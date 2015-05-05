/*globals describe, sinon, beforeEach, module, inject, it, should*/
describe("IndexedDBService", function () {
    var service;
    var $rootScope;
    var $timeout;
    var $window;
    var $q;
    var model;
    var modelDef;
    var mockIndexedDB;
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

    beforeEach(inject(function (_$rootScope_, _$timeout_, _$window_, _$q_, recallIndexedDBService, recall) {
        $rootScope = _$rootScope_;
        $timeout = _$timeout_;
        $window = _$window_;
        $q = _$q_;

        service = recallIndexedDBService;

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

    describe("Migrate", function () {
        it("Should create the object stores for the models", function () {
            sinon.stub(mockIndexedDB.api.mockDatabase, "createObjectStore").returns(mockIndexedDB.api.mockObjectStore);
            service.migrate(mockIndexedDB.api.mockDatabase);

            mockIndexedDB.api.mockDatabase.createObjectStore.calledWith("testEndpoint").should.equal(true);
        });

        it("Should create indexes for the fields", function () {
            sinon.stub(mockIndexedDB.api.mockObjectStore, "createIndex");
            service.migrate(mockIndexedDB.api.mockDatabase);

            mockIndexedDB.api.mockObjectStore.createIndex.calledWith("index", "test").should.equal(true);
        });

        it("Should not create existing object stores", function () {
            mockIndexedDB.api.mockObjectStores.push("testEndpoint");
            sinon.stub(mockIndexedDB.api.mockDatabase, "createObjectStore");

            service.migrate(mockIndexedDB.api.mockDatabase);

            mockIndexedDB.api.mockDatabase.createObjectStore.called.should.equal(false);
        });
    });

    describe("HandleVersionChange", function () {
        it("Should close the connection when the database is closed.", function () {
            service.handleVersionChange(mockIndexedDB.api.mockDatabase);
            sinon.stub(mockIndexedDB.api.mockDatabase, "close");
            sinon.stub($window, "alert");

            mockIndexedDB.api.mockDatabase.onversionchange();

            mockIndexedDB.api.mockDatabase.close.called.should.equal(true);
            $window.alert.called.should.equal(true);
        });
    });

    describe("Connect", function () {
        it("Should return a promise", function () {
            var promise = service.connect("test", 1);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve with the database", function () {
            var response = {};

            service.connect("test", 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal(mockIndexedDB.api.mockDatabase);
        });

        it("Should resolve with the database when upgrade is needed", function () {
            var response = {};
            sinon.stub($window.indexedDB, "open", function () {
                var toReturn = {
                    onupgradeneeded: function () { return null; },
                    onsuccess: function () { return null; },
                    onerror: function () { return null; },
                    error: "Error"
                };

                $timeout(function () {
                    toReturn.onupgradeneeded({
                        target: {
                            result: mockIndexedDB.api.mockDatabase
                        }
                    });
                });
                return toReturn;
            });

            service.connect("test", 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal(mockIndexedDB.api.mockDatabase);
        });

        it("Should call handleVersionChange", function () {
            var response = {};
            sinon.stub(service, "handleVersionChange");

            service.connect("test", 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            service.handleVersionChange.called.should.equal(true);
        });

        it("Should call handleVersionChange when upgrade is needed", function () {
            var response = {};
            sinon.stub($window.indexedDB, "open", function () {
                var toReturn = {
                    onupgradeneeded: function () { return null; },
                    onsuccess: function () { return null; },
                    onerror: function () { return null; },
                    error: "Error"
                };

                $timeout(function () {
                    toReturn.onupgradeneeded({
                        target: {
                            result: mockIndexedDB.api.mockDatabase
                        }
                    });
                });
                return toReturn;
            });

            sinon.stub(service, "handleVersionChange");

            service.connect("test", 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            service.handleVersionChange.called.should.equal(true);
        });

        it("Should call migrate when upgrade is needed", function () {
            var response = {};
            sinon.stub($window.indexedDB, "open", function () {
                var toReturn = {
                    onupgradeneeded: function () { return null; },
                    onsuccess: function () { return null; },
                    onerror: function () { return null; },
                    error: "Error"
                };

                $timeout(function () {
                    toReturn.onupgradeneeded({
                        target: {
                            result: mockIndexedDB.api.mockDatabase
                        }
                    });
                });
                return toReturn;
            });

            sinon.stub(service, "migrate");

            service.connect("test", 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            service.migrate.called.should.equal(true);
        });

        it("Should reject with a proper error", function () {
            mockIndexedDB.api.rejectConnection();
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

        it("Should resolve a proper response when nothing is found", function () {
            mockIndexedDB.api.setTransactionResult(null);
            var response = {};

            service.findOne(mockIndexedDB.api.mockDatabase, model, 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            should.equal(null, response);
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

        it("Should resolve a proper response when the found items are deleted", function () {
            mockIndexedDB.api.setTransactionResult({id: 1, name: "John", deleted: true});
            var response = {};

            service.find(mockIndexedDB.api.mockDatabase, model).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.length.should.equal(0);
        });

        it("Should resolve a proper response when the found items are deleted and include deleted is true", function () {
            mockIndexedDB.api.setTransactionResult({id: 1, name: "John", deleted: true});
            var response = {};

            service.find(mockIndexedDB.api.mockDatabase, model, true).then(function (res) {
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

        it("Should reject with a proper error when find fails", function () {
            mockIndexedDB.api.rejectTransaction();
            var response = {};

            service.update(mockIndexedDB.api.mockDatabase, model, 1, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });

        it("Should reject with a proper error when update fails", function () {
            mockIndexedDB.api.setTransactionResult({id: 1, name: "John"});
            sinon.stub(mockIndexedDB.api.mockObjectStore, "put", function () {
                var toReturn = {
                    onsuccess: function () { return null; },
                    onerror: function () { return null; },
                    result: null,
                    error: "Error"
                };

                $timeout(function () {
                    toReturn.onerror();
                });

                return toReturn;
            });
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
                throw e;
            });
            $timeout.flush();
            $rootScope.$apply();

            should.equal(response, null);
        });

        it("Should reject with a proper error when update fails", function () {
            mockIndexedDB.api.setTransactionResult({id: 1, name: "John"});
            sinon.stub(mockIndexedDB.api.mockObjectStore, "delete", function () {
                var toReturn = {
                    onsuccess: function () { return null; },
                    onerror: function () { return null; },
                    result: null,
                    error: "Error"
                };

                $timeout(function () {
                    toReturn.onerror();
                });

                return toReturn;
            });
            var response = {};

            service.remove(mockIndexedDB.api.mockDatabase, model, 1, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("FindByAssociation", function () {
        it("Should return a promise", function () {
            var promise = service.findByAssociation(mockIndexedDB.api.mockDatabase, model, 1, "aId");
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            mockIndexedDB.api.setTransactionResult({name: "John"});
            var response = {};

            service.findByAssociation(mockIndexedDB.api.mockDatabase, model, "id", "aId").then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response[0].name.should.equal("John");
        });

        it("Should resolve a proper response when nothing is found", function () {
            mockIndexedDB.api.setTransactionResult();
            var response = {};

            service.findByAssociation(mockIndexedDB.api.mockDatabase, model, "id", "aId").then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.length.should.equal(0);
        });

        it("Should resolve a proper response when the record found is deleted", function () {
            mockIndexedDB.api.setTransactionResult({name: "John", deleted: true});
            var response = {};

            service.findByAssociation(mockIndexedDB.api.mockDatabase, model, "id", "aId").then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.length.should.equal(0);
        });

        it("Should reject with an error", function () {
            mockIndexedDB.api.rejectTransaction();
            var response = {};

            service.findByAssociation(mockIndexedDB.api.mockDatabase, model, "id", "aId").then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });
});