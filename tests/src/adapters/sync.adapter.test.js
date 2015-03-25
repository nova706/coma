/*globals describe, beforeEach, afterEach, module, inject, it, should*/
describe("SyncAdapter", function () {
    var provider;
    var adapter;
    var PreparedQueryOptions;
    var $rootScope;
    var model;
    var master;
    var slave;
    var isFunc = function (a) {
        return typeof a === 'function';
    };

    beforeEach(module('recall.adapter.sync', function (recallSyncAdapterProvider) {
        model = {
            dataSourceName: "testEndpoint"
        };
        master = {
            create: function () {return 'master';},
            findOne: function () {return 'master';},
            find: function () {return 'master';},
            update: function () {return 'master';},
            remove: function () {return 'master';},
            synchronize: function () {return 'master';}
        };
        slave = {
            create: function () {return 'slave';},
            findOne: function () {return 'slave';},
            find: function () {return 'slave';},
            update: function () {return 'slave';},
            remove: function () {return 'slave';},
            synchronize: function () {return 'master';}
        };

        angular.module('recall.adapter.sync').factory('adapterInjectorTest', function () {
            return master;
        });

        recallSyncAdapterProvider.setSlave(slave);
        recallSyncAdapterProvider.setMaster(master);
        provider = recallSyncAdapterProvider;
    }));

    beforeEach(inject(function (recallPreparedQueryOptions, _$rootScope_) {
        PreparedQueryOptions = recallPreparedQueryOptions;
        $rootScope = _$rootScope_;
    }));

    it("Should provide the basic CRUD methods", inject(function ($injector) {
        adapter = $injector.invoke(provider.$get);
        should.equal(true, isFunc(adapter.create));
        should.equal(true, isFunc(adapter.findOne));
        should.equal(true, isFunc(adapter.find));
        should.equal(true, isFunc(adapter.update));
        should.equal(true, isFunc(adapter.remove));
    }));

    it("Should inject the master adapter if a string is provided", inject(function ($injector) {
        provider.setMaster('adapterInjectorTest');
        adapter = $injector.invoke(provider.$get);
        var result = adapter.modelValidationHook(model);
        should.equal(true, result);
    }));

    it("Should inject the slave adapter if a string is provided", inject(function ($injector) {
        provider.setSlave('adapterInjectorTest');
        adapter = $injector.invoke(provider.$get);
        var result = adapter.modelValidationHook(model);
        should.equal(true, result);
    }));

    describe("ModelValidationHook", function () {
        it("Should fail if no master adapter is provided", inject(function ($injector) {
            provider.setMaster(null);
            adapter = $injector.invoke(provider.$get);
            var result = adapter.modelValidationHook(model);
            should.equal(false, result);
        }));

        it("Should fail if no slave adapter is provided", inject(function ($injector) {
            provider.setSlave(null);
            adapter = $injector.invoke(provider.$get);
            var result = adapter.modelValidationHook(model);
            should.equal(false, result);
        }));

        it("Should fail if the master adapter does not have a synchronize method", inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
            delete master.synchronize;
            var result = adapter.modelValidationHook(model);
            should.equal(false, result);
        }));

        it("Should fail if the slave adapter does not have a synchronize method", inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
            delete slave.synchronize;
            var result = adapter.modelValidationHook(model);
            should.equal(false, result);
        }));

        it("Should fail if the master adapter fails model validation", inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
            master.modelValidationHook = function (model) {
                return false;
            };
            var result = adapter.modelValidationHook(model);
            should.equal(false, result);
        }));

        it("Should fail if the slave adapter fails model validation", inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
            slave.modelValidationHook = function (model) {
                return false;
            };
            var result = adapter.modelValidationHook(model);
            should.equal(false, result);
        }));

        it("Should pass if allgoes well", inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
            master.modelValidationHook = function (model) {
                return true;
            };
            slave.modelValidationHook = function (model) {
                return true;
            };
            var result = adapter.modelValidationHook(model);
            should.equal(true, result);
        }));
    });

    describe("Create", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
        }));

        it("Should call the slave adapter by default", function () {
            var called = adapter.create(model, {name: "John"});
            should.equal('slave', called);
        });

        it("Should call the master adapter if preferMaster is true in query options", function () {
            var queryOptions = new PreparedQueryOptions().preferMaster(true);
            var called = adapter.create(model, {name: "John"}, queryOptions);
            should.equal('master', called);
        });
    });

    describe("FindOne", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
        }));

        it("Should call the slave adapter by default", function () {
            var called = adapter.findOne(model, 1);
            should.equal('slave', called);
        });

        it("Should call the master adapter if preferMaster is true in query options", function () {
            var queryOptions = new PreparedQueryOptions().preferMaster(true);
            var called = adapter.findOne(model, 1, queryOptions);
            should.equal('master', called);
        });

        it("Should require the primary key", function () {
            var promiseFailed = false;
            adapter.findOne(model).then(null, function () {
                promiseFailed = true;
            });
            $rootScope.$apply();

            should.equal(true, promiseFailed);
        });
    });

    describe("Find", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
        }));

        it("Should call the slave adapter by default", function () {
            var called = adapter.find(model);
            should.equal('slave', called);
        });

        it("Should call the master adapter if preferMaster is true in query options", function () {
            var queryOptions = new PreparedQueryOptions().preferMaster(true);
            var called = adapter.find(model, queryOptions);
            should.equal('master', called);
        });
    });

    describe("Update", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
        }));

        it("Should call the slave adapter by default", function () {
            var called = adapter.update(model, 1, {name: "Steve"});
            should.equal('slave', called);
        });

        it("Should call the master adapter if preferMaster is true in query options", function () {
            var queryOptions = new PreparedQueryOptions().preferMaster(true);
            var called = adapter.update(model, 1, {name: "Steve"}, queryOptions);
            should.equal('master', called);
        });

        it("Should require the primary key", function () {
            var promiseFailed = false;
            adapter.update(model, null, {name: "Steve"}).then(null, function () {
                promiseFailed = true;
            });
            $rootScope.$apply();

            should.equal(true, promiseFailed);
        });
    });

    describe("Remove", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
        }));

        it("Should call the slave adapter by default", function () {
            var called = adapter.remove(model, 1);
            should.equal('slave', called);
        });

        it("Should call the master adapter if preferMaster is true in query options", function () {
            var queryOptions = new PreparedQueryOptions().preferMaster(true);
            var called = adapter.remove(model, 1, queryOptions);
            should.equal('master', called);
        });

        it("Should require the primary key", function () {
            var promiseFailed = false;
            adapter.remove(model).then(null, function () {
                promiseFailed = true;
            });
            $rootScope.$apply();

            should.equal(true, promiseFailed);
        });
    });
});