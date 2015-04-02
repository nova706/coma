angular.module('recall').factory("recallAdapterResponse", [
    function () {

        /**
         * The AdapterResponse class represents a response that is coming back from an adapter. Every Adapter should
         * resolve and reject with a properly formed AdapterResponse so that the Model can handle the response.
         *
         * @param {Object|Array|String} data The raw data from the adapter or an error message
         * @param {Number} [count] The number of records affected by the action. Left null if not set
         * @param {Number} [status=200] The status of the response
         * @param {Object} [headers] The response headers (used by $http)
         * @param {Object} [config] The configuration of the request (used by $http)
         * @constructor
         */
        var AdapterResponse = function (data, count, status, headers, config) {
            this.data = data;
            this.count = (count >= 0) ? count : null;
            this.status = status || AdapterResponse.OK;
            this.headers = headers;
            this.config = config;
        };

        // 2xx status codes used in OOTB adapters
        AdapterResponse.OK = 200;
        AdapterResponse.CREATED = 201;
        AdapterResponse.ACCEPTED = 202;
        AdapterResponse.NO_CONTENT = 204;

        // 4xx status codes used in OOTB adapters
        AdapterResponse.BAD_REQUEST = 400;
        AdapterResponse.UNAUTHORIZED = 401;
        AdapterResponse.NOT_FOUND = 404;
        AdapterResponse.CONFLICT = 409;

        // 5xx status codes used in OOTB adapters
        AdapterResponse.INTERNAL_SERVER_ERROR = 500;
        AdapterResponse.NOT_IMPLEMENTED = 501;

        return AdapterResponse;
    }
]);