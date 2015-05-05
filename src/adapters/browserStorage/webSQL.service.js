angular.module('recall.adapter.browserStorage').factory('recallWebSQLService', [
    '$log',
    '$q',
    '$window',
    'recall',

    function ($log, $q, $window, recall) {

        var webSQLService = {};

        webSQLService.migrate = function (db) {
            var dfd = $q.defer();

            webSQLService.createTables(db).then(function () {
                webSQLService.migrateTables(db).then(function () {
                    dfd.resolve(null);
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
                        columnValues.push(webSQLService.convertValueToSQL(theModel.fields[field], modelInstance));
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

        webSQLService.findOne = function (db, theModel, pk) {
            var dfd = $q.defer();

            db.transaction(function (tx) {

                var sql = "SELECT * FROM `" + theModel.dataSourceName + "` WHERE `" + theModel.primaryKeyFieldName + "`=?";
                $log.debug("WebSQLService: " + sql, [pk]);
                tx.executeSql(sql, [pk], function (tx, response) {
                    var results = webSQLService.transformSQLResult(theModel, response);
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

        webSQLService.find = function (db, theModel, includeDeleted) {
            var dfd = $q.defer();

            db.transaction(function (tx) {

                var sql = "SELECT * FROM `" + theModel.dataSourceName + "`";
                if (!includeDeleted && theModel.deletedFieldName) {
                    sql += " WHERE `" + theModel.deletedFieldName + "`=0";
                }

                $log.debug("WebSQLService: " + sql);
                tx.executeSql(sql, [], function (tx, response) {
                    var results = webSQLService.transformSQLResult(theModel, response);
                    dfd.resolve(results);
                }, function (tx, e) {
                    dfd.reject(e);
                });
            });

            return dfd.promise;
        };

        webSQLService.update = function (db, theModel, pk, modelInstance) {
            var dfd = $q.defer();

            db.transaction(function (tx) {

                var columns = [];
                var columnNames = [];
                var columnValues = [];
                var placeholders = [];
                var field;
                for (field in theModel.fields) {
                    if (theModel.fields.hasOwnProperty(field) && modelInstance.hasOwnProperty(field) && field !== theModel.primaryKeyFieldName) {
                        columns.push("`" + field + "`=?");
                        columnValues.push(webSQLService.convertValueToSQL(theModel.fields[field], modelInstance));
                        columnNames.push("`" + field +  "`");
                        placeholders.push("?");
                    }
                }

                columnValues.push(pk);

                var sql = "UPDATE `" + theModel.dataSourceName + "` SET " + columns.join(',') + " WHERE `" + theModel.primaryKeyFieldName + "`=?";
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

            db.transaction(function (tx) {

                var sql = "DELETE FROM `" + theModel.dataSourceName + "` WHERE `" + theModel.primaryKeyFieldName + "`=?";
                $log.debug("WebSQLService: " + sql, [pk]);
                tx.executeSql(sql, [pk], function () {
                    dfd.resolve(null);
                }, function (tx, e) {
                    dfd.reject(e);
                });

            });

            return dfd.promise;
        };

        webSQLService.findByAssociation = function (db, model, pk, mappedBy) {
            var dfd = $q.defer();

            var sql = "SELECT * FROM `" + model.dataSourceName + "` WHERE `" + mappedBy + "`=?";
            if (model.deletedFieldName) {
                sql += " AND `" + model.deletedFieldName + "`=0";
            }

            $log.debug("WebSQLService: " + sql, [pk]);

            db.transaction(function (tx) {
                tx.executeSql(sql, [pk], function (tx, response) {
                    var results = webSQLService.transformSQLResult(model, response);
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

        var getModelFieldSQL = function (modelField) {
            var modelFieldSQL = "`" + modelField.name + "`";
            switch (modelField.type) {
            case 'STRING':
                modelFieldSQL += ' TEXT';
                break;
            case 'NUMBER':
                modelFieldSQL += ' REAL';
                break;
            case 'DATE':
                modelFieldSQL += ' TEXT';
                break;
            case 'BOOLEAN':
                modelFieldSQL += ' INTEGER';
                break;
            default:
                return false;
            }

            if (modelField.primaryKey) {
                modelFieldSQL += ' PRIMARY KEY';
            }
            if (modelField.unique) {
                modelFieldSQL += ' UNIQUE';
            }
            if (modelField.notNull) {
                modelFieldSQL += ' NOT NULL';
            }

            return modelFieldSQL;
        };

        webSQLService.createTables = function (db) {
            var dfd = $q.defer();

            var promises = [];
            var operations = [];

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
                        column = getModelFieldSQL(model.fields[field]);

                        if (!column) {
                            return $q.reject('WebSQLService: Migrate - An unknown field type was found.');
                        }

                        fields.push(column);
                    }
                }
                operations.push({model: model, fields: fields });
            }

            db.transaction(function (tx) {
                for (i = 0; i < operations.length; i++) {
                    promises.push(createTable(operations[i].model, operations[i].fields, tx));
                }
                $q.all(promises).then(function () {
                    dfd.resolve();
                }, function (e) {
                    dfd.reject(e);
                });
            });

            return dfd.promise;
        };

        webSQLService.addColumnToTable = function (modelField, tableName, tx) {
            var dfd = $q.defer();

            var column = getModelFieldSQL(modelField);

            if (!column) {
                return $q.reject('WebSQLService: Migrate - An unknown field type was found.');
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

        webSQLService.migrateTable = function (model, tableRows, tx) {
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
                    promises.push(webSQLService.addColumnToTable(missingFields[i], model.dataSourceName, tx));
                }
            }

            return $q.all(promises);
        };

        webSQLService.migrateTables = function (db) {
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
                        promises.push(webSQLService.migrateTable(model, tableRows, tx));
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

        webSQLService.convertValueToSQL = function (field, modelInstance) {
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
            if (field.type === "BOOLEAN") {
                return sqlResultInstance[field.name] === 1;
            }
            return sqlResultInstance[field.name];
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

        webSQLService.transformSQLResult = function (theModel, response) {
            var results = [];
            var i;
            for (i = 0; i < response.rows.length; i++) {
                results.push(getSQLModelObject(theModel, response.rows.item(i)));
            }

            return results;
        };

        return webSQLService;

    }
]);