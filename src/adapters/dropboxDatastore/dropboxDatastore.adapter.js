/*globals Dropbox*/
angular.module('recall.adapter.dropboxDatastore', ['recall']).provider('recallDropboxDatastoreAdapter', [
    function () {

        var providerConfig = {};

        // Sets the Dropbox Datastore client API Key
        providerConfig.clientKey = null;
        this.setClientKey = function (clientKey) {
            providerConfig.clientKey = clientKey;
            return this;
        };

        // Sets auth driver to use for the Dropbox Datastore. Uses the default if not set.
        providerConfig.authDriver = null;
        this.setAuthDriver = function (driver) {
            providerConfig.authDriver = driver;
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
            'recallBaseClientSideAdapter',
            'recallDropboxDatastoreService',

            function ($log, BaseClientSideAdapter, dropboxDatastoreService) {

                if (Dropbox === undefined) {
                    $log.error('DropboxDatastoreAdapter: Dropbox is required');
                    return;
                }

                var connectionArguments = [providerConfig.clientKey, providerConfig.authDriver];
                return new BaseClientSideAdapter("DropboxDatastoreAdapter", dropboxDatastoreService, connectionArguments, providerConfig.pkGenerator);
            }
        ];
    }
]);