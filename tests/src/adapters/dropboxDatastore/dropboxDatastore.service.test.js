/*globals describe, sinon, beforeEach, module, inject, it, should*/
describe("DropboxDatastoreService", function () {
    var service;
    var $rootScope;
    var $timeout;
    var $window;
    var $q;
    var mockDropboxDatastore;
    var model;
    var modelDef;
    var testAdapter;

    var isFunc = function (a) {
        return typeof a === 'function';
    };

    var resolvedPromiseFunction = function () {
        var dfd = $q.defer();
        dfd.resolve();
        return dfd.promise;
    };

    beforeEach(module('recall.adapter.dropboxDatastore'));

    beforeEach(inject(function (_$rootScope_, _$timeout_, _$window_, _$q_, recallDropboxDatastoreService, recall) {
        $rootScope = _$rootScope_;
        $timeout = _$timeout_;
        $window = _$window_;
        $q = _$q_;

        service = recallDropboxDatastoreService;

        mockDropboxDatastore = new window.MockDropboxDatastore($timeout);
        Dropbox = mockDropboxDatastore.Dropbox;

        modelDef = {
            name: "testEndpoint",
            dataSourceName: "testEndpoint",
            fields: {
                id: {
                    primaryKey: true,
                    type: "String"
                },
                name: "String",
                index: {
                    type: "Boolean",
                    index: "test"
                }
            }
        };

        testAdapter = {
            create: resolvedPromiseFunction,
            findOne: resolvedPromiseFunction,
            find: resolvedPromiseFunction,
            update: resolvedPromiseFunction,
            remove: resolvedPromiseFunction
        };

        model = recall.defineModel(modelDef, testAdapter);
        model.setDeletedFieldName("deleted");
        model.setLastModifiedFieldName("lastModified");
    }));

    describe("Connect", function () {
        it("Should return a promise", function () {
            var promise = service.connect("test", 1);
            should.equal(isFunc(promise.then), true);
        });

        it("Should set the auth driver if provided", function () {
            var response = {};

            sinon.stub(mockDropboxDatastore.api.client, "authDriver");

            service.connect("test", 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            mockDropboxDatastore.api.client.authDriver.calledWith(1).should.equal(true);
        });

        it("Should perform a non-interactive authentication", function () {
            var response = {};
            var theOptions = null;

            sinon.stub(mockDropboxDatastore.api.client, "authenticate", function (options, callback) {
                theOptions = options;
                callback();
            });

            service.connect("test", 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            theOptions.interactive.should.equal(false);
        });

        it("Should resolve with the default datastore", function () {
            var response = {};

            sinon.stub(mockDropboxDatastore.api.dataStoreManager, "openDefaultDatastore", function (callback) {
                callback(null, "datastore");
            });

            service.connect("test", 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("datastore");
        });

        it("Should reject with a proper error when authentication has an error", function () {
            var response = {};

            sinon.stub(mockDropboxDatastore.api.client, "authenticate", function (options, callback) {
                callback("Error");
            });

            service.connect("test", 1).then(null, function (res) {
                response = res;
            });
            $rootScope.$apply();

            response.should.equal("Error");
        });

        it("Should reject with a proper error when authentication fails", function () {
            var response = {};

            sinon.stub(mockDropboxDatastore.api.client, "isAuthenticated", function () {
                return false;
            });

            service.connect("test", 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Could not authenticate");
        });

        it("Should reject with a proper error when the default datastore cannot be opened", function () {
            var response = {};

            sinon.stub(mockDropboxDatastore.api.dataStoreManager, "openDefaultDatastore", function (callback) {
                callback("Error");
            });

            service.connect("test", 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });

        it("Should reject with a proper error when the client key is not provided", function () {
            var response = {};

            service.connect(null, "test").then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Client key not set");
        });
    });

    describe("Create", function () {
        it("Should return a promise", function () {
            var promise = service.create(mockDropboxDatastore.api.defaultDatastore, model, {name: "John"});
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            var response = {};

            sinon.stub(mockDropboxDatastore.api.table, "getOrInsert", function (id, instance) {
                return new mockDropboxDatastore.api.Result(instance, id);
            });

            service.create(mockDropboxDatastore.api.defaultDatastore, model, {name: "John"}).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.name.should.equal("John");
        });

        it("Should create the entity with the primary key", function () {
            var response = {};
            var theInstance;

            sinon.stub(mockDropboxDatastore.api.table, "getOrInsert", function (id, instance) {
                theInstance = instance;
                return new mockDropboxDatastore.api.Result(instance, id);
            });

            service.create(mockDropboxDatastore.api.defaultDatastore, model, {id: 1, name: "John"}).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            mockDropboxDatastore.api.table.getOrInsert.calledWith(1, theInstance);
            should.equal(theInstance.id, undefined);
        });

        it("Should reject with a proper error when the table retrieval fails", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub(mockDropboxDatastore.api.defaultDatastore, "getTable").throws(exception);
            var response = {};

            service.create(mockDropboxDatastore.api.defaultDatastore, model, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal(exception);
        });

        it("Should reject with a proper error", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub(mockDropboxDatastore.api.table, "getOrInsert").throws(exception);
            var response = {};

            service.create(mockDropboxDatastore.api.defaultDatastore, model, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal(exception);
        });
    });

    describe("FindOne", function () {
        it("Should return a promise", function () {
            var promise = service.findOne(mockDropboxDatastore.api.defaultDatastore, model, 1);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            var response = {};

            sinon.stub(mockDropboxDatastore.api.table, "get", function () {
                return new mockDropboxDatastore.api.Result({name: "John"}, 1);
            });

            service.findOne(mockDropboxDatastore.api.defaultDatastore, model, 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            mockDropboxDatastore.api.table.get.calledWith(1).should.equal(true);
            response.name.should.equal("John");
        });

        it("Should resolve a proper response when nothing is found", function () {
            var response = {};

            sinon.stub(mockDropboxDatastore.api.table, "get", function () {
                return null;
            });

            service.findOne(mockDropboxDatastore.api.defaultDatastore, model, 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            should.equal(response, null);
        });

        it("Should reject with a proper error when the table retrieval fails", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub(mockDropboxDatastore.api.defaultDatastore, "getTable").throws(exception);
            var response = {};

            service.findOne(mockDropboxDatastore.api.defaultDatastore, model, 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal(exception);
        });

        it("Should reject with a proper error", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub(mockDropboxDatastore.api.table, "get").throws(exception);
            var response = {};

            service.findOne(mockDropboxDatastore.api.defaultDatastore, model, 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal(exception);
        });
    });

    describe("Find", function () {
        it("Should return a promise", function () {
            var promise = service.find(mockDropboxDatastore.api.defaultDatastore, model);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            var response = {};
            var theQuery = null;

            sinon.stub(mockDropboxDatastore.api.table, "query", function (query) {
                theQuery = query;
                return [new mockDropboxDatastore.api.Result({id: 1, name: "John"})];
            });

            service.find(mockDropboxDatastore.api.defaultDatastore, model).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response[0].name.should.equal("John");
            theQuery.deleted.should.equal(false);
        });

        it("Should not limit the query when includeDeleted is true", function () {
            var response = {};
            var theQuery = null;

            sinon.stub(mockDropboxDatastore.api.table, "query", function (query) {
                theQuery = query;
                return [new mockDropboxDatastore.api.Result({id: 1, name: "John"})];
            });

            service.find(mockDropboxDatastore.api.defaultDatastore, model, true).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response[0].name.should.equal("John");
            should.equal(theQuery, undefined);
        });

        it("Should reject with a proper error when the table retrieval fails", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub(mockDropboxDatastore.api.defaultDatastore, "getTable").throws(exception);
            var response = {};

            service.find(mockDropboxDatastore.api.defaultDatastore, model).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal(exception);
        });
    });

    describe("Update", function () {
        it("Should return a promise", function () {
            var promise = service.update(mockDropboxDatastore.api.defaultDatastore, model, 1, {name: "John"});
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            var response = {};

            sinon.stub(mockDropboxDatastore.api.table, "get", function () {
                return new mockDropboxDatastore.api.Result({id: 1, name: "Steve"});
            });

            service.update(mockDropboxDatastore.api.defaultDatastore, model, 1, {name: "John"}).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.name.should.equal("John");
        });

        it("Should reject with a proper response when nothing is found", function () {
            var response = {};

            sinon.stub(mockDropboxDatastore.api.table, "get", function () {
                return null;
            });

            service.update(mockDropboxDatastore.api.defaultDatastore, model, 1, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            should.equal(response, null);
        });

        it("Should reject with a proper error when table retrieval fails", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub(mockDropboxDatastore.api.defaultDatastore, "getTable").throws(exception);
            var response = {};

            service.update(mockDropboxDatastore.api.defaultDatastore, model, 1, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal(exception);
        });

        it("Should reject with a proper error", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub(mockDropboxDatastore.api.table, "get").throws(exception);
            var response = {};

            service.update(mockDropboxDatastore.api.defaultDatastore, model, 1, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal(exception);
        });
    });

    describe("Remove", function () {
        it("Should return a promise", function () {
            var promise = service.remove(mockDropboxDatastore.api.defaultDatastore, model, 1);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            var response = {};
            var result = new mockDropboxDatastore.api.Result({id: 1, name: "Steve"});

            sinon.stub(mockDropboxDatastore.api.table, "get", function () {
                return result;
            });
            sinon.stub(result, "deleteRecord");

            service.remove(mockDropboxDatastore.api.defaultDatastore, model, 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            should.equal(response, null);
            result.deleteRecord.called.should.equal(true);
        });

        it("Should resolve a proper response when nothing is found", function () {
            var response = {};

            sinon.stub(mockDropboxDatastore.api.table, "get", function () {
                return null;
            });

            service.remove(mockDropboxDatastore.api.defaultDatastore, model, 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            should.equal(response, null);
        });

        it("Should reject with a proper error when table retrieval fails", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub(mockDropboxDatastore.api.defaultDatastore, "getTable").throws(exception);
            var response = {};

            service.remove(mockDropboxDatastore.api.defaultDatastore, model, 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal(exception);
        });

        it("Should reject with a proper error", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub(mockDropboxDatastore.api.table, "get").throws(exception);
            var response = {};

            service.remove(mockDropboxDatastore.api.defaultDatastore, model, 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal(exception);
        });
    });

    describe("FindByAssociation", function () {
        it("Should return a promise", function () {
            var promise = service.findByAssociation(mockDropboxDatastore.api.defaultDatastore, model, "id", "aId");
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            var response = {};
            var theQuery = null;

            sinon.stub(mockDropboxDatastore.api.table, "query", function (query) {
                theQuery = query;
                return [
                    new mockDropboxDatastore.api.Result({aId: "id", name: "John"}),
                    new mockDropboxDatastore.api.Result({aId: "foo", name: "Steve"})
                ];
            });

            service.findByAssociation(mockDropboxDatastore.api.defaultDatastore, model, "id", "aId").then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response[0].name.should.equal("John");
            response.length.should.equal(1);
            theQuery.deleted.should.equal(false);
        });

        it("Should reject with an error when table retrieval fails", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub(mockDropboxDatastore.api.defaultDatastore, "getTable").throws(exception);
            var response = {};

            service.findByAssociation(mockDropboxDatastore.api.defaultDatastore, model, "id", "aId").then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal(exception);
        });

        it("Should reject with an error", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub(mockDropboxDatastore.api.table, "query").throws(exception);
            var response = {};

            service.findByAssociation(mockDropboxDatastore.api.defaultDatastore, model, "id", "aId").then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal(exception);
        });
    });
});