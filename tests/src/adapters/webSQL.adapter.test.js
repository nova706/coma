/*globals describe, sinon, beforeEach, module, inject, it, should*/
describe("WebSQLAdapter", function () {
    var provider;
    var adapter;
    var $rootScope;
    var $timeout;
    var mockWebSQL;
    var model;
    var $window;

    var isFunc = function (a) {
        return typeof a === 'function';
    };

    beforeEach(module('recall.adapter.webSQL', function (recallWebSQLAdapterProvider) {
        provider = recallWebSQLAdapterProvider;
    }));

    beforeEach(inject(function (_$rootScope_, _$timeout_, _$window_) {
        $rootScope = _$rootScope_;
        $timeout = _$timeout_;
        $window = _$window_;
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

    it("Should provide the basic CRUD methods", inject(function ($injector) {
        adapter = $injector.invoke(provider.$get);
        should.equal(isFunc(adapter.create), true);
        should.equal(isFunc(adapter.findOne), true);
        should.equal(isFunc(adapter.find), true);
        should.equal(isFunc(adapter.update), true);
        should.equal(isFunc(adapter.remove), true);
        should.equal(isFunc(adapter.synchronize), true);
    }));

    describe("setDbName", function () {
        it("Should open a connection to the DB specified", inject(function ($injector) {
            provider.setDbName('test');
            adapter = $injector.invoke(provider.$get);
            sinon.stub($window, "openDatabase").returns({});

            adapter.create(model, {name: "John"});

            $window.openDatabase.calledWith('test').should.equal(true);
        }));
    });

    describe("setDbVersion", function () {
        it("Should open a connection to the DB with the version specified", inject(function ($injector) {
            provider.setDbVersion(2);
            adapter = $injector.invoke(provider.$get);
            sinon.stub($window, "openDatabase").returns({});

            adapter.create(model, {name: "John"});

            $window.openDatabase.calledWith('recall', '2').should.equal(true);
        }));
    });

    describe("setDbSize", function () {
        it("Should open a connection to the DB with the size specified", inject(function ($injector) {
            provider.setDbSize(2048);
            adapter = $injector.invoke(provider.$get);
            sinon.stub($window, "openDatabase").returns({});

            adapter.create(model, {name: "John"});

            $window.openDatabase.calledWith('recall', '1', 'Recall WebSQL Database', 2048).should.equal(true);
        }));
    });

    describe("setPkGenerator", function () {
        it("Should generate new primary keys with the function specified", inject(function ($injector) {
            provider.setPkGenerator(function () {
                return 'test';
            });
            adapter = $injector.invoke(provider.$get);

            var theSql;
            var theParams;
            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                theSql = sql;
                theParams = params;
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{id: 1, name: "John"}]));
            });

            adapter.create(model, {name: "John"});
            $timeout.flush();
            $rootScope.$apply();

            theSql.should.equal("INSERT INTO `" + model.dataSourceName + "` (`id`,`name`) VALUES (?,?)");
            theParams[0].should.equal("test");
        }));
    });

    describe("Create", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
        }));

        it("Should return a promise", function () {
            var promise = adapter.create(model, {name: "John"});
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

            adapter.create(model, {name: "John", test: "test"});
            $timeout.flush();
            $rootScope.$apply();

            theSql.should.equal("INSERT INTO `" + model.dataSourceName + "` (`id`,`name`) VALUES (?,?)");
            theParams[1].should.equal("John");
        });

        it("Should resolve a proper response", function () {
            var response = {};

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{name: "John"}]));
            });

            adapter.create(model, {name: "John"}).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(201);
        });

        it("Should reject with a proper error", function () {
            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success, failure) {
                failure(mockWebSQL.api.mockTransaction, "Error");
            });
            var response = {};

            adapter.create(model, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when connection fails", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub($window, "openDatabase").throws(exception);
            var response = {};

            adapter.create(model, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal(exception);
            response.count.should.equal(0);
            response.status.should.equal(500);
        });
    });

    describe("FindOne", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
        }));

        it("Should return a promise", function () {
            var promise = adapter.findOne(model, 1);
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

            adapter.findOne(model, 1);
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

            adapter.findOne(model, 1, null, true);
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

            adapter.findOne(model, 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should resolve a proper response when nothing is found", function () {
            var response = {};

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([]));
            });

            adapter.findOne(model, 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Not Found");
            response.count.should.equal(0);
            response.status.should.equal(404);
        });

        it("Should reject with a proper error", function () {
            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success, failure) {
                failure(mockWebSQL.api.mockTransaction, "Error");
            });
            var response = {};

            adapter.findOne(model, 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when connection fails", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub($window, "openDatabase").throws(exception);
            var response = {};

            adapter.findOne(model, 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal(exception);
            response.count.should.equal(0);
            response.status.should.equal(500);
        });
    });

    describe("Find", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
        }));

        it("Should return a promise", function () {
            var promise = adapter.find(model);
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

            adapter.find(model);
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

            adapter.find(model, null, true);
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

            adapter.find(model).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data[0].name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should reject with a proper error", function () {
            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success, failure) {
                failure(mockWebSQL.api.mockTransaction, "Error");
            });
            var response = {};

            adapter.find(model).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when connection fails", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub($window, "openDatabase").throws(exception);
            var response = {};

            adapter.find(model).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal(exception);
            response.count.should.equal(0);
            response.status.should.equal(500);
        });
    });

    describe("Update", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
        }));

        it("Should return a promise", function () {
            var promise = adapter.update(model, 1, {name: "John"});
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

            adapter.update(model, 1, {name: "John"});
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

            adapter.update(model, 1, {name: "John"}, true);
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

            adapter.update(model, 1, {name: "John"}).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should reject with a proper error", function () {
            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success, failure) {
                failure(mockWebSQL.api.mockTransaction, "Error");
            });
            var response = {};

            adapter.update(model, 1, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when connection fails", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub($window, "openDatabase").throws(exception);
            var response = {};

            adapter.update(model, 1, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal(exception);
            response.count.should.equal(0);
            response.status.should.equal(500);
        });
    });

    describe("Remove", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
        }));

        it("Should return a promise", function () {
            var promise = adapter.remove(model, 1);
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

            adapter.remove(model, 1);
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

            adapter.remove(model, 1).then(function (res) {
                response = res;
            }, function (e) {
                throw e.data;
            });
            $timeout.flush();
            $rootScope.$apply();

            should.equal(response.data, null);
            response.count.should.equal(1);
            response.status.should.equal(204);
        });

        it("Should reject with a proper error", function () {
            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success, failure) {
                failure(mockWebSQL.api.mockTransaction, "Error");
            });
            var response = {};

            adapter.remove(model, 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when connection fails", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub($window, "openDatabase").throws(exception);
            var response = {};

            adapter.remove(model, 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal(exception);
            response.count.should.equal(0);
            response.status.should.equal(500);
        });
    });

    describe("Synchronize", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
        }));

        it("Should return a promise", function () {
            var promise = adapter.synchronize(model, [{name: "John"}]);
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

            adapter.synchronize(model, [{name: "John"}]);
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

            adapter.synchronize(model, [{id: 1, name: "John", deleted: true}]);
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

            adapter.synchronize(model, [{id: 1, name: "John", deleted: true}]).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should resolve a proper response", function () {
            var response = {};

            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success) {
                success(mockWebSQL.api.mockTransaction, new mockWebSQL.api.Response([{name: "John"}]));
            });

            adapter.synchronize(model, [{name: "John"}]).then(function (res) {
                response = res;
            }, function (e) {
                throw e.data;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data[0].name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should reject with a proper error", function () {
            sinon.stub(mockWebSQL.api.mockTransaction, "executeSql", function (sql, params, success, failure) {
                failure(mockWebSQL.api.mockTransaction, "Error");
            });
            var response = {};

            adapter.synchronize(model, [{name: "John"}]).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when connection fails", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub($window, "openDatabase").throws(exception);
            var response = {};

            adapter.synchronize(model, [{name: "John"}]).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal(exception);
            response.count.should.equal(0);
            response.status.should.equal(500);
        });
    });
});