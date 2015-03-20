angular.module('coma').factory('comaSyncHandler', [
    '$log',
    '$q',
    'comaLocalStorage',
    'comaPredicate',
    'comaPreparedQueryOptions',

    function ($log, $q, comaLocalStorage, Predicate, PreparedQueryOptions) {
        var syncHandler = {};

        var SyncResult = function (sent, returned, totalProcessed, status) {
            this.sent = sent;
            this.returned = returned;
            this.totalProcessed = totalProcessed;
            this.status = status;
        };

        syncHandler.getLastSyncTime = function (Model) {
            var lastSync = comaLocalStorage.get(comaLocalStorage.keys.LAST_SYNC, Model.modelName);
            if (lastSync) {
                return new Date(lastSync);
            }

            // This client has no sync record for this Model.
            return null;
        };

        syncHandler.updateLastSyncTimeToNow = function (Model) {
            comaLocalStorage.set(comaLocalStorage.keys.LAST_SYNC, new Date().getTime(), Model.modelName);
        };

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

        syncHandler.sendSyncRequestData = function (Model, data) {
            var lastSync = this.getLastSyncTime(Model);
            return Model.remoteAdapter.synchronize(Model, data, lastSync);
        };

        syncHandler.processSyncResponseData = function (Model, data) {
            var lastSync = this.getLastSyncTime(Model);
            return Model.localAdapter.synchronize(Model, data, lastSync);
        };

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

            $log.debug('Sync Handler: Sending ' + data.length + ' local item(s) to sync');

            syncHandler.sendSyncRequestData(Model, data).then(function (syncResponse) {
                // TODO: Handle Conflicts

                $log.debug('Sync Handler: Found ' + syncResponse.count + ' remote item(s) to sync');
                totalItemsProcessed += syncResponse.count + 1;
                syncResponseData = syncResponse.data;
                syncHandler.processSyncResponseData(Model, syncResponse.data).then(function () {
                    result = new SyncResult(data, syncResponseData, totalItemsProcessed, 'Complete');
                    $log.debug('Sync Handler: ' + Model.modelName, 'Sync Complete', result);
                    syncHandler.updateLastSyncTimeToNow(Model);
                    dfd.resolve(result);
                }, handleError);

            }, handleError);

            return dfd.promise;
        };

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

            Model.localAdapter.find(Model, queryOptions).then(function (response) {
                return syncHandler.processSyncRequest(Model, response.data);
            }, function (e) {
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

        syncHandler.entity = function (Model, entity) {
            $log.debug('Sync Handler: Starting Entity Sync');
            return syncHandler.processSyncRequest(Model, [entity]);
        };

        return syncHandler;
    }
]);