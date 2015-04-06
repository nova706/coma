// Mock WebSQL instance used to test the WebSQLAdapter
window.MockWebSQL = function ($timeout) {
    var noop = function () { return null; };

    var mockTransaction;

    mockTransaction = {
        executeSql: noop
    };

    return {
        api: {
            mockTransaction: mockTransaction,
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
            return {
                transaction: function (callback) {
                    $timeout(function () {
                        callback(mockTransaction);
                    });
                }
            };
        }
    };
};