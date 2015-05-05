/*globals describe, sinon, beforeEach, module, inject, it, should*/
describe("DropboxDatastoreAdapter", function () {
    var provider;
    var adapter;
    var $rootScope;
    var $timeout;
    var mockDropboxDatastore;
    var personModelDefinition;
    var model;
    var recall;
    var $window;
    var $q;

    var isFunc = function (a) {
        return typeof a === 'function';
    };

    beforeEach(module('recall.adapter.dropboxDatastore', function (recallDropboxDatastoreAdapterProvider, recallProvider) {
        recallProvider.setLastModifiedFieldName('lastModified');
        recallProvider.setDeletedFieldName('deleted');
        provider = recallDropboxDatastoreAdapterProvider;
    }));

    beforeEach(inject(function (_$rootScope_, _$timeout_, _$window_, _$q_, _recall_) {
        recall = _recall_;
        $rootScope = _$rootScope_;
        $timeout = _$timeout_;
        $window = _$window_;
        $q = _$q_;
        mockDropboxDatastore = new window.MockDropboxDatastore($timeout);
        Dropbox = mockDropboxDatastore.Dropbox;

        personModelDefinition = {
            name: "person",
            dataSourceName: "people",
            fields: {
                id: {
                    primaryKey: true,
                    type: "String"
                },
                name: {
                    type: "String",
                    index: "firstName",
                    notNull: true
                }
            }
        };
    }));

    it("Should provide the basic CRUD methods", inject(function ($injector) {
        adapter = $injector.invoke(provider.$get);
        should.equal(isFunc(adapter.create), true);
        should.equal(isFunc(adapter.findOne), true);
        should.equal(isFunc(adapter.find), true);
        should.equal(isFunc(adapter.update), true);
        should.equal(isFunc(adapter.remove), true);
        should.equal(isFunc(adapter.synchronize), true);
    }));

    it("Should return if Dropbox is not available", inject(function ($injector) {
        Dropbox = undefined;
        adapter = $injector.invoke(provider.$get);
        should.equal(adapter, undefined);
    }));

    describe("setClientKey", function () {
        it("Should open a connection to the datastore with the client api key specified", inject(function ($injector) {
            provider.setClientKey('test');
            adapter = $injector.invoke(provider.$get);
            model = recall.defineModel(personModelDefinition, adapter);

            adapter.create(model, {name: "John"});

            mockDropboxDatastore.api.client.options.key.should.equal("test");
        }));
    });

    describe("setAuthDriver", function () {
        it("Should open a connection to the datastore with the auth driver specified", inject(function ($injector) {
            provider.setClientKey('key');
            provider.setAuthDriver('driver');
            adapter = $injector.invoke(provider.$get);
            model = recall.defineModel(personModelDefinition, adapter);

            sinon.stub(adapter.service, "connect", function () {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            });

            adapter.connect(model, {name: "John"});

            adapter.service.connect.calledWith("key", "driver").should.equal(true);
        }));
    });

    describe("setPkGenerator", function () {
        it("Should generate new primary keys with the function specified", inject(function ($injector) {
            provider.setClientKey('test');
            provider.setPkGenerator(function () {
                return 'test';
            });
            adapter = $injector.invoke(provider.$get);
            model = recall.defineModel(personModelDefinition, adapter);

            var theId;
            sinon.stub(mockDropboxDatastore.api.table, "getOrInsert", function (id, instance) {
                theId = id;
            });

            adapter.create(model, {name: "John"});
            $timeout.flush();
            $rootScope.$apply();

            theId.should.equal("test");
        }));
    });

    describe("Create", function () {
        beforeEach(inject(function ($injector) {
            provider.setClientKey('test');
            adapter = $injector.invoke(provider.$get);
            model = recall.defineModel(personModelDefinition, adapter);
        }));

        it("Should return a promise", function () {
            var promise = adapter.create(model, {name: "John"});
            should.equal(isFunc(promise.then), true);
        });

        it("Should insert the model", function () {
            var theInstance = null;

            sinon.stub(mockDropboxDatastore.api.table, "getOrInsert", function (id, instance) {
                theInstance = instance;
            });

            adapter.create(model, {id: 1, name: "John", test: "test"});
            $timeout.flush();
            $rootScope.$apply();

            mockDropboxDatastore.api.table.getOrInsert.calledWith(1, theInstance);
            theInstance.name.should.equal("John");
            should.equal(theInstance.test, undefined);
            should.equal(theInstance.id, undefined);
        });

        it("Should resolve a proper response", function () {
            var response = {};

            adapter.create(model, {id: 1, name: "John"}).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(201);
        });

        it("Should reject with a proper error", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub(mockDropboxDatastore.api.table, "getOrInsert").throws(exception);
            var response = {};

            adapter.create(model, {id: 1, name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal(exception);
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when table retrieval fails", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub(mockDropboxDatastore.api.defaultDatastore, "getTable").throws(exception);
            var response = {};

            adapter.create(model, {id: 1, name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal(exception);
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when connection fails", function () {
            sinon.stub(mockDropboxDatastore.api.client, "authenticate", function (options, errorCallback) {
                errorCallback("Error");
            });
            var response = {};

            adapter.create(model, {id: 1, name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });
    });

    describe("FindOne", function () {
        beforeEach(inject(function ($injector) {
            provider.setClientKey('test');
            adapter = $injector.invoke(provider.$get);
            model = recall.defineModel(personModelDefinition, adapter);
        }));

        it("Should return a promise", function () {
            var promise = adapter.findOne(model, 1);
            should.equal(isFunc(promise.then), true);
        });

        it("Should call get with the primary key", function () {
            sinon.stub(mockDropboxDatastore.api.table, "get");

            adapter.findOne(model, 1);
            $timeout.flush();
            $rootScope.$apply();

            mockDropboxDatastore.api.table.get.calledWith(1).should.equal(true);
        });

        it("Should resolve a proper response", function () {
            var response = {};

            sinon.stub(mockDropboxDatastore.api.table, "get", function () {
                return new mockDropboxDatastore.api.Result({name: "John"}, 1);
            });

            adapter.findOne(model, 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should resolve a proper response when nothing is found", function () {
            var response = {};

            sinon.stub(mockDropboxDatastore.api.table, "get", function () {
                return null;
            });

            adapter.findOne(model, 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Not Found");
            response.count.should.equal(0);
            response.status.should.equal(404);
        });

        it("Should reject with a proper error", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub(mockDropboxDatastore.api.table, "get").throws(exception);
            var response = {};

            adapter.findOne(model, 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal(exception);
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when table retrieval fails", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub(mockDropboxDatastore.api.defaultDatastore, "getTable").throws(exception);
            var response = {};

            adapter.findOne(model, 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal(exception);
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when connection fails", function () {
            sinon.stub(mockDropboxDatastore.api.client, "authenticate", function (options, errorCallback) {
                errorCallback("Error");
            });
            var response = {};

            adapter.findOne(model, 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });
    });

    describe("Find", function () {
        beforeEach(inject(function ($injector) {
            provider.setClientKey('test');
            adapter = $injector.invoke(provider.$get);
            model = recall.defineModel(personModelDefinition, adapter);
        }));

        it("Should return a promise", function () {
            var promise = adapter.find(model);
            should.equal(isFunc(promise.then), true);
        });

        it("Should exclude deleted records", function () {
            var theQuery;

            sinon.stub(mockDropboxDatastore.api.table, "query", function (query) {
                theQuery = query;
                return [];
            });

            adapter.find(model);
            $timeout.flush();
            $rootScope.$apply();

            theQuery.deleted.should.equal(false);
        });

        it("Should allow deleted records when including deleted", function () {
            var theQuery;

            sinon.stub(mockDropboxDatastore.api.table, "query", function (query) {
                theQuery = query;
                return [];
            });

            adapter.find(model, null, true);
            $timeout.flush();
            $rootScope.$apply();

            should.equal(theQuery, undefined);
        });

        it("Should resolve a proper response", function () {
            var response = {};

            sinon.stub(mockDropboxDatastore.api.table, "query", function () {
                return [new mockDropboxDatastore.api.Result({name: "John"}, 1)];
            });

            adapter.find(model).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data[0].name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should reject with a proper error when table retrieval fails", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub(mockDropboxDatastore.api.defaultDatastore, "getTable").throws(exception);
            var response = {};

            adapter.find(model).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal(exception);
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when connection fails", function () {
            sinon.stub(mockDropboxDatastore.api.client, "authenticate", function (options, errorCallback) {
                errorCallback("Error");
            });
            var response = {};

            adapter.find(model).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });
    });

    describe("Update", function () {
        beforeEach(inject(function ($injector) {
            provider.setClientKey('test');
            adapter = $injector.invoke(provider.$get);
            model = recall.defineModel(personModelDefinition, adapter);
        }));

        it("Should return a promise", function () {
            var promise = adapter.update(model, 1, {name: "John"});
            should.equal(isFunc(promise.then), true);
        });

        it("Should call get with the primary key", function () {
            sinon.stub(mockDropboxDatastore.api.table, "get");

            adapter.update(model, 1, {name: "John"});
            $timeout.flush();
            $rootScope.$apply();

            mockDropboxDatastore.api.table.get.calledWith(1).should.equal(true);
        });

        it("Should resolve a proper response", function () {
            var response = {};

            sinon.stub(mockDropboxDatastore.api.table, "get", function () {
                return new mockDropboxDatastore.api.Result({name: "Steve"}, 1);
            });

            adapter.update(model, 1, {name: "John"}).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should resolve a proper response when nothing is found", function () {
            var response = {};

            sinon.stub(mockDropboxDatastore.api.table, "get", function () {
                return null;
            });

            adapter.update(model, 1, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Not Found");
            response.count.should.equal(0);
            response.status.should.equal(404);
        });

        it("Should reject with a proper error", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub(mockDropboxDatastore.api.table, "get").throws(exception);
            var response = {};

            adapter.update(model, 1, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal(exception);
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when table retrieval fails", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub(mockDropboxDatastore.api.defaultDatastore, "getTable").throws(exception);
            var response = {};

            adapter.update(model, 1, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal(exception);
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when connection fails", function () {
            sinon.stub(mockDropboxDatastore.api.client, "authenticate", function (options, errorCallback) {
                errorCallback("Error");
            });
            var response = {};

            adapter.update(model, 1, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });
    });

    describe("Remove", function () {
        beforeEach(inject(function ($injector) {
            provider.setClientKey('test');
            adapter = $injector.invoke(provider.$get);
            model = recall.defineModel(personModelDefinition, adapter);
        }));

        it("Should return a promise", function () {
            var promise = adapter.remove(model, 1);
            should.equal(isFunc(promise.then), true);
        });

        it("Should call get with the primary key", function () {
            sinon.stub(mockDropboxDatastore.api.table, "get");

            adapter.update(model, 1, {name: "John"});
            $timeout.flush();
            $rootScope.$apply();

            mockDropboxDatastore.api.table.get.calledWith(1).should.equal(true);
        });

        it("Should resolve a proper response", function () {
            var response = {};

            sinon.stub(mockDropboxDatastore.api.table, "get", function () {
                return new mockDropboxDatastore.api.Result({name: "John", deleted: false}, 1);
            });

            adapter.remove(model, 1).then(function (res) {
                response = res;
            }, function (e) {
                throw e.data;
            });
            $timeout.flush();
            $rootScope.$apply();

            should.equal(response.data, null);
            response.count.should.equal(1);
            response.status.should.equal(204);
        });

        it("Should reject with a proper error", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub(mockDropboxDatastore.api.table, "get").throws(exception);
            var response = {};

            adapter.remove(model, 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal(exception);
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when table retrieval fails", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub(mockDropboxDatastore.api.defaultDatastore, "getTable").throws(exception);
            var response = {};

            adapter.remove(model, 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal(exception);
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when connection fails", function () {
            sinon.stub(mockDropboxDatastore.api.client, "authenticate", function (options, errorCallback) {
                errorCallback("Error");
            });
            var response = {};

            adapter.remove(model, 1).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });
    });

    describe("Synchronize", function () {
        beforeEach(inject(function ($injector) {
            provider.setClientKey('test');
            adapter = $injector.invoke(provider.$get);
            model = recall.defineModel(personModelDefinition, adapter);
        }));

        it("Should return a promise", function () {
            var promise = adapter.synchronize(model, [{name: "John"}]);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            var response = {};

            sinon.stub(mockDropboxDatastore.api.table, "query", function () {
                return [new mockDropboxDatastore.api.Result({name: "John"}, 1)];
            });

            adapter.synchronize(model, []).then(function (res) {
                response = res;
            }, function (e) {
                throw e.data;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data[0].name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should reject with a proper error", function () {
            var exception = {name: "Error", message: "Error"};
            sinon.stub(mockDropboxDatastore.api.table, "get").throws(exception);
            var response = {};

            adapter.synchronize(model, [{name: "John"}]).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal(exception);
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when connection fails", function () {
            sinon.stub(mockDropboxDatastore.api.client, "authenticate", function (options, errorCallback) {
                errorCallback("Error");
            });
            var response = {};

            adapter.synchronize(model, [{name: "John"}]).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });
    });
});