angular.module('coma.adapter.indexedDB', ['coma']).provider('comaIndexedDBAdapter', [
    function () {

        var providerConfig = {};

        providerConfig.dbName = 'coma';
        this.setDbName = function (dbName) {
            providerConfig.dbName = dbName;
            return this;
        };

        providerConfig.dbVersion = 1;
        this.setDbVersion = function (dbVersion) {
            providerConfig.dbVersion = dbVersion;
            return this;
        };

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

        this.dropDatabase = function () {
            try {
                window.indexedDB.deleteDatabase(providerConfig.dbName);
            } catch (e) {
                return e;
            }
            return true;
        };

        this.$get = ['$log', '$q', '$window', 'coma', 'comaAdapterResponse', function ($log, $q, $window, coma, AdapterResponse) {

            var adapter = {};
            var db;

            var generatePrimaryKey = providerConfig.pkGenerator;

            var migrate = function (db) {
                var i;
                var model;
                var field;
                var indexName;
                var objectStore;
                var models = coma.getModels();
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

            var useDatabase = function (theDb) {
                db = theDb;

                // Make sure to add a handler to be notified if another page requests a version
                // change. We must close the database. This allows the other page to upgrade the database.
                // If you don't do this then the upgrade won't happen until the user closes the tab.
                db.onversionchange = function () {
                    db.close();
                    $log.error('IndexedDBAdapter: DB version changed in a different window');
                    alert("A new version of this page is ready. Please reload!");
                };
            };

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

            var getTablesFromExpandPath = function (theModel, expandPath) {
                var tables = [];
                var pathsToExpand = expandPath.split('.');
                var toExpand = pathsToExpand[0];
                if (toExpand) {
                    var association = theModel.getAssociationByAlias(toExpand);
                    var model = association.getModel();
                    if (association && model) {
                        tables.push(model.dataSourceName);
                        if (pathsToExpand.length > 1) {
                            tables = tables.concat(getTablesFromExpandPath(model, pathsToExpand.substring(pathsToExpand.indexOf('.') + 1)));
                        }
                    }
                }
                return tables;
            };

            var getTablesFromQueryOptions = function (theModel, queryOptions) {
                var tables = [];
                var $expand;

                if (queryOptions) {
                    $expand = queryOptions.$expand();
                }
                if ($expand) {
                    var paths = $expand.split(',');
                    var i;
                    for (i = 0; i < paths.length; i++) {
                        tables = tables.concat(getTablesFromExpandPath(theModel, paths[i]));
                    }
                }
                return tables;
            };

            var expandPath = function (result, theModel, pathToExpand, tx) {
                var dfd = $q.defer();
                var pathsToExpand = pathToExpand.split('.');
                var toExpand = pathsToExpand[0];

                if (toExpand) {
                    var association = theModel.getAssociationByAlias(toExpand);
                    var model = association.getModel();
                    if (association && model) {
                        var store = tx.objectStore(model.dataSourceName);
                        var req;
                        if (association.type === 'hasOne' && result[association.foreignKey] !== undefined) {
                            req = store.get(result[association.foreignKey]);

                            req.onsuccess = function () {
                                result[association.alias] = req.result;
                                if (pathsToExpand.length > 1) {
                                    expandPath(req.result, theModel, pathToExpand.substring(pathToExpand.indexOf('.') + 1), tx).then(function () {
                                        dfd.resolve();
                                    }, function (e) {
                                        dfd.reject(e);
                                    });
                                } else {
                                    dfd.resolve();
                                }
                            };
                            req.onerror = function () {
                                dfd.reject(this.error);
                            };
                        } else if (association.type === 'hasMany') {
                            var index = store.index(association.mappedBy);
                            req = index.openCursor();
                            var results = [];

                            req.onsuccess = function (event) {
                                var cursor = event.target.result;
                                if (cursor) {
                                    if (cursor.key === result[theModel.primaryKeyFieldName]) {
                                        results.push(cursor.value);
                                    }
                                    cursor.continue();
                                } else {
                                    result[association.alias] = results;
                                    if (pathsToExpand.length > 1) {
                                        var i;
                                        var promises = [];
                                        for (i = 0; i < results.length; i++) {
                                            promises.push(expandPath(results[i], theModel, pathToExpand.substring(pathToExpand.indexOf('.') + 1), tx));
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
                        }
                    } else {
                        dfd.resolve();
                    }
                } else {
                    dfd.resolve();
                }
                return dfd.promise;
            };

            var performExpand = function (result, theModel, queryOptions, tx) {
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
                        promises.push(expandPath(result, theModel, paths[i], tx));
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

            var resultMatchesFilters = function (result, predicate) {
                return predicate.test(result);
            };

            var applyFilter = function (results, filterPredicate) {
                if (filterPredicate && results) {
                    results.filter(function (a) {
                        return resultMatchesFilters(a, filterPredicate);
                    });
                }
                return results;
            };

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

            adapter.create = function (theModel, modelInstance) {
                var dfd = $q.defer();
                var response;

                var buildError = function (e) {
                    response = new AdapterResponse(e, 0, AdapterResponse.INTERNAL_SERVER_ERROR);
                    $log.error('IndexedDBAdapter: Create ' + theModel.modelName, response, modelInstance);
                    return response;
                };

                modelInstance[theModel.primaryKeyFieldName] = generatePrimaryKey();

                // TODO: Manage Cascade Create
                modelInstance = theModel.getRawModelObject(modelInstance, false);

                connect().then(function () {
                    var tables = [theModel.dataSourceName];
                    var tx = db.transaction(tables, "readwrite");
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

            adapter.findOne = function (theModel, pk, queryOptions) {
                var dfd = $q.defer();
                var response;

                var buildError = function (e, status) {
                    response = new AdapterResponse(e, 0, status || AdapterResponse.INTERNAL_SERVER_ERROR);
                    $log.error('IndexedDBAdapter: FindOne ' + theModel.modelName, response, pk, queryOptions);
                    return response;
                };

                connect().then(function () {
                    var tables = [theModel.dataSourceName].concat(getTablesFromQueryOptions(theModel, queryOptions));
                    var tx = db.transaction(tables);
                    var store = tx.objectStore(theModel.dataSourceName);
                    var req = store.get(pk);

                    // TODO: Apply Select
                    req.onsuccess = function () {
                        if (req.result) {
                            performExpand(req.result, theModel, queryOptions, tx).then(function () {
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

            adapter.find = function (theModel, queryOptions) {
                var dfd = $q.defer();
                var response;

                var buildError = function (e) {
                    response = new AdapterResponse(e, 0, AdapterResponse.INTERNAL_SERVER_ERROR);
                    $log.error('IndexedDBAdapter: Find ' + theModel.modelName, response, queryOptions);
                    return response;
                };

                connect().then(function () {
                    // TODO: Filter using an index if possible
                    var tables = [theModel.dataSourceName].concat(getTablesFromQueryOptions(theModel, queryOptions));
                    var tx = db.transaction(tables);
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
                            if (filterPredicate) {
                                if (resultMatchesFilters(cursor.value, filterPredicate)) {
                                    results.push(cursor.value);
                                }
                            } else {
                                results.push(cursor.value);
                            }
                            cursor.continue();
                        } else {
                            var i;
                            var promises = [];
                            for (i = 0; i < results.length; i++) {
                                promises.push(performExpand(results[i], theModel, queryOptions, tx));
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

            adapter.update = function (theModel, pk, modelInstance) {
                var dfd = $q.defer();
                var response;

                var buildError = function (e) {
                    response = new AdapterResponse(e, 0, AdapterResponse.INTERNAL_SERVER_ERROR);
                    $log.error('IndexedDBAdapter: Update ' + theModel.modelName, response, modelInstance);
                    return response;
                };

                connect().then(function () {
                    var tables = [theModel.dataSourceName];
                    var tx = db.transaction(tables, "readwrite");
                    var store = tx.objectStore(theModel.dataSourceName);
                    var req = store.get(pk);
                    req.onsuccess = function () {
                        var result = req.result;
                        delete modelInstance[theModel.primaryKeyFieldName];
                        angular.extend(result, modelInstance);

                        // TODO: Manage Cascade Create/Update/Delete
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
                    };
                    req.onerror = function () {
                        dfd.reject(buildError(this.error));
                    };

                }, function (e) {
                    dfd.reject(buildError(e));
                });
                return dfd.promise;
            };

            // TODO: Cascade Delete
            adapter.remove = function (theModel, pk) {
                var dfd = $q.defer();
                var response;

                var buildError = function (e) {
                    response = new AdapterResponse(e, 0, AdapterResponse.INTERNAL_SERVER_ERROR);
                    $log.error('IndexedDBAdapter: Remove ' + theModel.modelName, response);
                    return response;
                };

                connect().then(function () {
                    var tables = [theModel.dataSourceName];
                    var tx = db.transaction(tables, "readwrite");
                    var store = tx.objectStore(theModel.dataSourceName);
                    var req = store.delete(pk);
                    req.onsuccess = function () {
                        response = new AdapterResponse(null, 1, AdapterResponse.NO_CONTENT);
                        $log.debug('IndexedDBAdapter: Remove ' + theModel.modelName, response);
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

            adapter.synchronize = function (theModel, dataToSync) {
                var dfd = $q.defer();
                var response;

                var buildError = function (e) {
                    response = new AdapterResponse(e, 0, AdapterResponse.INTERNAL_SERVER_ERROR);
                    $log.error('IndexedDBAdapter: Synchronize ' + theModel.modelName, response, dataToSync);
                    return response;
                };

                connect().then(function () {
                    var tables = [theModel.dataSourceName];
                    var tx = db.transaction(tables, "readwrite");
                    var store = tx.objectStore(theModel.dataSourceName);

                    var i;
                    var promises = [];
                    for (i = 0; i < dataToSync.length; i++) {
                        promises.push(createOrUpdate(theModel, store, dataToSync[i]));
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

            return adapter;
        }];
    }
]);