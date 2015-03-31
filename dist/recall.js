/*! recall 31-03-2015 */
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
            if (result[association.mappedBy] === undefined) {
                result[association.mappedBy] = null;
                dfd.resolve();
                return dfd.promise;
            }
            var store = tx.objectStore(model.dataSourceName);
            var pathToExpand = pathsToExpand.join(".");
            var req = store.get(result[association.mappedBy]);
            req.onsuccess = function() {
                if (req.result && !req.result[model.deletedFieldName]) {
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
                } else {
                    result[association.alias] = null;
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
                results = results.filter(function(a) {
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
        var getUrlWithOptions = function(url, queryOptions) {
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
            var url = getUrlWithOptions(providerConfig.serverAPILocation + theModel.dataSourceName + "/" + pk, queryOptions);
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
            var url = getUrlWithOptions(providerConfig.serverAPILocation + theModel.dataSourceName, queryOptions);
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

angular.module("recall.adapter.sync", [ "recall" ]).provider("recallSyncAdapter", [ function() {
    var providerConfig = {};
    // Sets the master adapter
    providerConfig.masterAdapter = "";
    this.setMaster = function(masterAdapter) {
        providerConfig.masterAdapter = masterAdapter;
        return this;
    };
    // Sets the slave adapter
    providerConfig.slaveAdapter = "";
    this.setSlave = function(slaveAdapter) {
        providerConfig.slaveAdapter = slaveAdapter;
        return this;
    };
    this.$get = [ "$injector", "$log", "$q", "recallAdapterResponse", "recallLocalStorage", "recallPredicate", "recallPreparedQueryOptions", function($injector, $log, $q, AdapterResponse, localStorage, Predicate, PreparedQueryOptions) {
        var adapter = {};
        /**
                 * Validates the Model during creation
                 * @param {Object} theModel
                 * @returns {Boolean} True if the model passes validation
                 */
        adapter.modelValidationHook = function(theModel) {
            var master = getMaster();
            var slave = getSlave();
            if (!master) {
                $log.error("SyncAdapter: Master Adapter not Set", this, theModel);
                return false;
            }
            if (!slave) {
                $log.error("SyncAdapter: Slave Adapter not Set", this, theModel);
                return false;
            }
            if (typeof master.synchronize !== "function") {
                $log.error("SyncAdapter: Synchronize handler not found on the master adapter", this, theModel);
                return false;
            }
            if (typeof slave.synchronize !== "function") {
                $log.error("SyncAdapter: Synchronize handler not found on the slave adapter", this, theModel);
                return false;
            }
            if (typeof master.modelValidationHook === "function" && !master.modelValidationHook(theModel)) {
                return false;
            }
            if (typeof slave.modelValidationHook === "function" && !slave.modelValidationHook(theModel)) {
                return false;
            }
            return true;
        };
        /**
                 * Creates a new Entity on the Slave and attempts to sync to the Master
                 * @param {Object} theModel The model of the entity to create
                 * @param {Object} modelInstance The entity to create
                 * @param {PreparedQueryOptions} [queryOptions] The query options to use for preferMaster
                 * @returns {promise} Resolved with an AdapterResponse
                 */
        adapter.create = function(theModel, modelInstance, queryOptions) {
            if (queryOptions && queryOptions.preferMaster() === true) {
                return getMaster().create(theModel, modelInstance);
            } else {
                return getSlave().create(theModel, modelInstance);
            }
        };
        /**
                 * Finds a single entity given a primary key on the Slave
                 * @param {Object} theModel The model of the entity to find
                 * @param {String|Number} pk The primary key of the entity to find
                 * @param {PreparedQueryOptions} [queryOptions] The query options to use for $expand and preferMaster
                 * @returns {promise} Resolved with an AdapterResponse
                 */
        adapter.findOne = function(theModel, pk, queryOptions) {
            var response;
            if (!pk) {
                response = new AdapterResponse("No Primary Key was supplied", 0, AdapterResponse.BAD_REQUEST);
                $log.error("SyncAdapter: FindOne " + theModel.modelName, response, pk, queryOptions);
                return $q.reject(response);
            }
            if (queryOptions && queryOptions.preferMaster() === true) {
                return getMaster().findOne(theModel, pk, queryOptions);
            } else {
                return getSlave().findOne(theModel, pk, queryOptions);
            }
        };
        /**
                 * Finds a set of Model entities on the Slave
                 * @param {Object} theModel The model of the entities to find
                 * @param {PreparedQueryOptions} [queryOptions] The query options to use
                 * @returns {promise} Resolved with an AdapterResponse
                 */
        adapter.find = function(theModel, queryOptions) {
            if (queryOptions && queryOptions.preferMaster() === true) {
                return getMaster().find(theModel, queryOptions);
            } else {
                return getSlave().find(theModel, queryOptions);
            }
        };
        /**
                 * Updates a Model entity on the Slave given the primary key of the entity. Attempts to sync to the Master.
                 * @param {Object} theModel The model of the entity to update
                 * @param {String|Number} pk The primary key of the entity
                 * @param {Object} modelInstance The entity to update
                 * @param {PreparedQueryOptions} [queryOptions] The query options to use for preferMaster
                 * @returns {promise} Resolved with an AdapterResponse
                 */
        adapter.update = function(theModel, pk, modelInstance, queryOptions) {
            var response;
            if (!pk) {
                response = new AdapterResponse("No Primary Key was supplied", 0, AdapterResponse.BAD_REQUEST);
                $log.error("SyncAdapter: Update " + theModel.modelName, response, modelInstance);
                return $q.reject(response);
            }
            if (queryOptions && queryOptions.preferMaster() === true) {
                return getMaster().update(theModel, pk, modelInstance);
            } else {
                return getSlave().update(theModel, pk, modelInstance);
            }
        };
        /**
                 * Removes an Entity from the Slave given the primary key of the entity to remove. Attempts to sync to the Master.
                 * @param {Object} theModel The model of the entity to remove
                 * @param {String|Number} pk The primary key of the entity
                 * @param {PreparedQueryOptions} [queryOptions] The query options to use for preferMaster
                 * @returns {promise} Resolved with an AdapterResponse
                 */
        adapter.remove = function(theModel, pk, queryOptions) {
            var response;
            if (!pk) {
                response = new AdapterResponse("No Primary Key was supplied", 0, AdapterResponse.BAD_REQUEST);
                $log.error("SyncAdapter: Remove " + theModel.modelName, response, pk);
                return $q.reject(response);
            }
            if (queryOptions && queryOptions.preferMaster() === true) {
                return getMaster().remove(theModel, pk);
            } else {
                return getSlave().remove(theModel, pk);
            }
        };
        /**
                 * Manually Syncs the Slave and Master adapters
                 * @param {Object} theModel The model of the entities to synchronize
                 * @returns {promise} Resolved with an AdapterResponse
                 */
        adapter.synchronize = function(theModel) {
            return processSyncRequest(theModel);
        };
        var getAdapter = function(adapter) {
            return typeof adapter === "string" ? $injector.get(adapter) : adapter;
        };
        var getMaster = function() {
            return getAdapter(providerConfig.masterAdapter);
        };
        var getSlave = function() {
            return getAdapter(providerConfig.slaveAdapter);
        };
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
                 * @param {Object} theModel The model initiating the sync (the sync time is stored per model)
                 * @returns {String} The last sync date in ISO format
                 */
        var getLastSyncTime = function(theModel) {
            return localStorage.get(localStorage.keys.LAST_SYNC, theModel.modelName);
        };
        /**
                 * Updates the last sync time for a model
                 * @param {Object} theModel The model initiating the sync
                 */
        var updateLastSyncTimeToNow = function(theModel) {
            localStorage.set(localStorage.keys.LAST_SYNC, new Date().toISOString(), theModel.modelName);
        };
        /**
                 * Sends data from the local adapter to the remote adapter to update.
                 * @param {Object} theModel The model initiating the sync
                 * @param {Array} data An array of objects to send to the remote adapter to sync
                 * @returns {promise}
                 */
        var sendSyncRequestData = function(theModel, data) {
            var lastSync = getLastSyncTime(theModel);
            return getMaster().synchronize(theModel, data, lastSync);
        };
        /**
                 * Processes the data sent back from the remote adapter. This will update/create/delete records in the local
                 * adapter
                 * @param {Object} theModel The model initiating the sync
                 * @param {Array} data An array of data objects to update/create/delete
                 * @returns {promise}
                 */
        var processSyncResponseData = function(theModel, data) {
            var lastSync = getLastSyncTime(theModel);
            return getSlave().synchronize(theModel, data, lastSync);
        };
        /**
                 * Initializes a sync request
                 * @param {Object} theModel The model initiating the sync
                 * @returns {promise}
                 */
        var processSyncRequest = function(theModel) {
            var dfd = $q.defer();
            var result;
            var syncRequestData = [];
            var syncResponseData = [];
            var totalItemsProcessed = 0;
            var handleError = function(e) {
                result = new SyncResult(syncRequestData, syncResponseData, totalItemsProcessed, e);
                $log.error("SyncAdapter: " + theModel.modelName, result);
                dfd.reject(result);
            };
            var handleComplete = function() {
                result = new SyncResult(syncRequestData, syncResponseData, totalItemsProcessed, "Complete");
                $log.debug("SyncAdapter: " + theModel.modelName, "Sync Complete", result);
                updateLastSyncTimeToNow(theModel);
                dfd.resolve(result);
            };
            $log.debug("SyncAdapter: " + theModel.modelName + " Sync Started");
            var lastSync = getLastSyncTime(theModel);
            var queryOptions = new PreparedQueryOptions();
            if (lastSync) {
                var predicate = new Predicate("lastModified").greaterThanOrEqualTo(lastSync);
                queryOptions.$filter(predicate);
            }
            getSlave().find(theModel, queryOptions, true).then(function(response) {
                $log.debug("SyncAdapter: Sending " + response.count + " local item(s) to sync");
                totalItemsProcessed += response.count;
                syncRequestData = response.data;
                sendSyncRequestData(theModel, response.data).then(function(syncResponse) {
                    // TODO: Handle Conflicts
                    $log.debug("SyncAdapter: Found " + syncResponse.data.length + " remote item(s) to sync");
                    totalItemsProcessed += syncResponse.data.length;
                    syncResponseData = syncResponse.data;
                    if (syncResponse.data.length > 0) {
                        processSyncResponseData(theModel, syncResponse.data).then(handleComplete, handleError);
                    } else {
                        // No data from server to sync
                        handleComplete();
                    }
                }, handleError);
            }, handleError);
            return dfd.promise;
        };
        return adapter;
    } ];
} ]);

angular.module("recall").factory("recallAssociation", [ "$injector", "$log", "$q", "recallPredicate", "recallPreparedQueryOptions", function($injector, $log, $q, Predicate, PreparedQueryOptions) {
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
        this.getOptions = definition.getOptions || function() {
            return new PreparedQueryOptions();
        };
        if (!this.modelName || !this.type || !this.mappedBy) {
            $log.error("Association: The association definition is invalid", definition);
            this.invalid = true;
        }
    };
    /**
         * Gets the Association's Model
         * @returns {Object} The model
         */
    Association.prototype.getModel = function() {
        var recallService = $injector.get("recall");
        return recallService.getModel(this.modelName);
    };
    /**
         * Expands the association and adds it to the entity
         * @param {Entity} entity The entity to add the expanded association to
         * @returns {promise}
         */
    Association.prototype.expand = function(entity) {
        var dfd = $q.defer();
        var self = this;
        var Model = self.getModel();
        if (!Model) {
            return $q.reject("Association: Expand could not find the association's Model");
        }
        var queryOptions = self.getOptions(entity);
        if (self.type === "hasOne") {
            Model.adapter.findOne(Model, entity[self.mappedBy], queryOptions).then(function(response) {
                entity[self.alias] = Model.getRawModelObject(response.data);
                // TODO: The association should be an entity and should have transformResult called
                entity.$entity.storedState[self.alias] = Model.getRawModelObject(response.data);
                $log.debug("Association: Expand", self.type, self.alias, entity, response);
                dfd.resolve();
            }, function(e) {
                $log.error("Association: Expand", self.type, self.alias, entity, e);
                dfd.reject(e);
            });
        } else if (self.type === "hasMany") {
            var predicate = new Predicate(self.mappedBy).equals(entity.$getPrimaryKey());
            var existingPredicate = queryOptions.$filter();
            if (existingPredicate) {
                predicate = Predicate.and([ predicate, existingPredicate ]);
            }
            queryOptions.$filter(predicate);
            Model.adapter.find(Model, queryOptions).then(function(response) {
                var base = [];
                var stored = [];
                // TODO: The associations should be entities and should have transformResult called
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
        } else {
            $log.error("Association: Expand Association type not supported", self.type, self.alias, entity);
            dfd.reject("Association type not supported");
        }
        return dfd.promise;
    };
    return Association;
} ]);

angular.module("recall").factory("recallEntity", [ "$log", "$q", function($log, $q) {
    /**
         * An Entity is an object that represents an instance of a Model. The Entity instance exposes save and remove
         * operations as well as dirty checking and validation.
         *
         * @param {Object} object The object to construct the entity from
         * @param {Object} model The model that created the Entity
         * @param {Boolean} [persisted = false] Set to true if this model was created from an object that came from an adapter.
         * @constructor
         */
    var Entity = function(object, model, persisted) {
        model.extendFromRawObject(this, object);
        Object.defineProperty(this, "$entity", {
            value: {
                lastDirtyCheck: new Date().getTime(),
                lastDirtyState: false,
                persisted: persisted === true,
                saveInProgress: false,
                storedState: null
            }
        });
        Object.defineProperty(this, "$model", {
            value: model
        });
        this.$convertAssociationsToEntities();
        this.$storeState();
    };
    /**
         * Retrieves the Primary Key for the Entity.
         * @returns {String|Number} The Primary Key
         */
    Entity.prototype.$getPrimaryKey = function() {
        return this[this.$model.primaryKeyFieldName];
    };
    /**
         *
         */
    Entity.prototype.$convertAssociationsToEntities = function() {
        var i;
        var alias;
        var ForeignModel;
        var a;
        for (i = 0; i < this.$model.associations.length; i++) {
            alias = this.$model.associations[i].alias;
            ForeignModel = this.$model.associations[i].getModel();
            if (this.$model.associations[i].type === "hasOne") {
                if (this[alias] !== undefined && !this[alias].$entity) {
                    this[alias] = new ForeignModel.Entity(this[alias], this.$entity.persisted);
                }
            } else if (this.$model.associations[i].type === "hasMany") {
                if (this[alias] !== undefined && this[alias] instanceof Array) {
                    for (a = 0; a < this[alias].length; a++) {
                        if (!this[alias].$entity) {
                            this[alias][a] = new ForeignModel.Entity(this[alias][a], this.$entity.persisted);
                        }
                    }
                }
            }
        }
    };
    /**
         * Expands a given association on an Entity
         *
         * @param {String} associationName The alias of the association to expand
         * @returns {promise}
         */
    Entity.prototype.$expand = function(associationName) {
        var association = this.$model.getAssociationByAlias(associationName);
        if (!association) {
            return $q.reject("Entity: $expand could not find the association.");
        }
        return association.expand(this);
    };
    /**
         * Validates an entity against the model's field definition.
         * @returns {Boolean} True if the model validation succeeds
         */
    Entity.prototype.$isValid = function() {
        // TODO: This does not validate associations
        var field;
        var matchesType = false;
        var fieldIsUndefined;
        for (field in this.$model.fields) {
            if (this.$model.fields.hasOwnProperty(field)) {
                fieldIsUndefined = this[field] === null || this[field] === undefined;
                if (this.$model.fields[field].notNull === true && fieldIsUndefined) {
                    $log.debug("Entity: $isValid returned false", "NotNull field was null", field, this);
                    return false;
                }
                switch (this.$model.fields[field].type) {
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
                    matchesType = this[field] instanceof Date || !isNaN(Date.parse(this[field]));
                    break;
                }
                if (!matchesType && !fieldIsUndefined) {
                    $log.debug("Entity: $isValid returned false", "The type was not " + this.$model.fields[field].type, field, this);
                    return false;
                }
                if (typeof this.$model.fields[field].validate === "function" && !this.$model.fields[field].validate(this[field])) {
                    $log.debug("Entity: $isValid returned false", "Custom validator failed", field, this);
                    return false;
                }
            }
        }
        return true;
    };
    /**
         * Persists the model with the adapter. This will update the model if it exists in the adapter or create
         * the model if it does not exist.
         *
         * @method $save
         * @param {PreparedQueryOptions} queryOptions
         * @returns {promise} Resolves with the model
         */
    Entity.prototype.$save = function(queryOptions) {
        var dfd = $q.defer();
        var self = this;
        if (!self.$isValid()) {
            $log.warn("Entity: $save: aborted", self, self[self.$model.primaryKeyFieldName]);
            self.$reset();
            return $q.reject("aborted");
        }
        self.$entity.saveInProgress = true;
        var itemToSave = self.$model.preSave(self);
        var updateSavedState = function(entity, succeeded) {
            entity.$entity.saveInProgress = false;
            if (succeeded !== false) {
                entity.$storeState();
                entity.$entity.persisted = true;
            } else {
                entity.$reset();
            }
        };
        // The model exists in the DB
        if (self.$entity.persisted && itemToSave[self.$model.primaryKeyFieldName]) {
            itemToSave = self.$model.preUpdate(itemToSave);
            var pk = itemToSave[self.$model.primaryKeyFieldName];
            self.$model.adapter.update(self.$model, pk, itemToSave, queryOptions).then(function(response) {
                var result = self.$model.transformResult(response.data);
                self.$model.extendFromRawObject(self, result);
                updateSavedState(self, true);
                $log.debug("Entity: $save: update", self, itemToSave, response);
                dfd.resolve(self);
            }, function(e) {
                updateSavedState(self, false);
                $log.error("Entity: $save: update", self, itemToSave, e);
                dfd.reject(e);
            });
        } else {
            // The model is new
            itemToSave = self.$model.preCreate(itemToSave);
            self.$model.adapter.create(self.$model, itemToSave, queryOptions).then(function(response) {
                var result = self.$model.transformResult(response.data);
                self.$model.extendFromRawObject(self, result);
                updateSavedState(self, true);
                $log.debug("Entity: $save: create", self, itemToSave, response);
                dfd.resolve(self);
            }, function(e) {
                updateSavedState(self, false);
                $log.error("Entity: $save: create", self, itemToSave, e);
                dfd.reject(e);
            });
        }
        return dfd.promise;
    };
    /**
         * Removes the model from the adapter.
         *
         * @method $remove
         * @param {PreparedQueryOptions} queryOptions
         * @returns {promise}
         */
    Entity.prototype.$remove = function(queryOptions) {
        if (this[this.$model.primaryKeyFieldName]) {
            return this.$model.adapter.remove(this.$model, this[this.$model.primaryKeyFieldName], queryOptions);
        }
        $log.error("Entity: $remove", "The primary key was not found");
        return $q.reject("The primary key was not found.");
    };
    /**
         * Stores the model's state so that it can later be reset to the state if needed. This is called
         * on $save so that the model's state is always at the latest save point.
         *
         * @method $storeState
         */
    Entity.prototype.$storeState = function() {
        this.$entity.storedState = this.$model.getRawModelObject(this, false);
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
        if (this.$entity.lastDirtyCheck && delta < this.$model.dirtyCheckThreshold) {
            return this.$entity.lastDirtyState;
        }
        this.$entity.lastDirtyCheck = new Date().getTime();
        // TODO: This does not dirty check associations
        var field;
        var viewValue;
        var storedValue;
        for (field in this.$model.fields) {
            if (this.$model.fields.hasOwnProperty(field)) {
                storedValue = this.$entity.storedState[field];
                viewValue = this[field];
                if (storedValue !== viewValue) {
                    $log.debug("Entity: $isDirty", this[this.$model.primaryKeyFieldName], true, delta);
                    this.$entity.lastDirtyState = true;
                    return true;
                }
            }
        }
        $log.debug("Entity: $isDirty", this[this.$model.primaryKeyFieldName], false, delta);
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
        $log.debug("Entity: $reset", this[this.$model.primaryKeyFieldName], changedProperties);
        return changedProperties;
    };
    return Entity;
} ]);

angular.module("recall").factory("recallLocalStorage", [ "$document", "$window", function($document, $window) {
    /**
         * The localStorage utility helps manage the storage and retrieval of registered application data.
         */
    var storage = {
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
                $window.localStorage.setItem(key, value);
            } else {
                var life = 60 * 60 * 24 * 5;
                var v = encodeURIComponent(value);
                $document.cookie = key + "=" + v + "; max-age=" + life + ";";
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
                value = $window.localStorage.getItem(key) || "";
            } else {
                var regexp = new RegExp(key + "=([^;]+)", "g");
                var c = regexp.exec($document.cookie);
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
                $window.localStorage.removeItem(key);
            } else {
                $document.cookie = key + "=; max-age=0;";
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
            return "localStorage" in $window && $window.localStorage !== null;
        } catch (e) {
            return false;
        }
    };
    return storage;
} ]);

angular.module("recall").factory("recallModel", [ "$log", "$q", "recallAssociation", "recallEntity", "recallModelField", function($log, $q, Association, Entity, ModelField) {
    // Bubbles an error promise to the top.
    var propagateError = function(e) {
        return $q.reject(e);
    };
    /**
         * A Model is in charge of defining a structure for a type of Entity. The model provides CRUD operations for
         * that type of Entity as well as some other utility functions.
         *
         * Models should not be created directly. Instead, the recall service should be used as a proxy for creating
         * models.
         *
         * @constructor
         */
    var Model = function(modelDefinition) {
        this.modelName = modelDefinition.name;
        this.dataSourceName = modelDefinition.dataSourceName || modelDefinition.name;
        // Add the model definition to the Model as read only
        Object.defineProperty(this, "modelDefinition", {
            value: modelDefinition,
            writable: false
        });
        // Add a Constructor method to the Model for constructing new Entities from the Model: new Model.Entity();
        var self = this;
        Object.defineProperty(this, "Entity", {
            writable: false,
            configurable: false,
            value: function(obj, persisted) {
                return new Entity(obj, self, persisted === true);
            }
        });
        this.fields = {};
        this.associations = [];
        this.dirtyCheckThreshold = 30;
        this.primaryKeyFieldName = null;
        this.lastModifiedFieldName = null;
        this.deletedFieldName = null;
        this.adapter = null;
    };
    Model.prototype.setLastModifiedFieldName = function(lastModifiedFieldName) {
        this.lastModifiedFieldName = lastModifiedFieldName;
    };
    Model.prototype.setDeletedFieldName = function(deletedFieldName) {
        this.deletedFieldName = deletedFieldName;
    };
    Model.prototype.setAdapter = function(adapter) {
        this.adapter = adapter;
    };
    Model.prototype.setDirtyCheckThreshold = function(dirtyCheckThreshold) {
        this.dirtyCheckThreshold = dirtyCheckThreshold;
    };
    // Initializes the fields using the common ModelField class
    Model.prototype.initializeModelFields = function() {
        var modelDefinitionFields = this.modelDefinition.fields;
        var field;
        var modelField;
        var lastModifiedField;
        var deletedField;
        for (field in modelDefinitionFields) {
            if (modelDefinitionFields.hasOwnProperty(field)) {
                modelField = new ModelField(field, modelDefinitionFields[field]);
                if (modelField.primaryKey) {
                    this.primaryKeyFieldName = field;
                }
                if (modelField.invalid) {
                    return false;
                } else {
                    this.fields[field] = modelField;
                }
                if (field === this.lastModifiedFieldName) {
                    lastModifiedField = modelField;
                }
                if (field === this.deletedFieldName) {
                    deletedField = field;
                }
            }
        }
        if (lastModifiedField && lastModifiedField.type !== "Date") {
            $log.error("Model: The last modified field is not a Date field");
            return false;
        }
        if (this.lastModifiedFieldName && !lastModifiedField) {
            this.fields[this.lastModifiedFieldName] = new ModelField(this.lastModifiedFieldName, {
                type: "Date",
                index: true
            });
        }
        if (deletedField && deletedField.type !== "Boolean") {
            $log.error("Model: The deletedField field is not a Boolean field");
            return false;
        }
        if (this.deletedFieldName && !deletedField) {
            this.fields[this.deletedFieldName] = new ModelField(this.deletedFieldName, {
                type: "Boolean",
                index: true
            });
        }
        return true;
    };
    // TODO: Support many to many associations
    // Initialize the Model associations using the HasOneAssociation and HasManyAssociation classes
    Model.prototype.initializeAssociations = function() {
        var modelDefinitionAssociations = this.modelDefinition.associations;
        if (!modelDefinitionAssociations) {
            return;
        }
        var i;
        var association;
        for (i = 0; i < modelDefinitionAssociations.length; i++) {
            association = new Association(modelDefinitionAssociations[i]);
            if (association && !association.invalid) {
                if (association.type === "hasOne") {
                    if (!this.fields[association.mappedBy]) {
                        // If no field is defined for the foreign key, define one assuming the same foreign key type.
                        this.fields[association.mappedBy] = new ModelField(association.mappedBy, {
                            type: this.fields[this.primaryKeyFieldName].type,
                            index: association.mappedBy
                        });
                    } else {
                        this.fields[association.mappedBy].index = association.mappedBy;
                    }
                }
                this.associations.push(association);
            }
        }
    };
    /**
         * Gets a Model Association by the alias name. The alias is defined as the "as" property on an alias if
         * defined and falls back to the model name if "as" is not defined.
         *
         * @param {String} alias The association's alias
         * @returns {Object} The association object
         */
    Model.prototype.getAssociationByAlias = function(alias) {
        var i;
        for (i = 0; i < this.associations.length; i++) {
            if (this.associations[i].alias === alias) {
                return this.associations[i];
            }
        }
        return null;
    };
    /**
         * Extends an entity with a raw object. The raw object could be input from a controller or the result from
         * an adapter.
         *
         * @param {Object} entity The entity to extend
         * @param {Object} rawObject The object to extend from.
         */
    Model.prototype.extendFromRawObject = function(entity, rawObject) {
        angular.extend(entity, this.getRawModelObject(rawObject));
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
    Model.prototype.getRawModelObject = function(modelEntity, includeExpandedAssociations) {
        var object = {};
        var field;
        for (field in this.fields) {
            if (this.fields.hasOwnProperty(field)) {
                object[field] = modelEntity[field];
            }
        }
        var i;
        var alias;
        var foreignKey;
        var ForeignModel;
        var a;
        for (i = 0; i < this.associations.length; i++) {
            alias = this.associations[i].alias;
            ForeignModel = this.associations[i].getModel();
            if (this.associations[i].type === "hasOne") {
                if (modelEntity[alias] !== undefined) {
                    foreignKey = modelEntity[alias][ForeignModel.primaryKeyFieldName];
                    object[this.associations[i].mappedBy] = foreignKey;
                    if (includeExpandedAssociations !== false) {
                        object[alias] = ForeignModel.getRawModelObject(modelEntity[alias]);
                    }
                }
            } else if (this.associations[i].type === "hasMany" && includeExpandedAssociations !== false) {
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
    Model.prototype.applyDefaultValues = function(entity) {
        var field;
        for (field in this.fields) {
            if (this.fields.hasOwnProperty(field)) {
                if (typeof this.fields[field].getDefaultValue === "function" && entity[field] === undefined) {
                    entity[field] = this.fields[field].getDefaultValue(entity);
                }
            }
        }
    };
    /**
         * Transforms all objects returned by adapter transactions. This calls the transformResult function defined
         * in the model. This also recursively calls transformResult on all associations.
         *
         * @method transformResult
         * @param {Object} resultEntity
         * @returns {Object} The transformed result
         */
    Model.prototype.transformResult = function(resultEntity) {
        var i;
        var alias;
        var ForeignModel;
        var a;
        for (i = 0; i < this.associations.length; i++) {
            alias = this.associations[i].alias;
            ForeignModel = this.associations[i].getModel();
            if (this.associations[i].type === "hasOne") {
                if (resultEntity[alias] !== undefined) {
                    resultEntity[alias] = ForeignModel.transformResult(resultEntity[alias]);
                }
            } else if (this.associations[i].type === "hasMany") {
                if (resultEntity[alias] !== undefined && resultEntity[alias] instanceof Array) {
                    for (a = 0; a < resultEntity[alias].length; a++) {
                        resultEntity[alias][a] = ForeignModel.transformResult(resultEntity[alias][a]);
                    }
                }
            }
        }
        resultEntity = this.getRawModelObject(resultEntity);
        if (typeof this.modelDefinition.transformResult === "function") {
            resultEntity = this.modelDefinition.transformResult(resultEntity);
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
    Model.prototype.preSave = function(entity) {
        entity = this.getRawModelObject(entity);
        if (typeof this.modelDefinition.preSave === "function") {
            return this.modelDefinition.preSave(entity);
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
    Model.prototype.preCreate = function(rawEntity) {
        this.applyDefaultValues(rawEntity);
        if (typeof this.modelDefinition.preCreate === "function") {
            return this.modelDefinition.preCreate(rawEntity);
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
    Model.prototype.preUpdate = function(rawEntity) {
        if (typeof this.modelDefinition.preUpdate === "function") {
            return this.modelDefinition.preUpdate(rawEntity);
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
         * @returns {promise} Resolves with the Entity
         */
    Model.prototype.findOne = function(pk, queryOptions) {
        var self = this;
        if (!pk) {
            $log.error("Model: FindOne", "The primary key was not supplied");
            return $q.reject("The primary key was not supplied.");
        }
        return this.adapter.findOne(this, pk, queryOptions).then(function(response) {
            var result = self.transformResult(response.data);
            var entity = new Entity(result, self, true);
            $log.debug("Model: FindOne", entity, response, queryOptions);
            return entity;
        }, propagateError);
    };
    /**
         * Retrieves a list of models from the adapter. Query options can be passed to determine top, skip, order by,
         * select, expand, and filter operations.
         *
         * @method find
         * @param {Object} [queryOptions] Query options to use for retrieval
         * @returns {promise} Resolves with data.results and data.totalCount where results are Entities
         */
    Model.prototype.find = function(queryOptions) {
        var self = this;
        return this.adapter.find(this, queryOptions).then(function(response) {
            var results = [];
            var i;
            for (i = 0; i < response.data.length; i++) {
                results.push(new Entity(self.transformResult(response.data[i]), self, true));
            }
            var clientResponse = {
                results: results,
                totalCount: response.count
            };
            $log.debug("Model: Find", clientResponse, response, queryOptions);
            return clientResponse;
        }, propagateError);
    };
    /**
         * Removes the model from the adapter given a primary key.
         *
         * @method remove
         * @param {String} pk The primary key of the model to remove
         * @param {Object} [queryOptions] Query options
         * @returns {promise}
         */
    Model.prototype.remove = function(pk, queryOptions) {
        if (!pk) {
            $log.error("Model: Remove", "The primary key was not supplied");
            return $q.reject("The primary key was not supplied.");
        }
        return this.adapter.remove(this, pk, queryOptions);
    };
    return Model;
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
            this.validate = definition.validate;
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
         * Used in Sync Adapters to perform the CRUD operation against the Master instead of the Slave.
         *
         * @method preferMaster
         * @param {Boolean} [preferMaster=false] Whether the SyncAdapter should prefer the slave or master.
         * @return {PreparedQueryOptions|Boolean} PreparedQueryOptions object or the current preferMaster value.
         */
    PreparedQueryOptions.prototype.preferMaster = function(preferMaster) {
        if (arguments.length === 0) {
            return this.options.preferMaster || null;
        }
        if (preferMaster === null) {
            delete this.options.preferMaster;
            return this;
        }
        this.options.preferMaster = preferMaster === true;
        return this;
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
    // The default adapter to use unless otherwise specified by the model Definition
    config.adapter = null;
    this.setAdapter = function(adapter) {
        config.adapter = adapter;
        return this;
    };
    // Time in milliseconds to throttle Entity dirty checking. This allows for multiple digest cycles to pass
    // between checking if an Entity is dirty by examining its stored state
    config.dirtyCheckThreshold = 30;
    this.setDirtyCheckThreshold = function(dirtyCheckThreshold) {
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
    this.$get = [ "$injector", "recallModel", function($injector, Model) {
        var service = {
            adapter: config.adapter,
            lastModifiedFieldName: config.lastModifiedFieldName,
            deletedFieldName: config.deletedFieldName,
            dirtyCheckThreshold: config.dirtyCheckThreshold,
            models: {}
        };
        /**
             * Get an array of the defined Models.
             * @returns {Entity[]} The models
             */
        service.getModels = function() {
            var theModels = [];
            var model;
            for (model in this.models) {
                if (this.models.hasOwnProperty(model)) {
                    theModels.push(this.models[model]);
                }
            }
            return theModels;
        };
        /**
             * Gets a defined model by its name
             * @param {String} modelName
             * @returns {Entity} The model or null if the model is not found
             */
        service.getModel = function(modelName) {
            return this.models[modelName] || null;
        };
        /**
             * Creates a model based on a definition.
             * @param {Object} modelDefinition The definition of the model including fields and associations
             * @param {Object|String} [adapter] The adapter that is used to perform the CRUD actions
             * @returns {Object} The model
             */
        service.defineModel = function(modelDefinition, adapter) {
            adapter = adapter || this.adapter;
            // If the adapter is a string, assume it is the name of the adapter factory and inject it
            adapter = typeof adapter === "string" ? $injector.get(adapter) : adapter;
            // If there was no adapter set, then return out as the model can not be used.
            if (!adapter) {
                return null;
            }
            // TODO: Validated the model definition
            if (!modelDefinition || !modelDefinition.name) {
                return null;
            }
            // If the model is already defined, just return it.
            if (this.models[modelDefinition.name]) {
                return this.models[modelDefinition.name];
            }
            var model = new Model(modelDefinition);
            model.setLastModifiedFieldName(this.lastModifiedFieldName);
            model.setDeletedFieldName(this.deletedFieldName);
            model.setAdapter(adapter);
            model.setDirtyCheckThreshold(this.dirtyCheckThreshold);
            var fieldsValid = model.initializeModelFields();
            if (!fieldsValid) {
                return null;
            }
            model.initializeAssociations();
            // Call the model validation on the adapter after all Entity properties and methods are set.
            if (typeof adapter.modelValidationHook === "function" && !adapter.modelValidationHook(model)) {
                return null;
            }
            this.models[model.modelName] = model;
            return model;
        };
        return service;
    } ];
} ]);