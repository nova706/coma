/*globals describe, sinon, beforeEach, module, inject, it, should*/
describe("IndexedDBService", function () {
    var service;
    var $rootScope;
    var $timeout;
    var $window;
    var model;
    var mockIndexedDB;

    var isFunc = function (a) {
        return typeof a === 'function';
    };

    beforeEach(module('recall.adapter.browserStorage'));

    beforeEach(inject(function (_$rootScope_, _$timeout_, _$window_, recallIndexedDBService) {
        $rootScope = _$rootScope_;
        $timeout = _$timeout_;
        $window = _$window_;

        service = recallIndexedDBService;

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

    describe("Create", function () {
        it("Should return a promise", function () {
            var promise = service.create(mockIndexedDB.api.mockDatabase, model, {name: "John"});
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            var response = {};

            service.create(mockIndexedDB.api.mockDatabase, model, {name: "John"}).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.name.should.equal("John");
        });

        it("Should reject with a proper error", function () {
            mockIndexedDB.api.rejectTransaction();
            var response = {};

            service.create(mockIndexedDB.api.mockDatabase, model, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("FindOne", function () {
        it("Should return a promise", function () {
            var promise = service.findOne(mockIndexedDB.api.mockDatabase, model, 1);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            mockIndexedDB.api.setTransactionResult({id: 1, name: "John"});
            var response = {};

            service.findOne(mockIndexedDB.api.mockDatabase, model, 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.name.should.equal("John");
        });

        it("Should reject with a proper error", function () {
            mockIndexedDB.api.rejectTransaction();
            var response = {};

            service.findOne(mockIndexedDB.api.mockDatabase, model, 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("Find", function () {
        it("Should return a promise", function () {
            var promise = service.find(mockIndexedDB.api.mockDatabase, model);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            mockIndexedDB.api.setTransactionResult({id: 1, name: "John"});
            var response = {};

            service.find(mockIndexedDB.api.mockDatabase, model).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response[0].name.should.equal("John");
        });

        it("Should reject with a proper error", function () {
            mockIndexedDB.api.rejectTransaction();
            var response = {};

            service.find(mockIndexedDB.api.mockDatabase, model).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("Update", function () {
        it("Should return a promise", function () {
            var promise = service.update(mockIndexedDB.api.mockDatabase, model, 1, {name: "John"});
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            mockIndexedDB.api.setTransactionResult({id: 1, name: "John"});
            var response = {};

            service.update(mockIndexedDB.api.mockDatabase, model, 1, {name: "John"}).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.name.should.equal("John");
        });

        it("Should reject with a proper error", function () {
            mockIndexedDB.api.rejectTransaction();
            var response = {};

            service.update(mockIndexedDB.api.mockDatabase, model, 1, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("Remove", function () {
        it("Should return a promise", function () {
            var promise = service.remove(mockIndexedDB.api.mockDatabase, model, 1);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            var response = {};
            mockIndexedDB.api.setTransactionResult({id: 1, name: "John"});

            service.remove(mockIndexedDB.api.mockDatabase, model, 1).then(function (res) {
                response = res;
            }, function (e) {
                throw e.data;
            });
            $timeout.flush();
            $rootScope.$apply();

            should.equal(response, null);
        });

        it("Should reject with a proper error", function () {
            mockIndexedDB.api.rejectTransaction();
            var response = {};

            service.remove(mockIndexedDB.api.mockDatabase, model, 1, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("Synchronize", function () {
        it("Should return a promise", function () {
            var promise = service.synchronize(mockIndexedDB.api.mockDatabase, model, [{name: "John"}]);
            should.equal(isFunc(promise.then), true);
        });

        it("Should reject with an error when delete fails", function () {
            mockIndexedDB.api.rejectTransaction();
            var response = {};

            service.synchronize(mockIndexedDB.api.mockDatabase, model, [], [{id: 1, name: "John"}]).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });

        it("Should resolve a proper response", function () {
            var response = {};
            mockIndexedDB.api.setTransactionResult({name: "John"});

            service.synchronize(mockIndexedDB.api.mockDatabase, model, [{name: "John"}]).then(function (res) {
                response = res;
            }, function (e) {
                throw e.data;
            });
            $timeout.flush();
            $rootScope.$apply();

            response[0].name.should.equal("John");
        });

        it("Should reject with a proper error", function () {
            mockIndexedDB.api.rejectTransaction();
            var response = {};

            service.synchronize(mockIndexedDB.api.mockDatabase, model, [{name: "John"}]).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });
});