// Mock WebSQL instance used to test the WebSQLAdapter
window.MockDropboxDatastore = function ($timeout) {
    var noop = function () { return null; };

    var Client = function (options) {
        client.options = options;
        return(client);
    };

    var table = {
        getOrInsert: function (id, instance) {
            return new Result(instance, id);
        },
        get: noop,
        query: noop
    };

    var defaultDatastore = {
        getTable: function () {
            return table;
        }
    };

    var dataStoreManager = {
        openDefaultDatastore: function (callback) {
            $timeout(function () {
                callback(null, defaultDatastore);
            });
        }
    };

    var client = {
        authenticate: function (options, callback) {
            $timeout(function () {
                callback();
            });
        },
        isAuthenticated: function () {
            return true;
        },
        getDatastoreManager: function () {
            return dataStoreManager;
        },
        authDriver: noop
    };

    var Result = function (instance, id) {
        this.instance = instance;

        this.deleted = false;
        this.get = function (field) {
            return this.instance[field];
        };
        this.getId = function () {
            return id;
        };
        this.set = function (field, value) {
            this.instance[field] = value;
        };
        this.deleteRecord = function () {
            this.deleted = true;
        };
    };

    return {
        api: {
            client: client,
            dataStoreManager: dataStoreManager,
            defaultDatastore: defaultDatastore,
            table: table,
            Result: Result
        },
        Dropbox: {
            Client: Client
        }
    };
};