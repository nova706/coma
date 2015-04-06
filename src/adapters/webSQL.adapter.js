angular.module('recall.adapter.webSQL', ['recall']).provider('recallWebSQLAdapter', [

    function () {

        var providerConfig = {};

        // Sets the name of the WebSQL DB database to use
        providerConfig.dbName = 'recall';
        this.setDbName = function (dbName) {
            providerConfig.dbName = dbName;
            return this;
        };

        // Sets the version of the WebSQL DB to use
        providerConfig.dbVersion = 1;
        this.setDbVersion = function (dbVersion) {
            providerConfig.dbVersion = dbVersion;
            return this;
        };

        // Sets the size of the WebSQL DB
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

        // Drops the WebSQL DB database
        this.dropDatabase = function () {
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

                var createTable = function (model, fields, tx) {
                    var dfd = $q.defer();

                    var sql = 'CREATE TABLE IF NOT EXISTS `' + model.dataSourceName + '` (' + fields.join(', ') + ')';
                    $log.debug("WebSQLAdapter: " + sql);
                    tx.executeSql(sql, [], function () {
                        dfd.resolve();
                    }, function (tx, e) {
                        dfd.reject(e);
                    });

                    return dfd.promise;
                };

                // Handles version differences in the database and initializes or migrates the db
                var migrate = function (db) {
                    var dfd = $q.defer();

                    db.transaction(function (tx) {
                        var i;
                        var model;
                        var field;
                        var column;
                        var fields;
                        var models = recall.getModels();
                        var promises = [];

                        for (i = 0; i < models.length; i++) {
                            model = models[i];

                            fields = [];
                            for (field in model.fields) {
                                if (model.fields.hasOwnProperty(field)) {
                                    column = "`" + model.fields[field].name + "`";
                                    switch (model.fields[field].type) {
                                        case 'STRING':
                                            column += ' TEXT';
                                            break;
                                        case 'NUMBER':
                                            column += ' REAL';
                                            break;
                                        case 'DATE':
                                            column += ' TEXT';
                                            break;
                                        case 'BOOLEAN':
                                            column += ' INTEGER';
                                            break;
                                        default:
                                            $log.error('WebSQLAdapter: Migrate - An unknown field type was found.');
                                            return;
                                    }

                                    if (model.fields[field].primaryKey) {
                                        column += ' PRIMARY KEY';
                                    }
                                    if (model.fields[field].unique) {
                                        column += ' UNIQUE';
                                    }
                                    if (model.fields[field].notNull) {
                                        column += ' NOT NULL';
                                    }
                                    fields.push(column);
                                }
                            }
                            promises.push(createTable(model, fields, tx));
                        }

                        $q.all(promises).then(function () {
                            dfd.resolve();
                        }, function (e) {
                            $log.error("WebSQLAdapter: Table Creation Failed", e);
                            dfd.reject(e);
                        });
                    });

                    return dfd.promise;
                };

                // Connects to the database
                var connect = function () {
                    var dfd = $q.defer();

                    if (db) {
                        dfd.resolve(db);
                    } else {
                        try {
                            db = $window.openDatabase(providerConfig.dbName, providerConfig.dbVersion.toString(), 'Recall WebSQL Database', providerConfig.dbSize);
                            migrate(db).then(function () {
                                dfd.resolve(db);
                            }, function (e) {
                                dfd.reject(e);
                            });
                        } catch (e) {
                            dfd.reject(e);
                        }
                    }

                    return dfd.promise;
                };

                // TODO: Cascade create
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
                        $log.error('WebSQLAdapter: Create ' + theModel.modelName, response, modelInstance);
                        return response;
                    };

                    modelInstance[theModel.primaryKeyFieldName] = generatePrimaryKey();
                    modelInstance = theModel.getRawModelObject(modelInstance, false);
                    modelInstance[theModel.lastModifiedFieldName] = new Date();

                    connect().then(function () {
                        db.transaction(function (tx) {
                            var columns = [];
                            var columnValues = [];
                            var placeholders = [];
                            var field;
                            for (field in theModel.fields) {
                                if (theModel.fields.hasOwnProperty(field) && modelInstance.hasOwnProperty(field)) {
                                    columns.push("`" + field + "`");
                                    columnValues.push(convertValueToSQL(theModel.fields[field], modelInstance));
                                    placeholders.push('?');
                                }
                            }
                            var sql = "INSERT INTO `" + theModel.dataSourceName + "` (" + columns.join(',') + ") VALUES (" + placeholders.join(",") +")";
                            $log.debug("WebSQLAdapter: " + sql, columnValues);
                            tx.executeSql(sql, columnValues, function (tx, result) {
                                var results = transformSQLResult(theModel, result);
                                response = new AdapterResponse(results[0], 1, AdapterResponse.CREATED);
                                $log.debug('WebSQLAdapter: Create ' + theModel.modelName, response);
                                dfd.resolve(response);
                            }, function (tx, e) {
                                dfd.reject(buildError(e));
                            });
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
                        $log.error('WebSQLAdapter: FindOne ' + theModel.modelName, response, pk, queryOptions);
                        return response;
                    };

                    connect().then(function () {
                        db.transaction(function (tx) {

                            var sql = "SELECT * FROM `" + theModel.dataSourceName + "` WHERE `" + theModel.primaryKeyFieldName + "`=?";

                            if (!includeDeleted && theModel.deletedFieldName) {
                                sql += " AND `" + theModel.deletedFieldName + "`=0";
                            }

                            $log.debug("WebSQLAdapter: " + sql, [pk]);
                            tx.executeSql(sql, [pk], function (tx, result) {
                                var results = transformSQLResult(theModel, result);
                                if (results[0]) {
                                    performExpand(results[0], theModel, queryOptions, tx).then(function () {
                                        response = new AdapterResponse(results[0], 1);
                                        $log.debug('WebSQLAdapter: FindOne ' + theModel.modelName, response, pk, queryOptions);
                                        dfd.resolve(response);
                                    }, function (e) {
                                        dfd.reject(buildError(e));
                                    });
                                } else {
                                    dfd.reject(buildError('Not Found', AdapterResponse.NOT_FOUND));
                                }
                            }, function (tx, e) {
                                dfd.reject(buildError(e));
                            });
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
                        $log.error('WebSQLAdapter: Find ' + theModel.modelName, response, queryOptions);
                        return response;
                    };

                    connect().then(function () {
                        db.transaction(function (tx) {
                            var filterPredicate;

                            if (queryOptions && queryOptions.$filter()) {
                                filterPredicate = queryOptions.$filter();
                            }

                            var sql = "SELECT * FROM `" + theModel.dataSourceName + "`";

                            if (!includeDeleted && theModel.deletedFieldName) {
                                sql += " WHERE `" + theModel.deletedFieldName + "`=0";
                            }

                            if (queryOptions && queryOptions.$orderBy()) {
                                var field = queryOptions.$orderBy().split(' ')[0];
                                var dir = queryOptions.$orderBy().split(' ')[1] ? queryOptions.$orderBy().split(' ')[1].toUpperCase() : "ASC";
                                sql += " ORDER BY `" + field + "` " + dir;
                            }

                            $log.debug("WebSQLAdapter: " + sql);
                            tx.executeSql(sql, [], function (tx, result) {
                                var results = transformSQLResult(theModel, result);
                                var i;
                                var promises = [];
                                for (i = 0; i < results.length; i++) {
                                    promises.push(performExpand(results[i], theModel, queryOptions, tx));
                                }
                                $q.all(promises).then(function () {
                                    results = applyFilter(results, filterPredicate);

                                    var totalCount = results.length;

                                    // TODO: This is not very efficient but indexedDB does not seem to support a better way with filters and ordering
                                    results = applyPaging(results, queryOptions);
                                    response = new AdapterResponse(results, totalCount);

                                    $log.debug('WebSQLAdapter: Find ' + theModel.modelName, response, queryOptions);
                                    dfd.resolve(response);
                                }, function (e) {
                                    dfd.reject(buildError(e));
                                });
                            }, function (tx, e) {
                                dfd.reject(buildError(e));
                            });
                        });
                    }, function (e) {
                        dfd.reject(buildError(e));
                    });
                    return dfd.promise;
                };

                // TODO: Cascade Update
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
                        $log.error('WebSQLAdapter: Update ' + theModel.modelName, response, modelInstance);
                        return response;
                    };

                    modelInstance = theModel.getRawModelObject(modelInstance, false);
                    modelInstance[theModel.lastModifiedFieldName] = new Date();

                    connect().then(function () {
                        db.transaction(function (tx) {
                            var columns = [];
                            var columnValues = [];
                            var field;
                            for (field in theModel.fields) {
                                if (theModel.fields.hasOwnProperty(field) && modelInstance.hasOwnProperty(field) && field !== theModel.primaryKeyFieldName) {
                                    columns.push("`" + field + "`=?");
                                    columnValues.push(convertValueToSQL(theModel.fields[field], modelInstance));
                                }
                            }
                            columnValues.push(pk);
                            var sql = "UPDATE `" + theModel.dataSourceName + "` SET " + columns.join(',') + " WHERE `" + theModel.primaryKeyFieldName + "`=?";

                            if (!includeDeleted && theModel.deletedFieldName) {
                                sql += " AND `" + theModel.deletedFieldName + "`=0";
                            }

                            $log.debug("WebSQLAdapter: " + sql, columnValues);
                            tx.executeSql(sql, columnValues, function (tx, result) {
                                response = new AdapterResponse(modelInstance, 1);
                                $log.debug('WebSQLAdapter: Update ' + theModel.modelName, response, modelInstance);
                                dfd.resolve(response);
                            }, function (tx, e) {
                                dfd.reject(buildError(e));
                            });
                        });
                    }, function (e) {
                        dfd.reject(buildError(e));
                    });
                    return dfd.promise;
                };

                // TODO: Cascade Delete:
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
                        $log.error('WebSQLAdapter: Remove ' + theModel.modelName, response);
                        return response;
                    };

                    var columns = ["`" + theModel.lastModifiedFieldName + "`=?", "`" + theModel.deletedFieldName + "`=?"];
                    var columnValues = [new Date().toISOString(), 1, pk];

                    connect().then(function () {
                        db.transaction(function (tx) {

                            var sql = "UPDATE `" + theModel.dataSourceName + "` SET " + columns.join(',') + " WHERE `" + theModel.primaryKeyFieldName + "`=?";

                            $log.debug("WebSQLAdapter: " + sql, columnValues);
                            tx.executeSql(sql, columnValues, function (tx, result) {
                                response = new AdapterResponse(null, 1, AdapterResponse.NO_CONTENT);
                                $log.debug('WebSQLAdapter: Remove ' + theModel.modelName, response);
                                dfd.resolve(response);
                            }, function (tx, e) {
                                dfd.reject(buildError(e));
                            });
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
                        $log.error('WebSQLAdapter: Synchronize ' + theModel.modelName, response, dataToSync);
                        return response;
                    };

                    connect().then(function () {
                        db.transaction(function (tx) {
                            var i;
                            var promises = [];
                            for (i = 0; i < dataToSync.length; i++) {
                                if (dataToSync[i][theModel.deletedFieldName]) {
                                    promises.push(hardRemove(theModel, tx, dataToSync[i][theModel.primaryKeyFieldName]));
                                } else {
                                    promises.push(createOrUpdate(theModel, tx, dataToSync[i]));
                                }
                            }

                            $q.all(promises).then(function (results) {
                                response = new AdapterResponse(results, results.length, AdapterResponse.OK);
                                $log.debug('WebSQLAdapter: Synchronize ' + theModel.modelName, response, dataToSync);
                                dfd.resolve(response);
                            }, function (e) {
                                dfd.reject(buildError(e));
                            });
                        });
                    }, function (e) {
                        dfd.reject(buildError(e));
                    });
                    return dfd.promise;
                };

                // Creates a new Entity if not found or updates the existing one. Used in synchronization.
                var createOrUpdate = function (theModel, tx, modelInstance) {
                    var dfd = $q.defer();

                    var columns = [];
                    var columnValues = [];
                    var placeholders = [];
                    var field;
                    for (field in theModel.fields) {
                        if (theModel.fields.hasOwnProperty(field) && modelInstance.hasOwnProperty(field)) {
                            columns.push("`" + field + "`");
                            columnValues.push(convertValueToSQL(theModel.fields[field], modelInstance));
                            placeholders.push('?');
                        }
                    }
                    var sql = "INSERT OR REPLACE INTO `" + theModel.dataSourceName + "` (" + columns.join(',') + ") VALUES (" + placeholders.join(",") +")";
                    $log.debug("WebSQLAdapter: " + sql, columnValues);
                    tx.executeSql(sql, columnValues, function (tx, result) {
                        var results = transformSQLResult(theModel, result);
                        dfd.resolve(results[0]);
                    }, function (tx, e) {
                        dfd.reject(e);
                    });

                    return dfd.promise;
                };

                // Hard deletes an Entity. Used in synchronization.
                var hardRemove = function (theModel, tx, pk) {
                    var dfd = $q.defer();

                    var sql = "DELETE FROM `" + theModel.dataSourceName + "` WHERE `" + theModel.primaryKeyFieldName + "`=?";
                    $log.debug("WebSQLAdapter: " + sql, [pk]);
                    tx.executeSql(sql, [pk], function (tx, result) {
                        dfd.resolve();
                    }, function (tx, e) {
                        dfd.reject(e);
                    });

                    return dfd.promise;
                };

                // Expands a has one model association
                var expandHasOne = function (model, result, association, tx, pathsToExpand) {
                    var dfd = $q.defer();
                    var pathToExpand = pathsToExpand.join('.');

                    if (result[association.mappedBy] === undefined) {
                        result[association.mappedBy] = null;
                        dfd.resolve();
                        return dfd.promise;
                    }

                    var sql = "SELECT * FROM `" + model.dataSourceName + "` WHERE `" + model.primaryKeyFieldName + "`=?";

                    if (model.deletedFieldName) {
                        sql += " AND `" + model.deletedFieldName + "`=0";
                    }

                    $log.debug("WebSQLAdapter: " + sql, [result[association.mappedBy]]);
                    tx.executeSql(sql, [result[association.mappedBy]], function (tx, response) {
                        var results = transformSQLResult(model, response);
                        if (results[0]) {
                            result[association.alias] = results[0];
                            if (pathsToExpand.length > 1) {
                                expandPath(results[0], model, pathToExpand.substring(pathToExpand.indexOf('.') + 1), tx).then(function () {
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
                    }, function (tx, e) {
                        dfd.reject(e);
                    });

                    return dfd.promise;
                };

                // Expands a has many model association
                var expandHasMany = function (model, result, association, tx, pathsToExpand) {
                    var dfd = $q.defer();
                    var pathToExpand = pathsToExpand.join('.');

                    var sql = "SELECT * FROM `" + model.dataSourceName + "` WHERE `" + association.mappedBy + "`=?";

                    if (model.deletedFieldName) {
                        sql += " AND `" + model.deletedFieldName + "`=0";
                    }

                    $log.debug("WebSQLAdapter: " + sql, [result[model.primaryKeyFieldName]]);
                    tx.executeSql(sql, [result[model.primaryKeyFieldName]], function (tx, response) {
                        var results = transformSQLResult(model, response);

                        var filter = association.getOptions(result).$filter();
                        if (filter) {
                            results = applyFilter(results, filter);
                        }

                        result[association.alias] = results;
                        if (pathsToExpand.length > 1) {
                            var i;
                            var promises = [];
                            for (i = 0; i < results.length; i++) {
                                promises.push(expandPath(results[i], model, pathToExpand.substring(pathToExpand.indexOf('.') + 1), tx));
                            }
                            $q.all(promises).then(function () {
                                dfd.resolve();
                            }, function (e) {
                                dfd.reject(e);
                            });
                        } else {
                            dfd.resolve();
                        }
                    }, function (tx, e) {
                        dfd.reject(e);
                    });

                    return dfd.promise;
                };

                // Expands a Model association given an expand path
                // Recursive
                var expandPath = function (result, theModel, pathToExpand, tx) {
                    var pathsToExpand = pathToExpand.split('.');
                    var toExpand = pathsToExpand[0];

                    if (toExpand) {
                        var association = theModel.getAssociationByAlias(toExpand);
                        var model = association.getModel();
                        if (association && model) {
                            if (association.type === 'hasOne') {
                                return expandHasOne(model, result, association, tx, pathsToExpand);
                            } else if (association.type === 'hasMany') {
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
                            $log.error('WebSQLAdapter: PerformExpand', e, $expand, result);
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

                var convertValueToSQL = function (field, modelInstance) {
                    switch (field.type) {
                    case 'STRING':
                    case 'NUMBER':
                        return modelInstance[field.name];
                    case 'DATE':
                        if (modelInstance[field.name] instanceof Date) {
                            return modelInstance[field.name].toISOString();
                        }
                        return new Date(modelInstance[field.name]).toISOString();
                    case 'BOOLEAN':
                        if (modelInstance[field] === true || modelInstance[field] === 1) {
                            return 1;
                        }
                        return 0;
                    }
                };

                var convertValueToModel = function (field, sqlResultInstance) {
                    switch (field.type) {
                    case 'STRING':
                    case 'NUMBER':
                    case 'DATE':
                        return sqlResultInstance[field.name];
                    case 'BOOLEAN':
                        return sqlResultInstance[field.name] === 1;
                    }
                };

                var getSQLModelObject = function (theModel, result) {
                    var field;
                    var obj = {};
                    for (field in theModel.fields) {
                        if (theModel.fields.hasOwnProperty(field) && result.hasOwnProperty(field)) {
                            obj[field] = convertValueToModel(theModel.fields[field], result);
                        }
                    }
                    return obj;
                };

                var transformSQLResult = function (theModel, result) {
                    var results = [];
                    var i;
                    for (i = 0; i < result.rows.length; i++) {
                        results.push(getSQLModelObject(theModel, result.rows.item(i)));
                    }

                    return results;
                };

                return adapter;
            }
        ];
    }
]);