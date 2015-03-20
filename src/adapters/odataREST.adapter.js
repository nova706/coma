angular.module('coma.adapter.oDataREST', ['coma']).provider('comaODataRESTAdapter', [
    function () {

        var providerConfig = {};

        providerConfig.serverAPILocation = "/api/";
        this.setServerAPILocation = function (serverAPILocation) {
            if (serverAPILocation.substring(serverAPILocation.length - 1) !== "/") {
                serverAPILocation += '/';
            }
            providerConfig.serverAPILocation = serverAPILocation;
            return this;
        };

        providerConfig.resultsField = "results";
        this.setResultsField = function (resultsField) {
            providerConfig.resultsField = resultsField;
            return this;
        };

        providerConfig.totalCountFiled = "totalCount";
        this.setTotalCountFiled = function (totalCountFiled) {
            providerConfig.totalCountFiled = totalCountFiled;
            return this;
        };

        this.$get = ['$http', '$log', '$q', 'comaAdapterResponse', function ($http, $log, $q, AdapterResponse) {

            var adapter = {};

            var addOptionsToUrl = function (url, queryOptions) {
                url += queryOptions ? queryOptions.parseOptions() : "";
                return url;
            };

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

            adapter.findOne = function (theModel, pk, queryOptions) {
                var dfd = $q.defer();
                var response;

                if (!pk) {
                    response = new AdapterResponse("No Primary Key was supplied", 0, AdapterResponse.BAD_REQUEST);
                    $log.error('ODataRESTAdapter: FindOne ' + theModel.modelName, response, pk, queryOptions);
                    return $q.reject(response);
                }

                var url = addOptionsToUrl(providerConfig.serverAPILocation + theModel.dataSourceName + "/" + pk, queryOptions);

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

            adapter.find = function (theModel, queryOptions) {
                var dfd = $q.defer();
                var response;

                var url = addOptionsToUrl(providerConfig.serverAPILocation + theModel.dataSourceName);

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

            adapter.synchronize = function (theModel, dataToSync, lastSync) {
                var dfd = $q.defer();
                var response;

                var url = providerConfig.serverAPILocation + theModel.dataSourceName;
                var lastSyncTime = lastSync ? lastSync.getTime() : 0;

                $http.put(url, {data: dataToSync, lastSync: lastSyncTime})
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
        }];
    }
]);