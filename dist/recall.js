/*! recallTests 23-03-2015 */
angular.module("recall", []);

angular.module("recall").factory("recallAdapterResponse", [ function() {
    /**
         * The AdapterResponse class represents a response that is coming back from an adapter. Every Adapter should
         * resolve and reject with a properly formed AdapterResponse so that the Model can handle the response.
         *
         * @param {Object|Array|String} data The raw data from the adapter or an error message
         * @param {Number} [count=0] The number of records affected by the action
         * @param {Number} [status=200] The status of the response
         * @param {Object} [headers] The response headers (used by $http)
         * @param {Object} [config] The configuration of the request (used by $http)
         * @constructor
         */
    var AdapterResponse = function(data, count, status, headers, config) {
        this.data = data;
        this.count = count || 0;
        this.status = status || AdapterResponse.OK;
        this.headers = headers;
        this.config = config;
    };
    // 2xx status codes used in OOTB adapters
    AdapterResponse.OK = 200;
    AdapterResponse.CREATED = 201;
    AdapterResponse.ACCEPTED = 202;
    AdapterResponse.NO_CONTENT = 204;
    // 4xx status codes used in OOTB adapters
    AdapterResponse.BAD_REQUEST = 400;
    AdapterResponse.UNAUTHORIZED = 401;
    AdapterResponse.NOT_FOUND = 404;
    AdapterResponse.CONFLICT = 409;
    // 5xx status codes used in OOTB adapters
    AdapterResponse.INTERNAL_SERVER_ERROR = 500;
    AdapterResponse.NOT_IMPLEMENTED = 501;
    return AdapterResponse;
} ]);

angular.module("recall.adapter.indexedDB", [ "recall" ]).provider("recallIndexedDBAdapter", [ function() {
    var providerConfig = {};
    // Sets the name of the IndexedDB database to use
    providerConfig.dbName = "recall";
    this.setDbName = function(dbName) {
        providerConfig.dbName = dbName;
        return this;
    };
    // Sets the version of the IndexedDB to use
    providerConfig.dbVersion = 1;
    this.setDbVersion = function(dbVersion) {
        providerConfig.dbVersion = dbVersion;
        return this;
    };
    // Sets the default function to be used as a "GUID" generator
    providerConfig.pkGenerator = function() {
        function s4() {
            return Math.floor((1 + Math.random()) * 65536).toString(16).substring(1);
        }
        return s4() + s4() + "-" + s4() + "-" + s4() + "-" + s4() + "-" + s4() + s4() + s4();
    };
    this.setPkGenerator = function(pkGenerator) {
        providerConfig.pkGenerator = pkGenerator;
        return this;
    };
    // Drops the IndexedDB database
    this.dropDatabase = function() {
        try {
            window.indexedDB.deleteDatabase(providerConfig.dbName);
        } catch (e) {
            return e;
        }
        return true;
    };
    this.$get = [ "$log", "$q", "$window", "recall", "recallAdapterResponse", function($log, $q, $window, recall, AdapterResponse) {
        var adapter = {};
        var db;
        var generatePrimaryKey = providerConfig.pkGenerator;
        // Handles version differences in the database and initializes or migrates the db
        var migrate = function(db) {
            var i;
            var model;
            var field;
            var indexName;
            var objectStore;
            var models = recall.getModels();
            for (i = 0; i < models.length; i++) {
                model = models[i];
                if (!db.objectStoreNames.contains(model.dataSourceName)) {
                    objectStore = db.createObjectStore(model.dataSourceName, {
                        keyPath: model.primaryKeyFieldName
                    });
                    for (field in model.fields) {
                        if (model.fields.hasOwnProperty(field)) {
                            if (model.fields[field].unique === true || model.fields[field].index !== false) {
                                indexName = model.fields[field].index === true ? field : model.fields[field].index;
                                objectStore.createIndex(field, indexName, {
                                    unique: model.fields[field].unique
                                });
                            }
                        }
                    }
                }
            }
        };
        // Sets the database to use in the adapter
        var useDatabase = function(theDb) {
            db = theDb;
            // Handler for when the DB version is changed in another tab
            db.onversionchange = function() {
                db.close();
                $log.error("IndexedDBAdapter: DB version changed in a different window");
                alert("A new version of this page is ready. Please reload!");
            };
        };
        // Connects to the database
        var connect = function() {
            var dfd = $q.defer();
            if (db) {
                dfd.resolve(db);
            } else {
                var openRequest = $window.indexedDB.open(providerConfig.dbName, providerConfig.dbVersion);
                openRequest.onupgradeneeded = function(event) {
                    $log.info("IndexedDBAdapter: Migrating...", event);
                    useDatabase(event.target.result);
                    migrate(event.target.result);
                };
                openRequest.onsuccess = function(event) {
                    $log.debug("IndexedDBAdapter: Connection Success", event);
                    useDatabase(event.target.result);
                    dfd.resolve(db);
                };
                openRequest.onerror = function(event) {
                    $log.error("IndexedDBAdapter: Connection Error", event);
                    dfd.reject(event.target.errorCode);
                };
            }
            return dfd.promise;
        };
        /**
                 * Creates a new Entity
                 * @param {Object} theModel The model of the entity to create
                 * @param {Object} modelInstance The entity to create
                 * @returns {promise} Resolved with an AdapterResponse
                 */
        adapter.create = function(theModel, modelInstance) {
            var dfd = $q.defer();
            var response;
            var buildError = function(e) {
                response = new AdapterResponse(e, 0, AdapterResponse.INTERNAL_SERVER_ERROR);
                $log.error("IndexedDBAdapter: Create " + theModel.modelName, response, modelInstance);
                return response;
            };
            modelInstance[theModel.primaryKeyFieldName] = generatePrimaryKey();
            // TODO: Manage Cascade Create
            modelInstance = theModel.getRawModelObject(modelInstance, false);
            // TODO: Store all dates in ISO format
            modelInstance[theModel.lastModifiedFieldName] = new Date().toISOString();
            connect().then(function() {
                var tables = [ theModel.dataSourceName ];
                var tx = db.transaction(tables, "readwrite");
                var store = tx.objectStore(theModel.dataSourceName);
                var req = store.add(modelInstance);
                req.onsuccess = function() {
                    response = new AdapterResponse(modelInstance, 1, AdapterResponse.CREATED);
                    $log.debug("IndexedDBAdapter: Create " + theModel.modelName, response);
                    dfd.resolve(response);
                };
                req.onerror = function() {
                    dfd.reject(buildError(this.error));
                };
            }, function(e) {
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
        adapter.findOne = function(theModel, pk, queryOptions, includeDeleted) {
            var dfd = $q.defer();
            var response;
            var buildError = function(e, status) {
                response = new AdapterResponse(e, 0, status || AdapterResponse.INTERNAL_SERVER_ERROR);
                $log.error("IndexedDBAdapter: FindOne " + theModel.modelName, response, pk, queryOptions);
                return response;
            };
            connect().then(function() {
                var tables = [ theModel.dataSourceName ].concat(getTablesFromQueryOptions(theModel, queryOptions));
                var tx = db.transaction(tables);
                var store = tx.objectStore(theModel.dataSourceName);
                var req = store.get(pk);
                // TODO: Apply Select
                req.onsuccess = function() {
                    if (req.result && (includeDeleted || !req.result[theModel.deletedFieldName])) {
                        performExpand(req.result, theModel, queryOptions, tx).then(function() {
                            response = new AdapterResponse(req.result, 1);
                            $log.debug("IndexedDBAdapter: FindOne " + theModel.modelName, response, pk, queryOptions);
                            dfd.resolve(response);
                        }, function(e) {
                            dfd.reject(buildError(e));
                        });
                    } else {
                        dfd.reject(buildError("Not Found", AdapterResponse.NOT_FOUND));
                    }
                };
                req.onerror = function() {
                    dfd.reject(buildError(this.error));
                };
            }, function(e) {
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
        adapter.find = function(theModel, queryOptions, includeDeleted) {
            var dfd = $q.defer();
            var response;
            var buildError = function(e) {
                response = new AdapterResponse(e, 0, AdapterResponse.INTERNAL_SERVER_ERROR);
                $log.error("IndexedDBAdapter: Find " + theModel.modelName, response, queryOptions);
                return response;
            };
            connect().then(function() {
                // TODO: Filter using an index if possible
                var tables = [ theModel.dataSourceName ].concat(getTablesFromQueryOptions(theModel, queryOptions));
                var tx = db.transaction(tables);
                var store = tx.objectStore(theModel.dataSourceName);
                var req = store.openCursor();
                var results = [];
                var filterPredicate;
                if (queryOptions && queryOptions.$filter()) {
                    filterPredicate = queryOptions.$filter();
                }
                // TODO: Apply Select
                req.onsuccess = function(event) {
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
                            promises.push(performExpand(results[i], theModel, queryOptions, tx));
                        }
                        $q.all(promises).then(function() {
                            results = applyFilter(results, filterPredicate);
                            results = applyOrderBy(results, queryOptions);
                            var totalCount = results.length;
                            // TODO: This is not very efficient but indexedDB does not seem to support a better way with filters and ordering
                            results = applyPaging(results, queryOptions);
                            response = new AdapterResponse(results, totalCount);
                            $log.debug("IndexedDBAdapter: Find " + theModel.modelName, response, queryOptions);
                            dfd.resolve(response);
                        }, function(e) {
                            dfd.reject(buildError(e));
                        });
                    }
                };
                req.onerror = function() {
                    dfd.reject(buildError(this.error));
                };
            }, function(e) {
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
        adapter.update = function(theModel, pk, modelInstance, includeDeleted) {
            var dfd = $q.defer();
            var response;
            var buildError = function(e) {
                response = new AdapterResponse(e, 0, AdapterResponse.INTERNAL_SERVER_ERROR);
                $log.error("IndexedDBAdapter: Update " + theModel.modelName, response, modelInstance);
                return response;
            };
            connect().then(function() {
                var tables = [ theModel.dataSourceName ];
                var tx = db.transaction(tables, "readwrite");
                var store = tx.objectStore(theModel.dataSourceName);
                var req = store.get(pk);
                req.onsuccess = function() {
                    if (req.result && (includeDeleted || !req.result[theModel.deletedFieldName])) {
                        var result = req.result;
                        delete modelInstance[theModel.primaryKeyFieldName];
                        angular.extend(result, modelInstance);
                        // TODO: Convert all dates to ISO Format
                        result[theModel.lastModifiedFieldName] = new Date().toISOString();
                        // TODO: Manage Cascade Create/Update/Delete
                        result = theModel.getRawModelObject(result, false);
                        var updateReq = store.put(result);
                        updateReq.onsuccess = function() {
                            response = new AdapterResponse(result, 1);
                            $log.debug("IndexedDBAdapter: Update " + theModel.modelName, response, modelInstance);
                            dfd.resolve(response);
                        };
                        updateReq.onerror = function() {
                            dfd.reject(buildError(this.error));
                        };
                    } else {
                        dfd.reject(buildError("Not Found", AdapterResponse.NOT_FOUND));
                    }
                };
                req.onerror = function() {
                    dfd.reject(buildError(this.error));
                };
            }, function(e) {
                dfd.reject(buildError(e));
            });
            return dfd.promise;
        };
        // TODO: Cascade Delete
        /**
                 * Removes an Entity given the primary key of the entity to remove
                 * @param {Object} theModel The model of the entity to remove
                 * @param {String|Number} pk The primary key of the entity
                 * @returns {promise} Resolved with an AdapterResponse
                 */
        adapter.remove = function(theModel, pk) {
            var dfd = $q.defer();
            var response;
            var buildError = function(e) {
                response = new AdapterResponse(e, 0, AdapterResponse.INTERNAL_SERVER_ERROR);
                $log.error("IndexedDBAdapter: Remove " + theModel.modelName, response);
                return response;
            };
            connect().then(function() {
                var tables = [ theModel.dataSourceName ];
                var tx = db.transaction(tables, "readwrite");
                var store = tx.objectStore(theModel.dataSourceName);
                var req = store.get(pk);
                req.onsuccess = function() {
                    if (req.result && !req.result[theModel.deletedFieldName]) {
                        var result = req.result;
                        result[theModel.deletedFieldName] = true;
                        result[theModel.lastModifiedFieldName] = new Date().toISOString();
                        var updateReq = store.put(result);
                        updateReq.onsuccess = function() {
                            response = new AdapterResponse(null, 1, AdapterResponse.NO_CONTENT);
                            $log.debug("IndexedDBAdapter: Remove " + theModel.modelName, response);
                            dfd.resolve(response);
                        };
                        updateReq.onerror = function() {
                            dfd.reject(buildError(this.error));
                        };
                    } else {
                        dfd.reject(buildError("Not Found", AdapterResponse.NOT_FOUND));
                    }
                };
                req.onerror = function() {
                    dfd.reject(buildError(this.error));
                };
            }, function(e) {
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
        adapter.synchronize = function(theModel, dataToSync) {
            var dfd = $q.defer();
            var response;
            var buildError = function(e) {
                response = new AdapterResponse(e, 0, AdapterResponse.INTERNAL_SERVER_ERROR);
                $log.error("IndexedDBAdapter: Synchronize " + theModel.modelName, response, dataToSync);
                return response;
            };
            connect().then(function() {
                var tables = [ theModel.dataSourceName ];
                var tx = db.transaction(tables, "readwrite");
                var i;
                var promises = [];
                for (i = 0; i < dataToSync.length; i++) {
                    if (dataToSync[i][theModel.deletedFieldName]) {
                        promises.push(hardRemove(theModel, tx, dataToSync[i][theModel.primaryKeyFieldName]));
                    } else {
                        promises.push(createOrUpdate(theModel, tx, dataToSync[i]));
                    }
                }
                $q.all(promises).then(function(results) {
                    response = new AdapterResponse(results, results.length, AdapterResponse.OK);
                    $log.debug("IndexedDBAdapter: Synchronize " + theModel.modelName, response, dataToSync);
                    dfd.resolve(response);
                }, function(e) {
                    dfd.reject(buildError(e));
                });
            }, function(e) {
                dfd.reject(buildError(e));
            });
            return dfd.promise;
        };
        // Creates a new Entity if not found or updates the existing one. Used in synchronization.
        var createOrUpdate = function(theModel, tx, modelInstance) {
            var dfd = $q.defer();
            var objectStore = tx.objectStore(theModel.dataSourceName);
            var req = objectStore.get(modelInstance[theModel.primaryKeyFieldName]);
            req.onsuccess = function() {
                var result = req.result;
                if (result) {
                    angular.extend(result, modelInstance);
                    result = theModel.getRawModelObject(result, false);
                    var updateReq = objectStore.put(result);
                    updateReq.onsuccess = function() {
                        dfd.resolve(result);
                    };
                    updateReq.onerror = function() {
                        dfd.reject(this.error);
                    };
                } else {
                    var createReq = objectStore.add(modelInstance);
                    createReq.onsuccess = function() {
                        dfd.resolve(modelInstance);
                    };
                    createReq.onerror = function() {
                        dfd.reject(this.error);
                    };
                }
            };
            req.onerror = function() {
                dfd.reject(this.error);
            };
            return dfd.promise;
        };
        // Hard deletes an Entity. Used in synchronization.
        var hardRemove = function(theModel, tx, pk) {
            var dfd = $q.defer();
            var store = tx.objectStore(theModel.dataSourceName);
            var req = store.delete(pk);
            req.onsuccess = function() {
                dfd.resolve();
            };
            req.onerror = function() {
                dfd.reject(this.error);
            };
            return dfd.promise;
        };
        // Given an expand path, finds all the DB tables required for the transaction
        // Recursive
        var getTablesFromExpandPath = function(theModel, expandPath) {
            var tables = [];
            var pathsToExpand = expandPath.split(".");
            var toExpand = pathsToExpand[0];
            if (toExpand) {
                var association = theModel.getAssociationByAlias(toExpand);
                var model = association.getModel();
                if (association && model) {
                    tables.push(model.dataSourceName);
                    if (pathsToExpand.length > 1) {
                        tables = tables.concat(getTablesFromExpandPath(model, pathsToExpand.substring(pathsToExpand.indexOf(".") + 1)));
                    }
                }
            }
            return tables;
        };
        // Given queryOptions, finds all the DB tables required for the transaction
        var getTablesFromQueryOptions = function(theModel, queryOptions) {
            var tables = [];
            var $expand;
            if (queryOptions) {
                $expand = queryOptions.$expand();
            }
            if ($expand) {
                var paths = $expand.split(",");
                var i;
                for (i = 0; i < paths.length; i++) {
                    tables = tables.concat(getTablesFromExpandPath(theModel, paths[i]));
                }
            }
            return tables;
        };
        // Expands a has one model association
        var expandHasOne = function(model, result, association, tx, pathsToExpand) {
            var dfd = $q.defer();
            var store = tx.objectStore(model.dataSourceName);
            var pathToExpand = pathsToExpand.join(".");
            var req = store.get(result[association.mappedBy]);
            req.onsuccess = function() {
                result[association.alias] = req.result;
                if (pathsToExpand.length > 1) {
                    expandPath(req.result, model, pathToExpand.substring(pathToExpand.indexOf(".") + 1), tx).then(function() {
                        dfd.resolve();
                    }, function(e) {
                        dfd.reject(e);
                    });
                } else {
                    dfd.resolve();
                }
            };
            req.onerror = function() {
                dfd.reject(this.error);
            };
            return dfd.promise;
        };
        // Expands a has many model association
        var expandHasMany = function(model, result, association, tx, pathsToExpand) {
            var dfd = $q.defer();
            var store = tx.objectStore(model.dataSourceName);
            var pathToExpand = pathsToExpand.join(".");
            var index = store.index(association.mappedBy);
            var req = index.openCursor();
            var results = [];
            req.onsuccess = function(event) {
                var cursor = event.target.result;
                if (cursor) {
                    if (cursor.key === result[model.primaryKeyFieldName]) {
                        results.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    result[association.alias] = results;
                    if (pathsToExpand.length > 1) {
                        var i;
                        var promises = [];
                        for (i = 0; i < results.length; i++) {
                            promises.push(expandPath(results[i], model, pathToExpand.substring(pathToExpand.indexOf(".") + 1), tx));
                        }
                        $q.all(promises).then(function() {
                            dfd.resolve();
                        }, function(e) {
                            dfd.reject(e);
                        });
                    } else {
                        dfd.resolve();
                    }
                }
            };
            req.onerror = function() {
                dfd.reject(this.error);
            };
            return dfd.promise;
        };
        // Expands a Model association given an expand path
        // Recursive
        var expandPath = function(result, theModel, pathToExpand, tx) {
            var pathsToExpand = pathToExpand.split(".");
            var toExpand = pathsToExpand[0];
            if (toExpand) {
                var association = theModel.getAssociationByAlias(toExpand);
                var model = association.getModel();
                if (association && model) {
                    if (association.type === "hasOne") {
                        return expandHasOne(model, result, association, tx, pathsToExpand);
                    } else if (association.type === "hasMany") {
                        return expandHasMany(model, result, association, tx, pathsToExpand);
                    }
                }
            }
            // There is nothing left to expand, just resolve.
            var dfd = $q.defer();
            dfd.resolve();
            return dfd.promise;
        };
        // Expands all Model associations defined in the query options $expand clause
        var performExpand = function(result, theModel, queryOptions, tx) {
            var dfd = $q.defer();
            var $expand;
            var promises = [];
            if (queryOptions) {
                $expand = queryOptions.$expand();
            }
            if ($expand) {
                var paths = $expand.split(",");
                var i;
                for (i = 0; i < paths.length; i++) {
                    promises.push(expandPath(result, theModel, paths[i], tx));
                }
                $q.all(promises).then(function() {
                    dfd.resolve();
                }, function(e) {
                    $log.error("IndexedDBAdapter: PerformExpand", e, $expand, result);
                    dfd.reject(e);
                });
            } else {
                dfd.resolve();
            }
            return dfd.promise;
        };
        // Checks if a result matches a predicate filter
        var resultMatchesFilters = function(result, predicate) {
            return predicate.test(result);
        };
        // Applies a filter predicate to a set of results and returns an array of the matching results
        var applyFilter = function(results, filterPredicate) {
            if (filterPredicate && results) {
                results.filter(function(a) {
                    return resultMatchesFilters(a, filterPredicate);
                });
            }
            return results;
        };
        // Sorts the data given an $orderBy clause in query options
        var applyOrderBy = function(results, queryOptions) {
            if (!queryOptions) {
                return results;
            }
            var orderBy = queryOptions.$orderBy();
            if (orderBy) {
                var property = orderBy.split(" ")[0];
                var direction = orderBy.split(" ")[1] || "";
                results.sort(function(a, b) {
                    if (a[property] > b[property]) {
                        return direction.toLowerCase() === "desc" ? -1 : 1;
                    }
                    if (b[property] > a[property]) {
                        return direction.toLowerCase() === "desc" ? 1 : -1;
                    }
                    return 0;
                });
            }
            return results;
        };
        // Applies paging to a set of results and returns a sliced array of results
        var applyPaging = function(results, queryOptions) {
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
    } ];
} ]);

angular.module("recall.adapter.oDataREST", [ "recall" ]).provider("recallODataRESTAdapter", [ function() {
    var providerConfig = {};
    // Sets the location of the server api endpoint
    providerConfig.serverAPILocation = "/api/";
    this.setServerAPILocation = function(serverAPILocation) {
        if (serverAPILocation.substring(serverAPILocation.length - 1) !== "/") {
            serverAPILocation += "/";
        }
        providerConfig.serverAPILocation = serverAPILocation;
        return this;
    };
    // Sets the name of the results property in the server's response
    providerConfig.resultsField = "results";
    this.setResultsField = function(resultsField) {
        providerConfig.resultsField = resultsField;
        return this;
    };
    // Sets the name of the total count property in the server's response
    providerConfig.totalCountFiled = "totalCount";
    this.setTotalCountFiled = function(totalCountFiled) {
        providerConfig.totalCountFiled = totalCountFiled;
        return this;
    };
    this.$get = [ "$http", "$log", "$q", "recallAdapterResponse", function($http, $log, $q, AdapterResponse) {
        var adapter = {};
        // Appends the query options to the URL
        var addOptionsToUrl = function(url, queryOptions) {
            url += queryOptions ? queryOptions.parseOptions() : "";
            return url;
        };
        /**
                 * Creates a new Entity
                 * @param {Object} theModel The model of the entity to create
                 * @param {Object} modelInstance The entity to create
                 * @returns {promise} Resolved with an AdapterResponse
                 */
        adapter.create = function(theModel, modelInstance) {
            var dfd = $q.defer();
            var response;
            var url = providerConfig.serverAPILocation + theModel.dataSourceName;
            $http.post(url, modelInstance).success(function(data, status, headers, config) {
                response = new AdapterResponse(data, 1, status, headers, config);
                $log.debug("ODataRESTAdapter: Create " + theModel.modelName, response);
                dfd.resolve(response);
            }).error(function(error, status, headers, config) {
                response = new AdapterResponse(error, 0, status, headers, config);
                $log.error("ODataRESTAdapter: Create " + theModel.modelName, response, modelInstance);
                dfd.reject(response);
            });
            return dfd.promise;
        };
        /**
                 * Finds a single entity given a primary key
                 * @param {Object} theModel The model of the entity to find
                 * @param {String|Number} pk The primary key of the entity to find
                 * @param {PreparedQueryOptions} [queryOptions] The query options to use for $expand
                 * @returns {promise} Resolved with an AdapterResponse
                 */
        adapter.findOne = function(theModel, pk, queryOptions) {
            var dfd = $q.defer();
            var response;
            if (!pk) {
                response = new AdapterResponse("No Primary Key was supplied", 0, AdapterResponse.BAD_REQUEST);
                $log.error("ODataRESTAdapter: FindOne " + theModel.modelName, response, pk, queryOptions);
                return $q.reject(response);
            }
            var url = addOptionsToUrl(providerConfig.serverAPILocation + theModel.dataSourceName + "/" + pk, queryOptions);
            $http.get(url).success(function(data, status, headers, config) {
                response = new AdapterResponse(data, 1, status, headers, config);
                $log.debug("ODataRESTAdapter: FindOne " + theModel.modelName, response, pk, queryOptions);
                dfd.resolve(response);
            }).error(function(error, status, headers, config) {
                response = new AdapterResponse(error, 0, status, headers, config);
                $log.error("ODataRESTAdapter: FindOne " + theModel.modelName, response, pk, queryOptions);
                dfd.reject(response);
            });
            return dfd.promise;
        };
        /**
                 * Finds a set of Model entities
                 * @param {Object} theModel The model of the entities to find
                 * @param {PreparedQueryOptions} [queryOptions] The query options to use
                 * @returns {promise} Resolved with an AdapterResponse
                 */
        adapter.find = function(theModel, queryOptions) {
            var dfd = $q.defer();
            var response;
            var url = addOptionsToUrl(providerConfig.serverAPILocation + theModel.dataSourceName);
            $http.get(url).success(function(data, status, headers, config) {
                var results = data;
                var totalCount;
                if (providerConfig.resultsField) {
                    if (data[providerConfig.resultsField]) {
                        results = data[providerConfig.resultsField];
                    }
                    if (providerConfig.totalCountFiled && data[providerConfig.totalCountFiled]) {
                        totalCount = data[providerConfig.totalCountFiled];
                    }
                }
                response = new AdapterResponse(results, totalCount, status, headers, config);
                $log.debug("ODataRESTAdapter: Find " + theModel.modelName, response, queryOptions);
                dfd.resolve(response);
            }).error(function(error, status, headers, config) {
                response = new AdapterResponse(error, 0, status, headers, config);
                $log.error("ODataRESTAdapter: Find " + theModel.modelName, response, queryOptions);
                dfd.reject(response);
            });
            return dfd.promise;
        };
        /**
                 * Updates a Model entity given the primary key of the entity
                 * @param {Object} theModel The model of the entity to update
                 * @param {String|Number} pk The primary key of the entity
                 * @param {Object} modelInstance The entity to update
                 * @returns {promise} Resolved with an AdapterResponse
                 */
        adapter.update = function(theModel, pk, modelInstance) {
            var dfd = $q.defer();
            var response;
            if (!pk) {
                response = new AdapterResponse("No Primary Key was supplied", 0, AdapterResponse.BAD_REQUEST);
                $log.error("ODataRESTAdapter: Update " + theModel.modelName, response, modelInstance);
                return $q.reject(response);
            }
            var url = providerConfig.serverAPILocation + theModel.dataSourceName + "/" + pk;
            $http.put(url, modelInstance).success(function(data, status, headers, config) {
                response = new AdapterResponse(data, 1, status, headers, config);
                $log.debug("ODataRESTAdapter: Update " + theModel.modelName, response, modelInstance);
                dfd.resolve(response);
            }).error(function(error, status, headers, config) {
                response = new AdapterResponse(error, 0, status, headers, config);
                $log.error("ODataRESTAdapter: Update " + theModel.modelName, response, modelInstance);
                dfd.reject(response);
            });
            return dfd.promise;
        };
        /**
                 * Removes an Entity given the primary key of the entity to remove
                 * @param {Object} theModel The model of the entity to remove
                 * @param {String|Number} pk The primary key of the entity
                 * @returns {promise} Resolved with an AdapterResponse
                 */
        adapter.remove = function(theModel, pk) {
            var dfd = $q.defer();
            var response;
            if (!pk) {
                response = new AdapterResponse("No Primary Key was supplied", 0, AdapterResponse.BAD_REQUEST);
                $log.error("ODataRESTAdapter: Remove " + theModel.modelName, response, pk);
                return $q.reject(response);
            }
            var url = providerConfig.serverAPILocation + theModel.dataSourceName + "/" + pk;
            $http({
                method: "DELETE",
                url: url
            }).success(function(data, status, headers, config) {
                response = new AdapterResponse(data, 1, status, headers, config);
                $log.debug("ODataRESTAdapter: Remove " + theModel.modelName, response, pk);
                dfd.resolve(response);
            }).error(function(error, status, headers, config) {
                response = new AdapterResponse(error, 0, status, headers, config);
                $log.error("ODataRESTAdapter: Remove " + theModel.modelName, response, pk);
                dfd.reject(response);
            });
            return dfd.promise;
        };
        /**
                 * Takes an Array of entities and creates/updates/deletes them
                 * @param {Object} theModel The model of the entities to synchronize
                 * @param {Array} dataToSync An array of objects to create/update/delete
                 * @returns {promise} Resolved with an AdapterResponse
                 */
        adapter.synchronize = function(theModel, dataToSync, lastSync) {
            var dfd = $q.defer();
            var response;
            var url = providerConfig.serverAPILocation + theModel.dataSourceName;
            $http.put(url, {
                data: dataToSync,
                lastSync: lastSync
            }).success(function(data, status, headers, config) {
                var results = data;
                var totalCount;
                if (providerConfig.resultsField) {
                    if (data[providerConfig.resultsField]) {
                        results = data[providerConfig.resultsField];
                    }
                    if (providerConfig.totalCountFiled && data[providerConfig.totalCountFiled]) {
                        totalCount = data[providerConfig.totalCountFiled];
                    }
                }
                response = new AdapterResponse(results, totalCount, status, headers, config);
                $log.debug("ODataRESTAdapter: Synchronize " + theModel.modelName, response, dataToSync);
                dfd.resolve(response);
            }).error(function(error, status, headers, config) {
                response = new AdapterResponse(error, 0, status, headers, config);
                $log.error("ODataRESTAdapter: Synchronize " + theModel.modelName, response, dataToSync);
                dfd.reject(response);
            });
            return dfd.promise;
        };
        return adapter;
    } ];
} ]);

angular.module("recall").factory("recallAssociation", [ "$log", "$q", "recallPredicate", "recallPreparedQueryOptions", function($log, $q, Predicate, PreparedQueryOptions) {
    /**
         * Association class
         * @param {Object|Association} definition
         * @constructor
         */
    var Association = function(definition) {
        this.invalid = false;
        if (definition.type) {
            this.type = definition.type;
        } else if (typeof definition.hasOne === "string") {
            this.type = "hasOne";
        } else if (typeof definition.hasMany === "string") {
            this.type = "hasMany";
        }
        this.modelName = definition.modelName || definition.hasOne || definition.hasMany;
        this.alias = definition.as || definition.alias || this.modelName;
        this.mappedBy = definition.mappedBy || definition.foreignKey;
        this.getModel = function() {
            return Association.getAssociationModel(this.modelName);
        };
        if (!this.modelName || !this.type || !this.mappedBy) {
            $log.error("Association: The association definition is invalid", definition);
            this.invalid = true;
        }
    };
    Association.prototype.expand = function(entity, remote) {
        var dfd = $q.defer();
        var self = this;
        var Model = self.getModel();
        if (!Model) {
            return $q.reject("Association: Expand could not find the association's Model");
        }
        var adapter = remote === true && Model.remoteAdapter ? Model.remoteAdapter : Model.localAdapter;
        if (self.type === "hasOne") {
            adapter.findOne(Model, entity[self.mappedBy]).then(function(response) {
                entity[self.alias] = Model.getRawModelObject(response.data);
                entity.$entity.storedState[self.alias] = Model.getRawModelObject(response.data);
                $log.debug("Association: Expand", self.type, self.alias, entity, response);
                dfd.resolve();
            }, function(e) {
                $log.error("Association: Expand", self.type, self.alias, entity, e);
                dfd.reject(e);
            });
        } else if (self.type === "hasMany") {
            var predicate = new Predicate(self.mappedBy).equals(entity.$getPrimaryKey());
            var queryOptions = new PreparedQueryOptions().$filter(predicate);
            adapter.find(Model, queryOptions).then(function(response) {
                var base = [];
                var stored = [];
                var i;
                for (i = 0; i < response.data.length; i++) {
                    base.push(Model.getRawModelObject(response.data[i]));
                    stored.push(Model.getRawModelObject(response.data[i]));
                }
                entity[self.alias] = base;
                entity.$entity.storedState[self.alias] = stored;
                $log.debug("Association: Expand", self.type, self.alias, entity, response);
                dfd.resolve();
            }, function(e) {
                $log.error("Association: Expand", self.type, self.alias, entity, e);
                dfd.reject(e);
            });
        }
        return dfd.promise();
    };
    // Implemented by the baseModelService
    Association.getAssociationModel = null;
    return Association;
} ]);

angular.module("recall").factory("recallBaseModelService", [ "$injector", "$log", "$q", "recallAssociation", "recallModelField", "recallPreparedQueryOptions", "recallPredicate", "recallSyncHandler", function($injector, $log, $q, Association, ModelField, PreparedQueryOptions, Predicate, syncHandler) {
    var baseModelService = {
        dirtyCheckThreshold: 30,
        lastModifiedFieldName: "",
        deletedFieldName: "",
        localAdapter: {},
        remoteAdapter: {},
        models: {}
    };
    // Bubbles an error promise to the top.
    var propagateError = function(e) {
        return $q.reject(e);
    };
    // Convenience class for logging.
    var RecallModel = function(model) {
        angular.extend(this, model);
    };
    // Convenience class for logging.
    var Response = function(response) {
        angular.extend(this, response);
    };
    // Convenience class for logging.
    var RawModelInstance = function() {
        return this;
    };
    // Initialize the getModel functions on the associations
    Association.getAssociationModel = function(modelName) {
        return baseModelService.getModel(modelName);
    };
    /**
         * Set the dirty check threshold used by the entity dirty checking
         * @param {Number} [dirtyCheckThreshold=30] in Milliseconds
         */
    baseModelService.setDirtyCheckThreshold = function(dirtyCheckThreshold) {
        baseModelService.dirtyCheckThreshold = dirtyCheckThreshold || 30;
    };
    /**
         * Sets the field to be used as the last modified field required for synchronization.
         * @param {String} lastModifiedFieldName
         */
    baseModelService.setLastModifiedFieldName = function(lastModifiedFieldName) {
        baseModelService.lastModifiedFieldName = lastModifiedFieldName;
    };
    /**
         * Sets the field to be used as the deleted field required for synchronization.
         * @param {String} deletedFieldName
         */
    baseModelService.setDeletedFieldName = function(deletedFieldName) {
        baseModelService.deletedFieldName = deletedFieldName;
    };
    /**
         * Sets the local adapter to use for retrieving data locally.
         * @param {Object|String} adapter The adapter object or the name of the adapter factory to inject.
         */
    baseModelService.setLocalAdapter = function(adapter) {
        baseModelService.localAdapter = adapter;
    };
    /**
         * Sets the default remote adapter to use for retrieving data remotely. This can be overridden by an individual model.
         * @param {Object|String} adapter The adapter object or the name of the adapter factory to inject.
         */
    baseModelService.setRemoteAdapter = function(adapter) {
        baseModelService.remoteAdapter = adapter;
    };
    /**
         * Get an array of the defined Models.
         * @returns {Entity[]} The models
         */
    baseModelService.getModels = function() {
        var theModels = [];
        var model;
        for (model in baseModelService.models) {
            if (baseModelService.models.hasOwnProperty(model)) {
                theModels.push(baseModelService.models[model]);
            }
        }
        return theModels;
    };
    /**
         * Gets a defined model by its name
         * @param {String} modelName
         * @returns {Entity} The model or null if the model is not found
         */
    baseModelService.getModel = function(modelName) {
        return baseModelService.models[modelName] || null;
    };
    /**
         * Creates a model based on a definition.
         * @param {Object} modelDefinition The definition of the model including fields and associations
         * @param {Object} [localAdapter] The adapter that is used to perform the CRUD actions locally
         * @param {Object} [remoteAdapter] The adapter that is used to perform the CRUD actions remotely
         * @returns {Entity} The model
         */
    baseModelService.defineModel = function(modelDefinition, localAdapter, remoteAdapter) {
        localAdapter = localAdapter || baseModelService.localAdapter;
        remoteAdapter = remoteAdapter || baseModelService.remoteAdapter;
        // If the adapter is a string, assume it is the name of the adapter factory and inject it
        localAdapter = typeof localAdapter === "string" ? $injector.get(localAdapter) : localAdapter;
        remoteAdapter = typeof remoteAdapter === "string" ? $injector.get(remoteAdapter) : remoteAdapter;
        // If there were no adapters set, then return out as the model can not be used.
        if (!remoteAdapter && !localAdapter) {
            return null;
        }
        // If there is a remoteAdapter but no local adapter, use the remote as the default.
        if (remoteAdapter && !localAdapter) {
            localAdapter = remoteAdapter;
            remoteAdapter = null;
        }
        // TODO: Validated the model definition
        if (!modelDefinition || !modelDefinition.name) {
            return null;
        }
        // If the model is already defined, just return it.
        if (baseModelService.models[modelDefinition.name]) {
            return baseModelService.models[modelDefinition.name];
        }
        /**
             * An Entity is an object that represents an instance of a Model. The class has basic CRUD operations as
             * well as some utilities. The Entity instance exposes save and move operations as well as dirty checking.
             *
             * @param {Object} object The object to construct the entity from
             * @param {Boolean} [persisted = false] Set to true if this model was created from an object that came
             *                                         from an adapter.
             * @param {Object} [adapter=localAdapter] The adapter used to fetch the Entity.
             * @constructor
             */
        var Entity = function(object, persisted, adapter) {
            Entity.extendFromRawObject(this, object);
            this.$entity = {
                adapter: adapter || localAdapter,
                lastDirtyCheck: new Date().getTime(),
                lastDirtyState: false,
                persisted: persisted === true,
                saveInProgress: false,
                storedState: null
            };
            this.$storeState();
        };
        Entity.fields = {};
        Entity.associations = [];
        Entity.primaryKeyFieldName = null;
        Entity.lastModifiedFieldName = baseModelService.lastModifiedFieldName;
        Entity.deletedFieldName = baseModelService.deletedFieldName;
        Entity.localAdapter = localAdapter;
        Entity.remoteAdapter = remoteAdapter;
        Entity.modelName = modelDefinition.name;
        Entity.dataSourceName = modelDefinition.dataSourceName || modelDefinition.name;
        // Initializes the fields using the common ModelField class
        var initializeEntityFields = function() {
            var field;
            var modelField;
            var lastModifiedField;
            var deletedField;
            for (field in modelDefinition.fields) {
                if (modelDefinition.fields.hasOwnProperty(field)) {
                    modelField = new ModelField(field, modelDefinition.fields[field]);
                    if (modelField.primaryKey) {
                        Entity.primaryKeyFieldName = field;
                    }
                    if (!modelField.invalid) {
                        Entity.fields[field] = modelField;
                    }
                    if (field === baseModelService.lastModifiedFieldName) {
                        lastModifiedField = modelField;
                    }
                    if (field === baseModelService.deletedFieldName) {
                        deletedField = field;
                    }
                }
            }
            if (lastModifiedField && lastModifiedField.type !== "Date") {
                $log.error("BaseModelService: The last modified field is not a Date field");
                return false;
            }
            if (baseModelService.lastModifiedFieldName && !lastModifiedField) {
                Entity.fields[baseModelService.lastModifiedFieldName] = new ModelField(baseModelService.lastModifiedFieldName, {
                    type: "Date",
                    index: true
                });
            }
            if (baseModelService.deletedFieldName && !deletedField) {
                Entity.fields[baseModelService.deletedFieldName] = new ModelField(baseModelService.deletedFieldName, {
                    type: "Boolean",
                    index: true
                });
            }
            return true;
        };
        if (!initializeEntityFields()) {
            return null;
        }
        // TODO: Support many to many associations
        // Initialize the Model associations using the HasOneAssociation and HasManyAssociation classes
        var initializeAssociations = function() {
            if (!modelDefinition.associations) {
                return;
            }
            var i;
            var association;
            for (i = 0; i < modelDefinition.associations.length; i++) {
                association = new Association(modelDefinition.associations[i]);
                if (association && !association.invalid) {
                    if (association.type === "hasOne") {
                        if (!Entity.fields[association.mappedBy]) {
                            // If no field is defined for the foreign key, define one assuming the same foreign key type.
                            Entity.fields[association.mappedBy] = new ModelField(association.mappedBy, {
                                type: Entity.fields[Entity.primaryKeyFieldName].type,
                                index: association.mappedBy
                            });
                        } else {
                            Entity.fields[association.mappedBy].index = association.mappedBy;
                        }
                    }
                    Entity.associations.push(association);
                }
            }
        };
        initializeAssociations();
        /**
             * Gets a Model Association by the alias name. The alias is defined as the "as" property on an alias if
             * defined and falls back to the model name if "as" is not defined.
             *
             * @param {String} alias The association's alias
             * @returns {Object} The association object
             */
        Entity.getAssociationByAlias = function(alias) {
            var i;
            for (i = 0; i < Entity.associations.length; i++) {
                if (Entity.associations[i].alias === alias) {
                    return Entity.associations[i];
                }
            }
        };
        /**
             * Extends an entity with a raw object. The raw object could be input from a controller or the result from
             * an adapter.
             *
             * @param {Object} entity The entity to extend
             * @param {Object} rawObject The object to extend from.
             */
        Entity.extendFromRawObject = function(entity, rawObject) {
            angular.extend(entity, Entity.getRawModelObject(rawObject));
        };
        /**
             * Gets a raw representation of the model object to be used in adapter transactions. This returns an object
             * in which only the Model defined fields are set. This also looks through expanded associations to set the
             * foreignKey field for one to n associations and sets the association to the raw association object.
             *
             * @param {Object} modelEntity
             * @param {Boolean} [includeExpandedAssociations = true] Include the expanded association in the raw object.
             * @returns {Object} The raw object
             */
        Entity.getRawModelObject = function(modelEntity, includeExpandedAssociations) {
            var object = new RawModelInstance();
            var field;
            for (field in Entity.fields) {
                if (Entity.fields.hasOwnProperty(field)) {
                    object[field] = modelEntity[field];
                }
            }
            var i;
            var alias;
            var foreignKey;
            var ForeignModel;
            var a;
            for (i = 0; i < Entity.associations.length; i++) {
                alias = Entity.associations[i].alias;
                ForeignModel = Entity.associations[i].getModel();
                if (Entity.associations[i].type === "hasOne") {
                    if (modelEntity[alias] !== undefined && includeExpandedAssociations !== false) {
                        foreignKey = modelEntity[alias][ForeignModel.primaryKeyFieldName];
                        object[Entity.associations[i].mappedBy] = foreignKey;
                        object[alias] = ForeignModel.getRawModelObject(modelEntity[alias]);
                    }
                    if (modelEntity[Entity.associations[i].mappedBy]) {
                        object[Entity.associations[i].mappedBy] = modelEntity[Entity.associations[i].mappedBy];
                    }
                } else if (Entity.associations[i].type === "hasMany" && includeExpandedAssociations !== false) {
                    if (modelEntity[alias] !== undefined && modelEntity[alias] instanceof Array) {
                        object[alias] = [];
                        for (a = 0; a < modelEntity[alias].length; a++) {
                            object[alias].push(ForeignModel.getRawModelObject(modelEntity[alias][a]));
                        }
                    }
                }
            }
            return object;
        };
        /**
             * Applies the default values on any undefined field in an entity.
             *
             * @param {Object} entity The entity to set the default values on
             */
        Entity.applyDefaultValues = function(entity) {
            var field;
            for (field in Entity.fields) {
                if (Entity.fields.hasOwnProperty(field)) {
                    if (typeof Entity.fields[field].getDefaultValue === "function" && entity[field] === undefined) {
                        entity[field] = Entity.fields[field].getDefaultValue(entity);
                    }
                }
            }
        };
        /**
             * Transforms all objects returned by adapter transactions. This calls the transformResult function defined
             * in the model.
             *
             * @method transformResult
             * @param {Object} resultEntity
             * @returns {Object} The transformed result
             */
        Entity.transformResult = function(resultEntity) {
            resultEntity = Entity.getRawModelObject(resultEntity);
            if (typeof modelDefinition.transformResult === "function") {
                return modelDefinition.transformResult(resultEntity);
            }
            return resultEntity;
        };
        /**
             * Ran before the create and update adapter transactions. This calls the preSave function defined in the
             * model.
             *
             * @method preSave
             * @param {Object} entity
             * @returns {Object} The raw transformed entity
             */
        Entity.preSave = function(entity) {
            entity = Entity.getRawModelObject(entity);
            if (typeof modelDefinition.preSave === "function") {
                return modelDefinition.preSave(entity);
            }
            return entity;
        };
        /**
             * Ran before the create adapter transaction. This applies the default values to any undefined fields and
             * then calls the preCreate function defined in the model.
             *
             * @method preCreate
             * @param {Object} rawEntity
             * @returns {Object} The raw transformed entity
             */
        Entity.preCreate = function(rawEntity) {
            Entity.applyDefaultValues(rawEntity);
            if (typeof modelDefinition.preCreate === "function") {
                return modelDefinition.preCreate(rawEntity);
            }
            return rawEntity;
        };
        /**
             * Ran before the update adapter transaction. This calls the preUpdate function defined in the model.
             *
             * @method preUpdate
             * @param {Object} rawEntity
             * @returns {Object} The raw transformed entity
             */
        Entity.preUpdate = function(rawEntity) {
            if (typeof modelDefinition.preUpdate === "function") {
                return modelDefinition.preUpdate(rawEntity);
            }
            return rawEntity;
        };
        /**
             * Retrieves a single model from the adapter given a primary key. Query options can be passed to determine
             * select and expand operations.
             *
             * @method findOne
             * @param {String} pk The primary key of the model to retrieve
             * @param {Object} [queryOptions] Query options to use for retrieval
             * @param {Boolean} [remote=false] Use the remote adapter if supplied
             * @returns {promise} Resolves with the model
             */
        Entity.findOne = function(pk, queryOptions, remote) {
            if (!pk) {
                $log.error("BaseModelService: FindOne", "The primary key was not supplied");
                return $q.reject("The primary key was not supplied.");
            }
            var adapter = remote === true && remoteAdapter ? remoteAdapter : localAdapter;
            return adapter.findOne(new RecallModel(Entity), pk, queryOptions).then(function(response) {
                var result = Entity.transformResult(response.data);
                var entity = new Entity(result, true, adapter);
                $log.debug("BaseModelService: FindOne", new Response(entity), response, queryOptions);
                return entity;
            }, propagateError);
        };
        /**
             * Retrieves a list of models from the adapter. Query options can be passed to determine top, skip, order by,
             * select, expand, and filter operations.
             *
             * @method find
             * @param {Object} [queryOptions] Query options to use for retrieval
             * @param {Boolean} [remote=false] Use the remote adapter if supplied
             * @returns {promise} Resolves with data.results and data.totalCount where results are models
             */
        Entity.find = function(queryOptions, remote) {
            var adapter = remote === true && remoteAdapter ? remoteAdapter : localAdapter;
            return adapter.find(new RecallModel(Entity), queryOptions).then(function(response) {
                var results = [];
                var i;
                for (i = 0; i < response.data.length; i++) {
                    results.push(new Entity(Entity.transformResult(response.data[i]), true, adapter));
                }
                var clientResponse = {
                    results: results,
                    totalCount: response.count
                };
                $log.debug("BaseModelService: Find", new Response(clientResponse), response, queryOptions);
                return clientResponse;
            }, propagateError);
        };
        /**
             * Removes the model from the adapter given a primary key.
             *
             * @method remove
             * @param {String} pk The primary key of the model to remove
             * @param {Boolean} [remote=false] Use the remote adapter if supplied
             * @returns {promise}
             */
        Entity.remove = function(pk, remote) {
            if (!pk) {
                $log.error("BaseModelService: Remove", "The primary key was not supplied");
                return $q.reject("The primary key was not supplied.");
            }
            var adapter = remote === true && remoteAdapter ? remoteAdapter : localAdapter;
            return adapter.remove(new RecallModel(Entity), pk);
        };
        /**
             * Synchronizes all modified entities between a local and remote adapter.
             * @returns {promise}
             */
        Entity.synchronize = function() {
            return syncHandler.model(Entity);
        };
        /**
             * Synchronizes a single entity between a local and remote adapter.
             * @returns {promise}
             */
        Entity.prototype.$sync = function() {
            return syncHandler.entity(Entity, this);
        };
        /**
             * Retrieves the Primary Key for the Entity.
             * @returns {String|Number} The Primary Key
             */
        Entity.prototype.$getPrimaryKey = function() {
            return this[Entity.primaryKeyFieldName];
        };
        /**
             * Expands a given association on an Entity
             *
             * @param {String} associationName The alias of the association to expand
             * @returns {promise}
             */
        Entity.prototype.$expand = function(associationName) {
            var association = Entity.getAssociationByAlias(associationName);
            if (!association) {
                return $q.reject("BaseModelService: $expand could not find the association to expand.", associationName, this);
            }
            return association.expand(this, this.$entity.adapter === remoteAdapter);
        };
        /**
             * Validates an entity against the model's field definition.
             * @returns {Boolean} True if the model validation succeeds
             */
        Entity.prototype.$isValid = function() {
            // TODO: This does not validate associations
            var field;
            var valid = true;
            var matchesType = false;
            var fieldIsUndefined;
            for (field in Entity.fields) {
                if (Entity.fields.hasOwnProperty(field)) {
                    fieldIsUndefined = this[field] === null || this[field] === undefined;
                    if (Entity.fields[field].notNull === true && fieldIsUndefined) {
                        $log.debug("BaseModelService: $isValid returned false", "NotNull field was null", field, this);
                        return false;
                    }
                    switch (Entity.fields[field].type) {
                      case "String":
                        matchesType = typeof this[field] === "string";
                        break;

                      case "Number":
                        matchesType = typeof this[field] === "number";
                        break;

                      case "Boolean":
                        matchesType = this[field] === true || this[field] === false;
                        break;

                      case "Date":
                        matchesType = this[field] instanceof Date && !isNaN(Date.parse(this[field]));
                        break;
                    }
                    if (!matchesType && !fieldIsUndefined) {
                        $log.debug("BaseModelService: $isValid returned false", "The type was not " + Entity.fields[field].type, field, this);
                        return false;
                    }
                    if (typeof Entity.fields[field].validate === "function") {
                        valid = Entity.fields[field].validate(this[field]);
                        if (!valid) {
                            $log.debug("BaseModelService: $isValid returned false", "Custom validator failed", field, this);
                            return false;
                        }
                    }
                }
            }
            return valid;
        };
        /**
             * Persists the model with the adapter. This will update the model if it exists in the adapter or create
             * the model if it does not exist.
             *
             * @method $save
             * @param {Boolean} [remote] Use the remote adapter if set instead of the Entity's default
             * @returns {promise} Resolves with the model
             */
        Entity.prototype.$save = function(remote) {
            var self = this;
            var itemToSave = Entity.preSave(this);
            var adapter = remote === true && remoteAdapter ? remoteAdapter : self.$entity.adapter;
            this.$entity.saveInProgress = true;
            var updateSavedState = function(entity, succeeded) {
                if (succeeded !== false) {
                    self.$storeState();
                    self.$entity.persisted = true;
                    self.$entity.saveInProgress = false;
                    self.$entity.adapter = adapter;
                } else {
                    self.$reset();
                    self.$entity.saveInProgress = false;
                }
            };
            // The model exists in the DB
            if (self.$entity.persisted && itemToSave[Entity.primaryKeyFieldName]) {
                itemToSave = Entity.preUpdate(itemToSave);
                if (!self.$isValid()) {
                    $log.warn("BaseModelService: $save: aborted", self, self[Entity.primaryKeyFieldName]);
                    self.$reset();
                    return $q.reject("aborted");
                }
                return adapter.update(new RecallModel(Entity), itemToSave[Entity.primaryKeyFieldName], itemToSave).then(function(response) {
                    var result = Entity.transformResult(response.data);
                    Entity.extendFromRawObject(self, result);
                    updateSavedState(self, true);
                    $log.debug("BaseModelService: $save: update", self, itemToSave, response);
                    return self;
                }, function(e) {
                    updateSavedState(self, false);
                    $log.error("BaseModelService: $save: update", self, itemToSave, e);
                    return $q.reject(e);
                });
            }
            // The model is new
            itemToSave = Entity.preCreate(itemToSave);
            if (!self.$isValid()) {
                $log.warn("BaseModelService: $save: aborted", self, self[Entity.primaryKeyFieldName]);
                self.$reset();
                return $q.reject("aborted");
            }
            return adapter.create(new RecallModel(Entity), itemToSave).then(function(response) {
                var result = Entity.transformResult(response.data);
                Entity.extendFromRawObject(self, result);
                updateSavedState(self, true);
                $log.debug("BaseModelService: $save: create", self, itemToSave, response);
                return self;
            }, function(e) {
                updateSavedState(self, false);
                $log.error("BaseModelService: $save: create", self, itemToSave, e);
                return $q.reject(e);
            });
        };
        /**
             * Removes the model from the adapter.
             *
             * @method $remove
             * @param {Boolean} [remote] Use the remote adapter if set instead of the Entity's default
             * @returns {promise}
             */
        Entity.prototype.$remove = function(remote) {
            if (this[Entity.primaryKeyFieldName]) {
                var adapter = remote === true && remoteAdapter ? remoteAdapter : this.$entity.adapter;
                return adapter.remove(new RecallModel(Entity), this[Entity.primaryKeyFieldName]);
            }
            $log.error("BaseModelService: $remove", "The primary key was not found");
            return $q.reject("The primary key was not found.");
        };
        /**
             * Stores the model's state so that it can later be reset to the state if needed. This is called
             * on $save so that the model's state is always at the latest save point.
             *
             * @method $storeState
             */
        Entity.prototype.$storeState = function() {
            this.$entity.storedState = Entity.getRawModelObject(this);
            this.$entity.lastDirtyCheck = new Date().getTime();
            this.$entity.lastDirtyState = false;
        };
        /**
             * Checks to see if the properties have diverged from the stored state. If so, this means that
             * the properties have been changed and have not been saved.
             *
             * @method $isDirty
             * @returns {Boolean} True if the properties are different than what is in the stored state.
             */
        Entity.prototype.$isDirty = function() {
            if (this.$entity.saveInProgress) {
                return false;
            }
            if (!this.$entity.storedState) {
                return false;
            }
            var now = new Date().getTime();
            var delta = now - this.$entity.lastDirtyCheck;
            if (this.$entity.lastDirtyCheck && delta < baseModelService.dirtyCheckThreshold) {
                return this.$entity.lastDirtyState;
            }
            this.$entity.lastDirtyCheck = new Date().getTime();
            var raw = Entity.getRawModelObject(this);
            // TODO: This does not dirty check associations
            var field;
            var viewValue;
            var storedValue;
            for (field in Entity.fields) {
                if (Entity.fields.hasOwnProperty(field)) {
                    storedValue = this.$entity.storedState[field];
                    viewValue = raw[field];
                    if (storedValue !== viewValue) {
                        $log.debug("BaseModelService: $isDirty", this[Entity.primaryKeyFieldName], true, delta);
                        this.$entity.lastDirtyState = true;
                        return true;
                    }
                }
            }
            $log.debug("BaseModelService: $isDirty", this[Entity.primaryKeyFieldName], false, delta);
            this.$entity.lastDirtyState = false;
            return false;
        };
        /**
             * Resets a model back to its stored state. This will reset any pending changes back to the
             * entities last save or initial retrieval.
             *
             * @method $reset
             * @returns {Array} A list of the changed field names and their before and after values
             */
        Entity.prototype.$reset = function() {
            if (!this.$entity.storedState) {
                this.$storeState();
                return [];
            }
            if (!this.$isDirty()) {
                return [];
            }
            var prop;
            var changedProperties = [];
            for (prop in this.$entity.storedState) {
                if (this.$entity.storedState.hasOwnProperty(prop) && this[prop] !== this.$entity.storedState[prop]) {
                    changedProperties.push({
                        name: prop,
                        before: this[prop],
                        after: this.$entity.storedState[prop]
                    });
                    this[prop] = this.$entity.storedState[prop];
                }
            }
            this.$entity.lastDirtyState = false;
            this.$entity.lastDirtyCheck = new Date().getTime();
            $log.debug("BaseModelService: $reset", this[Entity.primaryKeyFieldName], changedProperties);
            return changedProperties;
        };
        baseModelService.models[Entity.modelName] = Entity;
        return Entity;
    };
    return baseModelService;
} ]);

angular.module("recall").factory("recallLocalStorage", [ function() {
    /**
         * The localStorage utility helps manage the storage and retrieval of registered application data.
         */
    var storage = {
        localStorage: window.localStorage,
        cookie: document.cookie,
        keys: {
            LAST_SYNC: "LAST_SYNC"
        }
    };
    /**
         * Checks if the key is registered with the class.
         *
         * @param {String} key
         * @returns {Boolean} True if the key exists
         */
    var keyExists = function(key) {
        return storage.keys[key] !== undefined;
    };
    /**
         * Appends a modifier to a key
         * @param {String} key
         * @param {String} modifier
         * @returns {String} The key with the modifier appended.
         */
    var addKeyModifier = function(key, modifier) {
        if (modifier) {
            key += "_" + modifier;
        }
        return key;
    };
    /**
         * Stores data by key in local browser storage.
         *
         * @param {String} key The key to use as the local storage name. Must be a key found in localStorage.keys.
         * @param {String} value The string value to store.
         * @param {String} keyModifier An additional identifier on the key.
         */
    storage.set = function(key, value, keyModifier) {
        if (keyExists(key)) {
            key = addKeyModifier(key, keyModifier);
            if (storage.supportsLocalStorage()) {
                storage.localStorage.setItem(key, value);
            } else {
                var life = 60 * 60 * 24 * 5;
                var v = encodeURIComponent(value);
                storage.cookie = key + "=" + v + "; max-age=" + life + ";";
            }
        }
    };
    /**
         * Retrieves stored data by key.
         *
         * @param {String} key The key of the data to retrieve. Must be a key found in localStorage.keys.
         * @param {String} keyModifier An additional identifier on the key.
         * @return {String} The string value stored.
         */
    storage.get = function(key, keyModifier) {
        var value = "";
        if (keyExists(key)) {
            key = addKeyModifier(key, keyModifier);
            if (storage.supportsLocalStorage()) {
                value = storage.localStorage.getItem(key) || "";
            } else {
                var regexp = new RegExp(key + "=([^;]+)", "g");
                var c = regexp.exec(storage.cookie);
                if (c) {
                    value = decodeURIComponent(c[1]);
                }
            }
        }
        return value;
    };
    /**
         * Removes stored data by key.
         *
         * @param {String} key The key of the data to remove. Must be a key found in localStorage.keys.
         * @param {String} keyModifier An additional identifier on the key.
         */
    storage.remove = function(key, keyModifier) {
        if (keyExists(key)) {
            key = addKeyModifier(key, keyModifier);
            if (storage.supportsLocalStorage()) {
                storage.localStorage.removeItem(key);
            } else {
                storage.cookie = key + "=; max-age=0;";
            }
        }
    };
    /**
         * Checks if the browser supports html5 local storage.
         *
         * @private
         * @returns {Boolean} True if the browser does support html5 local storage.
         */
    storage.supportsLocalStorage = function() {
        try {
            return "localStorage" in window && window.localStorage !== null;
        } catch (e) {
            return false;
        }
    };
    return storage;
} ]);

angular.module("recall").factory("recallModelField", [ "$log", function($log) {
    /**
         * Model Field class to make all model fields consistent
         * @param {String} name
         * @param {Object | String} definition The Field Definition or the Field Type
         * @constructor
         */
    var ModelField = function(name, definition) {
        this.invalid = false;
        this.name = name;
        if (typeof definition === "string") {
            this.type = definition;
            this.primaryKey = false;
            this.unique = false;
            this.index = false;
            this.notNull = false;
        } else {
            this.type = definition.type;
            this.primaryKey = definition.primaryKey === true;
            this.unique = definition.unique === true;
            this.index = typeof definition.index === "string" ? definition.index : definition.index === true ? name : false;
            this.notNull = definition.notNull === true;
            if (typeof definition.getDefaultValue === "function") {
                this.getDefaultValue = definition.getDefaultValue;
            }
        }
        // The adapter or the adapter's handler should enforce uniqueness of the primary key.
        // The index on the primary key should be handled automatically without needing to specify an index.
        // In order to pass validation during creation, the primary key should not be set as notNull.
        // This of course should be enforced by the adapter or the adapter's handler.
        if (this.primaryKey) {
            this.notNull = false;
            this.unique = false;
            this.index = false;
        }
        // TODO: Better field validation
        if (!this.name || !this.type) {
            this.invalid = true;
            $log.error("ModelField: The field definition is invalid", this, definition);
        }
    };
    return ModelField;
} ]);

// Date.toISOString polyfill: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString
if (!Date.prototype.toISOString) {
    (function() {
        function pad(number) {
            if (number < 10) {
                return "0" + number;
            }
            return number;
        }
        Date.prototype.toISOString = function() {
            return this.getUTCFullYear() + "-" + pad(this.getUTCMonth() + 1) + "-" + pad(this.getUTCDate()) + "T" + pad(this.getUTCHours()) + ":" + pad(this.getUTCMinutes()) + ":" + pad(this.getUTCSeconds()) + "." + (this.getUTCMilliseconds() / 1e3).toFixed(3).slice(2, 5) + "Z";
        };
    })();
}

angular.module("recall").factory("recallPredicate", [ function() {
    /*
         * BASED ON:
         * Predicate
         * version: 1.1.2
         * author: David Hamilton
         * license: https://github.com/nova706/PreparedQueryOptions/blob/master/LICENSE.txt (MIT)
         * https://github.com/nova706/PreparedQueryOptions
         *
         */
    /**
         * A predicate is used for the $filter operator in a query. Predicates can be joined to query
         * using a group of filters with the 'and' operator.
         *
         * This is a helper class for the PreparedQueryOptions class to assist in building complex
         * filter clauses.
         *
         * @class Predicate
         * @constructor
         * @param {String} [property] The property to filter by.
         * @param {Function} [parser] A function that returns the predicate string.
         */
    function Predicate(property, parser) {
        this.property = property;
        this.parser = parser;
        return this;
    }
    /**
         * Joins a provided set of predicates using the group operator and returns a new Predicate
         *
         * @method join
         * @param {Predicate[]} predicates Array of predicates to join.
         * @param {String} [groupOperator] The operator for the filter set ('and' 'or').
         * @return {Predicate} Predicate object.
         */
    Predicate.join = function(predicates, groupOperator) {
        if (predicates instanceof Array && predicates.length > 0) {
            return new Predicate().join(predicates, groupOperator);
        }
        return null;
    };
    /**
         * Sets the property of a predicate
         *
         * @method setProperty
         * @param {String} property
         * @return {Predicate} Predicate object.
         */
    Predicate.prototype.setProperty = function(property) {
        this.property = property;
        return this;
    };
    /**
         * Modifies an existing predicate setting the operator to 'eq' and the value to the input parameter
         *
         * @method equals
         * @param {String|Number|Boolean} (value) The value to match.
         * @return {Predicate} Used for chaining function calls
         */
    Predicate.prototype.equals = function(value) {
        this.parser = function() {
            return this.property + " eq " + escapeValue(value);
        };
        return this;
    };
    /**
         * Modifies an existing predicate setting the operator to 'ne' and the value to the input parameter
         *
         * @method notEqualTo
         * @param {String|Number|Boolean} (value) The value to match.
         * @return {Predicate} Used for chaining function calls
         */
    Predicate.prototype.notEqualTo = function(value) {
        this.parser = function() {
            return this.property + " ne " + escapeValue(value);
        };
        return this;
    };
    /**
         * Modifies an existing predicate setting the operator to 'gt' and the value to the input parameter
         *
         * @method greaterThan
         * @param {String|Number|Boolean} (value) The value to match.
         * @return {Predicate} Used for chaining function calls
         */
    Predicate.prototype.greaterThan = function(value) {
        this.parser = function() {
            return this.property + " gt " + escapeValue(value);
        };
        return this;
    };
    /**
         * Modifies an existing predicate setting the operator to 'ge' and the value to the input parameter
         *
         * @method greaterThanOrEqualTo
         * @param {String|Number|Boolean} (value) The value to match.
         * @return {Predicate} Used for chaining function calls
         */
    Predicate.prototype.greaterThanOrEqualTo = function(value) {
        this.parser = function() {
            return this.property + " ge " + escapeValue(value);
        };
        return this;
    };
    /**
         * Modifies an existing predicate setting the operator to 'lt' and the value to the input parameter
         *
         * @method lessThan
         * @param {String|Number|Boolean} (value) The value to match.
         * @return {Predicate} Used for chaining function calls
         */
    Predicate.prototype.lessThan = function(value) {
        this.parser = function() {
            return this.property + " lt " + escapeValue(value);
        };
        return this;
    };
    /**
         * Modifies an existing predicate setting the operator to 'le' and the value to the input parameter
         *
         * @method lessThanOrEqualTo
         * @param {String|Number|Boolean} (value) The value to match.
         * @return {Predicate} Used for chaining function calls
         */
    Predicate.prototype.lessThanOrEqualTo = function(value) {
        this.parser = function() {
            return this.property + " le " + escapeValue(value);
        };
        return this;
    };
    /**
         * Modifies an existing predicate setting the operation to substringof and the value to the input parameter
         *
         * @method contains
         * @param {String|Number|Boolean} (value) The value to match.
         * @return {Predicate} Used for chaining function calls
         */
    Predicate.prototype.contains = function(value) {
        this.parser = function() {
            return "substringof(" + escapeValue(value) + ", " + this.property + ")";
        };
        return this;
    };
    /**
         * Modifies an existing predicate setting the operation to startswith and the value to the input parameter
         *
         * @method startsWith
         * @param {String|Number|Boolean} (value) The value to match.
         * @return {Predicate} Used for chaining function calls
         */
    Predicate.prototype.startsWith = function(value) {
        this.parser = function() {
            return "startswith(" + this.property + ", " + escapeValue(value) + ")";
        };
        return this;
    };
    /**
         * Modifies an existing predicate setting the operation to endswith and the value to the input parameter
         *
         * @method startsWith
         * @param {String|Number|Boolean} (value) The value to match.
         * @return {Predicate} Used for chaining function calls
         */
    Predicate.prototype.endsWith = function(value) {
        this.parser = function() {
            return "endswith(" + this.property + ", " + escapeValue(value) + ")";
        };
        return this;
    };
    /**
         * Joins an existing predicate with additional predicates using the group operator
         *
         * @method join
         * @param {Predicate|Predicate[]} predicates A single predicate or an array of predicates to join to the existing one.
         * @param {String} [groupOperator] The operator for the filter set ('and' 'or').
         * @return {Predicate} Used for chaining function calls
         */
    Predicate.prototype.join = function(predicates, groupOperator) {
        var initialPredicate;
        if (this.property && typeof this.parser === "function") {
            initialPredicate = new Predicate(this.property, this.parser);
        }
        var newPredicates = [];
        if (predicates instanceof Predicate) {
            newPredicates.push(predicates);
        } else if (predicates instanceof Array && predicates.length > 0) {
            var i;
            for (i = 0; i < predicates.length; i++) {
                if (predicates[i]) {
                    newPredicates.push(predicates[i]);
                }
            }
        }
        if (newPredicates.length > 0) {
            delete this.parser;
            delete this.property;
            this.joinedPredicates = this.joinedPredicates ? this.joinedPredicates.concat(newPredicates) : newPredicates;
            if (groupOperator || !this.groupOperator) {
                this.groupOperator = groupOperator === "or" ? "or" : "and";
            }
            if (initialPredicate) {
                this.joinedPredicates.unshift(initialPredicate);
            }
        }
        return this;
    };
    /**
         * Joins an existing predicate with additional predicates using the 'and' group operator
         *
         * @method and
         * @param {Predicate|Predicate[]} predicates A single predicate or an array of predicates to join to the existing one.
         * @return {Predicate} Used for chaining function calls
         */
    Predicate.prototype.and = function(predicates) {
        return this.join(predicates, "and");
    };
    /**
         * Joins an existing predicate with additional predicates using the 'or' group operator
         *
         * @method or
         * @param {Predicate|Predicate[]} predicates A single predicate or an array of predicates to join to the existing one.
         * @return {Predicate} Used for chaining function calls
         */
    Predicate.prototype.or = function(predicates) {
        return this.join(predicates, "or");
    };
    /**
         * Evaluate an object to see if it matches the predicate filter conditions.
         *
         * @method test
         * @param {Object} object The object to test against the predicate.
         * @param {Boolean} [failOnMissingAssociation=true] Should the test fail when the a filter is performed against an expanded association that is not present
         * @return {Boolean} True if the object matches the filter conditions.
         */
    Predicate.prototype.test = function(object, failOnMissingAssociation) {
        return testPredicate(this, object, failOnMissingAssociation);
    };
    /**
         * Builds and returns a URL parameter string based on the predicate.
         *
         * @method parsePredicate
         * @param {Boolean} [nested = false] Used for building the nested group during recursion
         * @returns {String}
         */
    Predicate.prototype.parsePredicate = function(nested) {
        nested = nested === true;
        var urlString = "";
        if (this.property && typeof this.parser === "function") {
            return this.parser();
        }
        if (this.joinedPredicates && this.joinedPredicates.length > 0) {
            var i;
            var predicate;
            var predicateString;
            for (i = 0; i < this.joinedPredicates.length; i++) {
                predicate = this.joinedPredicates[i];
                predicateString = predicate.parsePredicate(true);
                urlString += i > 0 ? " " + this.groupOperator + " " + predicateString : predicateString;
            }
        }
        return nested ? "(" + urlString + ")" : urlString;
    };
    /**
         * Creates a predicate structure from a string
         *
         * @method fromString
         * @param {String} predicateString
         * @return {Predicate|null} null if the predicate could not be built from the string
         */
    Predicate.fromString = function(predicateString) {
        if (typeof predicateString !== "string") {
            return null;
        }
        // Extract all the filters out of the predicate string
        var conditionMatcher = new RegExp("(substringof\\(.+?\\)|startswith\\(.+?\\)|endswith\\(.+?\\)|[\\w\\.]+?\\s(?:eq|ne|gt|ge|lt|le)\\s(?:\\w+|\\'.+?\\'))", "g");
        var filters = predicateString.match(conditionMatcher);
        if (!filters) {
            return null;
        }
        // Convert each filter into a predicate
        var i;
        for (i = 0; i < filters.length; i++) {
            filters[i] = getPredicateFromSegment(filters[i]);
            if (filters[i] === null) {
                return null;
            }
        }
        if (filters.length === 0) {
            return null;
        }
        // Remove all predicates from string
        i = 0;
        predicateString = predicateString.replace(conditionMatcher, function() {
            return i++;
        });
        if (filters.length === 1) {
            if (predicateString.replace(/[0-9]|\s|and|or/g, "") !== "") {
                return null;
            }
            return filters[0];
        }
        return buildPredicateFromMap(predicateString, filters);
    };
    /**
         * Builds a predicate based on a predicate map and array of extracted filters
         * @param {String} predicateMap A String representing a map of a predicate where the indexes map to the filters array
         *                              "1 and (2 or 3)" where filters.length === 3
         * @param {Predicate[]} filters An array of Predicates whose index map to the indexes on the predicateMap
         * @returns {Predicate|Null} The resulting Predicate or null if the map is invalid
         */
    var buildPredicateFromMap = function(predicateMap, filters) {
        var closeParenthesisIndex;
        var openParenthesisIndex;
        var groupString;
        var filterIndexes;
        var groupPredicate = null;
        var groupFilters;
        var operator;
        var testNextLevel = true;
        while (testNextLevel) {
            closeParenthesisIndex = predicateMap.indexOf(")");
            if (closeParenthesisIndex !== -1) {
                openParenthesisIndex = predicateMap.lastIndexOf("(", closeParenthesisIndex);
                groupString = predicateMap.substring(openParenthesisIndex + 1, closeParenthesisIndex);
                predicateMap = predicateMap.substring(0, openParenthesisIndex) + filters.length + predicateMap.substring(closeParenthesisIndex + 1);
            } else {
                groupString = predicateMap;
                testNextLevel = false;
            }
            // If the group contains invalid characters then return null as an invalid predicate string.
            if (groupString.replace(/[0-9]|\s|and|or/g, "") !== "") {
                return null;
            }
            // If the group uses both 'and' and 'or' then return null as an invalid predicate string.
            if (groupString.indexOf("and") >= 0 && groupString.indexOf("or") >= 0) {
                return null;
            }
            filterIndexes = groupString.match(/[0-9]+/g);
            groupFilters = [];
            var i;
            for (i = 0; i < filterIndexes.length; i++) {
                groupFilters.push(filters[Number(filterIndexes[i])]);
            }
            operator = groupString.indexOf("or") >= 0 ? "or" : "and";
            groupPredicate = new Predicate().join(groupFilters, operator);
            filters.push(groupPredicate);
        }
        return groupPredicate;
    };
    /**
         * Takes a predicate's value and if it is a string, adds single quotes around it.
         *
         * @method escapeValue
         * @param {String|Boolean|Number|Date} value
         * @returns {string} The string value
         */
    var escapeValue = function(value) {
        if (value instanceof Date) {
            value = value.toISOString();
        }
        return typeof value === "string" ? "'" + value + "'" : value.toString();
    };
    /**
         * Returns the raw value of the predicate string
         *
         * @method convertValueToType
         * @param {String} value
         * @returns {String|Boolean|Number}
         */
    var convertValueToType = function(value) {
        if (typeof value === "string") {
            if (value.indexOf("'") >= 0) {
                return value.replace(/\'/g, "");
            }
            if (value.toLowerCase() === "true") {
                return true;
            }
            if (value.toLowerCase() === "false") {
                return false;
            }
        }
        if (!isNaN(value)) {
            return Number(value);
        }
        return value;
    };
    /**
         * Tests a predicate group to see if the object matches
         * @param {Predicate} predicate
         * @param {Object} object
         * @returns {Boolean} True if the object matches the predicate
         */
    var testPredicateGroup = function(predicate, object) {
        var result;
        var i;
        for (i = 0; i < predicate.joinedPredicates.length; i++) {
            result = testPredicate(predicate.joinedPredicates[i], object);
            // If the operator is 'and' and any of the filters do not match, return false.
            if (predicate.groupOperator === "and" && result === false) {
                return false;
            }
            // If the operator is 'or' and any of the filters match, return true.
            if (predicate.groupOperator === "or" && result === true) {
                return true;
            }
        }
        // The operator was 'and' and all of the filters matched or the operator was 'or' and none of the filters matched.
        return predicate.groupOperator === "and";
    };
    /**
         * Tests an object to see if the filter conditions match a given predicate. Used for recursive tests.
         *
         * @param {Predicate} predicate
         * @param {Object} object
         * @param {Boolean} [failOnMissingAssociation=true] Should the test fail when the a filter is performed against an expanded association that is not present
         */
    var testPredicate = function(predicate, object, failOnMissingAssociation) {
        if (predicate.joinedPredicates && predicate.joinedPredicates.length > 0) {
            return testPredicateGroup(predicate, object);
        }
        if (predicate.property) {
            var propertyPath = predicate.property.split(".");
            var objectValue = object;
            var i;
            for (i = 0; i < propertyPath.length; i++) {
                if (objectValue.hasOwnProperty(propertyPath[i]) && objectValue[propertyPath[i]] !== undefined) {
                    objectValue = objectValue[propertyPath[i]];
                } else {
                    return failOnMissingAssociation === false;
                }
            }
            var condition = predicate.parsePredicate();
            if (condition.indexOf("(") >= 0) {
                return testComplexPredicate(condition, objectValue);
            }
            return testSimplePredicate(condition, objectValue);
        }
        return false;
    };
    /**
         * Tests a complex predicate that uses startswith, endswith, or substringof
         * @param {String} condition The Predicate condition
         * @param {String|Number|Boolean} objectValue The value that is being tested
         * @returns {Boolean} True if the object value matches the condition
         */
    var testComplexPredicate = function(condition, objectValue) {
        var value;
        var operator = condition.substr(0, condition.indexOf("("));
        var start = condition.indexOf("(") + 1;
        var end = condition.indexOf(")") - start;
        var conditionParams = condition.substr(start, end);
        conditionParams = conditionParams.replace(/\'/g, "").split(", ");
        switch (operator) {
          case "startswith":
            value = conditionParams[1].toLowerCase();
            return objectValue.indexOf(value) === 0;

          case "endswith":
            value = conditionParams[1].toLowerCase();
            return objectValue.indexOf(value) === objectValue.length - 1 - value.length;

          case "substringof":
            value = conditionParams[0].toLowerCase();
            return objectValue.indexOf(value) >= 0;
        }
        return false;
    };
    /**
         * Tests a simple predicate that uses lt, gt, le, ge, ne, or eq
         * @param {String} condition The Predicate condition
         * @param {String|Number|Boolean} objectValue The value that is being tested
         * @returns {Boolean} True if the object value matches the condition
         */
    var testSimplePredicate = function(condition, objectValue) {
        var conditionParams = condition.split(" ");
        var operator = conditionParams[1];
        var value = conditionParams.slice(2).join(" ");
        value = convertValueToType(value);
        // If both the predicate value and the object values are Date-like, convert them to dates to compare
        if (objectValue instanceof Date && !isNaN(Date.parse(value))) {
            value = Date.parse(value);
            objectValue = objectValue.getTime();
        } else if (typeof objectValue === "string" && !isNaN(Date.parse(objectValue))) {
            objectValue = Date.parse(objectValue);
            value = Date.parse(value);
        }
        /* jshint eqeqeq: false */
        switch (operator) {
          case "lt":
            return objectValue < value;

          case "gt":
            return objectValue > value;

          case "le":
            return objectValue <= value;

          case "ge":
            return objectValue >= value;

          case "ne":
            return objectValue != value;

          case "eq":
            return objectValue == value;
        }
        /* jshint eqeqeq: true */
        return false;
    };
    /**
         * Builds a predicate from a complex segment that uses startswith, endswith, or substringof
         * @param {String} condition The predicate condition
         * @returns {Predicate} The resulting Predicate
         */
    var getComplexPredicateFromSegment = function(condition) {
        var predicate;
        var value;
        var parenPos = condition.indexOf("(");
        var operator = condition.substring(0, parenPos);
        var conditionParams = condition.substring(parenPos + 1, condition.indexOf(")")).split(", ");
        switch (operator) {
          case "startswith":
            value = convertValueToType(conditionParams[1]);
            predicate = new Predicate(conditionParams[0]).startsWith(value);
            break;

          case "endswith":
            value = convertValueToType(conditionParams[1]);
            predicate = new Predicate(conditionParams[0]).endsWith(value);
            break;

          case "substringof":
            value = convertValueToType(conditionParams[0]);
            predicate = new Predicate(conditionParams[1]).contains(value);
            break;
        }
        return predicate;
    };
    /**
         * Builds a predicate from a simple segment that uses eq, ne, gt, ge, lt, or le
         * @param {String} condition The predicate condition
         * @returns {Predicate} The resulting Predicate
         */
    var getSimplePredicateFromSegment = function(condition) {
        var conditionParams = condition.split(" ");
        var operator = conditionParams[1];
        var value = convertValueToType(conditionParams.slice(2).join(" "));
        var predicate = new Predicate(conditionParams[0]);
        switch (operator) {
          case "eq":
            predicate.equals(value);
            break;

          case "ne":
            predicate.notEqualTo(value);
            break;

          case "gt":
            predicate.greaterThan(value);
            break;

          case "ge":
            predicate.greaterThanOrEqualTo(value);
            break;

          case "lt":
            predicate.lessThan(value);
            break;

          case "le":
            predicate.lessThanOrEqualTo(value);
            break;
        }
        return predicate;
    };
    /**
         * Creates a predicate from a single condition eg: "property eq 'value'"
         *
         * @param {String} condition
         * @return {Predicate} The predicate built from the condition
         */
    var getPredicateFromSegment = function(condition) {
        if (condition.indexOf("(") >= 0) {
            return getComplexPredicateFromSegment(condition);
        }
        return getSimplePredicateFromSegment(condition);
    };
    return Predicate;
} ]);

angular.module("recall").factory("recallPreparedQueryOptions", [ "recallPredicate", function(Predicate) {
    /*
         * BASED ON:
         * PreparedQueryOptions
         * version: 1.1.2
         * author: David Hamilton
         * license: https://github.com/nova706/PreparedQueryOptions/blob/master/LICENSE.txt (MIT)
         * https://github.com/nova706/PreparedQueryOptions
         *
         */
    /**
         * PreparedQueryOptions are used to set, store and parse OData query parameters. Instead of passing
         * multiple arguments to methods for each query option, simply pass the preparedQueryOptions object.
         * Use the parseOptions method on the object to return an OData string for a query.
         *
         * @class PreparedQueryOptions
         * @constructor
         */
    function PreparedQueryOptions() {
        /**
             * Stores the query options that have been set.
             * @property options
             * @type Object
             * @default {}
             */
        this.options = {};
    }
    var isPredicate = function(object) {
        return object && typeof object === "object" && typeof object.parsePredicate === "function";
    };
    /**
         * Sets the number of results to retrieve. Passing a null top value will clear the top option. Negating the value
         * will return the current top value.
         *
         * @method $top
         * @param {Number} [top] Number of results to query for.
         * @return {PreparedQueryOptions|Number} PreparedQueryOptions object or the current $top value.
         */
    PreparedQueryOptions.prototype.$top = function(top) {
        if (arguments.length === 0) {
            return this.options.$top || null;
        }
        if (typeof top === "number" && top >= 0) {
            this.options.$top = top;
        }
        if (top === null) {
            delete this.options.$top;
        }
        return this;
    };
    /**
         * Sets the index of the first result to retrieve. Passing a null skip value will clear the skip option. Negating the
         * value will return the current skip value.
         *
         * @method $skip
         * @param {Number} [skip] The index of the first result to retrieve
         * @return {PreparedQueryOptions|Number} PreparedQueryOptions object or the current $skip value.
         */
    PreparedQueryOptions.prototype.$skip = function(skip) {
        if (arguments.length === 0) {
            return this.options.$skip || null;
        }
        if (typeof skip === "number" && skip >= 0) {
            this.options.$skip = skip;
        }
        if (skip === null) {
            delete this.options.$skip;
        }
        return this;
    };
    /**
         * Sets orderBy string. Passing a null order by value will clear the order by option. Negating the value will return
         * the current order by value.
         *
         * @method $orderBy
         * @param {String} [orderBy] The orderBy string used to retrieve the results in a sorted order.
         * @return {PreparedQueryOptions|String} PreparedQueryOptions object or the current $orderby value.
         */
    PreparedQueryOptions.prototype.$orderBy = function(orderBy) {
        if (arguments.length === 0) {
            return this.options.$orderby || null;
        }
        if (orderBy && typeof orderBy === "string") {
            this.options.$orderby = orderBy;
        }
        if (orderBy === null) {
            delete this.options.$orderby;
        }
        return this;
    };
    /**
         * Sets expand string. Passing a null expand value will clear the expand option. Negating the value will return the
         * current expand value.
         *
         * @method $expand
         * @param {String | Array} [foreignKey] The foreignKey to expand when retrieving the results.
         * @return {PreparedQueryOptions|String} PreparedQueryOptions object or the current $expand value.
         */
    PreparedQueryOptions.prototype.$expand = function(foreignKey) {
        if (arguments.length === 0) {
            return this.options.$expand || null;
        }
        if (typeof foreignKey === "string") {
            this.options.$expand = foreignKey;
        } else if (foreignKey instanceof Array) {
            this.options.$expand = foreignKey.join(",");
        }
        if (foreignKey === null) {
            delete this.options.$expand;
        }
        return this;
    };
    /**
         * Sets select string. Passing a null select value will clear the select option. Negating the value will return the
         * current select value.
         *
         * @method $select
         * @param {String | Array} [property] A single property name or array of property names to select.
         * @return {PreparedQueryOptions|String} PreparedQueryOptions object or the current $select value.
         */
    PreparedQueryOptions.prototype.$select = function(property) {
        if (arguments.length === 0) {
            return this.options.$select || null;
        }
        if (typeof property === "string") {
            this.options.$select = property;
        } else if (property instanceof Array) {
            this.options.$select = property.join(",");
        }
        if (property === null) {
            delete this.options.$select;
        }
        return this;
    };
    /**
         * Enables or disables inline count. Passing a null inline count value will clear the inline count option. Negating
         * the value will return the current inline count value: "allpages" or null.
         *
         * @method $inlineCount
         * @param {Boolean} [enable=true] Flag to enable or disable inline count.
         * @return {PreparedQueryOptions|String} PreparedQueryOptions object or the current $inlinecount value.
         */
    PreparedQueryOptions.prototype.$inlineCount = function(enable) {
        if (arguments.length === 0) {
            return this.options.$inlinecount || null;
        }
        if (enable !== false && enable !== null) {
            this.options.$inlinecount = "allpages";
        } else {
            delete this.options.$inlinecount;
        }
        return this;
    };
    /**
         * Sets the filter option. Include the Predicate class to assist in building complex filter clauses.
         * Passing a null filter value will clear the filter option. Negating the value will return the current filter value.
         *
         * @method $filter
         * @param {String | Predicate} [filter] The filter clause to use when retrieving the results.
         * @return {PreparedQueryOptions|Predicate} PreparedQueryOptions object or the current $filter predicate.
         */
    PreparedQueryOptions.prototype.$filter = function(filter) {
        if (arguments.length === 0) {
            return this.options.$filter || null;
        }
        if (filter && typeof filter === "string") {
            this.options.$filter = Predicate.fromString(filter);
        } else if (isPredicate(filter)) {
            this.options.$filter = filter;
        }
        if (filter === null) {
            delete this.options.$filter;
        }
        return this;
    };
    /**
         * Sets a custom query option parameter. Passing a null value will clear the filter. Negating the value will return
         * the current custom filter value.
         *
         * @method custom
         * @param {String} optionName The name of the option. Must not start with '$'.
         * @param {String|Number|Boolean} [value] The string value of the option.
         * @return {PreparedQueryOptions} PreparedQueryOptions object or the current custom filter value.
         */
    PreparedQueryOptions.prototype.custom = function(optionName, value) {
        if (arguments.length === 1) {
            return this.options[optionName] || null;
        }
        if (optionName && typeof optionName === "string" && optionName.indexOf("$") !== 0 && value && (typeof value === "string" || typeof value === "number" || typeof value === "boolean")) {
            this.options[optionName] = value;
        }
        if (optionName && value === null) {
            delete this.options[optionName];
        }
        return this;
    };
    /**
         * Extend existing query with options from another query. Only the original query will be modified. Any
         * matching options will be overridden in the original query.
         *
         * @method extend
         * @param {PreparedQueryOptions} preparedQueryOptions The prepared query objects with the properties to be added.
         * @return {PreparedQueryOptions} PreparedQueryOptions object.
         */
    PreparedQueryOptions.prototype.extend = function(preparedQueryOptions) {
        var key;
        for (key in preparedQueryOptions.options) {
            if (preparedQueryOptions.options.hasOwnProperty(key)) {
                this.options[key] = preparedQueryOptions.options[key];
            }
        }
        return this;
    };
    /**
         * Builds and returns a URL parameter string based on the query options.
         *
         * @method parseOptions
         * @returns {String}
         * @example '$top=25&$skip=0'
         */
    PreparedQueryOptions.prototype.parseOptions = function() {
        var parameters = "";
        var appendSeparator = function() {
            parameters += parameters === "" ? "?" : "&";
        };
        var option;
        for (option in this.options) {
            if (this.options.hasOwnProperty(option)) {
                appendSeparator();
                if (isPredicate(this.options[option])) {
                    parameters += option + "=" + this.options[option].parsePredicate();
                } else {
                    parameters += option + "=" + this.options[option];
                }
            }
        }
        return parameters;
    };
    /**
         * Class method to create a new PreparedQueryOptions object from a simple object
         *
         * @method fromObject
         * @param {Object} object the object to build from
         * @returns {PreparedQueryOptions}
         */
    PreparedQueryOptions.fromObject = function(object) {
        var preparedQueryOptions = new PreparedQueryOptions();
        var property;
        for (property in object) {
            if (object.hasOwnProperty(property) && typeof preparedQueryOptions[property] === "function") {
                preparedQueryOptions[property](object[property]);
            }
        }
        return preparedQueryOptions;
    };
    return PreparedQueryOptions;
} ]);

/**
 * The recallProvider is the entry point for common configuration options. Specific adapters may have their own
 * configuration options
 */
angular.module("recall").provider("recall", [ function() {
    var config = {};
    // The default local adapter to use unless otherwise specified by the model Definition
    config.localAdapter = null;
    this.setLocalAdapter = function(localAdapter) {
        config.localAdapter = localAdapter;
        return this;
    };
    // The default remote adapter to use unless otherwise specified by the model Definition
    config.remoteAdapter = null;
    this.setRemoteAdapter = function(remoteAdapter) {
        config.remoteAdapter = remoteAdapter;
        return this;
    };
    // Time in milliseconds to throttle Entity dirty checking. This allows for multiple digest cycles to pass
    // between checking if an Entity is dirty by examining its stored state
    config.dirtyCheckThreshold = 30;
    this.setDirtCheckThreshold = function(dirtyCheckThreshold) {
        config.dirtyCheckThreshold = dirtyCheckThreshold;
        return this;
    };
    // The default last modified field name. To enable synchronization, this must be set.
    config.lastModifiedFieldName = null;
    this.setLastModifiedFieldName = function(lastModifiedFieldName) {
        config.lastModifiedFieldName = lastModifiedFieldName;
        return this;
    };
    // The default soft delete field name. To enable synchronization, this must be set.
    config.deletedFieldName = null;
    this.setDeletedFieldName = function(deletedFieldName) {
        config.deletedFieldName = deletedFieldName;
        return this;
    };
    this.$get = [ "recallBaseModelService", function(baseModelService) {
        var service = {
            config: config
        };
        // To Avoid circular dependency, add the config to the baseModelService
        baseModelService.setDirtyCheckThreshold(config.dirtyCheckThreshold);
        baseModelService.setLastModifiedFieldName(config.lastModifiedFieldName);
        baseModelService.setDeletedFieldName(config.deletedFieldName);
        // Set the adapters
        if (config.localAdapter) {
            baseModelService.setLocalAdapter(config.localAdapter);
        }
        if (config.remoteAdapter) {
            baseModelService.setRemoteAdapter(config.remoteAdapter);
        }
        /*------------------------------ Alias methods exposed in the recall service -------------------------------*/
        /**
             * Get an array of the defined Models.
             * @returns {Entity[]} The models
             */
        service.getModels = baseModelService.getModels;
        /**
             * Gets a defined model by its name
             * @param {String} modelName
             * @returns {Entity} The model or null if the model is not found
             */
        service.getModel = baseModelService.getModel;
        /**
             * Creates a model based on a definition.
             * @param {Object} modelDefinition The definition of the model including fields and associations
             * @param {Object} [localAdapter] The adapter that is used to perform the CRUD actions locally
             * @param {Object} [remoteAdapter] The adapter that is used to perform the CRUD actions remotely
             * @returns {Entity} The model
             */
        service.defineModel = baseModelService.defineModel;
        return service;
    } ];
} ]);

angular.module("recall").factory("recallSyncHandler", [ "$log", "$q", "recallLocalStorage", "recallPredicate", "recallPreparedQueryOptions", function($log, $q, localStorage, Predicate, PreparedQueryOptions) {
    var syncHandler = {};
    /**
         * Represents the result of a sync operation
         * @param {Array} sent An array of entities sent to the remote adapter
         * @param {Array} returned An array of data objects returned from the remote adapter
         * @param {Number} totalProcessed The total number of entities processed in the sync operation
         * @param {String} status The operation's status message
         * @constructor
         */
    var SyncResult = function(sent, returned, totalProcessed, status) {
        this.sent = sent;
        this.returned = returned;
        this.totalProcessed = totalProcessed;
        this.status = status;
    };
    /**
         * Retrieves the last sync time for a given model in ISO format
         * @param {Object} Model The model initiating the sync (the sync time is stored per model)
         * @returns {String} The last sync date in ISO format
         */
    syncHandler.getLastSyncTime = function(Model) {
        return localStorage.get(localStorage.keys.LAST_SYNC, Model.modelName);
    };
    /**
         * Updates the last sync time for a model
         * @param {Object} Model The model initiating the sync
         */
    syncHandler.updateLastSyncTimeToNow = function(Model) {
        localStorage.set(localStorage.keys.LAST_SYNC, new Date().toISOString(), Model.modelName);
    };
    /**
         * Validates the model to see if it is able to synchronize.
         * @param {Object} Model The model initiating the sync
         * @returns {Boolean|SyncResult} Returns true if valid or a SyncResult if not valid
         */
    syncHandler.validateModel = function(Model) {
        if (!Model.localAdapter || !Model.remoteAdapter) {
            return new SyncResult([], [], 0, "Remote or Local Adapter not Set");
        }
        if (typeof Model.remoteAdapter.synchronize !== "function") {
            return new SyncResult([], [], 0, "Synchronize handler not found on remote adapter");
        }
        if (typeof Model.localAdapter.synchronize !== "function") {
            return new SyncResult([], [], 0, "Synchronize handler not found on local adapter");
        }
        return true;
    };
    /**
         * Sends data from the local adapter to the remote adapter to update.
         * @param {Object} Model The model initiating the sync
         * @param {Array} data An array of objects to send to the remote adapter to sync
         * @returns {promise}
         */
    syncHandler.sendSyncRequestData = function(Model, data) {
        var lastSync = this.getLastSyncTime(Model);
        return Model.remoteAdapter.synchronize(Model, data, lastSync);
    };
    /**
         * Processes the data sent back from the remote adapter. This will update/create/delete records in the local
         * adapter
         * @param {Object} Model The model initiating the sync
         * @param {Array} data An array of data objects to update/create/delete
         * @returns {promise}
         */
    syncHandler.processSyncResponseData = function(Model, data) {
        var lastSync = this.getLastSyncTime(Model);
        return Model.localAdapter.synchronize(Model, data, lastSync);
    };
    /**
         * Initializes a sync request
         * @param {Object} Model The model initiating the sync
         * @param {Array} data An array of local entities to send to the remote adapter to sync
         * @returns {promise}
         */
    syncHandler.processSyncRequest = function(Model, data) {
        var dfd = $q.defer();
        var result;
        var isValid = syncHandler.validateModel(Model);
        if (isValid !== true) {
            isValid.sent = data;
            $log.error("Sync Handler: " + Model.modelName, isValid);
            return $q.reject(isValid);
        }
        var syncResponseData = [];
        var totalItemsProcessed = data.length;
        var handleError = function(e) {
            result = new SyncResult(data, syncResponseData, totalItemsProcessed, e);
            $log.error("Sync Handler: " + Model.modelName, result);
            dfd.reject(result);
        };
        var handleComplete = function() {
            result = new SyncResult(data, syncResponseData, totalItemsProcessed, "Complete");
            $log.debug("Sync Handler: " + Model.modelName, "Sync Complete", result);
            syncHandler.updateLastSyncTimeToNow(Model);
            dfd.resolve(result);
        };
        $log.debug("Sync Handler: Sending " + data.length + " local item(s) to sync");
        syncHandler.sendSyncRequestData(Model, data).then(function(syncResponse) {
            // TODO: Handle Conflicts
            $log.debug("Sync Handler: Found " + syncResponse.data.length + " remote item(s) to sync");
            totalItemsProcessed += syncResponse.data.length;
            syncResponseData = syncResponse.data;
            if (syncResponse.data.length > 0) {
                syncHandler.processSyncResponseData(Model, syncResponse.data).then(handleComplete, handleError);
            } else {
                // No data from server to sync
                handleComplete();
            }
        }, handleError);
        return dfd.promise;
    };
    /**
         * Initializes a sync at the model level. This will look for all local entities that have been modified since
         * the last sync time and send them to the remote adapter to be synchronized. The remote adapter should respond
         * with an Array of Model entities that need to be updated locally.
         * @param {Object} Model The model initiating the sync
         * @returns {promise}
         */
    syncHandler.model = function(Model) {
        var dfd = $q.defer();
        var result;
        // Perform the validation checks before the local adapter is called
        var isValid = syncHandler.validateModel(Model);
        if (isValid !== true) {
            $log.error("Sync Handler: " + Model.modelName, isValid);
            return $q.reject(isValid);
        }
        $log.debug("Sync Handler: Starting Model Sync");
        var lastSync = this.getLastSyncTime(Model);
        var queryOptions = new PreparedQueryOptions();
        if (lastSync) {
            var predicate = new Predicate("lastModified").greaterThanOrEqualTo(lastSync);
            queryOptions.$filter(predicate);
        }
        // Get all local entities in this model that have been modified since the last sync time and therefor should
        // be sent to the remote adapter
        Model.localAdapter.find(Model, queryOptions, true).then(function(response) {
            return syncHandler.processSyncRequest(Model, response.data);
        }, function(e) {
            // An error occurred while fetching the local entities
            result = new SyncResult([], [], 0, e);
            $log.error("Sync Handler: " + Model.modelName, result);
            dfd.reject(result);
        }).then(function(syncResponse) {
            dfd.resolve(syncResponse);
        }, function(e) {
            dfd.reject(e);
        });
        return dfd.promise;
    };
    /**
         * Initializes a sync at the entity level. This will only send the single entity (in an array) to the remote
         * adapter to be synchronized (regardless of the lastModified time). The remote adapter should respond with an
         * Array of Model entities that need to be updated locally.
         * @param {Object} Model The model initiating the sync
         * @param {Object} entity The entity to send to the remote adapter for synchronization
         * @returns {promise}
         */
    syncHandler.entity = function(Model, entity) {
        $log.debug("Sync Handler: Starting Entity Sync");
        return syncHandler.processSyncRequest(Model, [ entity ]);
    };
    return syncHandler;
} ]);