/*globals describe, sinon, beforeEach, module, inject, it, should*/
describe("Association", function () {

    beforeEach(module('recall'));

    var Association;
    var $rootScope;
    var $q;

    beforeEach(inject(function (recallAssociation, _$rootScope_, _$q_) {
        Association = recallAssociation;
        $rootScope = _$rootScope_;
        $q = _$q_;
    }));

    describe("New Association", function () {
        it("Should set type from the definition", function () {
            var association = new Association({
                type: 'hasOne'
            });
            association.type.should.equal('hasOne');
        });

        it("Should set type if hasOne is defined in the definition", function () {
            var association = new Association({
                hasOne: "model"
            });
            association.type.should.equal('hasOne');
        });

        it("Should set type if hasMany is defined in the definition", function () {
            var association = new Association({
                hasMany: "model"
            });
            association.type.should.equal('hasMany');
        });

        it("Should set modelName from the definition", function () {
            var association = new Association({
                modelName: 'model'
            });
            association.modelName.should.equal('model');
        });

        it("Should set modelName from hasOne if it is defined the definition", function () {
            var association = new Association({
                hasOne: "model"
            });
            association.modelName.should.equal('model');
        });

        it("Should set modelName from hasMany if it is defined the definition", function () {
            var association = new Association({
                hasMany: "model"
            });
            association.modelName.should.equal('model');
        });

        it("Should set alias from the definition", function () {
            var association = new Association({
                alias: "alias"
            });
            association.alias.should.equal('alias');
        });

        it("Should set alias from as if it is defined in the definition", function () {
            var association = new Association({
                as: "alias"
            });
            association.alias.should.equal('alias');
        });

        it("Should set alias from modelName as a fallback", function () {
            var association = new Association({
                modelName: "alias"
            });
            association.alias.should.equal('alias');
        });

        it("Should set mappedBy from the definition", function () {
            var association = new Association({
                mappedBy: "id"
            });
            association.mappedBy.should.equal('id');
        });

        it("Should set mappedBy from foreignKey if it is defined in the definition", function () {
            var association = new Association({
                foreignKey: "id"
            });
            association.mappedBy.should.equal('id');
        });

        it("Should set invalid if modelName, type, or mappedBy are not set", function () {
            var association = new Association({
                type: "type",
                mappedBy: "id"
            });
            association.invalid.should.equal(true);

            association = new Association({
                modelName: "model",
                mappedBy: "id"
            });
            association.invalid.should.equal(true);

            association = new Association({
                modelName: "model",
                type: "type"
            });
            association.invalid.should.equal(true);
        });

        it("Should set invalid to false the definition is valid", function () {
            var association = new Association({
                hasOne: "model",
                as: "theModel",
                mappedBy: "id"
            });
            association.invalid.should.equal(false);

            association = new Association({
                hasMany: "model",
                foreignKey: "id"
            });
            association.invalid.should.equal(false);

            association = new Association({
                modelName: "model",
                type: "type",
                alias: "theModel",
                mappedBy: "id"
            });
            association.invalid.should.equal(false);
        });

        it("Should be able to be created from an existing association", function () {
            var association1 = new Association({
                hasOne: "model",
                as: "theModel",
                mappedBy: "id"
            });
            var association2 = new Association(association1);

            association2.type.should.equal(association1.type);
            association2.modelName.should.equal(association1.modelName);
            association2.alias.should.equal(association1.alias);
            association2.mappedBy.should.equal(association1.mappedBy);
            association2.invalid.should.equal(association1.invalid);
            association2.invalid.should.equal(false);
        });
    });

    describe("Get Model", function () {
        it("Should return the association's model", function () {
            Association.getAssociationModel = function () {};
            sinon.stub(Association, "getAssociationModel").returns("test");
            var association = new Association({
                hasOne: "model",
                as: "theModel",
                mappedBy: "id"
            });

            association.getModel();

            Association.getAssociationModel.calledWith("model").should.equal(true);
        });
    });

    describe("Expand", function () {
        var association;
        var entity;
        var findResult;
        var findOneResult;
        var fakeAdapter;
        var fakeModel;

        beforeEach(function () {
            fakeAdapter = {
                find: function () {
                    var dfd = $q.defer();
                    dfd.resolve(findResult);
                    return dfd.promise;
                },
                findOne: function () {
                    var dfd = $q.defer();
                    dfd.resolve(findOneResult);
                    return dfd.promise;
                }
            };
            fakeModel = {
                getRawModelObject: function (obj) {
                    return obj;
                },
                adapter: fakeAdapter
            };
            findResult = {data: [{id: 2}]};
            findOneResult = {data: {id: 2}};
            association = new Association({
                hasOne: "model",
                as: "alias",
                mappedBy: "modelId"
            });
            Association.getAssociationModel = function () {};
            sinon.stub(Association, "getAssociationModel", function () {
                return fakeModel;
            });
            entity = {
                id: "test",
                modelId: "modelId",
                $getPrimaryKey: function () {
                    return "test";
                },
                $entity: {
                    storedState: {
                        id: "test",
                        modelId: "modelId"
                    }
                }
            };
        });

        it("Should reject if the association's model could not be found", function () {
            fakeModel = null;
            var rejected = false;
            association.expand(entity).then(null, function() {
                rejected = true;
            });
            $rootScope.$apply();

            rejected.should.equal(true);
        });

        it("Should call find one on the model if the association is of type: hasOne", function () {
            sinon.stub(fakeAdapter, "findOne", function () {
                var dfd = $q.defer();
                dfd.resolve(findOneResult);
                return dfd.promise;
            });

            association.expand(entity);
            $rootScope.$apply();

            fakeAdapter.findOne.calledWith(fakeModel, "modelId").should.equal(true);
        });

        it("Should add the expanded association object to the entity", function () {
            association.expand(entity);
            $rootScope.$apply();

            entity.alias.should.equal(findOneResult.data);
        });

        it("Should add the expanded association object to the entity's stored state as a clone", function () {
            association.expand(entity);
            $rootScope.$apply();

            entity.$entity.storedState.alias.should.equal(findOneResult.data);
        });

        it("Should reject if an error occurs in find one", function () {
            sinon.stub(fakeAdapter, "findOne", function () {
                var dfd = $q.defer();
                dfd.reject();
                return dfd.promise;
            });

            var rejected = false;
            association.expand(entity).then(null, function() {
                rejected = true;
            });
            $rootScope.$apply();

            rejected.should.equal(true);
        });

        it("Should call find on the model if the association is of type: hasMany", function () {
            association.type = "hasMany";
            var queryOptions;
            sinon.stub(fakeAdapter, "find", function (model, options) {
                queryOptions = options;
                var dfd = $q.defer();
                dfd.resolve(findResult);
                return dfd.promise;
            });

            association.expand(entity);
            $rootScope.$apply();

            fakeAdapter.find.calledWith(fakeModel, queryOptions).should.equal(true);
            queryOptions.$filter().parsePredicate().should.equal("modelId eq 'test'");
        });

        it("Should add the expanded associations array to the entity", function () {
            association.type = "hasMany";
            association.expand(entity);
            $rootScope.$apply();

            entity.alias[0].should.equal(findResult.data[0]);
        });

        it("Should add the expanded associations array to the entity's stored state as clones", function () {
            association.type = "hasMany";
            association.expand(entity);
            $rootScope.$apply();

            entity.$entity.storedState.alias[0].should.equal(findResult.data[0]);
        });

        it("Should reject if an error occurs in find", function () {
            association.type = "hasMany";
            sinon.stub(fakeAdapter, "find", function () {
                var dfd = $q.defer();
                dfd.reject();
                return dfd.promise;
            });

            var rejected = false;
            association.expand(entity).then(null, function() {
                rejected = true;
            });
            $rootScope.$apply();

            rejected.should.equal(true);
        });

        it("Should reject the type is not recognized", function () {
            association.type = "foo";

            var rejected = false;
            association.expand(entity).then(null, function() {
                rejected = true;
            });
            $rootScope.$apply();

            rejected.should.equal(true);
        });
    });
});