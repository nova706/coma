angular.module('recall.adapter.browserStorage', ['recall']).provider('recallBrowserStorageAdapter', [
    function () {

        var providerConfig = {};

        providerConfig.preferredBackend = 'indexedDB';
        this.preferIndexedDB = function () {
            providerConfig.preferredBackend = 'indexedDB';
            return this;
        };
        this.preferWebSQL = function () {
            providerConfig.preferredBackend = 'webSQL';
            return this;
        };

        // Sets the name of the database to use
        providerConfig.dbName = 'recall';
        this.setDbName = function (dbName) {
            providerConfig.dbName = dbName;
            return this;
        };

        // Sets the version of the database
        providerConfig.dbVersion = 1;
        this.setDbVersion = function (dbVersion) {
            providerConfig.dbVersion = dbVersion;
            return this;
        };

        // Sets the size of the database (WebSQL)
        providerConfig.dbSize = 5 * 1024 * 1024; // 5MB
        this.setDbSize = function (dbSize) {
            providerConfig.dbSize = dbSize;
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

        this.$get = [
            '$log',
            '$q',
            '$window',
            'recall',
            'recallAdapterResponse',
            'recallIndexedDBService',
            'recallWebSQLService',

            function ($log, $q, $window, recall, AdapterResponse, indexedDBService, webSQLService) {

                var adapter = {
                    service: null,
                    db: null
                };
                var connectionPromise;

                var generatePrimaryKey = providerConfig.pkGenerator;

                var init = function () {
                    if (providerConfig.preferredBackend === 'webSQL') {
                        if ($window.openDatabase !== undefined) {
                            adapter.service = webSQLService;
                        } else if ($window.indexedDB !== undefined) {
                            adapter.service = indexedDBService;
                        }
                    } else {
                        if ($window.indexedDB !== undefined) {
                            adapter.service = indexedDBService;
                        } else if ($window.openDatabase !== undefined) {
                            adapter.service = webSQLService;
                        }
                    }

                    if (!adapter.service) {
                        $log.error('BrowserStorageAdapter: IndexedDB and WebSQL are not available');
                    }
                };

                // Connects to the database
                var connect = function () {
                    var dfd = $q.defer();

                    if (adapter.db) {
                        dfd.resolve(adapter.db);
                    } else if (connectionPromise) {
                        return connectionPromise;
                    } else {
                        adapter.service.connect(providerConfig.dbName, providerConfig.dbVersion, providerConfig.dbSize).then(function (db) {
                            $log.debug('BrowserStorageAdapter: Database Connection Success');
                            adapter.db = db;
                            dfd.resolve(adapter.db);
                        }, function (e) {
                            $log.error('BrowserStorageAdapter: Database Connection Failed', e);
                            dfd.reject(e);
                        });
                    }

                    connectionPromise = dfd.promise;
                    return dfd.promise;
                };

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
                        $log.error('BrowserStorageAdapter: Create ' + theModel.modelName, response, modelInstance);
                        return response;
                    };

                    modelInstance[theModel.primaryKeyFieldName] = generatePrimaryKey();
                    modelInstance = theModel.getRawModelObject(modelInstance, false);

                    // TODO: Store all dates in ISO format
                    modelInstance[theModel.lastModifiedFieldName] = new Date().toISOString();

                    connect().then(function (db) {

                        adapter.service.create(db, theModel, modelInstance).then(function (result) {
                            response = new AdapterResponse(result, 1, AdapterResponse.CREATED);
                            $log.debug('BrowserStorageAdapter: Create ' + theModel.modelName, response);
                            dfd.resolve(response);
                        }, function (e) {
                            dfd.reject(buildError(e));
                        });

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
                        $log.error('BrowserStorageAdapter: FindOne ' + theModel.modelName, response, pk, queryOptions);
                        return response;
                    };

                    connect().then(function (db) {

                        adapter.service.findOne(db, theModel, pk, includeDeleted).then(function (result) {

                            if (result) {
                                performExpand(result, theModel, queryOptions, db).then(function () {
                                    response = new AdapterResponse(result, 1);
                                    $log.debug('BrowserStorageAdapter: FindOne ' + theModel.modelName, response, pk, queryOptions);
                                    dfd.resolve(response);
                                }, function (e) {
                                    dfd.reject(buildError(e));
                                });
                            } else {
                                dfd.reject(buildError('Not Found', AdapterResponse.NOT_FOUND));
                            }

                        }, function (e) {
                            dfd.reject(buildError(e));
                        });

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
                        $log.error('BrowserStorageAdapter: Find ' + theModel.modelName, response, queryOptions);
                        return response;
                    };

                    connect().then(function (db) {
                        var filterPredicate;

                        if (queryOptions && queryOptions.$filter()) {
                            filterPredicate = queryOptions.$filter();
                        }

                        adapter.service.find(db, theModel, includeDeleted).then(function (results) {

                            var i;
                            var promises = [];
                            for (i = 0; i < results.length; i++) {
                                promises.push(performExpand(results[i], theModel, queryOptions, db));
                            }
                            $q.all(promises).then(function () {
                                results = applyFilter(results, filterPredicate);
                                results = applyOrderBy(theModel, results, queryOptions);

                                var totalCount = results.length;
                                results = applyPaging(results, queryOptions);
                                response = new AdapterResponse(results, totalCount);

                                $log.debug('BrowserStorageAdapter: Find ' + theModel.modelName, response, queryOptions);
                                dfd.resolve(response);
                            }, function (e) {
                                dfd.reject(buildError(e));
                            });

                        }, function (e) {
                            dfd.reject(buildError(e));
                        });

                    }, function (e) {
                        dfd.reject(buildError(e));
                    });
                    return dfd.promise;
                };

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
                        $log.error('BrowserStorageAdapter: Update ' + theModel.modelName, response, modelInstance);
                        return response;
                    };

                    connect().then(function (db) {

                        adapter.service.update(db, theModel, pk, modelInstance, includeDeleted).then(function (result) {

                            if (result) {
                                response = new AdapterResponse(result, 1);
                                $log.debug('BrowserStorageAdapter: Update ' + theModel.modelName, response, modelInstance);
                                dfd.resolve(response);
                            } else {
                                dfd.reject(buildError('Not Found', AdapterResponse.NOT_FOUND));
                            }

                        }, function (e) {
                            dfd.reject(buildError(e));
                        });

                    }, function (e) {
                        dfd.reject(buildError(e));
                    });
                    return dfd.promise;
                };

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
                        $log.error('BrowserStorageAdapter: Remove ' + theModel.modelName, response);
                        return response;
                    };

                    connect().then(function (db) {

                        adapter.service.remove(db, theModel, pk).then(function () {
                            response = new AdapterResponse(null, 1, AdapterResponse.NO_CONTENT);
                            $log.debug('BrowserStorageAdapter: Remove ' + theModel.modelName, response);
                            dfd.resolve(response);
                        }, function (e) {
                            dfd.reject(buildError(e));
                        });

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
                        $log.error('BrowserStorageAdapter: Synchronize ' + theModel.modelName, response, dataToSync);
                        return response;
                    };

                    connect().then(function (db) {
                        var i;
                        var merge = [];
                        var remove = [];
                        for (i = 0; i < dataToSync.length; i++) {
                            if (dataToSync[i][theModel.deletedFieldName]) {
                                remove.push(dataToSync[i]);
                            } else {
                                merge.push(dataToSync[i]);
                            }
                        }

                        adapter.service.synchronize(db, theModel, merge, remove).then(function (results) {
                            response = new AdapterResponse(results, results.length, AdapterResponse.OK);
                            $log.debug('BrowserStorageAdapter: Synchronize ' + theModel.modelName, response, dataToSync);
                            dfd.resolve(response);
                        }, function (e) {
                            dfd.reject(buildError(e));
                        });
                    }, function (e) {
                        dfd.reject(buildError(e));
                    });
                    return dfd.promise;
                };

                // Expands a has one model association
                var expandHasOne = function (model, instance, association, db, pathsToExpand) {
                    var dfd = $q.defer();

                    if (instance[association.mappedBy] === undefined) {
                        instance[association.mappedBy] = null;
                        dfd.resolve();
                        return dfd.promise;
                    }

                    adapter.service.expandHasOne(db, model, instance, association).then(function (result) {

                        var pathToExpand = pathsToExpand.join('.');

                        if (result) {
                            instance[association.alias] = result;
                            if (pathsToExpand.length > 1) {
                                expandPath(result, model, pathToExpand.substring(pathToExpand.indexOf('.') + 1), db).then(function () {
                                    dfd.resolve();
                                }, function (e) {
                                    dfd.reject(e);
                                });
                            } else {
                                dfd.resolve();
                            }
                        } else {
                            instance[association.alias] = null;
                            dfd.resolve();
                        }
                    });

                    return dfd.promise;
                };

                // Expands a has many model association
                var expandHasMany = function (model, instance, association, db, pathsToExpand) {
                    var dfd = $q.defer();

                    adapter.service.expandHasMany(db, model, instance, association).then(function (results) {

                        var pathToExpand = pathsToExpand.join('.');
                        var filter = association.getOptions(instance).$filter();
                        if (filter) {
                            results = applyFilter(results, filter);
                        }

                        instance[association.alias] = results;
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

                    }, function (e) {
                        dfd.reject(e);
                    });

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
                            $log.error('BrowserStorageAdapter: PerformExpand', e, $expand, result);
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
                var applyOrderBy = function (theModel, results, queryOptions) {
                    if (!queryOptions) {
                        return results;
                    }
                    var orderBy = queryOptions.$orderBy();
                    if (orderBy) {
                        var property = orderBy.split(' ')[0];
                        var direction = orderBy.split(' ')[1] || "";
                        var isDate = false;

                        if (theModel.fields[property] && theModel.fields[property].type === "DATE") {
                            isDate = true;
                        }

                        results.sort(function (a, b) {
                            var aTest = a[property];
                            var bTest = b[property];

                            if (isDate) {
                                aTest = new Date(aTest);
                                bTest = new Date(bTest);
                            }

                            if (aTest > bTest) {
                                return (direction.toLowerCase() === 'desc') ? -1 : 1;
                            }
                            if (bTest > aTest) {
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

                init();

                return adapter;
            }
        ];
    }
]);