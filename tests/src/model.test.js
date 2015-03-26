/*globals describe, sinon, beforeEach, module, inject, it, should*/
describe("Model", function () {
    beforeEach(module('recall'));

    var $injector;
    var $q;
    var $rootScope;
    var Model;
    var testModelDefinition;
    var otherModelDefinition;
    var foreignModel;

    beforeEach(inject(function(_$injector_, _$q_, _$rootScope_, recallModel) {
        $injector = _$injector_;
        $q = _$q_;
        $rootScope = _$rootScope_;
        Model = recallModel;
        testModelDefinition = {
            name: "modelName",
            dataSourceName: "dataSourceName",
            fields: {
                id: {
                    primaryKey: true,
                    type: "String"
                },
                number: "Number",
                boolean: {
                    type: "Boolean",
                    index: "boolean"
                },
                otherModelId: "String"
            },
            associations: [
                {
                    hasOne: 'otherModel',
                    as: 'model',
                    foreignKey: 'modelId'
                }
            ],
            transformResult: function (o) { return o; },
            preSave: function (o) { return o; },
            preUpdate: function (o) { return o; },
            preCreate: function (o) { return o; }
        };
        otherModelDefinition = {
            name: "otherModel",
            fields: {
                id: {
                    primaryKey: true,
                    type: "String"
                },
                test: {
                    type: 'String',
                    getDefaultValue: function () {
                        return 'test';
                    }
                },
                test2: {
                    type: 'String',
                    getDefaultValue: function () {
                        return 'test2';
                    }
                }
            },
            associations: [
                {
                    hasMany: 'modelName',
                    as: 'models',
                    foreignKey: 'otherModelId'
                }
            ]
        };
        foreignModel = new Model(otherModelDefinition);
    }));

    describe("New Model", function () {
        it("Should initialize from a model definition", function () {
            var model = new Model(testModelDefinition);

            model.modelName.should.equal(testModelDefinition.name);
            model.dataSourceName.should.equal(testModelDefinition.dataSourceName);
            model.modelDefinition.should.equal(testModelDefinition);
            model.dirtyCheckThreshold.should.equal(30);
            should.equal(model.primaryKeyFieldName, null);
            should.equal(model.lastModifiedFieldName, null);
            should.equal(model.deletedFieldName, null);
            should.equal(model.adapter, null);
        });

        it("Should use the modelName as the dataSourceName if it is not provided", function () {
            delete testModelDefinition.dataSourceName;
            var model = new Model(testModelDefinition);

            model.dataSourceName.should.equal(testModelDefinition.name);
        });

        it("Should not initialize fields or associations", function () {
            var model = new Model(testModelDefinition);

            should.equal(undefined, model.fields.id);
            model.associations.length.should.equal(0);
        });
    });

    describe("Entity Constructor", function () {
        it("Should construct a new Entity from the model", function () {
            var model = new Model(testModelDefinition);
            model.initializeModelFields();
            model.initializeAssociations();

            var entity = new model.Entity({id: '1', other: 'other'});

            entity.id.should.equal('1');
            entity.$entity.storedState.id.should.equal('1');
            should.equal(entity.other, undefined);
        });
    });

    describe("setLastModifiedFieldName", function () {
        it("Should set the last modified field name", function () {
            var model = new Model(testModelDefinition);
            model.setLastModifiedFieldName('test');
            model.lastModifiedFieldName.should.equal('test');
        });
    });

    describe("setDeletedFieldName", function () {
        it("Should set the deleted field name", function () {
            var model = new Model(testModelDefinition);
            model.setDeletedFieldName('test');
            model.deletedFieldName.should.equal('test');
        });
    });

    describe("setAdapter", function () {
        it("Should set the adapter", function () {
            var model = new Model(testModelDefinition);
            model.setAdapter('test');
            model.adapter.should.equal('test');
        });
    });

    describe("setDirtyCheckThreshold", function () {
        it("Should set the dirty checking threshold", function () {
            var model = new Model(testModelDefinition);
            model.setDirtyCheckThreshold(20);
            model.dirtyCheckThreshold.should.equal(20);
        });
    });

    describe("initializeModelFields", function () {
        it("Should create the model fields from the definition", function () {
            var model = new Model(testModelDefinition);
            model.initializeModelFields();

            model.fields.id.name.should.equal('id');
            model.fields.id.type.should.equal('String');
            model.fields.number.name.should.equal('number');
            model.fields.number.type.should.equal('Number');
            model.fields.boolean.name.should.equal('boolean');
            model.fields.boolean.type.should.equal('Boolean');
        });

        it("Should return false if a field is invalid", function () {
            delete testModelDefinition.fields.id.type;
            var model = new Model(testModelDefinition);
            var response = model.initializeModelFields();

            response.should.equal(false);
        });

        it("Should return false if the lastModified field is not a Date field", function () {
            testModelDefinition.fields.lastModified = "String";
            var model = new Model(testModelDefinition);
            model.setLastModifiedFieldName("lastModified");
            var response = model.initializeModelFields();

            response.should.equal(false);
        });

        it("Should create the lastModified field if the name is set but the field does not exist", function () {
            var model = new Model(testModelDefinition);
            model.setLastModifiedFieldName("lastModified");
            model.initializeModelFields();

            model.fields.lastModified.type.should.equal('Date');
            model.fields.lastModified.index.should.equal('lastModified');
        });

        it("Should return false if the deleted field is not a Boolean field", function () {
            testModelDefinition.fields.deleted = "String";
            var model = new Model(testModelDefinition);
            model.setDeletedFieldName("deleted");
            var response = model.initializeModelFields();

            response.should.equal(false);
        });

        it("Should create the deleted field if the name is set but the field does not exist", function () {
            var model = new Model(testModelDefinition);
            model.setDeletedFieldName("deleted");
            model.initializeModelFields();

            model.fields.deleted.type.should.equal('Boolean');
            model.fields.deleted.index.should.equal('deleted');
        });
    });

    describe("initializeAssociations", function () {
        it("Should return if there are no associations", function () {
            var model = new Model({
                name: "modelName",
                fields: {
                    id: {
                        primaryKey: true,
                        type: "String"
                    },
                    number: "Number",
                    boolean: {
                        type: "Boolean",
                        index: "boolean"
                    }
                }
            });
            model.initializeModelFields();
            model.initializeAssociations();

            model.associations.length.should.equal(0);
        });

        it("Should add each valid association to the model", function () {
            var model = new Model({
                name: "modelName",
                dataSourceName: "dataSourceName",
                fields: {
                    id: {
                        primaryKey: true,
                        type: "String"
                    },
                    number: "Number",
                    boolean: {
                        type: "Boolean",
                        index: "boolean"
                    }
                },
                associations: [
                    {
                        hasOne: 'otherModel',
                        as: 'model',
                        foreignKey: 'modelId'
                    },
                    {
                        hasOne: 'anotherModel',
                        as: 'invalid'
                    }
                ]
            });
            model.initializeModelFields();
            model.initializeAssociations();

            model.associations.length.should.equal(1);
            model.associations[0].modelName.should.equal('otherModel');
        });

        it("Should create the hasOne field if it does not exist", function () {
            var model = new Model(testModelDefinition);
            model.initializeModelFields();
            model.initializeAssociations();

            model.fields.modelId.type.should.equal('String');
            model.fields.modelId.index.should.equal('modelId');
        });

        it("Should add an index to the hasOne field if it already exists", function () {
            testModelDefinition.fields.modelId = "String";
            var model = new Model(testModelDefinition);
            model.initializeModelFields();
            model.initializeAssociations();

            model.fields.modelId.type.should.equal('String');
            model.fields.modelId.index.should.equal('modelId');
        });
    });

    describe("getAssociationByAlias", function () {
        it("Should return the association", function () {
            var model = new Model(testModelDefinition);
            model.initializeModelFields();
            model.initializeAssociations();
            var association = model.getAssociationByAlias('model');

            association.should.equal(model.associations[0]);
        });

        it("Should return null if the association could not be found", function () {
            var model = new Model(testModelDefinition);
            model.initializeModelFields();
            model.initializeAssociations();
            var association = model.getAssociationByAlias('test');

            should.equal(association, null);
        });
    });

    describe("extendFromRawObject", function () {
        it("Should extend the object with only the fields found in the model", function () {
            var model = new Model(testModelDefinition);
            model.initializeModelFields();
            model.initializeAssociations();
            foreignModel.initializeModelFields();
            foreignModel.initializeAssociations();

            var entity = {
                test: 'test'
            };

            model.extendFromRawObject(entity, {
                id: 'id',
                other: 'other'
            });

            entity.id.should.equal('id');
            should.equal(entity.other, undefined);
        });
    });

    describe("getRawModelObject", function () {
        var model;
        beforeEach(inject(function (recall) {
            model = new Model(testModelDefinition);
            model.initializeModelFields();
            model.initializeAssociations();
            foreignModel.initializeModelFields();
            foreignModel.initializeAssociations();
            sinon.stub(recall, 'getModel', function (modelName) {
                if (modelName === testModelDefinition.name) {
                    return model;
                }
                if (modelName === otherModelDefinition.name) {
                    return foreignModel;
                }
            });
        }));

        it("Should copy the model fields from the entity into an object", function () {
            var result = model.getRawModelObject({
                id: 'id',
                modelId: '2',
                other: 'other'
            }, false);

            result.id.should.equal('id');
            result.modelId.should.equal('2');
            should.equal(result.other, undefined);
        });

        it("Should add the foreignKey onto the object if the association is expanded", function () {
            var result = model.getRawModelObject({
                id: 'id',
                model: {
                    id: '2'
                }
            }, false);

            result.modelId.should.equal('2');
            should.equal(result.model, undefined);
        });

        it("Should return the raw hasOne association if includeExpandedAssociations is true", function () {
            var result = model.getRawModelObject({
                id: 'id',
                model: {
                    id: '2',
                    other: 'other'
                }
            }, true);

            result.modelId.should.equal('2');
            result.model.id.should.equal('2');
            should.equal(result.model.other, undefined);
        });

        it("Should return the raw hasMany associations if includeExpandedAssociations is true", function () {
            var result = foreignModel.getRawModelObject({
                id: 'id',
                models: [
                    {
                        id: '1',
                        other: 'other'
                    },
                    {
                        id: '2',
                        other: 'other'
                    }
                ]
            }, true);

            result.models.length.should.equal(2);
            result.models[0].id.should.equal('1');
            result.models[1].id.should.equal('2');
            should.equal(result.models[1].other, undefined);
        });
    });

    describe("applyDefaultValues", function () {
        it("Should apply the default values only if the field is undefined", function () {
            foreignModel.initializeModelFields();
            foreignModel.initializeAssociations();

            var entity = {
                test: null
            };

            foreignModel.applyDefaultValues(entity);

            should.equal(entity.test, null);
            entity.test2.should.equal('test2');
        });
    });

    describe("transformResult", function () {
        it("Should return the raw object", function () {
            var model = new Model(testModelDefinition);
            model.initializeModelFields();
            model.initializeAssociations();

            var entity = {id: '1', other: 'other'};
            entity = model.transformResult(entity);

            entity.id.should.equal('1');
            should.equal(entity.other, undefined);
        });

        it("Should call transformResult on the model", function () {
            var model = new Model(testModelDefinition);
            model.initializeModelFields();
            model.initializeAssociations();
            sinon.stub(model.modelDefinition, 'transformResult');

            var entity = {id: '1', other: 'other'};
            model.transformResult(entity);

            model.modelDefinition.transformResult.calledOnce.should.equal(true);
        });
    });

    describe("preSave", function () {
        it("Should return the raw object", function () {
            var model = new Model(testModelDefinition);
            model.initializeModelFields();
            model.initializeAssociations();

            var entity = {id: '1', other: 'other'};
            entity = model.preSave(entity);

            entity.id.should.equal('1');
            should.equal(entity.other, undefined);
        });

        it("Should call preSave on the model", function () {
            var model = new Model(testModelDefinition);
            model.initializeModelFields();
            model.initializeAssociations();
            sinon.stub(model.modelDefinition, 'preSave');

            var entity = {id: '1', other: 'other'};
            model.preSave(entity);

            model.modelDefinition.preSave.calledOnce.should.equal(true);
        });
    });

    describe("preCreate", function () {
        it("Should set default values", function () {
            foreignModel.initializeModelFields();
            foreignModel.initializeAssociations();

            var entity = {id: '1'};
            entity = foreignModel.preCreate(entity);

            entity.test.should.equal('test');
        });

        it("Should call preCreate on the model", function () {
            var model = new Model(testModelDefinition);
            model.initializeModelFields();
            model.initializeAssociations();
            sinon.stub(model.modelDefinition, 'preCreate');

            var entity = {id: '1'};
            model.preCreate(entity);

            model.modelDefinition.preCreate.calledOnce.should.equal(true);
        });
    });

    describe("preUpdate", function () {
        it("Should call preUpdate on the model", function () {
            var model = new Model(testModelDefinition);
            model.initializeModelFields();
            model.initializeAssociations();
            sinon.stub(model.modelDefinition, 'preUpdate');

            var entity = {id: '1'};
            model.preUpdate(entity);

            model.modelDefinition.preUpdate.calledOnce.should.equal(true);
        });
    });

    describe("findOne", function () {
        var model;

        beforeEach(function () {
            model = new Model(testModelDefinition);
            model.initializeModelFields();
            model.initializeAssociations();
            var adapter = {
                findOne: function () {
                    var dfd = $q.defer();
                    dfd.resolve({data: {id: '1', other: 'other'}});
                    return dfd.promise;
                }
            };
            model.setAdapter(adapter);
        });

        it("Should reject if the primaryKey is not set", function () {
            var rejected = false;
            model.findOne().then(null, function () {
                rejected = true;
            });
            $rootScope.$apply();

            rejected.should.equal(true);
        });

        it("should call findOne on the adapter", function () {
            sinon.stub(model.adapter, 'findOne', function () {
                var dfd = $q.defer();
                dfd.resolve({data: {id: '1', other: 'other'}});
                return dfd.promise;
            });
            var options = {};
            model.findOne('1', options);
            $rootScope.$apply();

            model.adapter.findOne.calledWith(model, '1', options).should.equal(true);
        });

        it("Should call transformResult on the response data", function () {
            sinon.stub(model, 'transformResult', function (o) {
                return o;
            });
            model.findOne('1');
            $rootScope.$apply();

            model.transformResult.calledOnce.should.equal(true);
        });

        it("Should resolve with a new entity", function () {
            sinon.stub(model.adapter, 'findOne', function () {
                var dfd = $q.defer();
                dfd.resolve({data: {id: '1', other: 'other'}});
                return dfd.promise;
            });
            var entity;
            model.findOne('1').then(function (theEntity) {
                entity = theEntity;
            });
            $rootScope.$apply();

            entity.id.should.equal('1');
            entity.$entity.storedState.id.should.equal('1');
            should.equal(entity.other, undefined);
        });

        it("Should reject with the error from the adapter", function () {
            sinon.stub(model.adapter, 'findOne', function () {
                var dfd = $q.defer();
                dfd.reject('test');
                return dfd.promise;
            });
            var rejection;
            model.findOne('1').then(null, function (e) {
                rejection = e;
            });
            $rootScope.$apply();

            rejection.should.equal('test');
        });
    });

    describe("find", function () {
        var model;

        beforeEach(function () {
            model = new Model(testModelDefinition);
            model.initializeModelFields();
            model.initializeAssociations();
            var adapter = {
                find: function () {
                    var dfd = $q.defer();
                    dfd.resolve({count: 2, data: [
                        {id: '1', other: 'other'},
                        {id: '2', other: 'other'}
                    ]});
                    return dfd.promise;
                }
            };
            model.setAdapter(adapter);
        });

        it("should call find on the adapter", function () {
            sinon.stub(model.adapter, 'find', function () {
                var dfd = $q.defer();
                dfd.resolve({count: 2, data: [
                    {id: '1', other: 'other'},
                    {id: '2', other: 'other'}
                ]});
                return dfd.promise;
            });
            var options = {};
            model.find(options);
            $rootScope.$apply();

            model.adapter.find.calledWith(model, options).should.equal(true);
        });

        it("Should call transformResult on the response data", function () {
            sinon.stub(model, 'transformResult', function (o) {
                return o;
            });
            model.find();
            $rootScope.$apply();

            model.transformResult.calledTwice.should.equal(true);
        });

        it("Should resolve with new entities", function () {
            sinon.stub(model.adapter, 'find', function () {
                var dfd = $q.defer();
                dfd.resolve({count: 2, data: [
                    {id: '1', other: 'other'},
                    {id: '2', other: 'other'}
                ]});
                return dfd.promise;
            });
            var entities;
            var count;
            model.find().then(function (response) {
                entities = response.results;
                count = response.totalCount;
            });
            $rootScope.$apply();

            count.should.equal(2);
            entities[0].id.should.equal('1');
            entities[1].id.should.equal('2');
            entities[0].$entity.storedState.id.should.equal('1');
            entities[1].$entity.storedState.id.should.equal('2');
            should.equal(entities[0].other, undefined);
            should.equal(entities[1].other, undefined);
        });

        it("Should reject with the error from the adapter", function () {
            sinon.stub(model.adapter, 'find', function () {
                var dfd = $q.defer();
                dfd.reject('test');
                return dfd.promise;
            });
            var rejection;
            model.find().then(null, function (e) {
                rejection = e;
            });
            $rootScope.$apply();

            rejection.should.equal('test');
        });
    });

    describe("remove", function () {
        var model;

        beforeEach(function () {
            model = new Model(testModelDefinition);
            model.initializeModelFields();
            model.initializeAssociations();
            var adapter = {
                remove: function () {
                    var dfd = $q.defer();
                    dfd.resolve();
                    return dfd.promise;
                }
            };
            model.setAdapter(adapter);
        });

        it("Should reject if the primaryKey is not set", function () {
            var rejected = false;
            model.remove().then(null, function () {
                rejected = true;
            });
            $rootScope.$apply();

            rejected.should.equal(true);
        });

        it("should call remove on the adapter", function () {
            sinon.stub(model.adapter, 'remove', function () {
                var dfd = $q.defer();
                dfd.resolve();
                return dfd.promise;
            });
            var options = {};
            model.remove('1', options);
            $rootScope.$apply();

            model.adapter.remove.calledWith(model, '1', options).should.equal(true);
        });

        it("Should reject with the error from the adapter", function () {
            sinon.stub(model.adapter, 'remove', function () {
                var dfd = $q.defer();
                dfd.reject('test');
                return dfd.promise;
            });
            var rejection;
            model.remove('1').then(null, function (e) {
                rejection = e;
            });
            $rootScope.$apply();

            rejection.should.equal('test');
        });
    });
});