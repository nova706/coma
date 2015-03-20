/*globals describe, beforeEach, module, inject, it, should*/
describe("IndexedDBAdapter", function () {

    beforeEach(module('coma.adapter.indexedDB'));

    var adapter;
    var $rootScope;
    var $timeout;
    var isFunc = function (a) {
        return typeof a === 'function';
    };

    var model = {
        dataSourceName: "testEndpoint",
        getRawModelObject: function (object) {
            return angular.copy(object);
        }
    };

    var mockIndexedDB;

    beforeEach(inject(function (_$rootScope_, _$timeout_) {
        $rootScope = _$rootScope_;
        $timeout = _$timeout_;
    }));

    beforeEach(inject(function (comaIndexedDBAdapter, $window) {
        adapter = comaIndexedDBAdapter;
        mockIndexedDB = window.MockIndexedDB($timeout);
        if ($window.indexedDB) {
            angular.extend($window.indexedDB, mockIndexedDB);
        } else {
            $window.indexedDB = mockIndexedDB;
        }
    }));

    it("Should provide the basic CRUD methods", function () {
        should.equal(true, isFunc(adapter.create));
        should.equal(true, isFunc(adapter.findOne));
        should.equal(true, isFunc(adapter.find));
        should.equal(true, isFunc(adapter.update));
        should.equal(true, isFunc(adapter.remove));
    });

    describe("Create", function () {
        it("Should return a promise", function () {
            var promise = adapter.create(model, {name: "John"});
            should.equal(true, isFunc(promise.then));
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
            mockIndexedDB.rejectTransaction();
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
            mockIndexedDB.rejectConnection();
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
        it("Should return a promise", function () {
            var promise = adapter.findOne(model, 1);
            should.equal(true, isFunc(promise.then));
        });

        it("Should resolve a proper response", function () {
            mockIndexedDB.setTransactionResult({id: 1, name: "John"});
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
            mockIndexedDB.rejectTransaction();
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
            mockIndexedDB.rejectConnection();
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
        it("Should return a promise", function () {
            var promise = adapter.find(model);
            should.equal(true, isFunc(promise.then));
        });

        it("Should resolve a proper response", function () {
            mockIndexedDB.setTransactionResult({id: 1, name: "John"});
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
            mockIndexedDB.rejectTransaction();
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
            mockIndexedDB.rejectConnection();
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
        it("Should return a promise", function () {
            var promise = adapter.update(model, 1, {name: "John"});
            should.equal(true, isFunc(promise.then));
        });

        it("Should resolve a proper response", function () {
            mockIndexedDB.setTransactionResult({id: 1, name: "John"});
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
            mockIndexedDB.rejectTransaction();
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
            mockIndexedDB.rejectConnection();
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
        it("Should return a promise", function () {
            var promise = adapter.remove(model, 1);
            should.equal(true, isFunc(promise.then));
        });

        it("Should resolve a proper response", function () {
            var response = {};

            adapter.remove(model, 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            should.equal(null, response.data);
            response.count.should.equal(1);
            response.status.should.equal(204);
        });

        it("Should reject with a proper error", function () {
            mockIndexedDB.rejectTransaction();
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
            mockIndexedDB.rejectConnection();
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