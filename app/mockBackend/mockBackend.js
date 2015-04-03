/**
 * mockBackend utilizes $httpBackend from Angular Mocks as an interceptor which provides an in memory backend that
 * acts as a rest server in order to demoing local <-> remote synchronization.
 */

angular.module('recallDemo').config(['$provide', function ($provide) {
    $provide.decorator('$httpBackend', angular.mock.e2e.$httpBackendDecorator);
}]);

angular.module('recallDemo').run([
    '$httpBackend',
    'recallPredicate',

    function ($httpBackend, Predicate) {

        var demoData = {
            initialize: false
        };

        var resources = [
            { endpoint: 'people', dataPath: 'app/mockBackend/mockPeople.json' }
        ];

        var generateGuid = function () {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }

            return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
                s4() + '-' + s4() + s4() + s4();
        };

        demoData.initResponses = function (resourceArray) {
            var i;
            for (i = 0; i < resourceArray.length; i++) {
                this.initResponse(resourceArray[i]);
            }
        };

        demoData.initResponse = function (resource) {
            var itemsEndpoint = new RegExp("/api/" + resource.endpoint + "((!\/).*)?");
            var itemEndpoint = new RegExp("/api/" + resource.endpoint + "\/.+");
            var response = {
                results: [],
                totalCount: 0
            };

            var request = new XMLHttpRequest();
            request.open('GET', resource.dataPath, false);
            request.send(null);
            var resourceData = angular.fromJson(request.responseText);
            resource.data = resourceData;
            var i;

            resourceData = this.processJSONResults(resourceData);

            var objectMap = (resourceData.length > 0) ? angular.copy(resourceData[0]) : null;

            $httpBackend.whenGET(itemEndpoint).respond(function (method, url) {
                var results = resourceData.slice();
                var paramsIndex = url.indexOf('?');
                if (paramsIndex < 0) {
                    paramsIndex = url.length;
                }
                var id = url.substring(url.lastIndexOf('/') + 1, paramsIndex);
                var result = null;
                for (i = 0; i < results.length; i++) {
                    if (results[i].id === id) {
                        if (!results[i].deleted) {
                            result = results[i];
                        }
                        break;
                    }
                }

                if (!result) {
                    return [404];
                }

                return [200, result];
            });

            // Find All
            $httpBackend.whenGET(itemsEndpoint).respond(function (method, url) {
                var theResults = resourceData.slice();
                var results = [];

                for (i = 0; i < theResults.length; i++) {
                    if (!theResults[i].deleted) {
                        results.push(theResults[i]);
                    }
                }

                if (url.indexOf("$filter=") >= 0) {
                    var filterStart = url.substring(url.indexOf("$filter=") + 8);
                    var filterExpression = (filterStart.indexOf("&") >= 0) ? filterStart.substring(0, filterStart.indexOf("&")) : filterStart;
                    filterExpression = filterExpression.replace(/\+/g, ' ');
                    results = demoData.filterResults(results, filterExpression);
                }

                if (url.indexOf("$orderby=") >= 0) {
                    var orderByStart = url.substring(url.indexOf("$orderby=") + 9);
                    var orderByExpression = (orderByStart.indexOf("&") >= 0) ? orderByStart.substring(0, orderByStart.indexOf("&")) : orderByStart;
                    orderByExpression = orderByExpression.replace(/\+/g, ' ');
                    results = demoData.sortResults(results, orderByExpression);
                }

                response.totalCount = results.length;

                if (url.indexOf("$top=") >= 0) {
                    var topStart = url.substring(url.indexOf("$top=") + 5);
                    var top = (topStart.indexOf("&") >= 0) ? Number(topStart.substring(0, topStart.indexOf("&"))) : Number(topStart);
                    var skipStart = url.substring(url.indexOf("$skip=") + 6);
                    var skip = (url.indexOf("$skip=") >= 0) ? (skipStart.indexOf("&") >= 0) ? Number(skipStart.substring(0, skipStart.indexOf("&"))) : Number(skipStart) : 0;
                    results = demoData.getPageFromResults(results, top, skip);
                }

                response.results = results;

                return [200, response];
            });

            //Create
            $httpBackend.whenPOST(itemsEndpoint).respond(function (method, url, data) {
                data = angular.fromJson(data);

                var result = angular.copy(objectMap);
                var newObject = {};
                var property;

                for (property in result) {
                    if (result.hasOwnProperty(property)) {
                        newObject[property] = (result[property] instanceof Array) ? [] : null;
                    }
                }

                for (property in data) {
                    if (data.hasOwnProperty(property) && newObject.hasOwnProperty(property)) {
                        newObject[property] = data[property];
                    }
                }

                newObject.id = generateGuid();
                newObject.lastModified = new Date();

                resourceData.push(newObject);

                return [201, newObject];
            });

            // Update
            $httpBackend.whenPUT(itemEndpoint).respond(function (method, url, data) {
                data = angular.fromJson(data);

                var results = resourceData;
                var id = url.substring(url.lastIndexOf('/') + 1);
                var matchedResult = null;

                for (i = 0; i < results.length; i++) {
                    if (results[i].id === id) {
                        if (!results[i].deleted) {
                            matchedResult = results[i];
                        }
                        break;
                    }
                }

                if (!matchedResult) {
                    return [404];
                }

                angular.extend(matchedResult, data);
                matchedResult.lastModified = new Date();

                return [200, matchedResult];
            });

            // Remove
            $httpBackend.whenDELETE(itemEndpoint).respond(function (method, url) {
                var results = resourceData;
                var id = url.substring(url.lastIndexOf('/') + 1);
                var matchedResult = null;

                for (i = 0; i < results.length; i++) {
                    if (results[i].id === id) {
                        if (!results[i].deleted) {
                            matchedResult = results[i];
                        }
                        break;
                    }
                }

                if (!matchedResult) {
                    return [404];
                }

                matchedResult.deleted = true;
                matchedResult.lastModified = new Date();

                return [200];
            });

            // Synchronize
            $httpBackend.whenPUT(itemsEndpoint).respond(function (method, url, data) {
                data = angular.fromJson(data);

                var results = resourceData;
                var matchedData = null;

                var toUpdateOnClient = [];
                var totalUpdates = 0;

                var d;
                for (i = 0; i < results.length; i++) {
                    matchedData = null;
                    for (d = 0; d < data.data.length; d++) {
                        if (results[i].id === data.data[d].id) {
                            matchedData = data.data[d];
                            break;
                        }
                    }
                    if (matchedData) {
                        if (new Date(results[i].lastModified) > new Date(matchedData.lastModified)) {
                            // Conflict... the server has a newer version
                            toUpdateOnClient.push(results[i]);
                        } else {
                            // The client's version is newer, update the server
                            angular.extend(results[i], matchedData);
                            totalUpdates++;
                        }
                    } else if (!data.lastSync || new Date(results[i].lastModified) > new Date(data.lastSync)) {
                        // The server result was updated since the last client sync
                        toUpdateOnClient.push(results[i]);
                    }
                }

                for (i = 0; i < data.data.length; i++) {
                    for (d = 0; d < results.length; d++) {
                        if (results[d].id === data.data[i].id) {
                            break;
                        }
                    }
                    if (!matchedData) {
                        // The client entity does not exist on the server, add it.
                        results.push(data.data[i]);
                        totalUpdates++;
                    }
                }

                return [200, {results: toUpdateOnClient, totalCount: totalUpdates}];
            });
        };

        demoData.filterResults = function (results, expression) {
            var i;
            var collection = [];
            var predicate = Predicate.fromString(expression);

            for (i = 0; i < results.length; i++) {
                if (predicate.test(results[i])) {
                    collection.push(results[i]);
                }
            }

            return collection;
        };

        demoData.sortResults = function (results, sortExpression) {
            var sortParams = sortExpression.split(" ");
            var property = sortParams[0];
            var direction = (sortParams[1]) ? sortParams[1].toLowerCase() : 'desc';

            return results.sort(function (first, next) {
                var firstValue = first[property];
                var nextValue = next[property];

                if (firstValue === undefined) {
                    return (direction === "desc") ? 1 : -1;
                }
                if (nextValue === undefined) {
                    return (direction === "desc") ? -1 : 1;
                }

                if (firstValue instanceof Date && !isNaN(Date.parse(nextValue))) {
                    nextValue = Date.parse(nextValue);
                    firstValue = firstValue.getTime();
                } else if (typeof firstValue === 'string' && !isNaN(Date.parse(firstValue))) {
                    firstValue = Date.parse(firstValue);
                    nextValue = Date.parse(nextValue);
                }

                if (firstValue < nextValue) {
                    return (direction === "desc") ? 1 : -1;
                }

                return (direction === "desc") ? -1 : 1;
            });
        };

        demoData.getPageFromResults = function (results, top, skip) {
            if (top === 0) {
                return results;
            }
            return results.slice(skip, skip + top);
        };

        demoData.interpolate = function (value) {
            if (typeof value !== 'string') {
                return value;
            }
            if (value.indexOf('{{') === 0 && value.substring(value.length - 2) === '}}') {
                value = value.replace('{{', '').replace('}}', '');
                /* jshint evil: true */
                return eval(value);
                /* jshint evil: false */
            }
            return value;
        };

        demoData.processJSONResult = function (result) {
            var prop;
            for (prop in result) {
                if (result.hasOwnProperty(prop)) {
                    result[prop] = this.interpolate(result[prop]);
                }
            }
            return result;
        };

        demoData.processJSONResults = function (results) {
            var i;
            for (i = 0; i < results.length; i++) {
                results[i] = this.processJSONResult(results[i]);
            }
            return results;
        };

        $httpBackend.whenGET(/.*\.html/).passThrough();
        demoData.initResponses(resources);
    }
]);
