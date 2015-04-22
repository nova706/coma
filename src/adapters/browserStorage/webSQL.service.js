angular.module('recall.adapter.browserStorage').factory('recallWebSQLService', [
    '$log',
    '$q',
    '$window',
    'recall',

    function ($log, $q, $window, recall) {

        var webSQLService = {};

        webSQLService.migrate = function (db) {
            var dfd = $q.defer();

            createTables(db).then(function () {
                migrateTables(db).then(function () {
                    dfd.resolve();
                }, function (e) {
                    dfd.reject(e);
                });
            }, function (e) {
                dfd.reject(e);
            });

            return dfd.promise;
        };

        webSQLService.connect = function (dbName, dbVersion, dbSize) {
            var dfd = $q.defer();

            try {
                var theDb = $window.openDatabase(dbName, dbVersion.toString(), 'Recall WebSQL Database', dbSize);
                webSQLService.migrate(theDb).then(function () {
                    dfd.resolve(theDb);
                }, function (e) {
                    dfd.reject(e);
                });
            } catch (e) {
                dfd.reject(e);
            }

            return dfd.promise;
        };

        webSQLService.create = function (db, theModel, modelInstance) {
            var dfd = $q.defer();

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
                $log.debug("WebSQLService: " + sql, columnValues);
                tx.executeSql(sql, columnValues, function () {
                    dfd.resolve(modelInstance);
                }, function (tx, e) {
                    dfd.reject(e);
                });
            });

            return dfd.promise;
        };

        webSQLService.findOne = function (db, theModel, pk, includeDeleted) {
            var dfd = $q.defer();

            db.transaction(function (tx) {

                var sql = "SELECT * FROM `" + theModel.dataSourceName + "` WHERE `" + theModel.primaryKeyFieldName + "`=?";
                if (!includeDeleted && theModel.deletedFieldName) {
                    sql += " AND `" + theModel.deletedFieldName + "`=0";
                }

                $log.debug("WebSQLService: " + sql, [pk]);
                tx.executeSql(sql, [pk], function (tx, result) {
                    var results = transformSQLResult(theModel, result);
                    if (results[0]) {
                        dfd.resolve(results[0]);
                    } else {
                        dfd.reject(null);
                    }
                }, function (tx, e) {
                    dfd.reject(e);
                });
            });

            return dfd.promise;
        };

        webSQLService.find = function (db, theModel, includeDeleted) {
            var dfd = $q.defer();

            db.transaction(function (tx) {

                var sql = "SELECT * FROM `" + theModel.dataSourceName + "`";
                if (!includeDeleted && theModel.deletedFieldName) {
                    sql += " WHERE `" + theModel.deletedFieldName + "`=0";
                }

                $log.debug("WebSQLService: " + sql);
                tx.executeSql(sql, [], function (tx, result) {
                    var results = transformSQLResult(theModel, result);
                    dfd.resolve(results);
                }, function (tx, e) {
                    dfd.reject(e);
                });
            });

            return dfd.promise;
        };

        webSQLService.update = function (db, theModel, pk, modelInstance, includeDeleted) {
            var dfd = $q.defer();

            modelInstance = theModel.getRawModelObject(modelInstance, false);
            modelInstance[theModel.lastModifiedFieldName] = new Date();

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

                $log.debug("WebSQLService: " + sql, columnValues);
                tx.executeSql(sql, columnValues, function () {
                    dfd.resolve(modelInstance);
                }, function (tx, e) {
                    dfd.reject(e);
                });
            });

            return dfd.promise;
        };

        webSQLService.remove = function (db, theModel, pk) {
            var dfd = $q.defer();

            var columns = ["`" + theModel.lastModifiedFieldName + "`=?", "`" + theModel.deletedFieldName + "`=?"];
            var columnValues = [new Date().toISOString(), 1, pk];

            db.transaction(function (tx) {

                var sql = "UPDATE `" + theModel.dataSourceName + "` SET " + columns.join(',') + " WHERE `" + theModel.primaryKeyFieldName + "`=?";

                $log.debug("WebSQLService: " + sql, columnValues);
                tx.executeSql(sql, columnValues, function () {
                    dfd.resolve(null);
                }, function (tx, e) {
                    dfd.reject(e);
                });
            });

            return dfd.promise;
        };

        webSQLService.synchronize = function (db, theModel, merge, remove) {
            var dfd = $q.defer();

            merge = merge || [];
            remove = remove || [];

            db.transaction(function (tx) {
                var i;
                var promises = [];
                for (i = 0; i < merge.length; i++) {
                    promises.push(createOrUpdate(tx, theModel, merge[i]));
                }
                for (i = 0; i < remove.length; i++) {
                    promises.push(hardRemove(tx, theModel, remove[i][theModel.primaryKeyFieldName]));
                }

                $q.all(promises).then(function (results) {
                    dfd.resolve(results);
                }, function (e) {
                    dfd.reject(e);
                });
            });

            return dfd.promise;
        };

        webSQLService.expandHasOne = function (db, model, result, association) {
            var dfd = $q.defer();

            var sql = "SELECT * FROM `" + model.dataSourceName + "` WHERE `" + model.primaryKeyFieldName + "`=?";
            if (model.deletedFieldName) {
                sql += " AND `" + model.deletedFieldName + "`=0";
            }

            $log.debug("WebSQLService: " + sql, [result[association.mappedBy]]);

            db.transaction(function (tx) {
                tx.executeSql(sql, [result[association.mappedBy]], function (tx, response) {
                    var results = transformSQLResult(model, response);
                    if (results[0]) {
                        dfd.resolve(results[0]);
                    } else {
                        dfd.resolve(null);
                    }
                }, function (tx, e) {
                    dfd.reject(e);
                });
            });

            return dfd.promise;
        };

        webSQLService.expandHasMany = function (db, model, result, association) {
            var dfd = $q.defer();

            var sql = "SELECT * FROM `" + model.dataSourceName + "` WHERE `" + association.mappedBy + "`=?";
            if (model.deletedFieldName) {
                sql += " AND `" + model.deletedFieldName + "`=0";
            }

            $log.debug("WebSQLService: " + sql, [result[model.primaryKeyFieldName]]);

            db.transaction(function (tx) {
                tx.executeSql(sql, [result[model.primaryKeyFieldName]], function (tx, response) {
                    var results = transformSQLResult(model, response);
                    dfd.resolve(results);
                }, function (tx, e) {
                    dfd.reject(e);
                });
            });

            return dfd.promise;
        };

        var createTable = function (model, fields, tx) {
            var dfd = $q.defer();

            var sql = 'CREATE TABLE IF NOT EXISTS `' + model.dataSourceName + '` (' + fields.join(', ') + ')';
            $log.debug("WebSQLService: " + sql);
            tx.executeSql(sql, [], function () {
                dfd.resolve();
            }, function (tx, e) {
                dfd.reject(e);
            });

            return dfd.promise;
        };

        var createTables = function (db) {
            var promises = [];

            db.transaction(function (tx) {
                var i;
                var model;
                var field;
                var column;
                var fields;
                var models = recall.getModels();

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
                                return $q.reject('WebSQLService: Migrate - An unknown field type was found.');
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
            });

            return $q.all(promises);
        };

        var addColumnToTable = function (modelField, tableName, tx) {
            var dfd = $q.defer();

            var column = "`" + modelField.name + "`";
            switch (modelField.type) {
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
                return $q.reject('WebSQLService: Migrate - An unknown field type was found.');
            }

            if (modelField.primaryKey) {
                column += ' PRIMARY KEY';
            }
            if (modelField.unique) {
                column += ' UNIQUE';
            }
            if (modelField.notNull) {
                column += ' NOT NULL';
            }

            var sql = "ALTER TABLE `" + tableName + "` ADD " + column;
            $log.debug("WebSQLService: " + sql);
            tx.executeSql(sql, [], function () {
                dfd.resolve();
            }, function (tx, e) {
                dfd.reject(e);
            });

            return dfd.promise;
        };

        var migrateTable = function (model, tableRows, tx) {
            var promises = [];

            var i;
            var row;
            var tableSQL = null;
            for (i = 0; i < tableRows.length; i++) {
                row = tableRows[i];
                if (row.tbl_name === model.dataSourceName) {
                    tableSQL = row.sql;
                    break;
                }
            }

            if (tableSQL) {
                var field;
                var missingFields = [];
                for (field in model.fields) {
                    // TODO: This needs to check if the field name is the same as the model name
                    if (model.fields.hasOwnProperty(field) && tableSQL.indexOf("`" + field + "`") === -1) {
                        missingFields.push(model.fields[field]);
                    }
                }

                for (i = 0; i < missingFields.length; i++) {
                    promises.push(addColumnToTable(missingFields[i], model.dataSourceName, tx));
                }
            }

            return $q.all(promises);
        };

        var migrateTables = function (db) {
            var dfd = $q.defer();

            db.transaction(function (tx) {
                var sql = "SELECT tbl_name, sql from sqlite_master WHERE type = 'table'";
                $log.debug("WebSQLService: " + sql);
                tx.executeSql(sql, [], function (tx, result) {
                    var model;
                    var models = recall.getModels();
                    var promises = [];

                    var i;
                    var tableRows = [];
                    for (i = 0; i < result.rows.length; i++) {
                        tableRows.push(result.rows.item(i));
                    }

                    for (i = 0; i < models.length; i++) {
                        model = models[i];
                        promises.push(migrateTable(model, tableRows, tx));
                    }

                    $q.all(promises).then(function () {
                        dfd.resolve();
                    }, function (e) {
                        dfd.reject(e);
                    });
                }, function (tx, e) {
                    dfd.reject(e);
                });
            });

            return dfd.promise;
        };

        var createOrUpdate = function (tx, theModel, modelInstance) {
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

        var hardRemove = function (tx, theModel, pk) {
            var dfd = $q.defer();

            var sql = "DELETE FROM `" + theModel.dataSourceName + "` WHERE `" + theModel.primaryKeyFieldName + "`=?";
            $log.debug("WebSQLAdapter: " + sql, [pk]);
            tx.executeSql(sql, [pk], function () {
                dfd.resolve();
            }, function (tx, e) {
                dfd.reject(e);
            });

            return dfd.promise;
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
                if (modelInstance[field.name] === true || modelInstance[field.name] === 1) {
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

        return webSQLService;

    }
]);