/*globals describe, beforeEach, afterEach, module, inject, it, should*/
describe("ODataRESTAdapter", function () {
    var provider;
    var adapter;
    var $httpBackend;
    var $rootScope;
    var PreparedQueryOptions;
    var isFunc = function (a) {
        return typeof a === 'function';
    };

    var model = {
        dataSourceName: "testEndpoint"
    };
    var endpoint = '/api/' + model.dataSourceName;

    beforeEach(module('recall.adapter.oDataREST', function (recallODataRESTAdapterProvider) {
        provider = recallODataRESTAdapterProvider;
    }));

    beforeEach(inject(function (_$httpBackend_, _$rootScope_, recallPreparedQueryOptions) {
        $httpBackend = _$httpBackend_;
        $rootScope = _$rootScope_;
        PreparedQueryOptions = recallPreparedQueryOptions;
    }));

    afterEach(function () {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });

    it("Should provide the basic CRUD methods", inject(function ($injector) {
        adapter = $injector.invoke(provider.$get);
        should.equal(isFunc(adapter.create), true);
        should.equal(isFunc(adapter.findOne), true);
        should.equal(isFunc(adapter.find), true);
        should.equal(isFunc(adapter.update), true);
        should.equal(isFunc(adapter.remove), true);
        should.equal(isFunc(adapter.synchronize), true);
    }));

    describe("setServerAPILocation", function () {
        it("Should set the server's endpoint location", inject(function ($injector) {
            provider.setServerAPILocation('/test/');
            adapter = $injector.invoke(provider.$get);

            $httpBackend.expectPOST('/test/' + model.dataSourceName).respond({id: 1, name: 'John'});
            adapter.create(model, {name: "John"});
            $httpBackend.flush();
        }));

        it("Should append the trailing slash if not provided", inject(function ($injector) {
            provider.setServerAPILocation('/test');
            adapter = $injector.invoke(provider.$get);

            $httpBackend.expectPOST('/test/' + model.dataSourceName).respond({id: 1, name: 'John'});
            adapter.create(model, {name: "John"});
            $httpBackend.flush();
        }));
    });

    describe("setResultsField", function () {
        it("Should set the expected path to results in the response during find", inject(function ($injector) {
            provider.setResultsField('test');
            adapter = $injector.invoke(provider.$get);

            $httpBackend.expectGET(endpoint).respond(200, {test: [{id: 1, name: 'John'}], totalCount: 1});
            var response = {};

            adapter.find(model).then(function (res) {
                response = res;
            });
            $httpBackend.flush();
            $rootScope.$apply();

            response.data[0].name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        }));

        it("Should set the expected path to results in the response during synchronize", inject(function ($injector) {
            provider.setResultsField('test');
            adapter = $injector.invoke(provider.$get);

            var date = new Date().toISOString();
            $httpBackend.expectPUT(endpoint).respond(200, {test: [{id: 1, name: 'John'}], totalCount: 1});
            var response = {};

            adapter.synchronize(model, [{name: "John"}], date).then(function (res) {
                response = res;
            });
            $httpBackend.flush();
            $rootScope.$apply();

            response.data[0].name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        }));

        it("Should expect the results at the top level if set to null during find", inject(function ($injector) {
            provider.setResultsField('');
            adapter = $injector.invoke(provider.$get);

            $httpBackend.expectGET(endpoint).respond(200, [{id: 1, name: 'John'}]);
            var response = {};

            adapter.find(model).then(function (res) {
                response = res;
            });
            $httpBackend.flush();
            $rootScope.$apply();

            response.data[0].name.should.equal("John");
            should.equal(response.count, null);
            response.status.should.equal(200);
        }));

        it("Should expect the results at the top level if set to null during synchronize", inject(function ($injector) {
            provider.setResultsField('');
            adapter = $injector.invoke(provider.$get);

            var date = new Date().toISOString();
            $httpBackend.expectPUT(endpoint).respond(200, [{id: 1, name: 'John'}]);
            var response = {};

            adapter.synchronize(model, [{name: "John"}], date).then(function (res) {
                response = res;
            });
            $httpBackend.flush();
            $rootScope.$apply();

            response.data[0].name.should.equal("John");
            should.equal(response.count, null);
            response.status.should.equal(200);
        }));
    });

    describe("setTotalCountFiled", function () {
        it("Should set the expected path to the total count in the response during find", inject(function ($injector) {
            provider.setTotalCountFiled('test');
            adapter = $injector.invoke(provider.$get);

            $httpBackend.expectGET(endpoint).respond(200, {results: [{id: 1, name: 'John'}], test: 1});
            var response = {};

            adapter.find(model).then(function (res) {
                response = res;
            });
            $httpBackend.flush();
            $rootScope.$apply();

            response.data[0].name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        }));

        it("Should set the expected path to the total count in the response during synchronize", inject(function ($injector) {
            provider.setTotalCountFiled('test');
            adapter = $injector.invoke(provider.$get);

            var date = new Date().toISOString();
            $httpBackend.expectPUT(endpoint).respond(200, {results: [{id: 1, name: 'John'}], test: 1});
            var response = {};

            adapter.synchronize(model, [{name: "John"}], date).then(function (res) {
                response = res;
            });
            $httpBackend.flush();
            $rootScope.$apply();

            response.data[0].name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        }));

        it("Should ignore the total count if set to null during find", inject(function ($injector) {
            provider.setTotalCountFiled('');
            adapter = $injector.invoke(provider.$get);

            $httpBackend.expectGET(endpoint).respond(200, {results: [{id: 1, name: 'John'}], totalCount: 1});
            var response = {};

            adapter.find(model).then(function (res) {
                response = res;
            });
            $httpBackend.flush();
            $rootScope.$apply();

            response.data[0].name.should.equal("John");
            should.equal(response.count, null);
            response.status.should.equal(200);
        }));

        it("Should ignore the total count if set to null during synchronize", inject(function ($injector) {
            provider.setTotalCountFiled('');
            adapter = $injector.invoke(provider.$get);

            var date = new Date().toISOString();
            $httpBackend.expectPUT(endpoint).respond(200, {results: [{id: 1, name: 'John'}], test: 1});
            var response = {};

            adapter.synchronize(model, [{name: "John"}], date).then(function (res) {
                response = res;
            });
            $httpBackend.flush();
            $rootScope.$apply();

            response.data[0].name.should.equal("John");
            should.equal(response.count, null);
            response.status.should.equal(200);
        }));
    });

    describe("Create", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
        }));

        it("Should return a promise", function () {
            $httpBackend.expectPOST(endpoint).respond({id: 1, name: 'John'});

            var promise = adapter.create(model, {name: "John"});
            $httpBackend.flush();

            should.equal(true, isFunc(promise.then));
        });

        it("Should resolve a proper response", function () {
            $httpBackend.expectPOST(endpoint).respond(200, {id: 1, name: 'John'});
            var response = {};

            adapter.create(model, {name: "John"}).then(function (res) {
                response = res;
            });
            $httpBackend.flush();
            $rootScope.$apply();

            response.data.name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should reject with a proper error", function () {
            $httpBackend.expectPOST(endpoint).respond(500, "Error");
            var response = {};

            adapter.create(model, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $httpBackend.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });
    });

    describe("FindOne", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
        }));

        it("Should return a promise", function () {
            $httpBackend.expectGET(endpoint + '/1').respond({id: 1, name: 'John'});

            var promise = adapter.findOne(model, 1);
            $httpBackend.flush();

            should.equal(true, isFunc(promise.then));
        });

        it("Should require the primary key", function () {
            var promiseFailed = false;
            adapter.findOne(model).then(null, function () {
                promiseFailed = true;
            });
            $rootScope.$apply();

            should.equal(true, promiseFailed);
        });

        it("Should add the options onto the url", function () {
            var options = new PreparedQueryOptions().$top(10).$skip(10);
            $httpBackend.expectGET(endpoint + '/1?$top=10&$skip=10').respond(200, {id: 1, name: 'John'});
            var response = {};

            adapter.findOne(model, 1, options).then(function (res) {
                response = res;
            });
            $httpBackend.flush();
        });

        it("Should resolve a proper response", function () {
            $httpBackend.expectGET(endpoint + '/1').respond(200, {id: 1, name: 'John'});
            var response = {};

            adapter.findOne(model, 1).then(function (res) {
                response = res;
            });
            $httpBackend.flush();
            $rootScope.$apply();

            response.data.name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should reject with a proper error", function () {
            $httpBackend.expectGET(endpoint + '/1').respond(500, "Error");
            var response = {};

            adapter.findOne(model, 1).then(null, function (res) {
                response = res;
            });
            $httpBackend.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });
    });

    describe("Find", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
        }));

        it("Should return a promise", function () {
            $httpBackend.expectGET(endpoint).respond({results: [{id: 1, name: 'John'}], totalCount: 1});

            var promise = adapter.find(model);
            $httpBackend.flush();

            should.equal(true, isFunc(promise.then));
        });

        it("Should add the options onto the url", function () {
            var options = new PreparedQueryOptions().$top(10).$skip(10);
            $httpBackend.expectGET(endpoint + '?$top=10&$skip=10').respond({results: [{id: 1, name: 'John'}], totalCount: 1});
            var response = {};

            adapter.find(model, options).then(function (res) {
                response = res;
            });
            $httpBackend.flush();
        });

        it("Should resolve a proper response", function () {
            $httpBackend.expectGET(endpoint).respond(200, {results: [{id: 1, name: 'John'}], totalCount: 1});
            var response = {};

            adapter.find(model).then(function (res) {
                response = res;
            });
            $httpBackend.flush();
            $rootScope.$apply();

            response.data[0].name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should reject with a proper error", function () {
            $httpBackend.expectGET(endpoint).respond(500, "Error");
            var response = {};

            adapter.find(model).then(null, function (res) {
                response = res;
            });
            $httpBackend.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });
    });

    describe("Update", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
        }));

        it("Should return a promise", function () {
            $httpBackend.expectPUT(endpoint + '/1').respond({id: 1, name: 'Steve'});

            var promise = adapter.update(model, 1, {name: "Steve"});
            $httpBackend.flush();

            should.equal(true, isFunc(promise.then));
        });

        it("Should require the primary key", function () {
            var promiseFailed = false;
            adapter.update(model, null, {name: "Steve"}).then(null, function () {
                promiseFailed = true;
            });
            $rootScope.$apply();

            should.equal(true, promiseFailed);
        });

        it("Should resolve a proper response", function () {
            $httpBackend.expectPUT(endpoint + '/1').respond(200, {id: 1, name: 'Steve'});
            var response = {};

            adapter.update(model, 1, {name: "Steve"}).then(function (res) {
                response = res;
            });
            $httpBackend.flush();
            $rootScope.$apply();

            response.data.name.should.equal("Steve");
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should reject with a proper error", function () {
            $httpBackend.expectPUT(endpoint + '/1').respond(500, "Error");
            var response = {};

            adapter.update(model, 1, {name: "Steve"}).then(null, function (res) {
                response = res;
            });
            $httpBackend.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });
    });

    describe("Remove", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
        }));

        it("Should return a promise", function () {
            $httpBackend.expectDELETE(endpoint + '/1').respond(200);

            var promise = adapter.remove(model, 1);
            $httpBackend.flush();

            should.equal(true, isFunc(promise.then));
        });

        it("Should require the primary key", function () {
            var promiseFailed = false;
            adapter.remove(model).then(null, function () {
                promiseFailed = true;
            });
            $rootScope.$apply();

            should.equal(true, promiseFailed);
        });

        it("Should resolve a proper response", function () {
            $httpBackend.expectDELETE(endpoint + '/1').respond(200);
            var response = {};

            adapter.remove(model, 1).then(function (res) {
                response = res;
            });
            $httpBackend.flush();
            $rootScope.$apply();

            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should reject with a proper error", function () {
            $httpBackend.expectDELETE(endpoint + '/1').respond(500, "Error");
            var response = {};

            adapter.remove(model, 1).then(null, function (res) {
                response = res;
            });
            $httpBackend.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });
    });

    describe("Synchronize", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
        }));

        it("Should return a promise", function () {
            var date = new Date().toISOString();
            $httpBackend.expectPUT(endpoint).respond(200, {results: [{id: 1, name: 'John'}], totalCount: 1});

            var promise = adapter.synchronize(model, [{name: "John"}], date);
            $httpBackend.flush();

            should.equal(true, isFunc(promise.then));
        });

        it("Should resolve a proper response", function () {
            var date = new Date().toISOString();
            $httpBackend.expectPUT(endpoint).respond(200, {results: [{id: 1, name: 'John'}], totalCount: 1});
            var response = {};

            adapter.synchronize(model, [{name: "John"}], date).then(function (res) {
                response = res;
            });
            $httpBackend.flush();
            $rootScope.$apply();

            response.data[0].name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should reject with a proper error", function () {
            var date = new Date().toISOString();
            $httpBackend.expectPUT(endpoint).respond(500, "Error");
            var response = {};

            adapter.synchronize(model, [{name: "John"}], date).then(null, function (res) {
                response = res;
            });
            $httpBackend.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });
    });
});