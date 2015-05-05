/*globals describe, sinon, beforeEach, afterEach, module, inject, it, should*/
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
            modelName: 'modelName',
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
        should.equal(isFunc(adapter.create), true);
        should.equal(isFunc(adapter.findOne), true);
        should.equal(isFunc(adapter.find), true);
        should.equal(isFunc(adapter.update), true);
        should.equal(isFunc(adapter.remove), true);
        should.equal(isFunc(adapter.synchronize), true);
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

        it("Should pass if all goes well", inject(function ($injector) {
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

    describe("Synchronize", function () {
        beforeEach(inject(function ($injector) {
            adapter = $injector.invoke(provider.$get);
        }));

        it("Should get the lastSyncTime from local storage", inject(function ($injector, $q, recallLocalStorage) {
            var date = new Date().toISOString();
            sinon.stub(recallLocalStorage, 'get').returns(date);
            sinon.stub(master, "synchronize", function () {
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });
            sinon.stub(slave, "find", function (model, options, ignoreDelete) {
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });

            adapter.synchronize(model);
            $rootScope.$apply();

            recallLocalStorage.get.calledWith(recallLocalStorage.keys.LAST_SYNC, model.modelName).should.equal(true);
        }));

        it("Should call find on the slave with the correct args for each model", inject(function ($q, recallLocalStorage) {
            sinon.stub(recallLocalStorage, 'get').returns(null);
            var queryOptions;

            sinon.stub(master, "synchronize", function () {
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });
            sinon.stub(slave, "find", function (model, options, ignoreDelete) {
                queryOptions = options;
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });

            adapter.synchronize([model, model]);
            $rootScope.$apply();

            slave.find.calledWith(model, queryOptions, true).should.equal(true);
        }));

        it("Should call find on the slave with the correct args", inject(function ($q, recallLocalStorage) {
            sinon.stub(recallLocalStorage, 'get').returns(null);
            var queryOptions;

            sinon.stub(master, "synchronize", function () {
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });
            sinon.stub(slave, "find", function (model, options, ignoreDelete) {
                queryOptions = options;
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });

            adapter.synchronize(model);
            $rootScope.$apply();

            slave.find.calledWith(model, queryOptions, true).should.equal(true);
        }));

        it("Should clear the last sync time when forcing for each model", inject(function ($q, recallLocalStorage) {
            sinon.stub(recallLocalStorage, 'remove');
            sinon.stub(recallLocalStorage, 'get').returns(null);
            var queryOptions;

            sinon.stub(master, "synchronize", function () {
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });
            sinon.stub(slave, "find", function (model, options, ignoreDelete) {
                queryOptions = options;
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });

            adapter.synchronize([model, model], true);
            $rootScope.$apply();

            recallLocalStorage.remove.calledWith(recallLocalStorage.keys.LAST_SYNC, model.modelName);
        }));

        it("Should clear the last sync time when forcing", inject(function ($q, recallLocalStorage) {
            sinon.stub(recallLocalStorage, 'remove');
            sinon.stub(recallLocalStorage, 'get').returns(null);
            var queryOptions;

            sinon.stub(master, "synchronize", function () {
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });
            sinon.stub(slave, "find", function (model, options, ignoreDelete) {
                queryOptions = options;
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });

            adapter.synchronize(model, true);
            $rootScope.$apply();

            recallLocalStorage.remove.calledWith(recallLocalStorage.keys.LAST_SYNC, model.modelName);
        }));

        it("Should fetch all the items from the slave that have been modified since the lastSyncTime", inject(function ($q, recallLocalStorage) {
            var date = new Date().toISOString();
            sinon.stub(recallLocalStorage, 'get').returns(date);
            var queryOptions;

            sinon.stub(master, "synchronize", function () {
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });
            sinon.stub(slave, "find", function (model, options, ignoreDelete) {
                queryOptions = options;
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });

            adapter.synchronize(model);
            $rootScope.$apply();

            queryOptions.$filter().parsePredicate().should.equal("lastModified ge '" + date + "'");
        }));

        it("Should fetch all items if no last sync is found", inject(function ($q, recallLocalStorage) {
            sinon.stub(recallLocalStorage, 'get').returns(null);
            var queryOptions;

            sinon.stub(master, "synchronize", function () {
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });
            sinon.stub(slave, "find", function (model, options, ignoreDelete) {
                queryOptions = options;
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });

            adapter.synchronize(model);
            $rootScope.$apply();

            should.equal(null, queryOptions.$filter());
        }));

        it("Should increment the total count with the number of items found from the slave", inject(function ($q, recallLocalStorage) {
            sinon.stub(recallLocalStorage, 'get').returns(null);
            var result;
            var data = [{id: 1}];

            sinon.stub(master, "synchronize", function () {
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });
            sinon.stub(slave, "find", function () {
                var dfd = $q.defer();
                dfd.resolve({data: data, count: 1});
                return dfd.promise;
            });

            adapter.synchronize(model).then(function (syncResult) {
                result = syncResult;
            });
            $rootScope.$apply();

            result.sent.should.equal(data);
            result.returned.length.should.equal(0);
            result.totalProcessed.should.equal(1);
            result.status.should.equal("Complete");
        }));

        it("Should reject with an error when the slave find fails", inject(function ($q, recallLocalStorage) {
            sinon.stub(recallLocalStorage, 'get').returns(null);
            var result;

            sinon.stub(slave, "find", function () {
                var dfd = $q.defer();
                dfd.reject("error");
                return dfd.promise;
            });

            adapter.synchronize(model).then(null, function (syncResult) {
                result = syncResult;
            });
            $rootScope.$apply();

            result.sent.length.should.equal(0);
            result.returned.length.should.equal(0);
            result.totalProcessed.should.equal(0);
            result.status.should.equal("error");
        }));

        it("Should call synchronize on the master with the correct args", inject(function ($q, recallLocalStorage) {
            var date = new Date().toDateString();
            sinon.stub(recallLocalStorage, 'get').returns(date);
            var data= [{id: '1'}];

            sinon.stub(master, "synchronize", function () {
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });
            sinon.stub(slave, "find", function () {
                var dfd = $q.defer();
                dfd.resolve({data: data, count: data.length});
                return dfd.promise;
            });

            adapter.synchronize(model);
            $rootScope.$apply();

            master.synchronize.calledWith(model, data, date).should.equal(true);
        }));

        it("Should increment the total count with the number of items found from the slave", inject(function ($q, recallLocalStorage) {
            sinon.stub(recallLocalStorage, 'get').returns(null);
            var result;
            var data = [{id: 1}];

            sinon.stub(master, "synchronize", function () {
                var dfd = $q.defer();
                dfd.resolve({data: data, count: data.length});
                return dfd.promise;
            });
            sinon.stub(slave, "synchronize", function () {
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });
            sinon.stub(slave, "find", function () {
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });

            adapter.synchronize(model).then(function (syncResult) {
                result = syncResult;
            });
            $rootScope.$apply();

            result.sent.length.should.equal(0);
            result.returned.should.equal(data);
            result.totalProcessed.should.equal(1);
            result.status.should.equal("Complete");
        }));

        it("Should call synchronize on the slave when the master returned data", inject(function ($q, recallLocalStorage) {
            var date = new Date().toDateString();
            sinon.stub(recallLocalStorage, 'get').returns(date);
            var data = [{id: 1}];

            sinon.stub(master, "synchronize", function () {
                var dfd = $q.defer();
                dfd.resolve({data: data, count: data.length});
                return dfd.promise;
            });
            sinon.stub(slave, "synchronize", function () {
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });
            sinon.stub(slave, "find", function () {
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });

            adapter.synchronize(model);
            $rootScope.$apply();

            slave.synchronize.calledOnce.should.equal(true);
            slave.synchronize.calledWith(model, data, date).should.equal(true);
        }));

        it("Should not call synchronize on the slave when the master does not return data", inject(function ($q, recallLocalStorage) {
            sinon.stub(recallLocalStorage, 'get').returns(null);
            var data = [];

            sinon.stub(master, "synchronize", function () {
                var dfd = $q.defer();
                dfd.resolve({data: data, count: data.length});
                return dfd.promise;
            });
            sinon.stub(slave, "synchronize", function () {
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });
            sinon.stub(slave, "find", function () {
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });

            adapter.synchronize(model);
            $rootScope.$apply();

            slave.synchronize.called.should.equal(false);
        }));

        it("Should reject with an error when the master synchronize fails", inject(function ($q, recallLocalStorage) {
            sinon.stub(recallLocalStorage, 'get').returns(null);
            var result;

            sinon.stub(master, "synchronize", function () {
                var dfd = $q.defer();
                dfd.reject("error");
                return dfd.promise;
            });
            sinon.stub(slave, "find", function () {
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });

            adapter.synchronize(model).then(null, function (syncResult) {
                result = syncResult;
            });
            $rootScope.$apply();

            result.sent.length.should.equal(0);
            result.returned.length.should.equal(0);
            result.totalProcessed.should.equal(0);
            result.status.should.equal("error");
        }));

        it("Should reject with an error when the slave synchronize fails", inject(function ($q, recallLocalStorage) {
            sinon.stub(recallLocalStorage, 'get').returns(null);
            var result;
            var data = [{id: '1'}];

            sinon.stub(master, "synchronize", function () {
                var dfd = $q.defer();
                dfd.resolve({data: data, count: data.length});
                return dfd.promise;
            });
            sinon.stub(slave, "synchronize", function () {
                var dfd = $q.defer();
                dfd.reject('error');
                return dfd.promise;
            });
            sinon.stub(slave, "find", function () {
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });

            adapter.synchronize(model).then(null, function (syncResult) {
                result = syncResult;
            });
            $rootScope.$apply();

            result.sent.length.should.equal(0);
            result.returned.should.equal(data);
            result.totalProcessed.should.equal(1);
            result.status.should.equal("error");
        }));

        it("Should update the last sync time on success", inject(function ($q, recallLocalStorage) {
            var newDate;
            sinon.stub(recallLocalStorage, 'get').returns(null);
            sinon.stub(recallLocalStorage, 'set', function (key, date, modelName) {
                newDate = date;
            });
            var data = [{id: '1'}];

            sinon.stub(master, "synchronize", function () {
                var dfd = $q.defer();
                dfd.resolve({data: data, count: data.length});
                return dfd.promise;
            });
            sinon.stub(slave, "synchronize", function () {
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });
            sinon.stub(slave, "find", function () {
                var dfd = $q.defer();
                dfd.resolve({data: [], count: 0});
                return dfd.promise;
            });

            adapter.synchronize(model);
            $rootScope.$apply();

            recallLocalStorage.set.calledWith(recallLocalStorage.keys.LAST_SYNC, newDate, model.modelName).should.equal(true);
        }));
    });
});