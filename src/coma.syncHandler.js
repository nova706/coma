angular.module('recall').factory('recallSyncHandler', [
    '$log',
    '$q',
    'recallLocalStorage',
    'recallPredicate',
    'recallPreparedQueryOptions',

    function ($log, $q, localStorage, Predicate, PreparedQueryOptions) {
        var syncHandler = {};

        /**
         * Represents the result of a sync operation
         * @param {Array} sent An array of entities sent to the remote adapter
         * @param {Array} returned An array of data objects returned from the remote adapter
         * @param {Number} totalProcessed The total number of entities processed in the sync operation
         * @param {String} status The operation's status message
         * @constructor
         */
        var SyncResult = function (sent, returned, totalProcessed, status) {
            this.sent = sent;
            this.returned = returned;
            this.totalProcessed = totalProcessed;
            this.status = status;
        };

        /**
         * Retrieves the last sync time for a given model in ISO format
         * @param {Object} Model The model initiating the sync (the sync time is stored per model)
         * @returns {String} The last sync date in ISO format
         */
        syncHandler.getLastSyncTime = function (Model) {
            return localStorage.get(localStorage.keys.LAST_SYNC, Model.modelName);
        };

        /**
         * Updates the last sync time for a model
         * @param {Object} Model The model initiating the sync
         */
        syncHandler.updateLastSyncTimeToNow = function (Model) {
            localStorage.set(localStorage.keys.LAST_SYNC, new Date().toISOString(), Model.modelName);
        };

        /**
         * Validates the model to see if it is able to synchronize.
         * @param {Object} Model The model initiating the sync
         * @returns {Boolean|SyncResult} Returns true if valid or a SyncResult if not valid
         */
        syncHandler.validateModel = function (Model) {
            if (!Model.localAdapter || !Model.remoteAdapter) {
                return new SyncResult([], [], 0, 'Remote or Local Adapter not Set');
            }
            if (typeof Model.remoteAdapter.synchronize !== 'function') {
                return new SyncResult([], [], 0, 'Synchronize handler not found on remote adapter');
            }
            if (typeof Model.localAdapter.synchronize !== 'function') {
                return new SyncResult([], [], 0, 'Synchronize handler not found on local adapter');
            }
            return true;
        };

        /**
         * Sends data from the local adapter to the remote adapter to update.
         * @param {Object} Model The model initiating the sync
         * @param {Array} data An array of objects to send to the remote adapter to sync
         * @returns {promise}
         */
        syncHandler.sendSyncRequestData = function (Model, data) {
            var lastSync = this.getLastSyncTime(Model);
            return Model.remoteAdapter.synchronize(Model, data, lastSync);
        };

        /**
         * Processes the data sent back from the remote adapter. This will update/create/delete records in the local
         * adapter
         * @param {Object} Model The model initiating the sync
         * @param {Array} data An array of data objects to update/create/delete
         * @returns {promise}
         */
        syncHandler.processSyncResponseData = function (Model, data) {
            var lastSync = this.getLastSyncTime(Model);
            return Model.localAdapter.synchronize(Model, data, lastSync);
        };

        /**
         * Initializes a sync request
         * @param {Object} Model The model initiating the sync
         * @param {Array} data An array of local entities to send to the remote adapter to sync
         * @returns {promise}
         */
        syncHandler.processSyncRequest = function (Model, data) {
            var dfd = $q.defer();
            var result;

            var isValid = syncHandler.validateModel(Model);
            if (isValid !== true) {
                isValid.sent = data;
                $log.error('Sync Handler: ' + Model.modelName, isValid);
                return $q.reject(isValid);
            }

            var syncResponseData = [];
            var totalItemsProcessed = data.length;

            var handleError = function (e) {
                result = new SyncResult(data, syncResponseData, totalItemsProcessed, e);
                $log.error('Sync Handler: ' + Model.modelName, result);
                dfd.reject(result);
            };

            var handleComplete = function () {
                result = new SyncResult(data, syncResponseData, totalItemsProcessed, 'Complete');
                $log.debug('Sync Handler: ' + Model.modelName, 'Sync Complete', result);
                syncHandler.updateLastSyncTimeToNow(Model);
                dfd.resolve(result);
            };

            $log.debug('Sync Handler: Sending ' + data.length + ' local item(s) to sync');

            syncHandler.sendSyncRequestData(Model, data).then(function (syncResponse) {
                // TODO: Handle Conflicts

                $log.debug('Sync Handler: Found ' + syncResponse.data.length + ' remote item(s) to sync');
                totalItemsProcessed += syncResponse.data.length;
                syncResponseData = syncResponse.data;

                if (syncResponse.data.length > 0) {
                    syncHandler.processSyncResponseData(Model, syncResponse.data).then(handleComplete, handleError);
                } else {
                    // No data from server to sync
                    handleComplete();
                }
            }, handleError);

            return dfd.promise;
        };

        /**
         * Initializes a sync at the model level. This will look for all local entities that have been modified since
         * the last sync time and send them to the remote adapter to be synchronized. The remote adapter should respond
         * with an Array of Model entities that need to be updated locally.
         * @param {Object} Model The model initiating the sync
         * @returns {promise}
         */
        syncHandler.model = function (Model) {
            var dfd = $q.defer();
            var result;

            // Perform the validation checks before the local adapter is called
            var isValid = syncHandler.validateModel(Model);
            if (isValid !== true) {
                $log.error('Sync Handler: ' + Model.modelName, isValid);
                return $q.reject(isValid);
            }

            $log.debug('Sync Handler: Starting Model Sync');

            var lastSync = this.getLastSyncTime(Model);
            var queryOptions = new PreparedQueryOptions();
            if (lastSync) {
                var predicate = new Predicate('lastModified').greaterThanOrEqualTo(lastSync);
                queryOptions.$filter(predicate);
            }

            // Get all local entities in this model that have been modified since the last sync time and therefor should
            // be sent to the remote adapter
            Model.localAdapter.find(Model, queryOptions, true).then(function (response) {
                return syncHandler.processSyncRequest(Model, response.data);
            }, function (e) {
                // An error occurred while fetching the local entities
                result = new SyncResult([], [], 0, e);
                $log.error('Sync Handler: ' + Model.modelName, result);
                dfd.reject(result);
            }).then(function (syncResponse) {
                dfd.resolve(syncResponse);
            }, function (e) {
                dfd.reject(e);
            });

            return dfd.promise;
        };

        /**
         * Initializes a sync at the entity level. This will only send the single entity (in an array) to the remote
         * adapter to be synchronized (regardless of the lastModified time). The remote adapter should respond with an
         * Array of Model entities that need to be updated locally.
         * @param {Object} Model The model initiating the sync
         * @param {Object} entity The entity to send to the remote adapter for synchronization
         * @returns {promise}
         */
        syncHandler.entity = function (Model, entity) {
            $log.debug('Sync Handler: Starting Entity Sync');
            return syncHandler.processSyncRequest(Model, [entity]);
        };

        return syncHandler;
    }
]);