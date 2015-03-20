/*globals require, describe, beforeEach, afterEach, module, inject, it, should*/
describe("ODataRESTAdapter", function () {

    beforeEach(module('coma.adapter.oDataREST'));

    var adapter;
    var $httpBackend;
    var $rootScope;
    var isFunc = function (a) {
        return typeof a === 'function';
    };

    var model = {
        dataSourceName: "testEndpoint"
    };
    var endpoint = '/api/' + model.dataSourceName;

    beforeEach(inject(function (comaODataRESTAdapter) {
        adapter = comaODataRESTAdapter;
    }));

    beforeEach(inject(function (_$httpBackend_, _$rootScope_) {
        $httpBackend = _$httpBackend_;
        $rootScope = _$rootScope_;
    }));

    afterEach(function () {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });

    it("Should provide the basic CRUD methods", function () {
        should.equal(true, isFunc(adapter.create));
        should.equal(true, isFunc(adapter.findOne));
        should.equal(true, isFunc(adapter.find));
        should.equal(true, isFunc(adapter.update));
        should.equal(true, isFunc(adapter.remove));
    });

    describe("Create", function () {
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
        it("Should return a promise", function () {
            $httpBackend.expectGET(endpoint).respond({results: [{id: 1, name: 'John'}], totalCount: 1});

            var promise = adapter.find(model);
            $httpBackend.flush();

            should.equal(true, isFunc(promise.then));
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
});