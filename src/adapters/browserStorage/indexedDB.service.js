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
                                indexName = model.fields[field].index;
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
                $window.alert("A new version of this page is ready. Please reload!");
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

        indexedDBService.findOne = function (db, theModel, pk) {
            var dfd = $q.defer();

            var tx = db.transaction([theModel.dataSourceName]);
            var store = tx.objectStore(theModel.dataSourceName);
            var req = store.get(pk);

            req.onsuccess = function () {
                if (req.result) {
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

        indexedDBService.update = function (db, theModel, pk, modelInstance) {
            var dfd = $q.defer();

            var tx = db.transaction([theModel.dataSourceName], "readwrite");
            var store = tx.objectStore(theModel.dataSourceName);
            modelInstance[theModel.primaryKeyFieldName] = pk;

            var updateReq = store.put(modelInstance);
            updateReq.onsuccess = function () {
                dfd.resolve(modelInstance);
            };
            updateReq.onerror = function () {
                dfd.reject(this.error);
            };

            return dfd.promise;
        };

        indexedDBService.remove = function (db, theModel, pk) {
            var dfd = $q.defer();

            var tx = db.transaction([theModel.dataSourceName], "readwrite");
            var store = tx.objectStore(theModel.dataSourceName);

            var req = store.delete(pk);
            req.onsuccess = function () {
                dfd.resolve(null);
            };
            req.onerror = function () {
                dfd.reject(this.error);
            };

            return dfd.promise;
        };

        indexedDBService.findByAssociation = function (db, model, pk, mappedBy) {
            var dfd = $q.defer();

            var tx = db.transaction([model.dataSourceName]);
            var store = tx.objectStore(model.dataSourceName);
            var index = store.index(mappedBy);
            var req = index.openCursor();
            var results = [];

            req.onsuccess = function (event) {
                var cursor = event.target.result;
                if (cursor) {
                    if (!cursor.value[model.deletedFieldName] && cursor.key === pk) {
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

        return indexedDBService;

    }
]);