// Mock IndexedDB instance used to test the IndexedDBAdapter
window.MockIndexedDB = function ($timeout) {
    var rejectConnection = false;
    var rejectTransaction = false;
    var transactionResult = null;

    var noop = function () { return null; };

    var mockObjectStores = [];
    var mockDatabase;
    var mockTransaction;
    var mockObjectStore;
    var mockIndex;
    var MockCursor;

    mockDatabase = {
        onversionchange: noop,
        objectStoreNames: {
            contains: function (storeName) {
                return mockObjectStores.indexOf(storeName) >= 0;
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
                onerror: noop,
                result: transactionResult,
                error: "Error"
            };

            $timeout(function () {
                if (rejectTransaction) {
                    toReturn.onerror(toReturn);
                } else {
                    toReturn.onsuccess(instance);
                }
            });

            return toReturn;
        },
        get: function (pk) {
            var toReturn = {
                onsuccess: noop,
                onerror: noop,
                result: transactionResult,
                error: "Error"
            };

            $timeout(function () {
                if (rejectTransaction) {
                    toReturn.onerror();
                } else {
                    toReturn.onsuccess();
                }
            });

            return toReturn;
        },
        put: function (instance) {
            var toReturn = {
                onsuccess: noop,
                onerror: noop,
                result: transactionResult,
                error: "Error"
            };

            $timeout(function () {
                if (rejectTransaction) {
                    toReturn.onerror();
                } else {
                    toReturn.onsuccess();
                }
            });

            return toReturn;
        },
        delete: function () {
            var toReturn = {
                onsuccess: noop,
                onerror: noop,
                result: transactionResult,
                error: "Error"
            };

            $timeout(function () {
                if (rejectTransaction) {
                    toReturn.onerror();
                } else {
                    toReturn.onsuccess();
                }
            });

            return toReturn;
        },
        openCursor: function () {
            var toReturn = {
                onsuccess: noop,
                onerror: noop,
                error: "Error"
            };

            $timeout(function () {
                if (rejectTransaction) {
                    toReturn.onerror();
                } else if (!transactionResult) {
                    toReturn.onsuccess({
                        target: {
                            result: null
                        }
                    });
                } else {
                    toReturn.onsuccess({
                        target: {
                            result: new MockCursor(toReturn.onsuccess)
                        }
                    });
                }
            });

            return toReturn;
        },
        index: function (indexName) {
            return mockIndex;
        }
    };

    mockIndex = {
        openCursor: function () {
            var toReturn = {
                onsuccess: noop,
                onerror: noop,
                error: "Error"
            };

            $timeout(function () {
                if (rejectTransaction) {
                    toReturn.onerror();
                } else if (!transactionResult) {
                    toReturn.onsuccess({
                        target: {
                            result: null
                        }
                    });
                } else {
                    toReturn.onsuccess({
                        target: {
                            result: new MockCursor(toReturn.onsuccess)
                        }
                    });
                }
            });

            return toReturn;
        }
    };

    MockCursor = function (call) {
        this.continue = function () {
            call({
                target: {
                    result: false
                }
            });
        };
        this.key = "id";
        this.value = transactionResult;
    };

    return {
        api: {
            rejectConnection: function () {
                rejectConnection = true;
            },
            rejectTransaction: function () {
                rejectTransaction = true;
            },
            setTransactionResult: function (result) {
                transactionResult = result;
            },
            mockIndex: mockIndex,
            mockObjectStore: mockObjectStore,
            mockTransaction: mockTransaction,
            mockDatabase: mockDatabase,
            mockObjectStores: mockObjectStores
        },
        open: function () {
            var toReturn = {
                onupgradeneeded: noop,
                onsuccess: noop,
                onerror: noop,
                error: "Error"
            };

            $timeout(function () {
                if (rejectConnection) {
                    toReturn.onerror({
                        target: {
                            errorCode: "Error"
                        }
                    });
                } else {
                    toReturn.onsuccess({
                        target: {
                            result: mockDatabase
                        }
                    });
                }
            });
            return toReturn;
        }
    };
};