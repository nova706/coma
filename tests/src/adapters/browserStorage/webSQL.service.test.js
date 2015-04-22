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

    var isFunc = function (a) {
        return typeof a === 'function';
    };

    var resolvedPromiseFunction = function () {
        var dfd = $q.defer();
        dfd.resolve();
        return dfd.promise;
    };

    beforeEach(module('recall.adapter.browserStorage'));

    beforeEach(inject(function (_$rootScope_, _$timeout_, _$window_, _$q_, recallWebSQLService, recall) {
        $rootScope = _$rootScope_;
        $timeout = _$timeout_;
        $window = _$window_;
        $q = _$q_;

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

            theSql.should.equal("SELECT * FROM `" + model.dataSourceName + "` WHERE `id`=? AND `deleted`=0");
            theParams[0].should.equal(1);
        });

        it("Should execute the proper SQL when including deleted", function () {
            var theSql;
            var theParams;

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                theSql = sql;
                theParams = params;
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{id: 1, name: "John"}]));
            });

            service.findOne(mockWebSQL.api.mockDatabase, model, 1, true);
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

            service.findOne(mockWebSQL.api.mockDatabase, model, 1).then(null, function (res) {
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

            theSql.should.equal("UPDATE `" + model.dataSourceName + "` SET `name`=?,`index`=? WHERE `id`=? AND `deleted`=0");
            theParams[0].should.equal("John");
            theParams[2].should.equal(1);
        });

        it("Should execute the proper SQL when including deleted", function () {
            var theSql;
            var theParams;

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                theSql = sql;
                theParams = params;
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{id: 1, name: "John"}]));
            });

            service.update(mockWebSQL.api.mockDatabase, model, 1, {name: "John"}, true);
            $timeout.flush();
            $rootScope.$apply();

            theSql.should.equal("UPDATE `" + model.dataSourceName + "` SET `name`=?,`index`=? WHERE `id`=?");
            theParams[0].should.equal("John");
            theParams[2].should.equal(1);
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

            theSql.should.equal("UPDATE `" + model.dataSourceName + "` SET `lastModified`=?,`deleted`=? WHERE `id`=?");
            theParams[1].should.equal(1);
            theParams[2].should.equal(1);
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

    describe("Synchronize", function () {
        it("Should return a promise", function () {
            var promise = service.synchronize(mockWebSQL.api.mockDatabase, model, [{name: "John"}]);
            should.equal(isFunc(promise.then), true);
        });

        it("Should execute the proper SQL for create or update", function () {
            var theSql;
            var theParams;

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                theSql = sql;
                theParams = params;
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{id: 1, name: "John"}]));
            });

            service.synchronize(mockWebSQL.api.mockDatabase, model, [{name: "John"}]);
            $timeout.flush();
            $rootScope.$apply();

            theSql.should.equal("INSERT OR REPLACE INTO `" + model.dataSourceName + "` (`name`) VALUES (?)");
            theParams[0].should.equal("John");
        });

        it("Should execute the proper SQL for delete", function () {
            var theSql;
            var theParams;

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                theSql = sql;
                theParams = params;
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{id: 1, name: "John"}]));
            });

            service.synchronize(mockWebSQL.api.mockDatabase, model, [], [{id: 1, name: "John"}]);
            $timeout.flush();
            $rootScope.$apply();

            theSql.should.equal("DELETE FROM `" + model.dataSourceName + "` WHERE `id`=?");
            theParams[0].should.equal(1);
        });

        it("Should reject with an error when delete fails", function () {
            var response = {};

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success, failure) {
                failure(mockWebSQL.api.mockTransaction, "Error");
            });

            service.synchronize(mockWebSQL.api.mockDatabase, model, null, [{id: 1, name: "John"}]).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });

        it("Should resolve a proper response", function () {
            var response = {};

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{name: "John"}]));
            });

            service.synchronize(mockWebSQL.api.mockDatabase, model, [{name: "John"}]).then(function (res) {
                response = res;
            }, function (e) {
                throw e.data;
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

            service.synchronize(mockWebSQL.api.mockDatabase, model, [{name: "John"}]).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("ExpandHasOne", function () {
        it("Should return a promise", function () {
            var promise = service.expandHasOne(mockWebSQL.api.mockDatabase, model, {name: "John"}, {mappedBy: "aId"});
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

            service.expandHasOne(mockWebSQL.api.mockDatabase, model, {name: "John", aId: 1}, {mappedBy: "aId"});
            $timeout.flush();
            $rootScope.$apply();

            theSql.should.equal("SELECT * FROM `" + model.dataSourceName + "` WHERE `id`=? AND `deleted`=0");
            theParams[0].should.equal(1);
        });

        it("Should resolve a proper response", function () {
            var response = {};

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{id: 1, name: "John"}]));
            });

            service.expandHasOne(mockWebSQL.api.mockDatabase, model, {name: "John"}, {mappedBy: "aId"}).then(function (res) {
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

            service.expandHasOne(mockWebSQL.api.mockDatabase, model, {name: "John"}, {mappedBy: "aId"}).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            should.equal(response, null);
        });

        it("Should reject with an error", function () {
            var response = {};

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success, failure) {
                failure(mockWebSQL.api.mockTransaction, "Error");
            });

            service.expandHasOne(mockWebSQL.api.mockDatabase, model, {name: "John"}, {mappedBy: "aId"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("ExpandHasMany", function () {
        it("Should return a promise", function () {
            var promise = service.expandHasMany(mockWebSQL.api.mockDatabase, model, {name: "John"}, {mappedBy: "aId"});
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

            service.expandHasMany(mockWebSQL.api.mockDatabase, model, {name: "John", id: 1}, {mappedBy: "aId"});
            $timeout.flush();
            $rootScope.$apply();

            theSql.should.equal("SELECT * FROM `" + model.dataSourceName + "` WHERE `aId`=? AND `deleted`=0");
            theParams[0].should.equal(1);
        });

        it("Should resolve a proper response", function () {
            var response = {};

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{id: 1, name: "John"}]));
            });

            service.expandHasMany(mockWebSQL.api.mockDatabase, model, {id: "id", name: "John"}, {mappedBy: "aId"}).then(function (res) {
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

            service.expandHasMany(mockWebSQL.api.mockDatabase, model, {id: "id", name: "John"}, {mappedBy: "aId"}).then(function (res) {
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

            service.expandHasMany(mockWebSQL.api.mockDatabase, model, {id: "id", name: "John"}, {mappedBy: "aId"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });
});