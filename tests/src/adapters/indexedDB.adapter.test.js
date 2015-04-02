/*globals describe, sinon, beforeEach, module, inject, it, should*/
describe("IndexedDBAdapter", function () {
    var provider;
    var adapter;
    var $rootScope;
    var $timeout;
    var model;
    var mockIndexedDB;
    var $window;

    var isFunc = function (a) {
        return typeof a === 'function';
    };

    beforeEach(module('recall.adapter.indexedDB', function (recallIndexedDBAdapterProvider) {
        provider = recallIndexedDBAdapterProvider;
    }));

    beforeEach(inject(function (_$rootScope_, _$timeout_, _$window_) {
        $rootScope = _$rootScope_;
        $timeout = _$timeout_;
        $window = _$window_;
        mockIndexedDB = window.MockIndexedDB($timeout);
        if ($window.indexedDB) {
            angular.extend($window.indexedDB, mockIndexedDB);
        } else {
            $window.indexedDB = mockIndexedDB;
        }
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
    }));

    describe("setDbName", function () {
        it("Should open a connection to the DB specified", inject(function ($injector) {
            provider.setDbName('test');
            adapter = $injector.invoke(provider.$get);
            sinon.stub($window.indexedDB, "open").returns({});

            adapter.create(model, {name: "John"});

            $window.indexedDB.open.calledWith('test').should.equal(true);
        }));
    });

    describe("setDbVersion", function () {
        it("Should open a connection to the DB with the version specified", inject(function ($injector) {
            provider.setDbVersion(2);
            adapter = $injector.invoke(provider.$get);
            sinon.stub($window.indexedDB, "open").returns({});

            adapter.create(model, {name: "John"});

            $window.indexedDB.open.calledWith('recall', 2).should.equal(true);
        }));
    });

    describe("setPkGenerator", function () {
        it("Should generate new primary keys with the function specified", inject(function ($injector) {
            provider.setPkGenerator(function () {
                return 'test';
            });
            adapter = $injector.invoke(provider.$get);

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
            mockIndexedDB.api.rejectTransaction();
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
            mockIndexedDB.api.rejectConnection();
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
        }));

        it("Should return a promise", function () {
            var promise = adapter.findOne(model, 1);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            mockIndexedDB.api.setTransactionResult({id: 1, name: "John"});
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
            mockIndexedDB.api.rejectTransaction();
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
            mockIndexedDB.api.rejectConnection();
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
        }));

        it("Should return a promise", function () {
            var promise = adapter.find(model);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            mockIndexedDB.api.setTransactionResult({id: 1, name: "John"});
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
            mockIndexedDB.api.rejectTransaction();
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
            mockIndexedDB.api.rejectConnection();
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
        }));

        it("Should return a promise", function () {
            var promise = adapter.update(model, 1, {name: "John"});
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            mockIndexedDB.api.setTransactionResult({id: 1, name: "John"});
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
            mockIndexedDB.api.rejectTransaction();
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
            mockIndexedDB.api.rejectConnection();
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
        }));

        it("Should return a promise", function () {
            var promise = adapter.remove(model, 1);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            var response = {};
            mockIndexedDB.api.setTransactionResult({id: 1, name: "John"});

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
            mockIndexedDB.api.rejectTransaction();
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
            mockIndexedDB.api.rejectConnection();
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