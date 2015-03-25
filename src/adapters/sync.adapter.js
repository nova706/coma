angular.module('recall.adapter.sync', ['recall']).provider('recallSyncAdapter', [
    function () {

        var providerConfig = {};

        // Sets the master adapter
        providerConfig.masterAdapter = "";
        this.setMaster = function (masterAdapter) {
            providerConfig.masterAdapter = masterAdapter;
            return this;
        };

        // Sets the slave adapter
        providerConfig.slaveAdapter = "";
        this.setSlave = function (slaveAdapter) {
            providerConfig.slaveAdapter = slaveAdapter;
            return this;
        };

        this.$get = [
            '$injector',
            '$log',
            '$q',
            'recallAdapterResponse',
            'recallLocalStorage',
            'recallPredicate',
            'recallPreparedQueryOptions',

            function ($injector,
                      $log,
                      $q,
                      AdapterResponse,
                      localStorage,
                      Predicate,
                      PreparedQueryOptions) {

                var adapter = {};

                /**
                 * Validates the Model during creation
                 * @param {Object} theModel
                 * @returns {Boolean} True if the model passes validation
                 */
                adapter.modelValidationHook = function (theModel) {
                    var master = getMaster();
                    var slave = getSlave();

                    if (!master) {
                        $log.error('SyncAdapter: Master Adapter not Set', this, theModel);
                        return false;
                    }
                    if (!slave) {
                        $log.error('SyncAdapter: Slave Adapter not Set', this, theModel);
                        return false;
                    }

                    if (typeof master.synchronize !== 'function') {
                        $log.error('SyncAdapter: Synchronize handler not found on the master adapter', this, theModel);
                        return false;
                    }
                    if (typeof slave.synchronize !== 'function') {
                        $log.error('SyncAdapter: Synchronize handler not found on the slave adapter', this, theModel);
                        return false;
                    }

                    if (typeof master.modelValidationHook === 'function' && !master.modelValidationHook(theModel)) {
                        return false;
                    }
                    if (typeof slave.modelValidationHook === 'function' && !slave.modelValidationHook(theModel)) {
                        return false;
                    }

                    return true;
                };

                /**
                 * Creates a new Entity on the Slave and attempts to sync to the Master
                 * @param {Object} theModel The model of the entity to create
                 * @param {Object} modelInstance The entity to create
                 * @param {PreparedQueryOptions} [queryOptions] The query options to use for preferMaster
                 * @returns {promise} Resolved with an AdapterResponse
                 */
                adapter.create = function (theModel, modelInstance, queryOptions) {
                    if (queryOptions && queryOptions.preferMaster() === true) {
                        return getMaster().create(theModel, modelInstance);
                    } else {
                        return getSlave().create(theModel, modelInstance);
                    }
                    // TODO: Sync
                };

                /**
                 * Finds a single entity given a primary key on the Slave
                 * @param {Object} theModel The model of the entity to find
                 * @param {String|Number} pk The primary key of the entity to find
                 * @param {PreparedQueryOptions} [queryOptions] The query options to use for $expand and preferMaster
                 * @returns {promise} Resolved with an AdapterResponse
                 */
                adapter.findOne = function (theModel, pk, queryOptions) {
                    var response;

                    if (!pk) {
                        response = new AdapterResponse("No Primary Key was supplied", 0, AdapterResponse.BAD_REQUEST);
                        $log.error('SyncAdapter: FindOne ' + theModel.modelName, response, pk, queryOptions);
                        return $q.reject(response);
                    }

                    if (queryOptions && queryOptions.preferMaster() === true) {
                        return getMaster().findOne(theModel, pk, queryOptions);
                    } else {
                        return getSlave().findOne(theModel, pk, queryOptions);
                    }
                };

                /**
                 * Finds a set of Model entities on the Slave
                 * @param {Object} theModel The model of the entities to find
                 * @param {PreparedQueryOptions} [queryOptions] The query options to use
                 * @returns {promise} Resolved with an AdapterResponse
                 */
                adapter.find = function (theModel, queryOptions) {
                    if (queryOptions && queryOptions.preferMaster() === true) {
                        return getMaster().find(theModel, queryOptions);
                    } else {
                        return getSlave().find(theModel, queryOptions);
                    }
                };

                /**
                 * Updates a Model entity on the Slave given the primary key of the entity. Attempts to sync to the Master.
                 * @param {Object} theModel The model of the entity to update
                 * @param {String|Number} pk The primary key of the entity
                 * @param {Object} modelInstance The entity to update
                 * @param {PreparedQueryOptions} [queryOptions] The query options to use for preferMaster
                 * @returns {promise} Resolved with an AdapterResponse
                 */
                adapter.update = function (theModel, pk, modelInstance, queryOptions) {
                    var response;

                    if (!pk) {
                        response = new AdapterResponse("No Primary Key was supplied", 0, AdapterResponse.BAD_REQUEST);
                        $log.error('SyncAdapter: Update ' + theModel.modelName, response, modelInstance);
                        return $q.reject(response);
                    }

                    if (queryOptions && queryOptions.preferMaster() === true) {
                        return getMaster().update(theModel, pk, modelInstance);
                    } else {
                        return getSlave().update(theModel, pk, modelInstance);
                    }
                    // TODO: Sync
                };

                /**
                 * Removes an Entity from the Slave given the primary key of the entity to remove. Attempts to sync to the Master.
                 * @param {Object} theModel The model of the entity to remove
                 * @param {String|Number} pk The primary key of the entity
                 * @param {PreparedQueryOptions} [queryOptions] The query options to use for preferMaster
                 * @returns {promise} Resolved with an AdapterResponse
                 */
                adapter.remove = function (theModel, pk, queryOptions) {
                    var response;

                    if (!pk) {
                        response = new AdapterResponse("No Primary Key was supplied", 0, AdapterResponse.BAD_REQUEST);
                        $log.error('SyncAdapter: Remove ' + theModel.modelName, response, pk);
                        return $q.reject(response);
                    }

                    if (queryOptions && queryOptions.preferMaster() === true) {
                        return getMaster().remove(theModel, pk);
                    } else {
                        return getSlave().remove(theModel, pk);
                    }
                    // TODO: Sync
                };

                /**
                 * Manually Syncs the Slave and Master adapters
                 * @param {Object} theModel The model of the entities to synchronize
                 * @returns {promise} Resolved with an AdapterResponse
                 */
                adapter.synchronize = function (theModel) {
                    return processSyncRequest(theModel);
                };

                var getAdapter = function (adapter) {
                    return (typeof adapter === 'string') ? $injector.get(adapter) : adapter;
                };
                var getMaster = function () {
                    return getAdapter(providerConfig.masterAdapter);
                };
                var getSlave = function () {
                    return getAdapter(providerConfig.slaveAdapter);
                };

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
                 * @param {Object} theModel The model initiating the sync (the sync time is stored per model)
                 * @returns {String} The last sync date in ISO format
                 */
                var getLastSyncTime = function (theModel) {
                    return localStorage.get(localStorage.keys.LAST_SYNC, theModel.modelName);
                };

                /**
                 * Updates the last sync time for a model
                 * @param {Object} theModel The model initiating the sync
                 */
                var updateLastSyncTimeToNow = function (theModel) {
                    localStorage.set(localStorage.keys.LAST_SYNC, new Date().toISOString(), theModel.modelName);
                };

                /**
                 * Sends data from the local adapter to the remote adapter to update.
                 * @param {Object} theModel The model initiating the sync
                 * @param {Array} data An array of objects to send to the remote adapter to sync
                 * @returns {promise}
                 */
                var sendSyncRequestData = function (theModel, data) {
                    var lastSync = getLastSyncTime(theModel);
                    return getMaster().synchronize(theModel, data, lastSync);
                };

                /**
                 * Processes the data sent back from the remote adapter. This will update/create/delete records in the local
                 * adapter
                 * @param {Object} theModel The model initiating the sync
                 * @param {Array} data An array of data objects to update/create/delete
                 * @returns {promise}
                 */
                var processSyncResponseData = function (theModel, data) {
                    var lastSync = getLastSyncTime(theModel);
                    return getSlave().synchronize(theModel, data, lastSync);
                };

                /**
                 * Initializes a sync request
                 * @param {Object} theModel The model initiating the sync
                 * @returns {promise}
                 */
                var processSyncRequest = function (theModel) {
                    var dfd = $q.defer();
                    var result;

                    var syncRequestData = [];
                    var syncResponseData = [];
                    var totalItemsProcessed = 0;

                    var handleError = function (e) {
                        result = new SyncResult(syncRequestData, syncResponseData, totalItemsProcessed, e);
                        $log.error('SyncAdapter: ' + theModel.modelName, result);
                        dfd.reject(result);
                    };

                    var handleComplete = function () {
                        result = new SyncResult(syncRequestData, syncResponseData, totalItemsProcessed, 'Complete');
                        $log.debug('SyncAdapter: ' + theModel.modelName, 'Sync Complete', result);
                        updateLastSyncTimeToNow(theModel);
                        dfd.resolve(result);
                    };

                    $log.debug('SyncAdapter: ' + theModel.modelName + ' Sync Started');

                    var lastSync = getLastSyncTime(theModel);
                    var queryOptions = new PreparedQueryOptions();
                    if (lastSync) {
                        var predicate = new Predicate('lastModified').greaterThanOrEqualTo(lastSync);
                        queryOptions.$filter(predicate);
                    }

                    getSlave().find(theModel, queryOptions, true).then(function (response) {
                        $log.debug('SyncAdapter: Sending ' + response.count + ' local item(s) to sync');
                        totalItemsProcessed += response.count;
                        syncRequestData = response.data;
                        sendSyncRequestData(theModel, response.data).then(function (syncResponse) {
                            // TODO: Handle Conflicts

                            $log.debug('SyncAdapter: Found ' + syncResponse.data.length + ' remote item(s) to sync');
                            totalItemsProcessed += syncResponse.data.length;
                            syncResponseData = syncResponse.data;

                            if (syncResponse.data.length > 0) {
                                processSyncResponseData(theModel, syncResponse.data).then(handleComplete, handleError);
                            } else {
                                // No data from server to sync
                                handleComplete();
                            }
                        }, handleError);
                    }, handleError);

                    return dfd.promise;
                };

                return adapter;
            }
        ];
    }
]);