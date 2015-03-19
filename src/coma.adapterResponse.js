angular.module('coma').factory("comaAdapterResponse", [
    function () {

        var AdapterResponse = function (data, count, status) {
            this.data = data;
            this.count = count;
            this.status = status || AdapterResponse.OK;
        };

        AdapterResponse.OK = 200;
        AdapterResponse.CREATED = 201;
        AdapterResponse.ACCEPTED = 202;
        AdapterResponse.NO_CONTENT = 204;

        AdapterResponse.BAD_REQUEST = 400;
        AdapterResponse.UNAUTHORIZED = 401;
        AdapterResponse.NOT_FOUND = 404;
        AdapterResponse.CONFLICT = 409;

        AdapterResponse.INTERNAL_SERVER_ERROR = 500;
        AdapterResponse.NOT_IMPLEMENTED = 501;

        return AdapterResponse;
    }
]);