/*globals describe, sinon, beforeEach, module, inject, it, should*/
describe("BrowserStorageAdapter", function () {
    var provider;
    var adapter;
    var $rootScope;
    var $timeout;
    var $q;
    var $window;
    var model;
    var modelDef;
    var mockIndexedDB;
    var mockWebSQL;
    var indexedDBService;
    var webSQLService;
    var testAdapter;
    var service;
    var Predicate;
    var PreparedQueryOptions;

    var isFunc = function (a) {
        return typeof a === 'function';
    };

    var resolvedPromiseFunction = function () {
        var dfd = $q.defer();
        dfd.resolve();
        return dfd.promise;
    };

    beforeEach(module('recall.adapter.browserStorage', function (recallBrowserStorageAdapterProvider) {
        provider = recallBrowserStorageAdapterProvider;
    }));

    beforeEach(inject(function (_$rootScope_, _$timeout_, _$window_, _$q_, recall, recallIndexedDBService, recallWebSQLService, recallPredicate, recallPreparedQueryOptions) {
        $rootScope = _$rootScope_;
        $timeout = _$timeout_;
        $q = _$q_;
        $window = _$window_;
        Predicate = recallPredicate;
        PreparedQueryOptions = recallPreparedQueryOptions;

        service = recallIndexedDBService;

        indexedDBService = recallIndexedDBService;
        webSQLService = recallWebSQLService;

        mockWebSQL = window.MockWebSQL($timeout);
        $window.openDatabase = mockWebSQL.openDatabase;

        mockIndexedDB = window.MockIndexedDB($timeout);
        if ($window.indexedDB) {
            angular.extend($window.indexedDB, mockIndexedDB);
        } else {
            $window.indexedDB = mockIndexedDB;
        }

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
                    type: "String",
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

    it("Should provide the basic CRUD methods", inject(function ($injector) {
        adapter = $injector.invoke(provider.$get);
        should.equal(isFunc(adapter.create), true);
        should.equal(isFunc(adapter.findOne), true);
        should.equal(isFunc(adapter.find), true);
        should.equal(isFunc(adapter.update), true);
        should.equal(isFunc(adapter.remove), true);
        should.equal(isFunc(adapter.synchronize), true);
    }));

    describe("preferIndexedDB", function () {
        it("Should use the indexedDB service", inject(function ($injector) {
            provider.preferIndexedDB();
            adapter = $injector.invoke(provider.$get);

            adapter.service.should.equal(indexedDBService);
        }));

        it("Should fall back to webSQL", inject(function ($injector) {
            provider.preferIndexedDB();

            delete $window.indexedDB;
            adapter = $injector.invoke(provider.$get);

            adapter.service.should.equal(webSQLService);
        }));

        it("Should return null if neither service is available", inject(function ($injector) {
            provider.preferIndexedDB();

            delete $window.indexedDB;
            $window.openDatabase = undefined;
            adapter = $injector.invoke(provider.$get);

            should.equal(adapter, null);
        }));
    });

    describe("preferWebSQL", function () {
        it("Should use the webSQL service", inject(function ($injector) {
            provider.preferWebSQL();
            adapter = $injector.invoke(provider.$get);

            adapter.service.should.equal(webSQLService);
        }));

        it("Should fall back to indexedDB", inject(function ($injector) {
            provider.preferWebSQL();

            $window.openDatabase = undefined;
            adapter = $injector.invoke(provider.$get);

            adapter.service.should.equal(indexedDBService);
        }));

        it("Should return null if neither service is available", inject(function ($injector) {
            provider.preferWebSQL();

            delete $window.indexedDB;
            $window.openDatabase = undefined;
            adapter = $injector.invoke(provider.$get);

            should.equal(adapter, null);
        }));
    });

    describe("setDbName", function () {
        it("Should open a connection to the DB specified", inject(function ($injector) {
            provider.setDbName('test');
            adapter = $injector.invoke(provider.$get);
            adapter.service = service;

            sinon.stub(adapter.service, "connect", function () {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            });

            adapter.create(model, {name: "John"});

            adapter.service.connect.calledWith('test').should.equal(true);
        }));
    });

    describe("setDbVersion", function () {
        it("Should open a connection to the DB with the version specified", inject(function ($injector) {
            provider.setDbVersion(2);
            adapter = $injector.invoke(provider.$get);
            adapter.service = service;

            sinon.stub(adapter.service, "connect", function () {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            });

            adapter.create(model, {name: "John"});

            adapter.service.connect.calledWith('recall', 2).should.equal(true);
        }));
    });

    describe("setDbSize", function () {
        it("Should open a connection to the DB with the size specified", inject(function ($injector) {
            provider.setDbSize(1024);
            adapter = $injector.invoke(provider.$get);
            adapter.service = service;

            sinon.stub(adapter.service, "connect", function () {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            });

            adapter.create(model, {name: "John"});

            adapter.service.connect.calledWith('recall', 1, 1024).should.equal(true);
        }));
    });

    describe("setPkGenerator", function () {
        it("Should generate new primary keys with the function specified", inject(function ($injector) {
            provider.setPkGenerator(function () {
                return 'test';
            });
            adapter = $injector.invoke(provider.$get);
            adapter.service = service;

            var response = {};

            adapter.create(model, {name: "John"}).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.id.should.equal("test");
        }));
    });

    describe("Create", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
            adapter.service = service;
        }));

        it("Should return a promise", function () {
            var promise = adapter.create(model, {name: "John"});
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            var response = {};

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
            sinon.stub(adapter.service, "create", function () {
                return $q.reject("Error");
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
            sinon.stub(adapter.service, "connect", function () {
                return $q.reject("Error");
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
    });

    describe("FindOne", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
            adapter.service = service;
        }));

        it("Should return a promise", function () {
            var promise = adapter.findOne(model, 1);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });

            var response = {};

            adapter.findOne(model, 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should reject with a proper error when nothing is found", function () {
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            });

            var response = {};

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
            sinon.stub(adapter.service, "findOne", function () {
                return $q.reject("Error");
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
            sinon.stub(adapter.service, "connect", function () {
                return $q.reject("Error");
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
    });

    describe("Find", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
            adapter.service = service;
        }));

        it("Should return a promise", function () {
            var promise = adapter.find(model);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            sinon.stub(adapter.service, "find", function () {
                var dfd = $q.defer();
                dfd.resolve([{id: 1, name: "John"}]);
                return dfd.promise;
            });

            var response = {};

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
            sinon.stub(adapter.service, "find", function () {
                return $q.reject("Error");
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
            sinon.stub(adapter.service, "connect", function () {
                return $q.reject("Error");
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
    });

    describe("Update", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
            adapter.service = service;
        }));

        it("Should return a promise", function () {
            var promise = adapter.update(model, 1, {name: "John"});
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(adapter.service, "update", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });

            var response = {};

            adapter.update(model, 1, {name: "John"}).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should reject with a proper error when nothing is found", function () {
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve(null);
                return dfd.promise;
            });
            sinon.stub(adapter.service, "update", function () {
                var dfd = $q.defer();
                dfd.resolve(null);
                return dfd.promise;
            });

            var response = {};

            adapter.update(model, 1, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Not Found");
            response.count.should.equal(0);
            response.status.should.equal(404);
        });

        it("Should reject with a proper error", function () {
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(adapter.service, "update", function () {
                return $q.reject("Error");
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
            sinon.stub(adapter.service, "connect", function () {
                return $q.reject("Error");
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
    });

    describe("Remove", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
            adapter.service = service;
        }));

        it("Should return a promise", function () {
            var promise = adapter.remove(model, 1);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(adapter.service, "remove", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });

            var response = {};

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
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(adapter.service, "update", function () {
                return $q.reject("Error");
            });

            var response = {};

            adapter.remove(model, 1, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when connection fails", function () {
            sinon.stub(adapter.service, "connect", function () {
                return $q.reject("Error");
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
    });

    describe("Synchronize", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
            adapter.service = service;
        }));

        it("Should return a promise", function () {
            var promise = adapter.synchronize(model, []);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            sinon.stub(adapter, "syncInstance", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(adapter, "getSyncList", function () {
                var dfd = $q.defer();
                dfd.resolve([{id: 1, name: "John"}]);
                return dfd.promise;
            });

            var response = {};

            adapter.synchronize(model, [{id: 1, name: "John"}, {id: 2, name: "Steve", deleted: true}]).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data[0].name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should reject with a proper error", function () {
            sinon.stub(adapter, "syncInstance", function () {
                return $q.reject("Error");
            });

            var response = {};

            adapter.synchronize(model, [{id: 1, name: "John"}]).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when connection fails", function () {
            sinon.stub(adapter.service, "connect", function () {
                return $q.reject("Error");
            });

            var response = {};

            adapter.synchronize(model, [{id: 1, name: "John"}]).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });
    });
});
