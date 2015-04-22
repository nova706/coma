/*globals describe, sinon, beforeEach, module, inject, it, should*/
describe("BrowserStorageAdapter", function () {
    var provider;
    var adapter;
    var $rootScope;
    var $timeout;
    var $q;
    var model;
    var mockService;

    var isFunc = function (a) {
        return typeof a === 'function';
    };

    beforeEach(module('recall.adapter.browserStorage', function (recallBrowserStorageAdapterProvider) {
        provider = recallBrowserStorageAdapterProvider;
    }));

    beforeEach(inject(function (_$rootScope_, _$timeout_, _$window_, _$q_) {
        $rootScope = _$rootScope_;
        $timeout = _$timeout_;
        $q = _$q_;

        _$window_.indexedDB = false;
        _$window_.openDatabase = true;

        mockService = {
            connect: function (dbName, dbVersion, dbSize) {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            },
            create: function (db, theModel, modelInstance) {
                var dfd = $q.defer();
                dfd.resolve(modelInstance);
                return dfd.promise;
            },
            findOne: function (db, theModel, pk, includeDeleted) {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            },
            find: function (db, theModel, includeDeleted) {
                var dfd = $q.defer();
                dfd.resolve([]);
                return dfd.promise;
            },
            update: function (db, theModel, pk, modelInstance, includeDeleted) {
                var dfd = $q.defer();
                dfd.resolve(modelInstance);
                return dfd.promise;
            },
            remove: function (db, theModel, pk) {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            },
            synchronize: function (db, theModel, merge, remove) {
                var dfd = $q.defer();
                dfd.resolve([]);
                return dfd.promise;
            },
            expandHasOne: function (db, model, result, association) {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            },
            expandHasMany: function (db, model, result, association) {
                var dfd = $q.defer();
                dfd.resolve([]);
                return dfd.promise;
            }
        };

        model = {
            dataSourceName: "testEndpoint",
            lastModifiedFieldName: "lastModified",
            deletedFieldName: "deleted",
            primaryKeyFieldName: 'id',
            getRawModelObject: function (object) {
                return angular.copy(object);
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
            adapter.service = mockService;

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
            adapter.service = mockService;

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
            adapter.service = mockService;

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
            adapter.service = mockService;

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
            adapter.service = mockService;
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
            adapter.service = mockService;
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
            adapter.service = mockService;
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
            adapter.service = mockService;
        }));

        it("Should return a promise", function () {
            var promise = adapter.update(model, 1, {name: "John"});
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
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

        it("Should reject with a proper error", function () {
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
            adapter.service = mockService;
        }));

        it("Should return a promise", function () {
            var promise = adapter.remove(model, 1);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
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
            sinon.stub(adapter.service, "remove", function () {
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
});