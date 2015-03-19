/*globals require, describe, beforeEach, module, inject, it, should*/
describe("ODataRESTAdapter", function () {

    beforeEach(module('coma.adapter.oDataREST'));

    var adapter;
    var isFunc = function (a) {
        return typeof a === 'function';
    };

    var model = {
        dataSourceName: "testEndpoint"
    };

    beforeEach(inject(function (comaODataRESTAdapter) {
        adapter = comaODataRESTAdapter;
    }));

    it("Should provide the basic CRUD methods", function () {
        should.equal(true, isFunc(adapter.create));
        should.equal(true, isFunc(adapter.findOne));
        should.equal(true, isFunc(adapter.find));
        should.equal(true, isFunc(adapter.update));
        should.equal(true, isFunc(adapter.remove));
    });

    describe("Create", function () {
        it("Should return a promise", function () {
            var promise = adapter.create(model, {name: "John"});
            should.equal(true, isFunc(promise.then));
        });
    });

    describe("FindOne", function () {
        it("Should return a promise", function () {
            var promise = adapter.findOne(model, 1);
            should.equal(true, isFunc(promise.then));
        });
    });

    describe("Find", function () {
        it("Should return a promise", function () {
            var promise = adapter.find(model);
            should.equal(true, isFunc(promise.then));
        });
    });

    describe("Update", function () {
        it("Should return a promise", function () {
            var promise = adapter.update(model, 1, {name: "John"});
            should.equal(true, isFunc(promise.then));
        });
    });

    describe("Remove", function () {
        it("Should return a promise", function () {
            var promise = adapter.remove(model, 1);
            should.equal(true, isFunc(promise.then));
        });
    });
});