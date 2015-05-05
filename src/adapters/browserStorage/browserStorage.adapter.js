angular.module('recall.adapter.browserStorage', ['recall']).provider('recallBrowserStorageAdapter', [
    function () {

        var providerConfig = {};

        providerConfig.preferredBackend = 'indexedDB';
        this.preferIndexedDB = function () {
            providerConfig.preferredBackend = 'indexedDB';
            return this;
        };
        this.preferWebSQL = function () {
            providerConfig.preferredBackend = 'webSQL';
            return this;
        };

        // Sets the name of the database to use
        providerConfig.dbName = 'recall';
        this.setDbName = function (dbName) {
            providerConfig.dbName = dbName;
            return this;
        };

        // Sets the version of the database
        providerConfig.dbVersion = 1;
        this.setDbVersion = function (dbVersion) {
            providerConfig.dbVersion = dbVersion;
            return this;
        };

        // Sets the size of the database (WebSQL)
        providerConfig.dbSize = 5 * 1024 * 1024; // 5MB
        this.setDbSize = function (dbSize) {
            providerConfig.dbSize = dbSize;
            return this;
        };

        // Sets the default function to be used as a "GUID" generator
        providerConfig.pkGenerator = function () {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }

            return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
                s4() + '-' + s4() + s4() + s4();
        };
        this.setPkGenerator = function (pkGenerator) {
            providerConfig.pkGenerator = pkGenerator;
            return this;
        };

        this.$get = [
            '$log',
            '$window',
            'recallBaseClientSideAdapter',
            'recallIndexedDBService',
            'recallWebSQLService',

            function ($log, $window, BaseClientSideAdapter, indexedDBService, webSQLService) {

                var connectionArguments = [providerConfig.dbName, providerConfig.dbVersion, providerConfig.dbSize];

                var init = function () {
                    var service;
                    if (providerConfig.preferredBackend === 'webSQL') {
                        if ($window.openDatabase !== undefined) {
                            service = webSQLService;
                        } else if ($window.indexedDB !== undefined) {
                            service = indexedDBService;
                        }
                    } else {
                        if ($window.indexedDB !== undefined) {
                            service = indexedDBService;
                        } else if ($window.openDatabase !== undefined) {
                            service = webSQLService;
                        }
                    }

                    if (!service) {
                        $log.error('BrowserStorageAdapter: IndexedDB and WebSQL are not available');
                        return null;
                    } else {
                        return new BaseClientSideAdapter("BrowserStorageAdapter", service, connectionArguments, providerConfig.pkGenerator);
                    }
                };

                return init();
            }
        ];
    }
]);