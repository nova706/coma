angular.module('recall.adapter.browserStorage').factory('recallIndexedDBService', [
    '$q',
    '$window',
    'recall',

    function ($q, $window, recall) {

        var indexedDBService = {};

        indexedDBService.migrate = function (db) {
            var i;
            var model;
            var field;
            var indexName;
            var objectStore;
            var models = recall.getModels();
            for (i = 0; i < models.length; i++) {
                model = models[i];

                if (!db.objectStoreNames.contains(model.dataSourceName)) {
                    objectStore = db.createObjectStore(model.dataSourceName, { keyPath: model.primaryKeyFieldName });
                    for (field in model.fields) {
                        if (model.fields.hasOwnProperty(field)) {
                            if (model.fields[field].unique === true || model.fields[field].index !== false) {
                                indexName = (model.fields[field].index === true) ? field : model.fields[field].index;
                                objectStore.createIndex(field, indexName, { unique: model.fields[field].unique });
                            }
                        }
                    }
                }
            }
        };

        // Handler for when the DB version is changed in another tab
        indexedDBService.handleVersionChange = function (db) {
            db.onversionchange = function () {
                db.close();
                alert("A new version of this page is ready. Please reload!");
            };
        };

        indexedDBService.connect = function (dbName, dbVersion) {
            var dfd = $q.defer();

            var openRequest = $window.indexedDB.open(dbName, dbVersion);

            openRequest.onupgradeneeded = function (event) {
                indexedDBService.handleVersionChange(event.target.result);
                indexedDBService.migrate(event.target.result);
                dfd.resolve(event.target.result);
            };

            openRequest.onsuccess = function (event) {
                indexedDBService.handleVersionChange(event.target.result);
                dfd.resolve(event.target.result);
            };

            openRequest.onerror = function (event) {
                dfd.reject(event.target.errorCode);
            };

            return dfd.promise;
        };

        indexedDBService.create = function (db, theModel, modelInstance) {
            var dfd = $q.defer();

            var tx = db.transaction([theModel.dataSourceName], "readwrite");
            var store = tx.objectStore(theModel.dataSourceName);
            var req = store.add(modelInstance);

            req.onsuccess = function () {
                dfd.resolve(modelInstance);
            };

            req.onerror = function () {
                dfd.reject(this.error);
            };

            return dfd.promise;
        };

        indexedDBService.findOne = function (db, theModel, pk, includeDeleted) {
            var dfd = $q.defer();

            var tx = db.transaction([theModel.dataSourceName]);
            var store = tx.objectStore(theModel.dataSourceName);
            var req = store.get(pk);

            req.onsuccess = function () {
                if (req.result && (includeDeleted || !req.result[theModel.deletedFieldName])) {
                    dfd.resolve(req.result);
                } else {
                    dfd.resolve(null);
                }
            };
            req.onerror = function () {
                dfd.reject(this.error);
            };

            return dfd.promise;
        };

        indexedDBService.find = function (db, theModel, includeDeleted) {
            var dfd = $q.defer();

            var tx = db.transaction([theModel.dataSourceName]);
            var store = tx.objectStore(theModel.dataSourceName);
            var req = store.openCursor();
            var results = [];

            req.onsuccess = function (event) {
                var cursor = event.target.result;
                if (cursor) {
                    if (includeDeleted || !cursor.value[theModel.deletedFieldName]) {
                        results.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    dfd.resolve(results);
                }
            };
            req.onerror = function () {
                dfd.reject(this.error);
            };

            return dfd.promise;
        };

        indexedDBService.update = function (db, theModel, pk, modelInstance, includeDeleted) {
            var dfd = $q.defer();

            var tx = db.transaction([theModel.dataSourceName], "readwrite");
            var store = tx.objectStore(theModel.dataSourceName);
            var req = store.get(pk);

            req.onsuccess = function () {
                if (req.result && (includeDeleted || !req.result[theModel.deletedFieldName])) {
                    var result = req.result;
                    delete modelInstance[theModel.primaryKeyFieldName];
                    angular.extend(result, modelInstance);

                    // TODO: Convert all dates to ISO Format
                    result[theModel.lastModifiedFieldName] = new Date().toISOString();
                    result = theModel.getRawModelObject(result, false);

                    var updateReq = store.put(result);
                    updateReq.onsuccess = function () {
                        dfd.resolve(result);
                    };
                    updateReq.onerror = function () {
                        dfd.reject(this.error);
                    };
                } else {
                    dfd.resolve(null);
                }
            };
            req.onerror = function () {
                dfd.reject(this.error);
            };

            return dfd.promise;
        };

        indexedDBService.remove = function (db, theModel, pk) {
            var dfd = $q.defer();

            var tx = db.transaction([theModel.dataSourceName], "readwrite");
            var store = tx.objectStore(theModel.dataSourceName);
            var req = store.get(pk);

            req.onsuccess = function () {
                if (req.result && !req.result[theModel.deletedFieldName]) {
                    var result = req.result;

                    result[theModel.deletedFieldName] = true;
                    result[theModel.lastModifiedFieldName] = new Date().toISOString();

                    var updateReq = store.put(result);
                    updateReq.onsuccess = function () {
                        dfd.resolve(null);
                    };
                    updateReq.onerror = function () {
                        dfd.reject(this.error);
                    };
                }
            };
            req.onerror = function () {
                dfd.reject(this.error);
            };

            return dfd.promise;
        };

        indexedDBService.synchronize = function (db, theModel, merge, remove) {
            merge = merge || [];
            remove = remove || [];

            var tx = db.transaction([theModel.dataSourceName], "readwrite");
            var objectStore = tx.objectStore(theModel.dataSourceName);

            var i;
            var promises = [];
            for (i = 0; i < merge.length; i++) {
                promises.push(createOrUpdate(objectStore, theModel, merge[i]));
            }
            for (i = 0; i < remove.length; i++) {
                promises.push(hardRemove(objectStore, theModel, remove[i][theModel.primaryKeyFieldName]));
            }

            return $q.all(promises);
        };

        indexedDBService.expandHasOne = function (db, model, result, association) {
            var dfd = $q.defer();

            var tx = db.transaction([model.dataSourceName]);
            var store = tx.objectStore(model.dataSourceName);
            var req = store.get(result[association.mappedBy]);

            req.onsuccess = function () {
                if (req.result && !req.result[model.deletedFieldName]) {
                    dfd.resolve(req.result);
                } else {
                    dfd.resolve(null);
                }
            };
            req.onerror = function () {
                dfd.reject(this.error);
            };

            return dfd.promise;
        };

        indexedDBService.expandHasMany = function (db, model, result, association) {
            var dfd = $q.defer();

            var tx = db.transaction([model.dataSourceName]);
            var store = tx.objectStore(model.dataSourceName);
            var index = store.index(association.mappedBy);
            var req = index.openCursor();
            var results = [];

            req.onsuccess = function (event) {
                var cursor = event.target.result;
                if (cursor) {
                    if (!cursor.value[model.deletedFieldName] && cursor.key === result[model.primaryKeyFieldName]) {
                        results.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    dfd.resolve(results);
                }
            };
            req.onerror = function () {
                dfd.reject(this.error);
            };

            return dfd.promise;
        };

        var createOrUpdate = function (objectStore, theModel, modelInstance) {
            var dfd = $q.defer();

            var req = objectStore.get(modelInstance[theModel.primaryKeyFieldName]);
            req.onsuccess = function () {
                var result = req.result;
                if (result) {
                    angular.extend(result, modelInstance);
                    result = theModel.getRawModelObject(result, false);

                    var updateReq = objectStore.put(result);
                    updateReq.onsuccess = function () {
                        dfd.resolve(result);
                    };
                    updateReq.onerror = function () {
                        dfd.reject(this.error);
                    };
                } else {
                    var createReq = objectStore.add(modelInstance);
                    createReq.onsuccess = function () {
                        dfd.resolve(modelInstance);
                    };
                    createReq.onerror = function () {
                        dfd.reject(this.error);
                    };
                }
            };
            req.onerror = function () {
                dfd.reject(this.error);
            };

            return dfd.promise;
        };

        var hardRemove = function (objectStore, theModel, pk) {
            var dfd = $q.defer();

            var req = objectStore.delete(pk);
            req.onsuccess = function () {
                dfd.resolve();
            };
            req.onerror = function () {
                dfd.reject(this.error);
            };

            return dfd.promise;
        };

        return indexedDBService;

    }
]);