/**
 * Due to an iOS 8 bug in IndexedDB, a transaction cannot open multiple data stores at the same time: https://bugs.webkit.org/show_bug.cgi?id=136937
 * As a "Fix", transactions will only ever only open a single objectStore and multiple transactions will be used.
 * Impact to performance and stability is not yet known.
 */

angular.module('recall.adapter.indexedDB', ['recall']).provider('recallIndexedDBAdapter', [
    function () {

        var providerConfig = {};

        // Sets the name of the IndexedDB database to use
        providerConfig.dbName = 'recall';
        this.setDbName = function (dbName) {
            providerConfig.dbName = dbName;
            return this;
        };

        // Sets the version of the IndexedDB to use
        providerConfig.dbVersion = 1;
        this.setDbVersion = function (dbVersion) {
            providerConfig.dbVersion = dbVersion;
            return this;
        };

        // Sets the default function to be used as a "GUID" generator
        providerConfig.pkGenerator = function () {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }

            return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
                s4() + '-' + s4() + s4() + s4();
        };
        this.setPkGenerator = function (pkGenerator) {
            providerConfig.pkGenerator = pkGenerator;
            return this;
        };

        // Drops the IndexedDB database
        this.dropDatabase = function () {
            try {
                window.indexedDB.deleteDatabase(providerConfig.dbName);
            } catch (e) {
                return e;
            }
            return true;
        };

        this.$get = [
            '$log',
            '$q',
            '$window',
            'recall',
            'recallAdapterResponse',

            function ($log, $q, $window, recall, AdapterResponse) {

                var adapter = {};
                var db;

                var generatePrimaryKey = providerConfig.pkGenerator;

                // Handles version differences in the database and initializes or migrates the db
                var migrate = function (db) {
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

                // Sets the database to use in the adapter
                var useDatabase = function (theDb) {
                    db = theDb;

                    // Handler for when the DB version is changed in another tab
                    db.onversionchange = function () {
                        db.close();
                        $log.error('IndexedDBAdapter: DB version changed in a different window');
                        alert("A new version of this page is ready. Please reload!");
                    };
                };

                // Connects to the database
                var connect = function () {
                    var dfd = $q.defer();

                    if (db) {
                        dfd.resolve(db);
                    } else {
                        var openRequest = $window.indexedDB.open(providerConfig.dbName, providerConfig.dbVersion);

                        openRequest.onupgradeneeded = function (event) {
                            $log.info('IndexedDBAdapter: Migrating...', event);
                            useDatabase(event.target.result);
                            migrate(event.target.result);
                        };

                        openRequest.onsuccess = function (event) {
                            $log.debug('IndexedDBAdapter: Connection Success', event);
                            useDatabase(event.target.result);
                            dfd.resolve(db);
                        };

                        openRequest.onerror = function (event) {
                            $log.error('IndexedDBAdapter: Connection Error', event);
                            dfd.reject(event.target.errorCode);
                        };
                    }

                    return dfd.promise;
                };

                // TODO: Cascade Delete: Cannot do proper cascades until iOS fixes the bug in IndexedDB where a transaction cannot open multiple stores
                /**
                 * Creates a new Entity
                 * @param {Object} theModel The model of the entity to create
                 * @param {Object} modelInstance The entity to create
                 * @returns {promise} Resolved with an AdapterResponse
                 */
                adapter.create = function (theModel, modelInstance) {
                    var dfd = $q.defer();
                    var response;

                    var buildError = function (e) {
                        response = new AdapterResponse(e, 0, AdapterResponse.INTERNAL_SERVER_ERROR);
                        $log.error('IndexedDBAdapter: Create ' + theModel.modelName, response, modelInstance);
                        return response;
                    };

                    modelInstance[theModel.primaryKeyFieldName] = generatePrimaryKey();
                    modelInstance = theModel.getRawModelObject(modelInstance, false);

                    // TODO: Store all dates in ISO format
                    modelInstance[theModel.lastModifiedFieldName] = new Date().toISOString();

                    connect().then(function () {
                        var tx = db.transaction([theModel.dataSourceName], "readwrite");
                        var store = tx.objectStore(theModel.dataSourceName);
                        var req = store.add(modelInstance);
                        req.onsuccess = function () {
                            response = new AdapterResponse(modelInstance, 1, AdapterResponse.CREATED);
                            $log.debug('IndexedDBAdapter: Create ' + theModel.modelName, response);
                            dfd.resolve(response);
                        };
                        req.onerror = function () {
                            dfd.reject(buildError(this.error));
                        };
                    }, function (e) {
                        dfd.reject(buildError(e));
                    });

                    return dfd.promise;
                };

                /**
                 * Finds a single entity given a primary key
                 * @param {Object} theModel The model of the entity to find
                 * @param {String|Number} pk The primary key of the entity to find
                 * @param {PreparedQueryOptions} [queryOptions] The query options to use for $expand
                 * @param {Boolean} [includeDeleted=false] If true, includes soft-deleted entities
                 * @returns {promise} Resolved with an AdapterResponse
                 */
                adapter.findOne = function (theModel, pk, queryOptions, includeDeleted) {
                    var dfd = $q.defer();
                    var response;

                    var buildError = function (e, status) {
                        response = new AdapterResponse(e, 0, status || AdapterResponse.INTERNAL_SERVER_ERROR);
                        $log.error('IndexedDBAdapter: FindOne ' + theModel.modelName, response, pk, queryOptions);
                        return response;
                    };

                    connect().then(function () {
                        var tx = db.transaction([theModel.dataSourceName]);
                        var store = tx.objectStore(theModel.dataSourceName);
                        var req = store.get(pk);

                        // TODO: Apply Select
                        req.onsuccess = function () {
                            if (req.result && (includeDeleted || !req.result[theModel.deletedFieldName])) {
                                performExpand(req.result, theModel, queryOptions, db).then(function () {
                                    response = new AdapterResponse(req.result, 1);
                                    $log.debug('IndexedDBAdapter: FindOne ' + theModel.modelName, response, pk, queryOptions);
                                    dfd.resolve(response);
                                }, function (e) {
                                    dfd.reject(buildError(e));
                                });
                            } else {
                                dfd.reject(buildError('Not Found', AdapterResponse.NOT_FOUND));
                            }
                        };
                        req.onerror = function () {
                            dfd.reject(buildError(this.error));
                        };
                    }, function (e) {
                        dfd.reject(buildError(e));
                    });
                    return dfd.promise;
                };

                /**
                 * Finds a set of Model entities
                 * @param {Object} theModel The model of the entities to find
                 * @param {PreparedQueryOptions} [queryOptions] The query options to use
                 * @param {Boolean} [includeDeleted=false] If true, includes soft-deleted entities
                 * @returns {promise} Resolved with an AdapterResponse
                 */
                adapter.find = function (theModel, queryOptions, includeDeleted) {
                    var dfd = $q.defer();
                    var response;

                    var buildError = function (e) {
                        response = new AdapterResponse(e, 0, AdapterResponse.INTERNAL_SERVER_ERROR);
                        $log.error('IndexedDBAdapter: Find ' + theModel.modelName, response, queryOptions);
                        return response;
                    };

                    connect().then(function () {
                        // TODO: Filter using an index if possible
                        var tx = db.transaction([theModel.dataSourceName]);
                        var store = tx.objectStore(theModel.dataSourceName);
                        var req = store.openCursor();
                        var results = [];
                        var filterPredicate;

                        if (queryOptions && queryOptions.$filter()) {
                            filterPredicate = queryOptions.$filter();
                        }

                        // TODO: Apply Select
                        req.onsuccess = function (event) {
                            var cursor = event.target.result;
                            if (cursor) {
                                if (includeDeleted || !cursor.value[theModel.deletedFieldName]) {
                                    if (filterPredicate) {
                                        if (resultMatchesFilters(cursor.value, filterPredicate)) {
                                            results.push(cursor.value);
                                        }
                                    } else {
                                        results.push(cursor.value);
                                    }
                                }
                                cursor.continue();
                            } else {
                                var i;
                                var promises = [];
                                for (i = 0; i < results.length; i++) {
                                    promises.push(performExpand(results[i], theModel, queryOptions, db));
                                }
                                $q.all(promises).then(function () {
                                    results = applyFilter(results, filterPredicate);
                                    results = applyOrderBy(results, queryOptions);

                                    var totalCount = results.length;

                                    // TODO: This is not very efficient but indexedDB does not seem to support a better way with filters and ordering
                                    results = applyPaging(results, queryOptions);
                                    response = new AdapterResponse(results, totalCount);

                                    $log.debug('IndexedDBAdapter: Find ' + theModel.modelName, response, queryOptions);
                                    dfd.resolve(response);
                                }, function (e) {
                                    dfd.reject(buildError(e));
                                });
                            }
                        };
                        req.onerror = function () {
                            dfd.reject(buildError(this.error));
                        };
                    }, function (e) {
                        dfd.reject(buildError(e));
                    });
                    return dfd.promise;
                };

                // TODO: Cascade Update: Cannot do proper cascades until iOS fixes the bug in IndexedDB where a transaction cannot open multiple stores
                /**
                 * Updates a Model entity given the primary key of the entity
                 * @param {Object} theModel The model of the entity to update
                 * @param {String|Number} pk The primary key of the entity
                 * @param {Object} modelInstance The entity to update
                 * @param {Boolean} [includeDeleted=false] If true, includes soft-deleted entities
                 * @returns {promise} Resolved with an AdapterResponse
                 */
                adapter.update = function (theModel, pk, modelInstance, includeDeleted) {
                    var dfd = $q.defer();
                    var response;

                    var buildError = function (e) {
                        response = new AdapterResponse(e, 0, AdapterResponse.INTERNAL_SERVER_ERROR);
                        $log.error('IndexedDBAdapter: Update ' + theModel.modelName, response, modelInstance);
                        return response;
                    };

                    connect().then(function () {
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
                                    response = new AdapterResponse(result, 1);
                                    $log.debug('IndexedDBAdapter: Update ' + theModel.modelName, response, modelInstance);
                                    dfd.resolve(response);
                                };
                                updateReq.onerror = function () {
                                    dfd.reject(buildError(this.error));
                                };
                            } else {
                                dfd.reject(buildError('Not Found', AdapterResponse.NOT_FOUND));
                            }
                        };
                        req.onerror = function () {
                            dfd.reject(buildError(this.error));
                        };

                    }, function (e) {
                        dfd.reject(buildError(e));
                    });
                    return dfd.promise;
                };

                // TODO: Cascade Delete: Cannot do proper cascades until iOS fixes the bug in IndexedDB where a transaction cannot open multiple stores
                /**
                 * Removes an Entity given the primary key of the entity to remove
                 * @param {Object} theModel The model of the entity to remove
                 * @param {String|Number} pk The primary key of the entity
                 * @returns {promise} Resolved with an AdapterResponse
                 */
                adapter.remove = function (theModel, pk) {
                    var dfd = $q.defer();
                    var response;

                    var buildError = function (e) {
                        response = new AdapterResponse(e, 0, AdapterResponse.INTERNAL_SERVER_ERROR);
                        $log.error('IndexedDBAdapter: Remove ' + theModel.modelName, response);
                        return response;
                    };

                    connect().then(function () {
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
                                    response = new AdapterResponse(null, 1, AdapterResponse.NO_CONTENT);
                                    $log.debug('IndexedDBAdapter: Remove ' + theModel.modelName, response);
                                    dfd.resolve(response);
                                };
                                updateReq.onerror = function () {
                                    dfd.reject(buildError(this.error));
                                };
                            } else {
                                dfd.reject(buildError('Not Found', AdapterResponse.NOT_FOUND));
                            }
                        };
                        req.onerror = function () {
                            dfd.reject(buildError(this.error));
                        };
                    }, function (e) {
                        dfd.reject(buildError(e));
                    });
                    return dfd.promise;
                };

                /**
                 * Takes an Array of entities and creates/updates/deletes them
                 * @param {Object} theModel The model of the entities to synchronize
                 * @param {Array} dataToSync An array of objects to create/update/delete
                 * @returns {promise} Resolved with an AdapterResponse
                 */
                adapter.synchronize = function (theModel, dataToSync) {
                    var dfd = $q.defer();
                    var response;

                    var buildError = function (e) {
                        response = new AdapterResponse(e, 0, AdapterResponse.INTERNAL_SERVER_ERROR);
                        $log.error('IndexedDBAdapter: Synchronize ' + theModel.modelName, response, dataToSync);
                        return response;
                    };

                    connect().then(function () {
                        var tx = db.transaction([theModel.dataSourceName], "readwrite");
                        var objectStore = tx.objectStore(theModel.dataSourceName);

                        var i;
                        var promises = [];
                        for (i = 0; i < dataToSync.length; i++) {
                            if (dataToSync[i][theModel.deletedFieldName]) {
                                promises.push(hardRemove(theModel, objectStore, dataToSync[i][theModel.primaryKeyFieldName]));
                            } else {
                                promises.push(createOrUpdate(theModel, objectStore, dataToSync[i]));
                            }
                        }

                        $q.all(promises).then(function (results) {
                            response = new AdapterResponse(results, results.length, AdapterResponse.OK);
                            $log.debug('IndexedDBAdapter: Synchronize ' + theModel.modelName, response, dataToSync);
                            dfd.resolve(response);
                        }, function (e) {
                            dfd.reject(buildError(e));
                        });
                    }, function (e) {
                        dfd.reject(buildError(e));
                    });
                    return dfd.promise;
                };

                // Creates a new Entity if not found or updates the existing one. Used in synchronization.
                var createOrUpdate = function (theModel, objectStore, modelInstance) {
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

                // Hard deletes an Entity. Used in synchronization.
                var hardRemove = function (theModel, objectStore, pk) {
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

                // Expands a has one model association
                var expandHasOne = function (model, result, association, db, pathsToExpand) {
                    var dfd = $q.defer();

                    if (result[association.mappedBy] === undefined) {
                        result[association.mappedBy] = null;
                        dfd.resolve();
                        return dfd.promise;
                    }

                    var tx = db.transaction([model.dataSourceName]);
                    var store = tx.objectStore(model.dataSourceName);
                    var pathToExpand = pathsToExpand.join('.');
                    var req = store.get(result[association.mappedBy]);

                    req.onsuccess = function () {
                        if (req.result && !req.result[model.deletedFieldName]) {
                            result[association.alias] = req.result;
                            if (pathsToExpand.length > 1) {
                                expandPath(req.result, model, pathToExpand.substring(pathToExpand.indexOf('.') + 1), db).then(function () {
                                    dfd.resolve();
                                }, function (e) {
                                    dfd.reject(e);
                                });
                            } else {
                                dfd.resolve();
                            }
                        } else {
                            result[association.alias] = null;
                            dfd.resolve();
                        }
                    };
                    req.onerror = function () {
                        dfd.reject(this.error);
                    };

                    return dfd.promise;
                };

                // Expands a has many model association
                var expandHasMany = function (model, result, association, db, pathsToExpand) {
                    var dfd = $q.defer();
                    var tx = db.transaction([model.dataSourceName]);
                    var store = tx.objectStore(model.dataSourceName);
                    var pathToExpand = pathsToExpand.join('.');
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

                            var filter = association.getOptions(result).$filter();
                            if (filter) {
                                results = applyFilter(results, filter);
                            }

                            result[association.alias] = results;
                            if (pathsToExpand.length > 1) {
                                var i;
                                var promises = [];
                                for (i = 0; i < results.length; i++) {
                                    promises.push(expandPath(results[i], model, pathToExpand.substring(pathToExpand.indexOf('.') + 1), db));
                                }
                                $q.all(promises).then(function () {
                                    dfd.resolve();
                                }, function (e) {
                                    dfd.reject(e);
                                });
                            } else {
                                dfd.resolve();
                            }
                        }
                    };
                    req.onerror = function () {
                        dfd.reject(this.error);
                    };

                    return dfd.promise;
                };

                // Expands a Model association given an expand path
                // Recursive
                var expandPath = function (result, theModel, pathToExpand, db) {
                    var pathsToExpand = pathToExpand.split('.');
                    var toExpand = pathsToExpand[0];

                    if (toExpand) {
                        var association = theModel.getAssociationByAlias(toExpand);
                        var model = association.getModel();
                        if (association && model) {
                            if (association.type === 'hasOne') {
                                return expandHasOne(model, result, association, db, pathsToExpand);
                            } else if (association.type === 'hasMany') {
                                return expandHasMany(model, result, association, db, pathsToExpand);
                            }
                        }
                    }

                    // There is nothing left to expand, just resolve.
                    var dfd = $q.defer();
                    dfd.resolve();
                    return dfd.promise;
                };

                // Expands all Model associations defined in the query options $expand clause
                var performExpand = function (result, theModel, queryOptions, db) {
                    var dfd = $q.defer();
                    var $expand;
                    var promises = [];

                    if (queryOptions) {
                        $expand = queryOptions.$expand();
                    }
                    if ($expand) {
                        var paths = $expand.split(',');
                        var i;
                        for (i = 0; i < paths.length; i++) {
                            promises.push(expandPath(result, theModel, paths[i], db));
                        }
                        $q.all(promises).then(function () {
                            dfd.resolve();
                        }, function (e) {
                            $log.error('IndexedDBAdapter: PerformExpand', e, $expand, result);
                            dfd.reject(e);
                        });
                    } else {
                        dfd.resolve();
                    }

                    return dfd.promise;
                };

                // Checks if a result matches a predicate filter
                var resultMatchesFilters = function (result, predicate) {
                    return predicate.test(result);
                };

                // Applies a filter predicate to a set of results and returns an array of the matching results
                var applyFilter = function (results, filterPredicate) {
                    if (filterPredicate && results) {
                        results = results.filter(function (a) {
                            return resultMatchesFilters(a, filterPredicate);
                        });
                    }
                    return results;
                };

                // Sorts the data given an $orderBy clause in query options
                var applyOrderBy = function (results, queryOptions) {
                    if (!queryOptions) {
                        return results;
                    }
                    var orderBy = queryOptions.$orderBy();
                    if (orderBy) {
                        var property = orderBy.split(' ')[0];
                        var direction = orderBy.split(' ')[1] || "";
                        results.sort(function (a, b) {
                            if (a[property] > b[property]) {
                                return (direction.toLowerCase() === 'desc') ? -1 : 1;
                            }
                            if (b[property] > a[property]) {
                                return (direction.toLowerCase() === 'desc') ? 1 : -1;
                            }
                            return 0;
                        });
                    }
                    return results;
                };

                // Applies paging to a set of results and returns a sliced array of results
                var applyPaging = function (results, queryOptions) {
                    if (!queryOptions) {
                        return results;
                    }
                    var top = queryOptions.$top();
                    var skip = queryOptions.$skip();
                    if (top > 0 && skip >= 0) {
                        results = results.slice(skip, skip + top);
                    }
                    return results;
                };

                return adapter;
            }
        ];
    }
]);