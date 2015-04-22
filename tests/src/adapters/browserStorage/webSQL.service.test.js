/*globals describe, sinon, beforeEach, module, inject, it, should*/
describe("WebSQLService", function () {
    var service;
    var $rootScope;
    var $timeout;
    var $window;
    var mockWebSQL;
    var model;

    var isFunc = function (a) {
        return typeof a === 'function';
    };

    beforeEach(module('recall.adapter.browserStorage'));

    beforeEach(inject(function (_$rootScope_, _$timeout_, _$window_, recallWebSQLService) {
        $rootScope = _$rootScope_;
        $timeout = _$timeout_;
        $window = _$window_;

        service = recallWebSQLService;

        mockWebSQL = window.MockWebSQL($timeout);
        $window.openDatabase = mockWebSQL.openDatabase;

        model = {
            dataSourceName: "testEndpoint",
            lastModifiedFieldName: "lastModified",
            deletedFieldName: "deleted",
            primaryKeyFieldName: 'id',
            getRawModelObject: function (object) {
                return angular.copy(object);
            },
            fields: {
                id: {
                    primaryKey: true,
                    type: "STRING",
                    name: 'id'
                },
                name: {
                    type: "STRING",
                    name: "name"
                }
            }
        };
    }));

    describe("Create", function () {
        it("Should return a promise", function () {
            var promise = service.create(mockWebSQL.api.mockDb, model, {name: "John"});
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

            service.create(mockWebSQL.api.mockDb, model, {name: "John", test: "test"});
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

            service.create(mockWebSQL.api.mockDb, model, {name: "John"}).then(function (res) {
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

            service.create(mockWebSQL.api.mockDb, model, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("FindOne", function () {
        it("Should return a promise", function () {
            var promise = service.findOne(mockWebSQL.api.mockDb, model, 1);
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

            service.findOne(mockWebSQL.api.mockDb, model, 1);
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

            service.findOne(mockWebSQL.api.mockDb, model, 1, true);
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

            service.findOne(mockWebSQL.api.mockDb, model, 1).then(function (res) {
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

            service.findOne(mockWebSQL.api.mockDb, model, 1).then(null, function (res) {
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

            service.findOne(mockWebSQL.api.mockDb, model, 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("Find", function () {
        it("Should return a promise", function () {
            var promise = service.find(mockWebSQL.api.mockDb, model);
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

            service.find(mockWebSQL.api.mockDb, model);
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

            service.find(mockWebSQL.api.mockDb, model, true);
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

            service.find(mockWebSQL.api.mockDb, model).then(function (res) {
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

            service.find(mockWebSQL.api.mockDb, model).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("Update", function () {
        it("Should return a promise", function () {
            var promise = service.update(mockWebSQL.api.mockDb, model, 1, {name: "John"});
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

            service.update(mockWebSQL.api.mockDb, model, 1, {name: "John"});
            $timeout.flush();
            $rootScope.$apply();

            theSql.should.equal("UPDATE `" + model.dataSourceName + "` SET `name`=? WHERE `id`=? AND `deleted`=0");
            theParams[0].should.equal("John");
            theParams[1].should.equal(1);
        });

        it("Should execute the proper SQL when including deleted", function () {
            var theSql;
            var theParams;

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                theSql = sql;
                theParams = params;
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{id: 1, name: "John"}]));
            });

            service.update(mockWebSQL.api.mockDb, model, 1, {name: "John"}, true);
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

            service.update(mockWebSQL.api.mockDb, model, 1, {name: "John"}).then(function (res) {
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

            service.update(mockWebSQL.api.mockDb, model, 1, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("Remove", function () {
        it("Should return a promise", function () {
            var promise = service.remove(mockWebSQL.api.mockDb, model, 1);
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

            service.remove(mockWebSQL.api.mockDb, model, 1);
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

            service.remove(mockWebSQL.api.mockDb, model, 1).then(function (res) {
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

            service.remove(mockWebSQL.api.mockDb, model, 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("Synchronize", function () {
        it("Should return a promise", function () {
            var promise = service.synchronize(mockWebSQL.api.mockDb, model, [{name: "John"}]);
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

            service.synchronize(mockWebSQL.api.mockDb, model, [{name: "John"}]);
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

            service.synchronize(mockWebSQL.api.mockDb, model, [], [{id: 1, name: "John"}]);
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

            service.synchronize(mockWebSQL.api.mockDb, model, [], [{id: 1, name: "John"}]).then(null, function (res) {
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

            service.synchronize(mockWebSQL.api.mockDb, model, [{name: "John"}]).then(function (res) {
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

            service.synchronize(mockWebSQL.api.mockDb, model, [{name: "John"}]).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });
});