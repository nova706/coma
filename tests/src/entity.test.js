/*globals describe, sinon, beforeEach, module, inject, it, should*/
describe("Entity", function () {

    var Entity;
    var testModel;
    var testAdapter;
    var $rootScope;
    var $q;
    var fieldValidatorResponse;

    var isWithinRange = function (actual, expected, range) {
        return actual > expected - range && actual < expected + range;
    };

    var resolvedPromiseFunction = function () {
        var dfd = $q.defer();
        dfd.resolve();
        return dfd.promise;
    };

    var personModelDefinition = {
        name: "person",
        dataSourceName: "people",
        fields: {
            id: {
                primaryKey: true,
                type: "String"
            },
            firstName: {
                type: "String",
                index: "firstName",
                notNull: true
            },
            lastName: {
                type: "String",
                validate: function () {
                    return fieldValidatorResponse;
                }
            },
            awesome: "Boolean",
            age: "Number",
            added: {
                type: "Date",
                getDefaultValue: function () {
                    return new Date();
                },
                index: true
            }
        },
        associations: [
            {
                hasMany: 'phoneNumber',
                as: 'phoneNumbers',
                mappedBy: 'personId'
            }
        ]
    };

    beforeEach(module('recall'));

    beforeEach(inject(function(_$rootScope_, _$q_, recall, recallEntity) {
        $rootScope = _$rootScope_;
        $q = _$q_;
        Entity = recallEntity;
        testAdapter = {
            create: resolvedPromiseFunction,
            findOne: resolvedPromiseFunction,
            find: resolvedPromiseFunction,
            update: resolvedPromiseFunction,
            remove: resolvedPromiseFunction
        };
        testModel = recall.defineModel(personModelDefinition, testAdapter);
        fieldValidatorResponse = true;
    }));

    describe("New Entity", function () {
        it("Should extend the entity with the object passed in", function () {
            var entity = new Entity({id: '1'}, testModel);

            entity.id.should.equal('1');
        });

        it("Should initialize the $entity properties", function () {
            var entity = new Entity({id: '1'}, testModel);

            isWithinRange(entity.$entity.lastDirtyCheck, new Date().getTime(), 100).should.equal(true);
            entity.$entity.lastDirtyState.should.equal(false);
            entity.$entity.persisted.should.equal(false);
            entity.$entity.saveInProgress.should.equal(false);
        });

        it("Should add the model as a reference on the entity", function () {
            var entity = new Entity({id: '1'}, testModel);

            entity.$model.should.equal(testModel);
        });

        it("Should store the state of the entity", function () {
            var entity = new Entity({id: '1'}, testModel);

            entity.$entity.storedState.id.should.equal('1');
        });
    });

    describe("$getPrimaryKey", function () {
        it("Should return the primary key of the entity", function () {
            var entity = new Entity({id: '1'}, testModel);

            entity.$getPrimaryKey().should.equal('1');
        });
    });

    describe("$expand", function () {
        it("Should get the association", function () {
            var entity = new Entity({id: '1'}, testModel);

            sinon.stub(entity.$model, "getAssociationByAlias").returns(null);
            entity.$expand('test');

            entity.$model.getAssociationByAlias.calledWith('test').should.equal(true);
        });

        it("Should reject if the association does not exist", function () {
            var entity = new Entity({id: '1'}, testModel);
            var rejected = false;

            entity.$expand('test').then(null, function () {
                rejected = true;
            });
            $rootScope.$apply();

            rejected.should.equal(true);
        });

        it("Should call expand on the association", function () {
            var entity = new Entity({id: '1'}, testModel);
            var expandCalled = false;

            var association = {
                expand: function () {
                    expandCalled = true;
                }
            };

            sinon.stub(entity.$model, "getAssociationByAlias").returns(association);
            entity.$expand('test');

            expandCalled.should.equal(true);
        });
    });

    describe("$isValid", function () {
        it("Should return true if all fields are valid", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);

            entity.$isValid().should.equal(true);
        });

        it("Should return false if a NotNull field is null", function () {
            var entity = new Entity({
                id: '1',
                firstName: null,
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);

            entity.$isValid().should.equal(false);
        });

        it("Should return false if a NotNull field is undefined", function () {
            var entity = new Entity({
                id: '1',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);

            entity.$isValid().should.equal(false);
        });

        it("Should return false if a String field is not a String", function () {
            var entity = new Entity({
                id: 1,
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);

            entity.$isValid().should.equal(false);
        });

        it("Should return false if a Number field is not a Number", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: '21',
                added: new Date()
            }, testModel);

            entity.$isValid().should.equal(false);
        });

        it("Should return false if a Boolean field is not a Boolean", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: 'true',
                age: 21,
                added: new Date()
            }, testModel);

            entity.$isValid().should.equal(false);
        });

        it("Should return false if a Date field is not a Date", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: '2015-3-10'
            }, testModel);

            entity.$isValid().should.equal(false);
        });

        it("Should return false if a custom validator fails", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);
            fieldValidatorResponse = false;

            entity.$isValid().should.equal(false);
        });
    });

    describe("$save", function () {
        it("Should reject if the entity is not valid", function () {
            var rejected = false;
            var entity = new Entity({
                id: 1,
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel, true);

            entity.$save().then(null, function () {
                rejected = true;
            });
            $rootScope.$apply();

            rejected.should.equal(true);
        });

        it("Should set saveInProgress while saving", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel, true);

            entity.$save();

            entity.$entity.saveInProgress.should.equal(true);
        });

        it("Should call pre save on the model", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel, true);

            sinon.stub(entity.$model, "preSave").returns({id: '1'});

            entity.$save();

            entity.$model.preSave.calledWith(entity).should.equal(true);
        });

        it("Should call pre update if the save is an update", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel, true);

            sinon.stub(entity.$model, "preUpdate").returns({id: '1'});

            entity.$save();

            entity.$model.preUpdate.calledOnce.should.equal(true);
        });

        it("Should call update on the adapter", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel, true);

            var itemToSave = {id: '1'};
            var options = {};
            sinon.stub(entity.$model, "preUpdate").returns(itemToSave);
            sinon.stub(entity.$model.adapter, "update", function () {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            });

            entity.$save(options);

            entity.$model.adapter.update.calledWith(testModel, '1', itemToSave, options).should.equal(true);
        });

        it("Should call transformResult on update", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel, true);

            var response = {
                data: 'data'
            };
            sinon.stub(entity.$model, 'transformResult').returns('ok');
            sinon.stub(entity.$model.adapter, "update", function () {
                var dfd = $q.defer();
                dfd.resolve(response);
                return dfd.promise;
            });

            entity.$save();
            $rootScope.$apply();

            entity.$model.transformResult.calledWith(response.data).should.equal(true);
        });

        it("Should call extendFromRawObject on update", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel, true);

            var response = {
                data: 'data'
            };
            sinon.stub(entity.$model, 'extendFromRawObject').returns('ok');
            sinon.stub(entity.$model.adapter, "update", function () {
                var dfd = $q.defer();
                dfd.resolve(response);
                return dfd.promise;
            });

            entity.$save();
            $rootScope.$apply();

            entity.$model.extendFromRawObject.calledOnce.should.equal(true);
        });

        it("Should update the state on success of update", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel, true);

            entity.firstName = 'Steve';
            var response = {
                data: 'data'
            };
            sinon.stub(entity.$model.adapter, "update", function (model, pk, itemToSave) {
                var dfd = $q.defer();
                entity.firstName = itemToSave.firstName;
                response.data = entity;
                dfd.resolve(response);
                return dfd.promise;
            });

            entity.$save();
            $rootScope.$apply();

            entity.$entity.storedState.firstName.should.equal('Steve');
            entity.$entity.persisted.should.equal(true);
            entity.$entity.saveInProgress.should.equal(false);
        });

        it("Should update the state on fail of update", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel, true);

            entity.firstName = 'Steve';
            sinon.stub(entity.$model.adapter, "update", function (model, pk, itemToSave) {
                var dfd = $q.defer();
                dfd.reject();
                return dfd.promise;
            });

            entity.$save();
            $rootScope.$apply();

            entity.firstName.should.equal('John');
            entity.$entity.storedState.firstName.should.equal('John');
            entity.$entity.saveInProgress.should.equal(false);
        });

        it("Should call pre create if the save is an create", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);

            sinon.stub(entity.$model, "preCreate").returns({id: '1'});

            entity.$save();

            entity.$model.preCreate.calledOnce.should.equal(true);
        });

        it("Should call create on the adapter", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);

            var itemToSave = {id: '1'};
            var options = {};
            sinon.stub(entity.$model, "preCreate").returns(itemToSave);
            sinon.stub(entity.$model.adapter, "create", function () {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            });

            entity.$save(options);

            entity.$model.adapter.create.calledWith(testModel, itemToSave, options).should.equal(true);
        });

        it("Should call transformResult on create", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);

            var response = {
                data: 'data'
            };
            sinon.stub(entity.$model, 'transformResult').returns('ok');
            sinon.stub(entity.$model.adapter, "create", function () {
                var dfd = $q.defer();
                dfd.resolve(response);
                return dfd.promise;
            });

            entity.$save();
            $rootScope.$apply();

            entity.$model.transformResult.calledWith(response.data).should.equal(true);
        });

        it("Should call extendFromRawObject on create", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);

            var response = {
                data: 'data'
            };
            sinon.stub(entity.$model, 'extendFromRawObject').returns('ok');
            sinon.stub(entity.$model.adapter, "create", function () {
                var dfd = $q.defer();
                dfd.resolve(response);
                return dfd.promise;
            });

            entity.$save();
            $rootScope.$apply();

            entity.$model.extendFromRawObject.calledOnce.should.equal(true);
        });

        it("Should update the state on success of create", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);

            entity.firstName = 'Steve';
            sinon.stub(entity.$model.adapter, "create", function (model, itemToSave) {
                var dfd = $q.defer();
                dfd.resolve({data: itemToSave});
                return dfd.promise;
            });

            entity.$save();
            $rootScope.$apply();

            entity.$entity.storedState.firstName.should.equal('Steve');
            entity.$entity.persisted.should.equal(true);
            entity.$entity.saveInProgress.should.equal(false);
        });

        it("Should update the state on fail of create", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);

            entity.firstName = 'Steve';
            sinon.stub(entity.$model.adapter, "create", function (model, itemToSave) {
                return $q.reject();
            });

            entity.$save();
            $rootScope.$apply();

            entity.firstName.should.equal('John');
            entity.$entity.storedState.firstName.should.equal('John');
            entity.$entity.saveInProgress.should.equal(false);
        });
    });

    describe("$remove", function () {
        it("Should call remove on the adapter", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel, true);

            sinon.stub(entity.$model.adapter, "remove", function (model, pk, options) {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            });

            entity.$remove();
            $rootScope.$apply();

            entity.$model.adapter.remove.calledWith(entity.$model, '1').should.equal(true);
        });

        it("Should reject if no primary key is found on the entity", function () {
            var entity = new Entity({
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel, true);
            var rejected = false;

            entity.$remove().then(null, function () {
                rejected = true;
            });
            $rootScope.$apply();

            rejected.should.equal(true);
        });
    });

    describe("$storeState", function () {
        it("Should store the state of the entity", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);

            entity.firstName = 'Steve';
            entity.$storeState();

            entity.$entity.storedState.firstName.should.equal('Steve');
        });

        it("Should only store model fields", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);

            entity.otherProp = 'test';
            entity.$storeState();

            should.equal(undefined, entity.$entity.storedState.otherProp);
        });

        it("Should reset the dirty state", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);

            entity.firstName = 'Steve';
            entity.$entity.lastDirtyCheck = 'test';
            entity.$entity.lastDirtyState = true;
            entity.$storeState();

            isWithinRange(entity.$entity.lastDirtyCheck, new Date().getTime(), 100).should.equal(true);
            entity.$entity.lastDirtyState.should.equal(false);
        });
    });

    describe("$isDirty", function () {
        it("Should return false if a save is in progress", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);

            entity.$entity.saveInProgress = true;
            entity.$isDirty().should.equal(false);
        });

        it("Should return false if there is no stored state", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);

            entity.$entity.storedState = undefined;
            entity.$isDirty().should.equal(false);
        });

        it("Should only check if the last check is beyond the threshold", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);

            entity.$entity.lastDirtyState = 'test';
            entity.$isDirty().should.equal('test');

            entity.$entity.lastDirtyState = 'test';
            entity.$entity.lastDirtyCheck = new Date(new Date().getTime() - 100);
            entity.$isDirty().should.equal(false);
        });

        it("Should update the lastDirtyCheck", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);

            entity.$entity.lastDirtyState = 'test';
            entity.$entity.lastDirtyCheck = new Date(new Date().getTime() - 100);
            entity.$isDirty();

            entity.$entity.lastDirtyState.should.equal(false);
            isWithinRange(entity.$entity.lastDirtyCheck, new Date().getTime(), 100).should.equal(true);
        });

        it("Should return true if a property has changed", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);

            entity.firstName = 'Steve';
            entity.$entity.lastDirtyState = 'test';
            entity.$entity.lastDirtyCheck = new Date(new Date().getTime() - 100);
            entity.$isDirty().should.equal(true);
        });

        it("Should return false if no properties have changed", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);

            entity.$entity.lastDirtyState = 'test';
            entity.$entity.lastDirtyCheck = new Date(new Date().getTime() - 100);
            entity.$isDirty().should.equal(false);
        });
    });

    describe("$reset", function () {
        it("Should store the state if there is no stored state and return empty", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);

            delete entity.$entity.storedState;
            entity.firstName = 'Steve';
            var result = entity.$reset();

            entity.$entity.storedState.firstName.should.equal('Steve');
            result.length.should.equal(0);
        });

        it("Should reset the entity", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);

            entity.firstName = 'Steve';
            entity.$reset();

            entity.firstName.should.equal('John');
        });

        it("Should update the lastDirtyState", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);

            entity.$entity.lastDirtyCheck = 'test';
            entity.$entity.lastDirtyState = 'test';
            entity.$reset();

            isWithinRange(entity.$entity.lastDirtyCheck, new Date().getTime(), 100).should.equal(true);
            entity.$entity.lastDirtyState.should.equal(false);
        });

        it("Should return a list of properties that were reset", function () {
            var entity = new Entity({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                awesome: true,
                age: 21,
                added: new Date()
            }, testModel);

            entity.firstName = 'Steve';
            var result = entity.$reset();
            result.length.should.equal(1);
            result[0].name.should.equal('firstName');
            result[0].before.should.equal('Steve');
            result[0].after.should.equal('John');
        });
    });
});