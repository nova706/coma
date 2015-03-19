/*globals require, describe, beforeEach, module, inject, it, should*/
describe("IndexedDBAdapter", function () {

    beforeEach(module('coma.adapter.indexedDB'));

    var adapter;
    var isFunc = function (a) {
        return typeof a === 'function';
    };

    var noop = function () { return null; };

    var model = {
        dataSourceName: "testEndpoint",
        getRawModelObject: function (object) {
            return angular.copy(object);
        }
    };

    var mockData = {};
    var mockObjectStores = [];
    var mockDatabase;
    var mockTransaction;
    var mockObjectStore;
    var mockIndex;
    var mockCursor;

    beforeEach(inject(function (comaIndexedDBAdapter, $window, $timeout) {
        adapter = comaIndexedDBAdapter;

        mockDatabase = {
            onversionchange: noop,
            objectStoreNames: {
                contains: function (storeName) {
                    return mockObjectStores.indexOf(storeName);
                }
            },
            createObjectStore: function (storeName, properties) {
                mockObjectStores.push(storeName);
                return mockObjectStore;
            },
            transaction: function (tables, mode) {
                return mockTransaction;
            },
            close: function () {
                return true;
            }
        };

        mockTransaction = {
            objectStore: function (storeName) {
                return mockObjectStore;
            }
        };

        mockObjectStore = {
            createIndex: function (field, index, properties) {
                return true;
            },
            add: function (instance) {
                var toReturn = {
                    onsuccess: noop,
                    onerror: noop
                };

                this.result = "id";

                $timeout(function () {
                    toReturn.onsuccess();
                });

                return toReturn;
            },
            get: function (pk) {
                var toReturn = {
                    onsuccess: noop,
                    onerror: noop
                };

                this.result = mockData[pk];

                $timeout(function () {
                    toReturn.onsuccess();
                });

                return toReturn;
            },
            put: function (instance) {
                var toReturn = {
                    onsuccess: noop,
                    onerror: noop
                };

                $timeout(function () {
                    toReturn.onsuccess();
                });

                return toReturn;
            },
            delete: function () {
                var toReturn = {
                    onsuccess: noop,
                    onerror: noop
                };

                $timeout(function () {
                    toReturn.onsuccess();
                });

                return toReturn;
            },
            openCursor: function () {
                var toReturn = {
                    onsuccess: noop,
                    onerror: noop
                };

                $timeout(function () {
                    toReturn.onsuccess({
                        target: {
                            result: new mockCursor(toReturn.onsuccess)
                        }
                    });
                });

                return toReturn;
            },
            index: function (indexName) {
                return mockIndex;
            }
        };

        mockIndex = {
            openCursor: function () {}
        };

        mockCursor = function (call) {
            this.continue = function () {
                call({
                    target: {
                        result: false
                    }
                });
            };
            this.value = {name: "John"};
        };

        $window.indexedDB = {
            open: function () {
                var toReturn = {
                    onupgradeneeded: noop,
                    onsuccess: noop,
                    onerror: noop
                };

                $timeout(function () {
                    toReturn.onsuccess({
                        target: {
                            result: mockDatabase
                        }
                    });
                });

                return toReturn;
            }
        };
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
    });

    describe("FindOne", function () {
        it("Should return a promise", function () {
            var promise = adapter.findOne(model, 1);
            should.equal(true, isFunc(promise.then));
        });
    });

    describe("Find", function () {
        it("Should return a promise", function () {
            var promise = adapter.find(model);
            should.equal(true, isFunc(promise.then));
        });
    });

    describe("Update", function () {
        it("Should return a promise", function () {
            var promise = adapter.update(model, 1, {name: "John"});
            should.equal(true, isFunc(promise.then));
        });
    });

    describe("Remove", function () {
        it("Should return a promise", function () {
            var promise = adapter.remove(model, 1);
            should.equal(true, isFunc(promise.then));
        });
    });
});