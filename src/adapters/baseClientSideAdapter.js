angular.module('recall').factory('recallBaseClientSideAdapter', [
    '$log',
    '$q',
    '$window',
    'recall',
    'recallAdapterResponse',
    'recallPredicate',

    function ($log, $q, $window, recall, AdapterResponse, Predicate) {

        var BaseClientSideAdapter = function (name, service, connectionArguments, pkGenerator) {
            this.name = name;
            this.service = service;
            this.connectionArguments = connectionArguments;
            this.generatePrimaryKey = pkGenerator;
            this.db = null;
            this.connectionPromise = null;
        };

        // Connects to the database
        BaseClientSideAdapter.prototype.connect = function () {
            var dfd = $q.defer();
            var adapter = this;

            if (adapter.db) {
                dfd.resolve(adapter.db);
            } else if (adapter.connectionPromise) {
                return adapter.connectionPromise;
            } else {

                adapter.service.connect.apply(this, adapter.connectionArguments).then(function (db) {
                    $log.debug(adapter.name + ': Connection Success');
                    adapter.db = db;
                    dfd.resolve(adapter.db);
                }, function (e) {
                    $log.error(adapter.name + ': Connect', e);
                    dfd.reject(e);
                });

            }

            adapter.connectionPromise = dfd.promise;
            return dfd.promise;
        };

        /**
         * Creates a new Entity
         * @param {Object} theModel The model of the entity to create
         * @param {Object} modelInstance The entity to create
         * @returns {promise} Resolved with an AdapterResponse
         */
        BaseClientSideAdapter.prototype.create = function (theModel, modelInstance) {
            var dfd = $q.defer();
            var adapter = this;
            var response;

            var buildError = function (e) {
                response = new AdapterResponse(e, 0, AdapterResponse.INTERNAL_SERVER_ERROR);
                $log.error(adapter.name + ': Create ' + theModel.modelName, response, modelInstance);
                return response;
            };

            modelInstance[theModel.primaryKeyFieldName] = adapter.generatePrimaryKey();
            modelInstance = theModel.getRawModelObject(modelInstance, false);

            // TODO: Store all dates in ISO format
            modelInstance[theModel.lastModifiedFieldName] = new Date().toISOString();

            adapter.connect().then(function (db) {

                adapter.service.create(db, theModel, modelInstance).then(function (result) {
                    response = new AdapterResponse(result, 1, AdapterResponse.CREATED);
                    $log.debug(adapter.name + ': Create ' + theModel.modelName, response);
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
        BaseClientSideAdapter.prototype.findOne = function (theModel, pk, queryOptions, includeDeleted) {
            var dfd = $q.defer();
            var adapter = this;
            var response;

            var buildError = function (e, status) {
                response = new AdapterResponse(e, 0, status || AdapterResponse.INTERNAL_SERVER_ERROR);
                $log.error(adapter.name + ': FindOne ' + theModel.modelName, response, pk, queryOptions);
                return response;
            };

            adapter.connect().then(function (db) {

                adapter.service.findOne(db, theModel, pk).then(function (result) {

                    if (result && (includeDeleted || !result[theModel.deletedFieldName])) {
                        adapter.performExpand(result, theModel, queryOptions, db).then(function () {
                            response = new AdapterResponse(result, 1);
                            $log.debug(adapter.name + ': FindOne ' + theModel.modelName, response, pk, queryOptions);
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
        BaseClientSideAdapter.prototype.find = function (theModel, queryOptions, includeDeleted) {
            var dfd = $q.defer();
            var adapter = this;
            var response;

            var buildError = function (e) {
                response = new AdapterResponse(e, 0, AdapterResponse.INTERNAL_SERVER_ERROR);
                $log.error(adapter.name + ': Find ' + theModel.modelName, response, queryOptions);
                return response;
            };

            adapter.connect().then(function (db) {
                var filterPredicate;

                if (queryOptions && queryOptions.$filter()) {
                    filterPredicate = queryOptions.$filter();
                }

                adapter.service.find(db, theModel, includeDeleted).then(function (results) {

                    var i;
                    var promises = [];
                    for (i = 0; i < results.length; i++) {
                        if (BaseClientSideAdapter.resultMatchesFilters(results[i], filterPredicate)) {
                            promises.push(adapter.performExpand(results[i], theModel, queryOptions, db));
                        }
                    }

                    $q.all(promises).then(function () {
                        results = BaseClientSideAdapter.applyFilter(results, filterPredicate);
                        results = BaseClientSideAdapter.applyOrderBy(theModel, results, queryOptions);

                        var totalCount = results.length;
                        results = BaseClientSideAdapter.applyPaging(results, queryOptions);
                        response = new AdapterResponse(results, totalCount);

                        $log.debug(adapter.name + ': Find ' + theModel.modelName, response, queryOptions);
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
         * @returns {promise} Resolved with an AdapterResponse
         */
        BaseClientSideAdapter.prototype.update = function (theModel, pk, modelInstance) {
            var dfd = $q.defer();
            var adapter = this;
            var response;

            var buildError = function (e, status) {
                response = new AdapterResponse(e, 0, status || AdapterResponse.INTERNAL_SERVER_ERROR);
                $log.error(adapter.name + ': Update ' + theModel.modelName, response, modelInstance);
                return response;
            };

            delete modelInstance[theModel.primaryKeyFieldName];
            // TODO: Convert all dates to ISO Format
            modelInstance[theModel.lastModifiedFieldName] = new Date().toISOString();
            modelInstance = theModel.getRawModelObject(modelInstance, false);

            adapter.connect().then(function (db) {

                adapter.service.findOne(db, theModel, pk).then(function (result) {

                    if (result && !result[theModel.deletedFieldName]) {

                        angular.extend(result, modelInstance);
                        adapter.service.update(db, theModel, pk, result).then(function (result) {

                            response = new AdapterResponse(result, 1);
                            $log.debug(adapter.name + ': Update ' + theModel.modelName, response, modelInstance);
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
         * Performs a soft remove of an Entity given the primary key of the entity to remove
         * @param {Object} theModel The model of the entity to remove
         * @param {String|Number} pk The primary key of the entity
         * @returns {promise} Resolved with an AdapterResponse
         */
        BaseClientSideAdapter.prototype.remove = function (theModel, pk) {
            var dfd = $q.defer();
            var adapter = this;
            var response;

            var buildError = function (e, status) {
                response = new AdapterResponse(e, 0, status || AdapterResponse.INTERNAL_SERVER_ERROR);
                $log.error(adapter.name + ': Remove ' + theModel.modelName, response);
                return response;
            };

            adapter.connect().then(function (db) {

                adapter.service.findOne(db, theModel, pk).then(function (result) {

                    if (result) {

                        result[theModel.lastModifiedFieldName] = new Date().toISOString();
                        result[theModel.deletedFieldName] = true;

                        adapter.service.update(db, theModel, pk, result).then(function () {

                            response = new AdapterResponse(null, 1, AdapterResponse.NO_CONTENT);
                            $log.debug(adapter.name + ': Remove ' + theModel.modelName, response);
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
         * Takes an Array of entities and creates/updates/deletes them. Returns a list of entities that need to be synchronized
         * @param {Object} theModel The model of the entities to synchronize
         * @param {Array} [dataToSync] An array of objects to create/update/delete
         * @param {String} lastSync An ISO Date String representing the last sync
         * @param {Boolean} [hardDelete=false] If true,any entities that are marked for delete will be hard deleted
         * @returns {promise} Resolved with an AdapterResponse representing the items needing to be synchronized
         */
        BaseClientSideAdapter.prototype.synchronize = function (theModel, dataToSync, lastSync, hardDelete) {
            var dfd = $q.defer();
            var adapter = this;
            var response;

            var buildError = function (e) {
                response = new AdapterResponse(e, 0, AdapterResponse.INTERNAL_SERVER_ERROR);
                $log.error(adapter.name + ': Synchronize ' + theModel.modelName, response, dataToSync);
                return response;
            };

            dataToSync = dataToSync || [];

            adapter.connect().then(function (db) {

                var i;
                var promises = [];
                for (i = 0; i < dataToSync.length; i++) {
                    promises.push(adapter.syncInstance(db, theModel, dataToSync[i][theModel.primaryKeyFieldName], dataToSync[i], hardDelete));
                }

                $q.all(promises).then(function (syncResults) {
                    var i;
                    var ignoreList = [];
                    for (i = 0; i < syncResults.length; i++) {
                        if (syncResults[i] && syncResults[i][theModel.primaryKeyFieldName]) {
                            ignoreList.push(syncResults[i][theModel.primaryKeyFieldName]);
                        }
                    }

                    adapter.getSyncList(db, theModel, lastSync, ignoreList).then(function (results) {
                        response = new AdapterResponse(results, results.length, AdapterResponse.OK);
                        $log.debug(adapter.name + ': Synchronize ' + theModel.modelName, response, syncResults);
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
         * Synchronizes a single model instance. This will remove if it is marked for delete, update if it exists, create if it does not exist
         * @param {Object} db The db returned from the connection
         * @param {Object} theModel The model of the entities to synchronize
         * @param {String|Number} pk The primary key of the entity
         * @param {Object} rawModelInstance The raw entity to update
         * @param {Boolean} [hardDelete=false]
         * @returns {promise} Resolved with the instance or null
         */
        BaseClientSideAdapter.prototype.syncInstance = function (db, theModel, pk, rawModelInstance, hardDelete) {
            var dfd = $q.defer();
            var adapter = this;

            adapter.service.findOne(db, theModel, pk).then(function (result) {

                // Update if the stored instance's last modified time is before the rawModelInstance's last modified time
                var predicate = new Predicate(theModel.lastModifiedFieldName).lessThan(rawModelInstance[theModel.lastModifiedFieldName]);

                if (result && BaseClientSideAdapter.resultMatchesFilters(result, predicate)) {

                    if (!rawModelInstance[theModel.deletedFieldName]) {

                        // Update the instance
                        delete rawModelInstance[theModel.primaryKeyFieldName];
                        angular.extend(result, rawModelInstance);
                        adapter.service.update(db, theModel, pk, result).then(function (result) {
                            dfd.resolve(result);
                        }, function (e) {
                            dfd.reject(e);
                        });

                    } else if (hardDelete === true) {

                        // Hard Delete the instance
                        adapter.service.remove(db, theModel, pk).then(function (result) {
                            dfd.resolve(result);
                        }, function (e) {
                            dfd.reject(e);
                        });

                    } else {

                        // Soft Delete the instance
                        result[theModel.lastModifiedFieldName] = new Date().toISOString();
                        result[theModel.deletedFieldName] = true;

                        adapter.service.update(db, theModel, pk, result).then(function (result) {
                            dfd.resolve(result);
                        }, function (e) {
                            dfd.reject(e);
                        });

                    }

                } else if (!result && !rawModelInstance[theModel.deletedFieldName]) {

                    rawModelInstance[theModel.primaryKeyFieldName] = pk;
                    adapter.service.create(db, theModel, rawModelInstance).then(function (result) {
                        dfd.resolve(result);
                    }, function (e) {
                        dfd.reject(e);
                    });

                } else {
                    // The stored instance is newer than the update or the object is already deleted
                    dfd.resolve(null);
                }

            }, function (e) {
                dfd.reject(e);
            });

            return dfd.promise;
        };

        /**
         * Finds all entities that have been modified since the lastSync
         * @param {Object} db The db returned from the connection
         * @param {Object} theModel The model of the entities to synchronize
         * @param {String} lastSync An ISO Date String representing the last sync
         * @param {Array} ignoreList An array of primary keys to ignore
         * @returns {promise} Resolved the list of entities
         */
        BaseClientSideAdapter.prototype.getSyncList = function (db, theModel, lastSync, ignoreList) {
            var dfd = $q.defer();
            var adapter = this;

            ignoreList = ignoreList || [];

            adapter.service.find(db, theModel).then(function (results) {
                var predicate;
                var filteredResults = [];

                if (lastSync) {
                    predicate = new Predicate(theModel.lastModifiedFieldName).greaterThan(new Date(lastSync));
                }

                var i;
                for (i = 0; i < results.length; i++) {
                    if ((!predicate || BaseClientSideAdapter.resultMatchesFilters(results[i], predicate)) && ignoreList.indexOf(results[i][theModel.primaryKeyFieldName]) === -1) {
                        filteredResults.push(results[i]);
                    }
                }

                dfd.resolve(filteredResults);
            }, function (e) {
                dfd.reject(e);
            });

            return dfd.promise;
        };

        // Expands a has one model association
        BaseClientSideAdapter.prototype.expandHasOne = function (theModel, instance, association, db, pathsToExpand) {
            var dfd = $q.defer();
            var adapter = this;

            if (instance[association.mappedBy] === undefined) {
                instance[association.alias] = null;
                dfd.resolve();
                return dfd.promise;
            }

            adapter.service.findOne(db, theModel, instance[association.mappedBy]).then(function (result) {

                if (result && !result[theModel.deletedFieldName]) {
                    instance[association.alias] = result;
                    if (pathsToExpand.length > 1) {

                        var pathToExpand = pathsToExpand.join('.');
                        adapter.expandPath(result, theModel, pathToExpand.substring(pathToExpand.indexOf('.') + 1), db).then(function () {
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
            }, function (e) {
                dfd.reject(e);
            });

            return dfd.promise;
        };

        // Expands a has many model association
        BaseClientSideAdapter.prototype.expandHasMany = function (theModel, instance, association, db, pathsToExpand) {
            var dfd = $q.defer();
            var adapter = this;

            adapter.service.findByAssociation(db, theModel, instance[theModel.primaryKeyFieldName], association.mappedBy).then(function (results) {

                var filter = association.getOptions(instance).$filter();
                if (filter) {
                    results = BaseClientSideAdapter.applyFilter(results, filter);
                }

                instance[association.alias] = results;
                if (pathsToExpand.length > 1) {

                    var i;
                    var promises = [];
                    var pathToExpand = pathsToExpand.join('.');
                    for (i = 0; i < results.length; i++) {
                        promises.push(adapter.expandPath(results[i], theModel, pathToExpand.substring(pathToExpand.indexOf('.') + 1), db));
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
        BaseClientSideAdapter.prototype.expandPath = function (result, theModel, pathToExpand, db) {
            var pathsToExpand = pathToExpand.split('.');
            var toExpand = pathsToExpand[0];
            var adapter = this;

            if (toExpand) {
                var association = theModel.getAssociationByAlias(toExpand);
                if (association) {
                    var model = association.getModel();
                    if (association.type === 'hasOne') {
                        return adapter.expandHasOne(model, result, association, db, pathsToExpand);
                    } else if (association.type === 'hasMany') {
                        return adapter.expandHasMany(model, result, association, db, pathsToExpand);
                    }
                }
            }

            // There is nothing left to expand, just resolve.
            var dfd = $q.defer();
            dfd.resolve();
            return dfd.promise;
        };

        // Expands all Model associations defined in the query options $expand clause
        BaseClientSideAdapter.prototype.performExpand = function (result, theModel, queryOptions, db) {
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
                    promises.push(this.expandPath(result, theModel, paths[i], db));
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
        BaseClientSideAdapter.resultMatchesFilters = function (result, predicate) {
            return predicate ? predicate.test(result) : true;
        };

        // Applies a filter predicate to a set of results and returns an array of the matching results
        BaseClientSideAdapter.applyFilter = function (results, filterPredicate) {
            if (filterPredicate && results) {
                results = results.filter(function (a) {
                    return BaseClientSideAdapter.resultMatchesFilters(a, filterPredicate);
                });
            }
            return results;
        };

        // Sorts the data given an $orderBy clause in query options
        BaseClientSideAdapter.applyOrderBy = function (theModel, results, queryOptions) {
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
        BaseClientSideAdapter.applyPaging = function (results, queryOptions) {
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

        return BaseClientSideAdapter;
    }
]);