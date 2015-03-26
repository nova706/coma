angular.module('recall.adapter.oDataREST', ['recall']).provider('recallODataRESTAdapter', [
    function () {

        var providerConfig = {};

        // Sets the location of the server api endpoint
        providerConfig.serverAPILocation = "/api/";
        this.setServerAPILocation = function (serverAPILocation) {
            if (serverAPILocation.substring(serverAPILocation.length - 1) !== "/") {
                serverAPILocation += '/';
            }
            providerConfig.serverAPILocation = serverAPILocation;
            return this;
        };

        // Sets the name of the results property in the server's response
        providerConfig.resultsField = "results";
        this.setResultsField = function (resultsField) {
            providerConfig.resultsField = resultsField;
            return this;
        };

        // Sets the name of the total count property in the server's response
        providerConfig.totalCountFiled = "totalCount";
        this.setTotalCountFiled = function (totalCountFiled) {
            providerConfig.totalCountFiled = totalCountFiled;
            return this;
        };

        this.$get = [
            '$http',
            '$log',
            '$q',
            'recallAdapterResponse',

            function ($http,
                      $log,
                      $q,
                      AdapterResponse) {

                var adapter = {};

                // Appends the query options to the URL
                var getUrlWithOptions = function (url, queryOptions) {
                    url += queryOptions ? queryOptions.parseOptions() : "";
                    return url;
                };

                /**
                 * Creates a new Entity
                 * @param {Object} theModel The model of the entity to create
                 * @param {Object} modelInstance The entity to create
                 * @returns {promise} Resolved with an AdapterResponse
                 */
                adapter.create = function (theModel, modelInstance) {
                    var dfd = $q.defer();
                    var response;

                    var url = providerConfig.serverAPILocation + theModel.dataSourceName;

                    $http.post(url, modelInstance)
                        .success(function (data, status, headers, config) {
                            response = new AdapterResponse(data, 1, status, headers, config);
                            $log.debug('ODataRESTAdapter: Create ' + theModel.modelName, response);
                            dfd.resolve(response);
                        })
                        .error(function (error, status, headers, config) {
                            response = new AdapterResponse(error, 0, status, headers, config);
                            $log.error('ODataRESTAdapter: Create ' + theModel.modelName, response, modelInstance);
                            dfd.reject(response);
                        });

                    return dfd.promise;
                };

                /**
                 * Finds a single entity given a primary key
                 * @param {Object} theModel The model of the entity to find
                 * @param {String|Number} pk The primary key of the entity to find
                 * @param {PreparedQueryOptions} [queryOptions] The query options to use for $expand
                 * @returns {promise} Resolved with an AdapterResponse
                 */
                adapter.findOne = function (theModel, pk, queryOptions) {
                    var dfd = $q.defer();
                    var response;

                    if (!pk) {
                        response = new AdapterResponse("No Primary Key was supplied", 0, AdapterResponse.BAD_REQUEST);
                        $log.error('ODataRESTAdapter: FindOne ' + theModel.modelName, response, pk, queryOptions);
                        return $q.reject(response);
                    }

                    var url = getUrlWithOptions(providerConfig.serverAPILocation + theModel.dataSourceName + "/" + pk, queryOptions);

                    $http.get(url)
                        .success(function (data, status, headers, config) {
                            response = new AdapterResponse(data, 1, status, headers, config);
                            $log.debug('ODataRESTAdapter: FindOne ' + theModel.modelName, response, pk, queryOptions);
                            dfd.resolve(response);
                        })
                        .error(function (error, status, headers, config) {
                            response = new AdapterResponse(error, 0, status, headers, config);
                            $log.error('ODataRESTAdapter: FindOne ' + theModel.modelName, response, pk, queryOptions);
                            dfd.reject(response);
                        });

                    return dfd.promise;
                };

                /**
                 * Finds a set of Model entities
                 * @param {Object} theModel The model of the entities to find
                 * @param {PreparedQueryOptions} [queryOptions] The query options to use
                 * @returns {promise} Resolved with an AdapterResponse
                 */
                adapter.find = function (theModel, queryOptions) {
                    var dfd = $q.defer();
                    var response;

                    var url = getUrlWithOptions(providerConfig.serverAPILocation + theModel.dataSourceName, queryOptions);

                    $http.get(url)
                        .success(function (data, status, headers, config) {
                            var results = data;
                            var totalCount;

                            if (providerConfig.resultsField) {
                                if (data[providerConfig.resultsField]) {
                                    results = data[providerConfig.resultsField];
                                }
                                if (providerConfig.totalCountFiled && data[providerConfig.totalCountFiled]) {
                                    totalCount = data[providerConfig.totalCountFiled];
                                }
                            }

                            response = new AdapterResponse(results, totalCount, status, headers, config);
                            $log.debug('ODataRESTAdapter: Find ' + theModel.modelName, response, queryOptions);
                            dfd.resolve(response);
                        })
                        .error(function (error, status, headers, config) {
                            response = new AdapterResponse(error, 0, status, headers, config);
                            $log.error('ODataRESTAdapter: Find ' + theModel.modelName, response, queryOptions);
                            dfd.reject(response);
                        });

                    return dfd.promise;
                };

                /**
                 * Updates a Model entity given the primary key of the entity
                 * @param {Object} theModel The model of the entity to update
                 * @param {String|Number} pk The primary key of the entity
                 * @param {Object} modelInstance The entity to update
                 * @returns {promise} Resolved with an AdapterResponse
                 */
                adapter.update = function (theModel, pk, modelInstance) {
                    var dfd = $q.defer();
                    var response;

                    if (!pk) {
                        response = new AdapterResponse("No Primary Key was supplied", 0, AdapterResponse.BAD_REQUEST);
                        $log.error('ODataRESTAdapter: Update ' + theModel.modelName, response, modelInstance);
                        return $q.reject(response);
                    }

                    var url = providerConfig.serverAPILocation + theModel.dataSourceName + "/" + pk;

                    $http.put(url, modelInstance)
                        .success(function (data, status, headers, config) {
                            response = new AdapterResponse(data, 1, status, headers, config);
                            $log.debug('ODataRESTAdapter: Update ' + theModel.modelName, response, modelInstance);
                            dfd.resolve(response);
                        })
                        .error(function (error, status, headers, config) {
                            response = new AdapterResponse(error, 0, status, headers, config);
                            $log.error('ODataRESTAdapter: Update ' + theModel.modelName, response, modelInstance);
                            dfd.reject(response);
                        });

                    return dfd.promise;
                };

                /**
                 * Removes an Entity given the primary key of the entity to remove
                 * @param {Object} theModel The model of the entity to remove
                 * @param {String|Number} pk The primary key of the entity
                 * @returns {promise} Resolved with an AdapterResponse
                 */
                adapter.remove = function (theModel, pk) {
                    var dfd = $q.defer();
                    var response;

                    if (!pk) {
                        response = new AdapterResponse("No Primary Key was supplied", 0, AdapterResponse.BAD_REQUEST);
                        $log.error('ODataRESTAdapter: Remove ' + theModel.modelName, response, pk);
                        return $q.reject(response);
                    }

                    var url = providerConfig.serverAPILocation + theModel.dataSourceName + "/" + pk;

                    $http({method: 'DELETE', url: url})
                        .success(function (data, status, headers, config) {
                            response = new AdapterResponse(data, 1, status, headers, config);
                            $log.debug('ODataRESTAdapter: Remove ' + theModel.modelName, response, pk);
                            dfd.resolve(response);
                        })
                        .error(function (error, status, headers, config) {
                            response = new AdapterResponse(error, 0, status, headers, config);
                            $log.error('ODataRESTAdapter: Remove ' + theModel.modelName, response, pk);
                            dfd.reject(response);
                        });

                    return dfd.promise;
                };

                /**
                 * Takes an Array of entities and creates/updates/deletes them
                 * @param {Object} theModel The model of the entities to synchronize
                 * @param {Array} dataToSync An array of objects to create/update/delete
                 * @returns {promise} Resolved with an AdapterResponse
                 */
                adapter.synchronize = function (theModel, dataToSync, lastSync) {
                    var dfd = $q.defer();
                    var response;

                    var url = providerConfig.serverAPILocation + theModel.dataSourceName;

                    $http.put(url, {data: dataToSync, lastSync: lastSync})
                        .success(function (data, status, headers, config) {
                            var results = data;
                            var totalCount;

                            if (providerConfig.resultsField) {
                                if (data[providerConfig.resultsField]) {
                                    results = data[providerConfig.resultsField];
                                }
                                if (providerConfig.totalCountFiled && data[providerConfig.totalCountFiled]) {
                                    totalCount = data[providerConfig.totalCountFiled];
                                }
                            }

                            response = new AdapterResponse(results, totalCount, status, headers, config);
                            $log.debug('ODataRESTAdapter: Synchronize ' + theModel.modelName, response, dataToSync);
                            dfd.resolve(response);
                        })
                        .error(function (error, status, headers, config) {
                            response = new AdapterResponse(error, 0, status, headers, config);
                            $log.error('ODataRESTAdapter: Synchronize ' + theModel.modelName, response, dataToSync);
                            dfd.reject(response);
                        });

                    return dfd.promise;
                };

                return adapter;
            }
        ];
    }
]);