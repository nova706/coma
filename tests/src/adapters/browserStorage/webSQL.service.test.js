/*globals describe, sinon, beforeEach, module, inject, it, should*/
describe("WebSQLService", function () {
    var service;
    var $rootScope;
    var $timeout;
    var $window;
    var $q;
    var mockWebSQL;
    var model;
    var modelDef;
    var testAdapter;
    var recall;

    var isFunc = function (a) {
        return typeof a === 'function';
    };

    var resolvedPromiseFunction = function () {
        var dfd = $q.defer();
        dfd.resolve();
        return dfd.promise;
    };

    beforeEach(module('recall.adapter.browserStorage'));

    beforeEach(inject(function (_$rootScope_, _$timeout_, _$window_, _$q_, recallWebSQLService, _recall_) {
        $rootScope = _$rootScope_;
        $timeout = _$timeout_;
        $window = _$window_;
        $q = _$q_;

        recall = _recall_;

        service = recallWebSQLService;

        mockWebSQL = window.MockWebSQL($timeout);
        $window.openDatabase = mockWebSQL.openDatabase;

        modelDef = {
            name: "testEndpoint",
            dataSourceName: "testEndpoint",
            fields: {
                id: {
                    primaryKey: true,
                    type: "String"
                },
                name: "String",
                index: {
                    type: "Boolean",
                    index: "test"
                }
            }
        };

        testAdapter = {
            create: resolvedPromiseFunction,
            findOne: resolvedPromiseFunction,
            find: resolvedPromiseFunction,
            update: resolvedPromiseFunction,
            remove: resolvedPromiseFunction
        };

        model = recall.defineModel(modelDef, testAdapter);
        model.setDeletedFieldName("deleted");
        model.setLastModifiedFieldName("lastModified");
    }));

    describe("Migrate", function () {
        it("Should return a promise", function () {
            var promise = service.migrate(mockWebSQL.api.mockDatabase);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve with null", function () {
            sinon.stub(service, "migrateTables", function () {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            });
            sinon.stub(service, "createTables", function () {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            });
            var response = {};

            service.migrate(mockWebSQL.api.mockDatabase).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            should.equal(response, null);
        });

        it("Should reject with a proper error when create tables fails", function () {
            sinon.stub(service, "createTables", function () {
                return $q.reject("Error");
            });
            var response = {};

            service.migrate(mockWebSQL.api.mockDatabase).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });

        it("Should reject with a proper error when migrate tables fails", function () {
            sinon.stub(service, "createTables", function () {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            });
            sinon.stub(service, "migrateTables", function () {
                return $q.reject("Error");
            });
            var response = {};

            service.migrate(mockWebSQL.api.mockDatabase).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("Connect", function () {
        it("Should return a promise", function () {
            var promise = service.connect("test", 1);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve with the database", function () {
            var response = {};
            sinon.stub(service, "migrate", function () {
                var dfd = $q.defer();
                dfd.resolve(mockWebSQL.api.mockDatabase);
                return dfd.promise;
            });

            service.connect("test", 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal(mockWebSQL.api.mockDatabase);
        });

        it("Should call migrate when upgrade is needed", function () {
            var response = {};
            sinon.stub(service, "migrate");

            service.connect("test", 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            service.migrate.called.should.equal(true);
        });

        it("Should reject with a proper error", function () {
            sinon.stub($window, "openDatabase", function () {
                throw "Error";
            });
            var response = {};

            service.connect("test", 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });

        it("Should reject with a proper error when migrate fails", function () {
            sinon.stub(service, "migrate", function () {
                return $q.reject("Error");
            });
            var response = {};

            service.connect("test", 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("Create", function () {
        it("Should return a promise", function () {
            var promise = service.create(mockWebSQL.api.mockDatabase, model, {name: "John"});
            should.equal(isFunc(promise.then), true);
        });

        it("Should execute the proper SQL", function () {
            var theSql;
            var theParams;

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                theSql = sql;
                theParams = params;
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{id: 1, name: "John"}]));
            });

            service.create(mockWebSQL.api.mockDatabase, model, {name: "John", test: "test"});
            $timeout.flush();
            $rootScope.$apply();

            theSql.should.equal("INSERT INTO `" + model.dataSourceName + "` (`name`) VALUES (?)");
            theParams[0].should.equal("John");
        });

        it("Should resolve a proper response", function () {
            var response = {};

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{name: "John"}]));
            });

            service.create(mockWebSQL.api.mockDatabase, model, {name: "John"}).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.name.should.equal("John");
        });

        it("Should reject with a proper error", function () {
            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success, failure) {
                failure(mockWebSQL.api.mockTransaction, "Error");
            });
            var response = {};

            service.create(mockWebSQL.api.mockDatabase, model, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("FindOne", function () {
        it("Should return a promise", function () {
            var promise = service.findOne(mockWebSQL.api.mockDatabase, model, 1);
            should.equal(isFunc(promise.then), true);
        });

        it("Should execute the proper SQL", function () {
            var theSql;
            var theParams;

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                theSql = sql;
                theParams = params;
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{id: 1, name: "John"}]));
            });

            service.findOne(mockWebSQL.api.mockDatabase, model, 1);
            $timeout.flush();
            $rootScope.$apply();

            theSql.should.equal("SELECT * FROM `" + model.dataSourceName + "` WHERE `id`=?");
            theParams[0].should.equal(1);
        });

        it("Should resolve a proper response", function () {
            var response = {};

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{id: 1, name: "John"}]));
            });

            service.findOne(mockWebSQL.api.mockDatabase, model, 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.name.should.equal("John");
        });

        it("Should resolve a proper response when nothing is found", function () {
            var response = {};

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([]));
            });

            service.findOne(mockWebSQL.api.mockDatabase, model, 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            should.equal(response, null);
        });

        it("Should reject with a proper error", function () {
            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success, failure) {
                failure(mockWebSQL.api.mockTransaction, "Error");
            });
            var response = {};

            service.findOne(mockWebSQL.api.mockDatabase, model, 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("Find", function () {
        it("Should return a promise", function () {
            var promise = service.find(mockWebSQL.api.mockDatabase, model);
            should.equal(isFunc(promise.then), true);
        });

        it("Should execute the proper SQL", function () {
            var theSql;
            var theParams;

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                theSql = sql;
                theParams = params;
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{id: 1, name: "John"}]));
            });

            service.find(mockWebSQL.api.mockDatabase, model);
            $timeout.flush();
            $rootScope.$apply();

            theSql.should.equal("SELECT * FROM `" + model.dataSourceName + "` WHERE `deleted`=0");
            theParams.length.should.equal(0);
        });

        it("Should execute the proper SQL when including deleted", function () {
            var theSql;
            var theParams;

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                theSql = sql;
                theParams = params;
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{id: 1, name: "John"}]));
            });

            service.find(mockWebSQL.api.mockDatabase, model, true);
            $timeout.flush();
            $rootScope.$apply();

            theSql.should.equal("SELECT * FROM `" + model.dataSourceName + "`");
            theParams.length.should.equal(0);
        });

        it("Should resolve a proper response", function () {
            var response = {};

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{id: 1, name: "John"}]));
            });

            service.find(mockWebSQL.api.mockDatabase, model).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response[0].name.should.equal("John");
        });

        it("Should reject with a proper error", function () {
            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success, failure) {
                failure(mockWebSQL.api.mockTransaction, "Error");
            });
            var response = {};

            service.find(mockWebSQL.api.mockDatabase, model).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("Update", function () {
        it("Should return a promise", function () {
            var promise = service.update(mockWebSQL.api.mockDatabase, model, 1, {name: "John"});
            should.equal(isFunc(promise.then), true);
        });

        it("Should execute the proper SQL", function () {
            var theSql;
            var theParams;

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                theSql = sql;
                theParams = params;
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{id: 1, name: "John"}]));
            });

            service.update(mockWebSQL.api.mockDatabase, model, 1, {name: "John"});
            $timeout.flush();
            $rootScope.$apply();

            theSql.should.equal("UPDATE `" + model.dataSourceName + "` SET `name`=? WHERE `id`=?");
            theParams[0].should.equal("John");
            theParams[1].should.equal(1);
        });

        it("Should resolve a proper response", function () {
            var response = {};

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{id: 1, name: "John"}]));
            });

            service.update(mockWebSQL.api.mockDatabase, model, 1, {name: "John"}).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.name.should.equal("John");
        });

        it("Should reject with a proper error", function () {
            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success, failure) {
                failure(mockWebSQL.api.mockTransaction, "Error");
            });
            var response = {};

            service.update(mockWebSQL.api.mockDatabase, model, 1, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("Remove", function () {
        it("Should return a promise", function () {
            var promise = service.remove(mockWebSQL.api.mockDatabase, model, 1);
            should.equal(isFunc(promise.then), true);
        });

        it("Should execute the proper SQL", function () {
            var theSql;
            var theParams;

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                theSql = sql;
                theParams = params;
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{id: 1, name: "John"}]));
            });

            service.remove(mockWebSQL.api.mockDatabase, model, 1);
            $timeout.flush();
            $rootScope.$apply();

            theSql.should.equal("DELETE FROM `" + model.dataSourceName + "` WHERE `id`=?");
            theParams[0].should.equal(1);
        });

        it("Should resolve a proper response", function () {
            var response = {};

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{id: 1, name: "John"}]));
            });

            service.remove(mockWebSQL.api.mockDatabase, model, 1).then(function (res) {
                response = res;
            }, function (e) {
                throw e.data;
            });
            $timeout.flush();
            $rootScope.$apply();

            should.equal(response, null);
        });

        it("Should reject with a proper error", function () {
            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success, failure) {
                failure(mockWebSQL.api.mockTransaction, "Error");
            });
            var response = {};

            service.remove(mockWebSQL.api.mockDatabase, model, 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("FindByAssociation", function () {
        it("Should return a promise", function () {
            var promise = service.findByAssociation(mockWebSQL.api.mockDatabase, model, 1, "aId");
            should.equal(isFunc(promise.then), true);
        });

        it("Should execute the proper SQL", function () {
            var theSql;
            var theParams;

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                theSql = sql;
                theParams = params;
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{id: 1, name: "John"}]));
            });

            service.findByAssociation(mockWebSQL.api.mockDatabase, model, 1, "aId");
            $timeout.flush();
            $rootScope.$apply();

            theSql.should.equal("SELECT * FROM `" + model.dataSourceName + "` WHERE `aId`=? AND `deleted`=0");
            theParams[0].should.equal(1);
        });

        it("Should execute the proper SQL when the model does not have a deleted field name", function () {
            var theSql;
            var theParams;

            delete model.deletedFieldName;

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                theSql = sql;
                theParams = params;
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{id: 1, name: "John"}]));
            });

            service.findByAssociation(mockWebSQL.api.mockDatabase, model, 1, "aId");
            $timeout.flush();
            $rootScope.$apply();

            theSql.should.equal("SELECT * FROM `" + model.dataSourceName + "` WHERE `aId`=?");
            theParams[0].should.equal(1);
        });

        it("Should resolve a proper response", function () {
            var response = {};

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{id: 1, name: "John"}]));
            });

            service.findByAssociation(mockWebSQL.api.mockDatabase, model, "id", "aId").then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response[0].name.should.equal("John");
        });

        it("Should resolve a proper response when nothing is found", function () {
            var response = {};

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([]));
            });

            service.findByAssociation(mockWebSQL.api.mockDatabase, model, "id", "aId").then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.length.should.equal(0);
        });

        it("Should reject with an error", function () {
            var response = {};

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success, failure) {
                failure(mockWebSQL.api.mockTransaction, "Error");
            });

            service.findByAssociation(mockWebSQL.api.mockDatabase, model, "id", "aId").then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("CreateTables", function () {
        beforeEach(function () {
            recall.models = {};

            modelDef = {
                name: "testEndpoint",
                dataSourceName: "testEndpoint",
                fields: {
                    id: {
                        primaryKey: true,
                        type: "NUMBER"
                    },
                    name: {
                        type: "String",
                        notNull: true
                    },
                    index: {
                        type: "Boolean"
                    },
                    unique: {
                        type: "Date",
                        unique: true
                    }
                }
            };

            testAdapter = {
                create: resolvedPromiseFunction,
                findOne: resolvedPromiseFunction,
                find: resolvedPromiseFunction,
                update: resolvedPromiseFunction,
                remove: resolvedPromiseFunction
            };
        });

        it("Should return a promise", function () {
            model = recall.defineModel(modelDef, testAdapter);
            var promise = service.createTables(mockWebSQL.api.mockDatabase);
            should.equal(isFunc(promise.then), true);
        });

        it("Should execute the proper SQL", function () {
            model = recall.defineModel(modelDef, testAdapter);
            var theSql = null;

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                theSql = sql;
                success();
            });

            service.createTables(mockWebSQL.api.mockDatabase);
            $timeout.flush();
            $rootScope.$apply();

            theSql.should.equal('CREATE TABLE IF NOT EXISTS `testEndpoint` (`id` REAL PRIMARY KEY, `name` TEXT NOT NULL, `index` INTEGER, `unique` TEXT UNIQUE)');
        });

        it("Should reject with an error when the field type is unknown", function () {
            model = recall.defineModel(modelDef, testAdapter);
            model.fields.unique.type = "foo";
            var response = {};

            service.createTables(mockWebSQL.api.mockDatabase).then(function () {
                throw "This should not be reached.";
            }, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.not.equal(undefined);
        });

        it("Should reject with an error", function () {
            model = recall.defineModel(modelDef, testAdapter);
            var response = {};

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success, failure) {
                failure(mockWebSQL.api.mockTransaction, "Error");
            });

            service.createTables(mockWebSQL.api.mockDatabase).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("MigrateTables", function () {
        beforeEach(function () {
            recall.models = {};

            modelDef = {
                name: "testEndpoint",
                dataSourceName: "testEndpoint",
                fields: {
                    id: {
                        primaryKey: true,
                        type: "NUMBER"
                    },
                    name: {
                        type: "String",
                        notNull: true
                    },
                    index: {
                        type: "Boolean"
                    },
                    unique: {
                        type: "Date",
                        unique: true
                    }
                }
            };

            testAdapter = {
                create: resolvedPromiseFunction,
                findOne: resolvedPromiseFunction,
                find: resolvedPromiseFunction,
                update: resolvedPromiseFunction,
                remove: resolvedPromiseFunction
            };
        });

        it("Should return a promise", function () {
            model = recall.defineModel(modelDef, testAdapter);
            var promise = service.migrateTables(mockWebSQL.api.mockDatabase);
            should.equal(isFunc(promise.then), true);
        });

        it("Should get all tables in the DB", function () {
            model = recall.defineModel(modelDef, testAdapter);
            var theSql = null;
            var result = {rows: []};

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                theSql = sql;
                success({}, result);
            });

            service.migrateTables(mockWebSQL.api.mockDatabase);
            $timeout.flush();
            $rootScope.$apply();

            theSql.should.equal("SELECT tbl_name, sql from sqlite_master WHERE type = 'table'");
        });

        it("Should migrate each model", function () {
            model = recall.defineModel(modelDef, testAdapter);
            var theSql = null;
            var item = {id: 1};
            var result = new mockWebSQL.api.Response([item]);
            var tx = {};
            var theTableRows = null;

            sinon.stub(service, "migrateTable", function (model, tableRows) {
                theTableRows = tableRows;
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            });
            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                theSql = sql;
                success(tx, result);
            });

            service.migrateTables(mockWebSQL.api.mockDatabase);
            $timeout.flush();
            $rootScope.$apply();

            theTableRows[0].should.equal(item);
            service.migrateTable.calledOnce.should.equal(true);
        });

        it("Should reject with an error when migrateTable fails", function () {
            model = recall.defineModel(modelDef, testAdapter);
            var response = {};
            var result = {rows: []};

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                success({}, result);
            });
            sinon.stub(service, "migrateTable", function () {
                return $q.reject("Error");
            });

            service.migrateTables(mockWebSQL.api.mockDatabase).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });

        it("Should reject with an error", function () {
            model = recall.defineModel(modelDef, testAdapter);
            var response = {};

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success, failure) {
                failure(mockWebSQL.api.mockTransaction, "Error");
            });

            service.migrateTables(mockWebSQL.api.mockDatabase).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("MigrateTable", function () {
        beforeEach(function () {
            recall.models = {};

            modelDef = {
                name: "testEndpoint",
                dataSourceName: "testEndpoint",
                fields: {
                    id: {
                        primaryKey: true,
                        type: "NUMBER"
                    },
                    name: {
                        type: "String",
                        notNull: true
                    },
                    index: {
                        type: "Boolean"
                    },
                    unique: {
                        type: "Date",
                        unique: true
                    }
                }
            };

            testAdapter = {
                create: resolvedPromiseFunction,
                findOne: resolvedPromiseFunction,
                find: resolvedPromiseFunction,
                update: resolvedPromiseFunction,
                remove: resolvedPromiseFunction
            };
        });

        it("Should return a promise", function () {
            model = recall.defineModel(modelDef, testAdapter);
            var promise = service.migrateTable(model, []);
            should.equal(isFunc(promise.then), true);
        });

        it("Should add all missing columns to the table", function () {
            model = recall.defineModel(modelDef, testAdapter);

            var tx = {};
            var rows = [
                {
                    tbl_name: 'testEndpoint',
                    sql: '`id` `name` `index`'
                }
            ];

            sinon.stub(service, "addColumnToTable", function () {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            });

            service.migrateTable(model, rows, tx);
            $timeout.flush();
            $rootScope.$apply();

            service.addColumnToTable.calledWith(model.fields.unique, 'testEndpoint', tx).should.equal(true);
        });

        it("Should skip tables that don't match by name", function () {
            model = recall.defineModel(modelDef, testAdapter);

            var tx = {};
            var rows = [
                {
                    tbl_name: 'testEndpointFoo',
                    sql: '`id` `name` `index`'
                }
            ];

            sinon.stub(service, "addColumnToTable", function () {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            });

            service.migrateTable(model, rows, tx);

            service.addColumnToTable.called.should.equal(false);
        });

        it("Should reject with an error", function () {
            model = recall.defineModel(modelDef, testAdapter);
            var response = {};
            var tx = {};
            var rows = [
                {
                    tbl_name: 'testEndpoint',
                    sql: '`id` `name` `index`'
                }
            ];

            sinon.stub(service, "addColumnToTable", function () {
                return $q.reject("Error");
            });

            service.migrateTable(model, rows, tx).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("AddColumnToTable", function () {
        beforeEach(function () {
            recall.models = {};

            modelDef = {
                name: "testEndpoint",
                dataSourceName: "testEndpoint",
                fields: {
                    id: {
                        primaryKey: true,
                        type: "NUMBER"
                    },
                    name: {
                        type: "String",
                        notNull: true
                    },
                    index: {
                        type: "Boolean"
                    },
                    unique: {
                        type: "Date",
                        unique: true
                    }
                }
            };

            testAdapter = {
                create: resolvedPromiseFunction,
                findOne: resolvedPromiseFunction,
                find: resolvedPromiseFunction,
                update: resolvedPromiseFunction,
                remove: resolvedPromiseFunction
            };
        });

        it("Should return a promise", function () {
            model = recall.defineModel(modelDef, testAdapter);
            var promise = service.addColumnToTable(model.fields.id, "tableName", mockWebSQL.api.mockTransaction);
            should.equal(isFunc(promise.then), true);
        });

        it("Should execute the proper SQL", function () {
            model = recall.defineModel(modelDef, testAdapter);
            var theSQL = null;

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                theSQL = sql;
                success();
            });

            service.addColumnToTable(model.fields.id, "tableName", mockWebSQL.api.mockTransaction);
            $rootScope.$apply();

            theSQL.should.equal("ALTER TABLE `tableName` ADD `id` REAL PRIMARY KEY");
        });

        it("Should reject with an error when the column SQL cannot be generated", function () {
            model = recall.defineModel(modelDef, testAdapter);
            model.fields.id.type = "Foo";

            service.addColumnToTable(model.fields.id, "tableName", mockWebSQL.api.mockTransaction).then(function (res) {
                throw "This should not be reached";
            });
            $timeout.flush();
            $rootScope.$apply();
        });

        it("Should reject with an error", function () {
            model = recall.defineModel(modelDef, testAdapter);
            var response = {};

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success, failure) {
                failure(mockWebSQL.api.mockTransaction, "Error");
            });

            service.addColumnToTable(model.fields.id, "tableName", mockWebSQL.api.mockTransaction).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("ConvertValueToSQL", function () {
        beforeEach(function () {
            recall.models = {};

            modelDef = {
                name: "testEndpoint",
                dataSourceName: "testEndpoint",
                fields: {
                    id: {
                        primaryKey: true,
                        type: "NUMBER"
                    },
                    name: {
                        type: "String",
                        notNull: true
                    },
                    index: {
                        type: "Boolean"
                    },
                    unique: {
                        type: "Date",
                        unique: true
                    }
                }
            };

            testAdapter = {
                create: resolvedPromiseFunction,
                findOne: resolvedPromiseFunction,
                find: resolvedPromiseFunction,
                update: resolvedPromiseFunction,
                remove: resolvedPromiseFunction
            };
        });

        it("Should convert the instance value to SQL value", function () {
            model = recall.defineModel(modelDef, testAdapter);

            var now = new Date();
            var instance = { id: 1, name: "John", index: true, unique: now };

            var idValue = service.convertValueToSQL(model.fields.id, instance);
            var nameValue = service.convertValueToSQL(model.fields.name, instance);
            var indexValue = service.convertValueToSQL(model.fields.index, instance);
            var uniqueValue = service.convertValueToSQL(model.fields.unique, instance);

            idValue.should.equal(1);
            nameValue.should.equal("John");
            indexValue.should.equal(1);
            uniqueValue.should.equal(now.toISOString());
        });

        it("Should convert date timestamps", function () {
            model = recall.defineModel(modelDef, testAdapter);

            var now = new Date();
            var instance = { id: 1, name: "John", index: true, unique: now.getTime() };
            var uniqueValue = service.convertValueToSQL(model.fields.unique, instance);

            uniqueValue.should.equal(now.toISOString());
        });

        it("Should convert false booleans", function () {
            model = recall.defineModel(modelDef, testAdapter);

            var instance = { id: 1, name: "John", index: false, unique: new Date() };
            var indexValue = service.convertValueToSQL(model.fields.index, instance);

            indexValue.should.equal(0);
        });
    });

    describe("TransformSQLResult", function () {
        beforeEach(function () {
            recall.models = {};

            modelDef = {
                name: "testEndpoint",
                dataSourceName: "testEndpoint",
                fields: {
                    id: {
                        primaryKey: true,
                        type: "NUMBER"
                    },
                    name: {
                        type: "String",
                        notNull: true
                    },
                    index: {
                        type: "Boolean"
                    },
                    unique: {
                        type: "Date",
                        unique: true
                    }
                }
            };

            testAdapter = {
                create: resolvedPromiseFunction,
                findOne: resolvedPromiseFunction,
                find: resolvedPromiseFunction,
                update: resolvedPromiseFunction,
                remove: resolvedPromiseFunction
            };
        });

        it("Should convert the SQL result to raw JSON", function () {
            model = recall.defineModel(modelDef, testAdapter);
            var response = new mockWebSQL.api.Response([
                { id: 1, name: "John", index: 1, unique: "date", otherProp: 'test' }
            ]);
            var results = service.transformSQLResult(model, response);

            results.length.should.equal(1);
            results[0].id.should.equal(1);
            results[0].name.should.equal("John");
            results[0].index.should.equal(true);
            results[0].unique.should.equal("date");
            should.equal(results[0].otherProp, undefined);
        });
    });
});