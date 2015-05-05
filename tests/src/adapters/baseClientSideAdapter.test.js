/*globals describe, sinon, beforeEach, module, inject, it, should*/
describe("BaseClientSideAdapter", function () {
    var adapter;
    var BaseClientSideAdapter;
    var $rootScope;
    var $timeout;
    var $q;
    var model;
    var modelDef;
    var testAdapter;
    var mockService;
    var Predicate;
    var PreparedQueryOptions;

    var isFunc = function (a) {
        return typeof a === 'function';
    };

    var resolvedPromiseFunction = function () {
        var dfd = $q.defer();
        dfd.resolve();
        return dfd.promise;
    };

    beforeEach(module('recall'));

    beforeEach(inject(function (_$rootScope_, _$timeout_, _$window_, _$q_, recall, recallBaseClientSideAdapter, recallPredicate, recallPreparedQueryOptions) {
        $rootScope = _$rootScope_;
        $timeout = _$timeout_;
        $q = _$q_;
        Predicate = recallPredicate;
        PreparedQueryOptions = recallPreparedQueryOptions;

        _$window_.indexedDB = false;
        _$window_.openDatabase = true;

        BaseClientSideAdapter = recallBaseClientSideAdapter;

        mockService = {
            connect: function (dbName, dbVersion, dbSize) {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            },
            create: function (db, theModel, modelInstance) {
                var dfd = $q.defer();
                dfd.resolve(modelInstance);
                return dfd.promise;
            },
            findOne: function (db, theModel, pk, includeDeleted) {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            },
            find: function (db, theModel, includeDeleted) {
                var dfd = $q.defer();
                dfd.resolve([]);
                return dfd.promise;
            },
            update: function (db, theModel, pk, modelInstance, includeDeleted) {
                var dfd = $q.defer();
                dfd.resolve(modelInstance);
                return dfd.promise;
            },
            remove: function (db, theModel, pk) {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            },
            synchronize: function (db, theModel, merge, remove) {
                var dfd = $q.defer();
                dfd.resolve([]);
                return dfd.promise;
            },
            findByAssociation: function (db, model, pk, mappedBy) {
                var dfd = $q.defer();
                dfd.resolve([]);
                return dfd.promise;
            }
        };

        modelDef = {
            name: "testEndpoint",
            dataSourceName: "testEndpoint",
            fields: {
                id: {
                    primaryKey: true,
                    type: "String"
                },
                name: "String",
                date: "Date",
                index: {
                    type: "String",
                    index: "test"
                }
            },
            associations: [
                {
                    hasOne: 'otherModel',
                    as: 'association',
                    mappedBy: 'otherId'
                },
                {
                    hasMany: 'otherModel',
                    as: 'many',
                    mappedBy: 'modelId'
                }
            ]
        };

        var otherModelDef = {
            name: "otherModel",
            dataSourceName: "otherModel",
            fields: {
                id: {
                    primaryKey: true,
                    type: "String"
                },
                modelId: "String"
            },
            associations: [
                {
                    hasOne: 'otherModel',
                    as: 'parent',
                    mappedBy: 'parentId'
                },
                {
                    hasMany: 'otherModel',
                    as: 'children',
                    mappedBy: 'parentId'
                }
            ]
        };

        testAdapter = {
            create: resolvedPromiseFunction,
            findOne: resolvedPromiseFunction,
            find: resolvedPromiseFunction,
            update: resolvedPromiseFunction,
            remove: resolvedPromiseFunction
        };

        adapter = new recallBaseClientSideAdapter("test adapter", mockService, [], function () { return 1; });

        var otherModel = recall.defineModel(otherModelDef, testAdapter);
        model = recall.defineModel(modelDef, testAdapter);
        model.setDeletedFieldName("deleted");
        model.setLastModifiedFieldName("lastModified");
    }));

    it("Should provide the basic CRUD methods", inject(function ($injector) {
        should.equal(isFunc(adapter.create), true);
        should.equal(isFunc(adapter.findOne), true);
        should.equal(isFunc(adapter.find), true);
        should.equal(isFunc(adapter.update), true);
        should.equal(isFunc(adapter.remove), true);
        should.equal(isFunc(adapter.synchronize), true);
    }));

    describe("Connect", function () {
        it("Should return a promise", function () {
            var promise = adapter.connect();
            should.equal(isFunc(promise.then), true);
        });

        it("Should return a promise when the connection is pending", function () {
            var promise = adapter.connect();
            var promise2 = adapter.connect();
            $rootScope.$apply();

            should.equal(promise, promise2);
        });

        it("Should return databse if a connection is already established", function () {
            var i = 0;
            var response = {};
            sinon.stub(mockService, "connect", function () {
                var dfd = $q.defer();

                if (i === 0) {
                    dfd.resolve("db");
                } else {
                    dfd.reject();
                }

                i++;
                return dfd.promise;
            });

            adapter.connect();
            $rootScope.$apply();

            adapter.connect().then(function (res) {
                response = res;
            });
            $rootScope.$apply();

            response.should.equal("db");
        });

        it("Should reject with a proper error", function () {
            var response = {};

            sinon.stub(mockService, "connect", function () {
                return $q.reject("Error");
            });
            adapter.connect().then(null, function (res) {
                response = res;
            });
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("Create", function () {
        it("Should return a promise", function () {
            var promise = adapter.create(model, {name: "John"});
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            var response = {};

            adapter.create(model, {name: "John"}).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(201);
        });

        it("Should reject with a proper error", function () {
            sinon.stub(adapter.service, "create", function () {
                return $q.reject("Error");
            });

            var response = {};

            adapter.create(model, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when connection fails", function () {
            sinon.stub(adapter.service, "connect", function () {
                return $q.reject("Error");
            });

            var response = {};

            adapter.create(model, {name: "John"}).then(null, function (res) {
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
        it("Should return a promise", function () {
            var promise = adapter.findOne(model, 1);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });

            var response = {};

            adapter.findOne(model, 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should resolve a proper response with expanded associations", function () {
            var i = 0;
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();

                if (i === 0) {
                    dfd.resolve({id: 1, name: "John", otherId: 1});
                } else {
                    dfd.resolve({id: 2, modelId: 2});
                }

                i++;
                return dfd.promise;
            });
            sinon.stub(adapter.service, "findByAssociation", function () {
                var dfd = $q.defer();
                dfd.resolve([{id: 1, modelId: 1}]);
                return dfd.promise;
            });

            var response = {};
            var options = new PreparedQueryOptions().$expand("association,many");

            adapter.findOne(model, 1, options).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.name.should.equal("John");
            response.data.association.id.should.equal(2);
            response.data.many.length.should.equal(1);
            response.data.many[0].modelId.should.equal(1);
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should resolve a proper response with deep expanded associations", function () {
            var i = 0;
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();

                if (i === 0) {
                    dfd.resolve({id: 1, name: "John"});
                } else {
                    dfd.resolve({id: 1, parentId: 2});
                }

                i++;
                return dfd.promise;
            });
            sinon.stub(adapter.service, "findByAssociation", function () {
                var dfd = $q.defer();
                dfd.resolve([{id: 1, modelId: 1, parentId: 2}]);
                return dfd.promise;
            });

            var response = {};
            var options = new PreparedQueryOptions().$expand("many,many.parent,fake");

            adapter.findOne(model, 1, options).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.name.should.equal("John");
            response.data.many.length.should.equal(1);
            response.data.many[0].modelId.should.equal(1);
            response.data.many[0].parent.id.should.equal(1);
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should resolve a proper response with missing expanded associations", function () {
            var i = 0;
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();

                if (i === 0) {
                    dfd.resolve({id: 1, name: "John"});
                } else {
                    dfd.resolve({id: 2, modelId: 2});
                }

                i++;
                return dfd.promise;
            });

            var response = {};
            var options = new PreparedQueryOptions().$expand("association");

            adapter.findOne(model, 1, options).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.name.should.equal("John");
            should.equal(response.data.association, null);
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should resolve a proper response with not found expanded associations", function () {
            var i = 0;
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();

                if (i === 0) {
                    dfd.resolve({id: 1, name: "John", otherId: 1});
                } else {
                    dfd.resolve(null);
                }

                i++;
                return dfd.promise;
            });

            var response = {};
            var options = new PreparedQueryOptions().$expand("association");

            adapter.findOne(model, 1, options).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.name.should.equal("John");
            should.equal(response.data.association, null);
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should reject with a proper error when nothing is found", function () {
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            });

            var response = {};

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
            sinon.stub(adapter.service, "findOne", function () {
                return $q.reject("Error");
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

        it("Should reject with a proper error when expand hasOne fails", function () {
            var i = 0;
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();

                if (i === 0) {
                    dfd.resolve({id: 1, name: "John", otherId: 1});
                } else {
                    dfd.reject("Error");
                }

                i++;
                return dfd.promise;
            });

            var response = {};
            var options = new PreparedQueryOptions().$expand("association");

            adapter.findOne(model, 1, options).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when expand hasMany fails", function () {
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(adapter.service, "findByAssociation", function () {
                return $q.reject("Error");
            });

            var response = {};
            var options = new PreparedQueryOptions().$expand("many");

            adapter.findOne(model, 1, options).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when connection fails", function () {
            sinon.stub(adapter.service, "connect", function () {
                return $q.reject("Error");
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
        it("Should return a promise", function () {
            var promise = adapter.find(model);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            sinon.stub(adapter.service, "find", function () {
                var dfd = $q.defer();
                dfd.resolve([{id: 1, name: "John"}]);
                return dfd.promise;
            });

            var response = {};

            adapter.find(model).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data[0].name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should resolve a proper paged response", function () {
            sinon.stub(adapter.service, "find", function () {
                var dfd = $q.defer();
                dfd.resolve([{id: 1, name: "John"}, {id: 2, name: "Steve"}]);
                return dfd.promise;
            });

            var response = {};
            var options = new PreparedQueryOptions().$skip(1).$top(1);

            adapter.find(model, options).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.length.should.equal(1);
            response.data[0].name.should.equal("Steve");
            response.count.should.equal(2);
            response.status.should.equal(200);
        });

        it("Should resolve a proper ordered response", function () {
            sinon.stub(adapter.service, "find", function () {
                var dfd = $q.defer();
                dfd.resolve([{id: 2, name: "Steve"}, {id: 1, name: "John"}]);
                return dfd.promise;
            });

            var response = {};
            var options = new PreparedQueryOptions().$orderBy("name");

            adapter.find(model, options).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.length.should.equal(2);
            response.data[0].name.should.equal("John");
            response.count.should.equal(2);
            response.status.should.equal(200);
        });

        it("Should resolve a proper ordered response - date", function () {
            sinon.stub(adapter.service, "find", function () {
                var dfd = $q.defer();
                dfd.resolve([{id: 2, name: "Steve", date: new Date()}, {id: 1, name: "John", date: new Date()}]);
                return dfd.promise;
            });

            var response = {};
            var options = new PreparedQueryOptions().$orderBy("date");

            adapter.find(model, options).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.length.should.equal(2);
            response.data[0].name.should.equal("Steve");
            response.count.should.equal(2);
            response.status.should.equal(200);
        });

        it("Should resolve a proper ordered response - inverse", function () {
            sinon.stub(adapter.service, "find", function () {
                var dfd = $q.defer();
                dfd.resolve([{id: 1, name: "John"}, {id: 2, name: "Steve"}]);
                return dfd.promise;
            });

            var response = {};
            var options = new PreparedQueryOptions().$orderBy("name");

            adapter.find(model, options).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.length.should.equal(2);
            response.data[0].name.should.equal("John");
            response.count.should.equal(2);
            response.status.should.equal(200);
        });

        it("Should resolve a proper ordered response - desc", function () {
            sinon.stub(adapter.service, "find", function () {
                var dfd = $q.defer();
                dfd.resolve([{id: 2, name: "Steve"}, {id: 1, name: "John"}]);
                return dfd.promise;
            });

            var response = {};
            var options = new PreparedQueryOptions().$orderBy("name desc");

            adapter.find(model, options).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.length.should.equal(2);
            response.data[0].name.should.equal("Steve");
            response.count.should.equal(2);
            response.status.should.equal(200);
        });

        it("Should resolve a proper ordered response - desc inverse", function () {
            sinon.stub(adapter.service, "find", function () {
                var dfd = $q.defer();
                dfd.resolve([{id: 1, name: "John"}, {id: 2, name: "Steve"}]);
                return dfd.promise;
            });

            var response = {};
            var options = new PreparedQueryOptions().$orderBy("name desc");

            adapter.find(model, options).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.length.should.equal(2);
            response.data[0].name.should.equal("Steve");
            response.count.should.equal(2);
            response.status.should.equal(200);
        });

        it("Should resolve a proper ordered response - same value", function () {
            sinon.stub(adapter.service, "find", function () {
                var dfd = $q.defer();
                dfd.resolve([{id: 2, name: "John"}, {id: 1, name: "John"}]);
                return dfd.promise;
            });

            var response = {};
            var options = new PreparedQueryOptions().$orderBy("name desc");

            adapter.find(model, options).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.length.should.equal(2);
            response.data[0].id.should.equal(2);
            response.count.should.equal(2);
            response.status.should.equal(200);
        });

        it("Should resolve a proper response when filtering", function () {
            sinon.stub(adapter.service, "find", function () {
                var dfd = $q.defer();
                dfd.resolve([{id: 1, name: "John"}]);
                return dfd.promise;
            });

            var response = {};
            var options = new PreparedQueryOptions().$filter(new Predicate("name").notEqualTo("John"));

            adapter.find(model, options).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.length.should.equal(0);
            response.count.should.equal(0);
            response.status.should.equal(200);
        });

        it("Should reject with a proper error", function () {
            sinon.stub(adapter.service, "find", function () {
                return $q.reject("Error");
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

        it("Should reject with a proper error when expand hasOne fails", function () {
            sinon.stub(adapter.service, "find", function () {
                var dfd = $q.defer();
                dfd.resolve([{id: 1, name: "John", otherId: 1}]);
                return dfd.promise;
            });
            sinon.stub(adapter.service, "findOne", function () {
                return $q.reject("Error");
            });

            var response = {};
            var options = new PreparedQueryOptions().$expand("association");

            adapter.find(model, options).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when expand hasMany fails", function () {
            sinon.stub(adapter.service, "find", function () {
                var dfd = $q.defer();
                dfd.resolve([{id: 1, name: "John"}]);
                return dfd.promise;
            });
            sinon.stub(adapter.service, "findByAssociation", function () {
                return $q.reject("Error");
            });

            var response = {};
            var options = new PreparedQueryOptions().$expand("many");

            adapter.find(model, options).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when connection fails", function () {
            sinon.stub(adapter.service, "connect", function () {
                return $q.reject("Error");
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
        it("Should return a promise", function () {
            var promise = adapter.update(model, 1, {name: "John"});
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(adapter.service, "update", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });

            var response = {};

            adapter.update(model, 1, {name: "John"}).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should reject with a proper error when nothing is found", function () {
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve(null);
                return dfd.promise;
            });
            sinon.stub(adapter.service, "update", function () {
                var dfd = $q.defer();
                dfd.resolve(null);
                return dfd.promise;
            });

            var response = {};

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
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(adapter.service, "update", function () {
                return $q.reject("Error");
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

        it("Should reject with a proper error when connection fails", function () {
            sinon.stub(adapter.service, "connect", function () {
                return $q.reject("Error");
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
        it("Should return a promise", function () {
            var promise = adapter.remove(model, 1);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(adapter.service, "remove", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });

            var response = {};

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
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(adapter.service, "update", function () {
                return $q.reject("Error");
            });

            var response = {};

            adapter.remove(model, 1, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when nothing is found", function () {
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve(null);
                return dfd.promise;
            });

            var response = {};

            adapter.remove(model, 1, {name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Not Found");
            response.count.should.equal(0);
            response.status.should.equal(404);
        });

        it("Should reject with a proper error when connection fails", function () {
            sinon.stub(adapter.service, "connect", function () {
                return $q.reject("Error");
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
        it("Should return a promise", function () {
            var promise = adapter.synchronize(model, []);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            sinon.stub(adapter, "syncInstance", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(adapter, "getSyncList", function () {
                var dfd = $q.defer();
                dfd.resolve([{id: 1, name: "John"}]);
                return dfd.promise;
            });

            var response = {};

            adapter.synchronize(model, [{id: 1, name: "John"}, {id: 2, name: "Steve", deleted: true}]).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data[0].name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should resolve a proper response when no items are successfully synchronized", function () {
            sinon.stub(adapter, "syncInstance", function () {
                var dfd = $q.defer();
                dfd.resolve(null);
                return dfd.promise;
            });
            sinon.stub(adapter, "getSyncList", function () {
                var dfd = $q.defer();
                dfd.resolve([{id: 1, name: "John"}]);
                return dfd.promise;
            });

            var response = {};

            adapter.synchronize(model, [{id: 1, name: "John"}]).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data[0].name.should.equal("John");
            response.count.should.equal(1);
            response.status.should.equal(200);
        });

        it("Should not return items that have just been synchronized", function () {
            var theIgnoreList = null;
            sinon.stub(adapter, "syncInstance", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(adapter, "getSyncList", function (db, theModel, lastSync, ignoreList) {
                theIgnoreList = ignoreList;
                var dfd = $q.defer();
                dfd.resolve([{id: 1, name: "John"}, {id: 2, name: "Steve"}]);
                return dfd.promise;
            });

            var response = {};

            adapter.synchronize(model, [{id: 1, name: "John"}]).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            theIgnoreList.length.should.equal(1);
            theIgnoreList[0].should.equal(1);
        });

        it("Should reject with a proper error", function () {
            sinon.stub(adapter, "syncInstance", function () {
                return $q.reject("Error");
            });

            var response = {};

            adapter.synchronize(model, [{id: 1, name: "John"}]).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when getSyncList fails", function () {
            sinon.stub(adapter, "syncInstance", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(adapter, "getSyncList", function () {
                return $q.reject("Error");
            });

            var response = {};

            adapter.synchronize(model).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });

        it("Should reject with a proper error when connection fails", function () {
            sinon.stub(adapter.service, "connect", function () {
                return $q.reject("Error");
            });

            var response = {};

            adapter.synchronize(model, [{id: 1, name: "John"}]).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.data.should.equal("Error");
            response.count.should.equal(0);
            response.status.should.equal(500);
        });
    });

    describe("syncInstance", function () {
        it("Should return a promise", function () {
            var promise = adapter.syncInstance(model, []);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response on update", function () {
            sinon.stub(mockService, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(mockService, "update", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(BaseClientSideAdapter, "resultMatchesFilters", function () {
                return true;
            });

            var response = {};

            adapter.syncInstance({}, model, 1, {id: 1, name: "John"}).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.name.should.equal("John");
        });

        it("Should resolve a proper response on delete", function () {
            sinon.stub(mockService, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(mockService, "remove", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(BaseClientSideAdapter, "resultMatchesFilters", function () {
                return true;
            });

            var response = {};

            adapter.syncInstance({}, model, 1, {id: 1, name: "John", deleted: true}, true).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.name.should.equal("John");
        });

        it("Should resolve a proper response on remove", function () {
            sinon.stub(mockService, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(mockService, "update", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(BaseClientSideAdapter, "resultMatchesFilters", function () {
                return true;
            });

            var response = {};

            adapter.syncInstance({}, model, 1, {id: 1, name: "John", deleted: true}).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.name.should.equal("John");
        });

        it("Should resolve a proper response on create", function () {
            sinon.stub(mockService, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            });
            sinon.stub(mockService, "create", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(BaseClientSideAdapter, "resultMatchesFilters", function () {
                return true;
            });

            var response = {};

            adapter.syncInstance({}, model, 1, {id: 1, name: "John"}).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.name.should.equal("John");
        });

        it("Should reject with a proper error on update", function () {
            sinon.stub(mockService, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(mockService, "update", function () {
                return $q.reject("Error");
            });
            sinon.stub(BaseClientSideAdapter, "resultMatchesFilters", function () {
                return true;
            });

            var response = {};

            adapter.syncInstance({}, model, 1, {id: 1, name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });

        it("Should reject with a proper error on delete", function () {
            sinon.stub(mockService, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(mockService, "remove", function () {
                return $q.reject("Error");
            });
            sinon.stub(BaseClientSideAdapter, "resultMatchesFilters", function () {
                return true;
            });

            var response = {};

            adapter.syncInstance({}, model, 1, {id: 1, name: "John", deleted: true}, true).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });

        it("Should reject with a proper error on remove", function () {
            sinon.stub(mockService, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(mockService, "update", function () {
                return $q.reject("Error");
            });
            sinon.stub(BaseClientSideAdapter, "resultMatchesFilters", function () {
                return true;
            });

            var response = {};

            adapter.syncInstance({}, model, 1, {id: 1, name: "John", deleted: true}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });

        it("Should reject with a proper error on create", function () {
            sinon.stub(mockService, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            });
            sinon.stub(mockService, "create", function () {
                return $q.reject("Error");
            });
            sinon.stub(BaseClientSideAdapter, "resultMatchesFilters", function () {
                return true;
            });

            var response = {};

            adapter.syncInstance({}, model, 1, {id: 1, name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });

        it("Should resolve a proper response when the stored result has been modified after the input result", function () {
            sinon.stub(mockService, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(mockService, "update", function () {
                var dfd = $q.defer();
                dfd.resolve({id: 1, name: "John"});
                return dfd.promise;
            });
            sinon.stub(BaseClientSideAdapter, "resultMatchesFilters", function () {
                return false;
            });

            var response = {};

            adapter.syncInstance({}, model, 1, {id: 1, name: "John"}).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            should.equal(response, null);
        });

        it("Should reject with a proper error", function () {
            sinon.stub(mockService, "findOne", function () {
                return $q.reject("Error");
            });

            var response = {};

            adapter.syncInstance({}, model, 1, {id: 1, name: "John"}).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("GetSyncList", function () {
        it("Should return a promise", function () {
            var promise = adapter.getSyncList({}, model);
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve a proper response", function () {
            sinon.stub(adapter.service, "find", function () {
                var dfd = $q.defer();
                dfd.resolve([{id: 1, name: "John"}]);
                return dfd.promise;
            });
            sinon.stub(BaseClientSideAdapter, "resultMatchesFilters", function () {
                return true;
            });

            var response = {};

            adapter.getSyncList({}, model).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response[0].name.should.equal("John");
        });

        it("Should resolve a proper response when there is a last sync time", function () {
            sinon.stub(adapter.service, "find", function () {
                var dfd = $q.defer();
                dfd.resolve([{id: 1, name: "John"}]);
                return dfd.promise;
            });
            sinon.stub(BaseClientSideAdapter, "resultMatchesFilters", function () {
                return true;
            });

            var response = {};

            adapter.getSyncList({}, model, 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response[0].name.should.equal("John");
        });

        it("Should resolve a proper response when the result was modified before the lastSync", function () {
            sinon.stub(adapter.service, "find", function () {
                var dfd = $q.defer();
                dfd.resolve([{id: 1, name: "John"}]);
                return dfd.promise;
            });
            sinon.stub(BaseClientSideAdapter, "resultMatchesFilters", function () {
                return false;
            });

            var response = {};

            adapter.getSyncList({}, model, 1).then(function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.length.should.equal(0);
        });

        it("Should reject with a proper error", function () {
            sinon.stub(adapter.service, "find", function () {
                return $q.reject("Error");
            });

            var response = {};

            adapter.getSyncList({}, model).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("ExpandHasOne", function () {
        it("Should return a promise", function () {
            var association = {
                mappedBy: 'fk',
                alias: "alias"
            };
            var promise = adapter.expandHasOne(model, {}, association, {}, []);
            should.equal(isFunc(promise.then), true);
        });

        it("Should add the result to the instance", function () {
            var association = {
                mappedBy: 'fk',
                alias: "alias"
            };
            var instance = {fk: 1};
            var result = {id: 1, name: "John"};
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve(result);
                return dfd.promise;
            });

            adapter.expandHasOne(model, instance, association, {}, []).then(null, function (e) {
                throw e;
            });
            $timeout.flush();
            $rootScope.$apply();

            instance.alias.should.equal(result);
        });

        it("Should expand the next level", function () {
            var association = {
                mappedBy: 'fk',
                alias: "alias"
            };
            var instance = {fk: 1};
            var result = {id: 1, name: "John"};
            var db = {};
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve(result);
                return dfd.promise;
            });
            sinon.stub(adapter, "expandPath", function () {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            });

            adapter.expandHasOne(model, instance, association, db, ["level1", "level2", "level3"]).then(null, function (e) {
                throw e;
            });
            $timeout.flush();
            $rootScope.$apply();

            adapter.expandPath.calledWith(result, model, "level2.level3", db).should.equal(true);
        });

        it("Should set the instance alias to null if the instance does not have the fk", function () {
            var association = {
                mappedBy: 'fk',
                alias: "alias"
            };
            var instance = {foo: 1};
            var result = {id: 1, name: "John"};
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve(result);
                return dfd.promise;
            });

            adapter.expandHasOne(model, instance, association, {}, []).then(null, function (e) {
                throw e;
            });
            $timeout.flush();
            $rootScope.$apply();

            should.equal(instance.alias, null);
        });

        it("Should set the instance alias to null if no result is found", function () {
            var association = {
                mappedBy: 'fk',
                alias: "alias"
            };
            var instance = {foo: 1};
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve(null);
                return dfd.promise;
            });

            adapter.expandHasOne(model, instance, association, {}, []).then(null, function (e) {
                throw e;
            });
            $timeout.flush();
            $rootScope.$apply();

            should.equal(instance.alias, null);
        });

        it("Should set the instance alias to null if the result has been deleted", function () {
            var association = {
                mappedBy: 'fk',
                alias: "alias"
            };
            var instance = {foo: 1};
            var result = {id: 1, name: "John", deleted: true};
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve(result);
                return dfd.promise;
            });

            adapter.expandHasOne(model, instance, association, {}, []).then(null, function (e) {
                throw e;
            });
            $timeout.flush();
            $rootScope.$apply();

            should.equal(instance.alias, null);
        });

        it("Should reject with a proper error when expanding the next level fails", function () {
            var association = {
                mappedBy: 'fk',
                alias: "alias"
            };
            var instance = {fk: 1};
            var result = {id: 1, name: "John"};
            var db = {};
            sinon.stub(adapter.service, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve(result);
                return dfd.promise;
            });
            sinon.stub(adapter, "expandPath", function () {
                return $q.reject("Error");
            });

            var response = {};

            adapter.expandHasOne(model, instance, association, db, ["level1", "level2", "level3"]).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });

        it("Should reject with a proper error", function () {
            var association = {
                mappedBy: 'fk',
                alias: "alias"
            };
            var instance = {fk: 1};
            sinon.stub(adapter.service, "findOne", function () {
                return $q.reject("Error");
            });

            var response = {};

            adapter.expandHasOne(model, instance, association, {}, []).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("ExpandHasMany", function () {
        it("Should return a promise", function () {
            var association = {
                mappedBy: 'fk',
                alias: "alias",
                getOptions: function () { return new PreparedQueryOptions(); }
            };
            var promise = adapter.expandHasMany(model, {}, association, {}, []);
            should.equal(isFunc(promise.then), true);
        });

        it("Should add the result to the instance", function () {
            var association = {
                mappedBy: 'fk',
                alias: "alias",
                getOptions: function () { return new PreparedQueryOptions(); }
            };
            var instance = {fk: 1};
            var result = [{id: 1, name: "John"}];
            sinon.stub(adapter.service, "findByAssociation", function () {
                var dfd = $q.defer();
                dfd.resolve(result);
                return dfd.promise;
            });

            adapter.expandHasMany(model, instance, association, {}, []).then(null, function (e) {
                throw e;
            });
            $timeout.flush();
            $rootScope.$apply();

            instance.alias.should.equal(result);
        });

        it("Should use the association options to filter the results", function () {
            var association = {
                mappedBy: 'fk',
                alias: "alias",
                getOptions: function () { return new PreparedQueryOptions().$filter(new Predicate("name").equals("John")); }
            };
            var instance = {fk: 1};
            var result = [{id: 1, name: "John"}, {id: 2, name: "Steve"}];
            sinon.stub(adapter.service, "findByAssociation", function () {
                var dfd = $q.defer();
                dfd.resolve(result);
                return dfd.promise;
            });

            adapter.expandHasMany(model, instance, association, {}, []).then(null, function (e) {
                throw e;
            });
            $timeout.flush();
            $rootScope.$apply();

            instance.alias.length.should.equal(1);
            instance.alias[0].name.should.equal("John");
        });

        it("Should expand the next level", function () {
            var association = {
                mappedBy: 'fk',
                alias: "alias",
                getOptions: function () { return new PreparedQueryOptions(); }
            };
            var instance = {fk: 1};
            var result = [{id: 1, name: "John"}];
            var db = {};
            sinon.stub(adapter.service, "findByAssociation", function () {
                var dfd = $q.defer();
                dfd.resolve(result);
                return dfd.promise;
            });
            sinon.stub(adapter, "expandPath", function () {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            });

            adapter.expandHasMany(model, instance, association, db, ["level1", "level2", "level3"]).then(null, function (e) {
                throw e;
            });
            $timeout.flush();
            $rootScope.$apply();

            adapter.expandPath.calledWith(result[0], model, "level2.level3", db).should.equal(true);
        });

        it("Should set the instance alias to an empty array if no results are found", function () {
            var association = {
                mappedBy: 'fk',
                alias: "alias",
                getOptions: function () { return new PreparedQueryOptions(); }
            };
            var instance = {foo: 1};
            sinon.stub(adapter.service, "findByAssociation", function () {
                var dfd = $q.defer();
                dfd.resolve([]);
                return dfd.promise;
            });

            adapter.expandHasMany(model, instance, association, {}, []).then(null, function (e) {
                throw e;
            });
            $timeout.flush();
            $rootScope.$apply();

            instance.alias.length.should.equal(0);
        });

        it("Should reject with a proper error when expanding the next level fails", function () {
            var association = {
                mappedBy: 'fk',
                alias: "alias",
                getOptions: function () { return new PreparedQueryOptions(); }
            };
            var instance = {fk: 1};
            var result = [{id: 1, name: "John"}];
            var db = {};
            sinon.stub(adapter.service, "findByAssociation", function () {
                var dfd = $q.defer();
                dfd.resolve(result);
                return dfd.promise;
            });
            sinon.stub(adapter, "expandPath", function () {
                return $q.reject("Error");
            });

            var response = {};

            adapter.expandHasMany(model, instance, association, db, ["level1", "level2", "level3"]).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });

        it("Should reject with a proper error", function () {
            var association = {
                mappedBy: 'fk',
                alias: "alias",
                getOptions: function () { return new PreparedQueryOptions(); }
            };
            var instance = {fk: 1};
            sinon.stub(adapter.service, "findByAssociation", function () {
                return $q.reject("Error");
            });

            var response = {};

            adapter.expandHasMany(model, instance, association, {}, []).then(null, function (res) {
                response = res;
            });
            $timeout.flush();
            $rootScope.$apply();

            response.should.equal("Error");
        });
    });

    describe("ExpandPath", function () {
        it("Should return a promise", function () {
            var promise = adapter.expandPath({}, model, "", {});
            should.equal(isFunc(promise.then), true);
        });

        it("Should resolve if there is no association found", function () {
            var mockModel = {
                getAssociationByAlias: function () {
                    return false;
                }
            };
            adapter.expandPath({}, mockModel, "", {}).then(null, function (e) {
                throw e;
            });
            $timeout.flush();
            $rootScope.$apply();
        });

        it("Should call expandHasOne if the association type is hasOne", function () {
            var association = {
                getModel: function () { return model; },
                type: "hasOne"
            };
            var mockModel = {
                getAssociationByAlias: function () {
                    return association;
                }
            };

            sinon.stub(adapter, "expandHasOne", function () {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            });

            var db = {};
            var result = {id: 1};
            var pathsToExpand = "test";
            adapter.expandPath(result, mockModel, pathsToExpand, db).then(null, function (e) {
                throw e;
            });
            $timeout.flush();
            $rootScope.$apply();

            adapter.expandHasOne.calledWith(model, result, association, db).should.equal(true);
        });

        it("Should call expandHasMany if the association type is hasMany", function () {
            var association = {
                getModel: function () { return model; },
                type: "hasMany"
            };
            var mockModel = {
                getAssociationByAlias: function () {
                    return association;
                }
            };

            sinon.stub(adapter, "expandHasMany", function () {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            });

            var db = {};
            var result = {id: 1};
            var pathsToExpand = "test";
            adapter.expandPath(result, mockModel, pathsToExpand, db).then(null, function (e) {
                throw e;
            });
            $timeout.flush();
            $rootScope.$apply();

            adapter.expandHasMany.calledWith(model, result, association, db).should.equal(true);
        });

        it("Should not expand if the association type is unknown", function () {
            var association = {
                getModel: function () { return model; },
                type: "foo"
            };
            var mockModel = {
                getAssociationByAlias: function () {
                    return association;
                }
            };

            sinon.stub(adapter, "expandHasMany");
            sinon.stub(adapter, "expandHasOne");

            var db = {};
            var result = {id: 1};
            var pathsToExpand = "test";
            adapter.expandPath(result, mockModel, pathsToExpand, db).then(null, function (e) {
                throw e;
            });
            $timeout.flush();
            $rootScope.$apply();

            adapter.expandHasMany.called.should.equal(false);
            adapter.expandHasOne.called.should.equal(false);
        });
    });
});
