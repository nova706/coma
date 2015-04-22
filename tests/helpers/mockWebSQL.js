// Mock WebSQL instance used to test the WebSQLAdapter
window.MockWebSQL = function ($timeout) {
    var noop = function () { return null; };

    var mockTransaction = {
        executeSql: noop
    };

    var mockDb = {
        transaction: function (callback) {
            $timeout(function () {
                callback(mockTransaction);
            });
        }
    };

    return {
        api: {
            mockTransaction: mockTransaction,
            mockDb: mockDb,
            Response: function (items) {
                this.rows = {
                    length: items.length,
                    item: function (index) {
                        return items[index];
                    }
                };
            }
        },
        openDatabase: function () {
            return mockDb;
        }
    };
};