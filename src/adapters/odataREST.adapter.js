angular.module('coma.adapter.oDataREST', []).provider('comaODataRESTAdapter', [
    function () {

        var providerConfig = {};

        providerConfig.serverAPILocation = "/api/";
        this.setServerAPILocation = function (serverAPILocation) {
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

            adapter.create = function (theModel, modelInstance) {
                var dfd = $q.defer();
                var response;

                var url = providerConfig.serverAPILocation + theModel.dataSourceName;

                $http.post(url, modelInstance)
                    .success(function (data, status, headers, config) {
                        response = new AdapterResponse(data, 1, status, headers, config);
                        $log.debug('ODataRESTAdapter: Create', response, theModel);
                        dfd.resolve(response);
                    })
                    .error(function (error, status, headers, config) {
                        response = new AdapterResponse(error, 0, status, headers, config);
                        $log.error('ODataRESTAdapter: Create', response, modelInstance, theModel);
                        dfd.reject(response);
                    });

                return dfd.promise;
            };

            adapter.findOne = function (theModel, pk, queryOptions) {
                var dfd = $q.defer();
                var response;

                var url = providerConfig.serverAPILocation + theModel.dataSourceName + "/" + pk + queryOptions ? queryOptions.parseOptions() : "";

                $http.get(url)
                    .success(function (data, status, headers, config) {
                        response = new AdapterResponse(data, 1, status, headers, config);
                        $log.debug('ODataRESTAdapter: FindOne', response, pk, queryOptions, theModel);
                        dfd.resolve(response);
                    })
                    .error(function (error, status, headers, config) {
                        response = new AdapterResponse(error, 0, status, headers, config);
                        $log.error('ODataRESTAdapter: FindOne', response, pk, queryOptions, theModel);
                        dfd.reject(response);
                    });

                return dfd.promise;
            };

            adapter.find = function (theModel, queryOptions) {
                var dfd = $q.defer();
                var response;

                var url = providerConfig.serverAPILocation + theModel.dataSourceName + queryOptions ? queryOptions.parseOptions() : "";

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
                        $log.debug('ODataRESTAdapter: Find', response, queryOptions, theModel);
                        dfd.resolve(response);
                    })
                    .error(function (error, status, headers, config) {
                        response = new AdapterResponse(error, 0, status, headers, config);
                        $log.error('ODataRESTAdapter: Find', response, queryOptions, theModel);
                        dfd.reject(response);
                    });

                return dfd.promise;
            };

            adapter.update = function (theModel, pk, modelInstance) {
                var dfd = $q.defer();
                var response;

                var url = providerConfig.serverAPILocation + theModel.dataSourceName + "/" + pk;

                $http.put(url, modelInstance)
                    .success(function (data, status, headers, config) {
                        response = new AdapterResponse(data, 1, status, headers, config);
                        $log.debug('ODataRESTAdapter: Update', response, modelInstance, theModel);
                        dfd.resolve(response);
                    })
                    .error(function (error, status, headers, config) {
                        response = new AdapterResponse(error, 0, status, headers, config);
                        $log.error('ODataRESTAdapter: Update', response, modelInstance, theModel);
                        dfd.reject(response);
                    });

                return dfd.promise;
            };

            adapter.remove = function (theModel, pk) {
                var dfd = $q.defer();
                var response;

                var url = providerConfig.serverAPILocation + theModel.dataSourceName + "/" + pk;

                $http({method: 'DELETE', url: url})
                    .success(function (data, status, headers, config) {
                        response = new AdapterResponse(data, 1, status, headers, config);
                        $log.debug('ODataRESTAdapter: Remove', response, theModel);
                        dfd.resolve(response);
                    })
                    .error(function (error, status, headers, config) {
                        response = new AdapterResponse(error, 0, status, headers, config);
                        $log.error('ODataRESTAdapter: Remove', response, theModel);
                        dfd.reject(response);
                    });

                return dfd.promise;
            };

            return adapter;
        }];
    }
]);