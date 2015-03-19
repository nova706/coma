/*globals require, describe, beforeEach, module, inject, it, should*/
describe("BaseModelService", function () {

    beforeEach(module('coma'));

    var baseModelService;

    beforeEach(inject(function (comaBaseModelService) {
        baseModelService = comaBaseModelService;
    }));

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
            lastName: "String",
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

    var phoneNumberModelDefinition = {
        name: "phoneNumber",
        dataSourceName: "phonenumbers",
        fields: {
            id: {
                primaryKey: true,
                type: "String"
            },
            number: "String",
            primary: {
                type: "Boolean",
                index: "primary"
            }
        },
        associations: [
            {
                hasOne: 'person',
                as: 'person',
                foreignKey: 'personId'
            }
        ]
    };

    describe("Set Dirty Check Threshold", function () {
        it("Should set the dirty checking threshold", function () {
            baseModelService.setDirtyCheckThreshold(70);
            baseModelService.dirtyCheckThreshold.should.equal(70);
        });
    });

    describe("Set Default Adapter", function () {
        it("Should set the default adapter", function () {
            baseModelService.setDefaultAdapter("test");
            baseModelService.defaultAdapter.should.equal("test");
        });
    });

    describe("Get Models", function () {
        it("Should return an array of the defined models", function () {
            baseModelService.defineModel(personModelDefinition);
            baseModelService.defineModel(phoneNumberModelDefinition);

            var models = baseModelService.getModels();

            models.length.should.equal(2);
            models[0].modelName.should.equal(personModelDefinition.name);
            models[1].modelName.should.equal(phoneNumberModelDefinition.name);
        });
    });

    describe("Get Model", function () {
        it("Should return a model by its name", function () {
            baseModelService.defineModel(personModelDefinition);
            baseModelService.defineModel(phoneNumberModelDefinition);

            var personModel = baseModelService.getModel(personModelDefinition.name);

            personModel.modelName.should.equal(personModelDefinition.name);
        });

        it("Should return null if the model is not found", function () {
            baseModelService.defineModel(phoneNumberModelDefinition);

            var personModel = baseModelService.getModel(personModelDefinition.name);

            should.equal(null, personModel);
        });
    });

    describe("Define Model", function () {
        it("Should initialize basic model properties", function () {
            var personModel = baseModelService.defineModel(personModelDefinition);

            personModel.modelName.should.equal(personModelDefinition.name);
            personModel.primaryKeyFieldName.should.equal("id");
            personModel.dataSourceName.should.equal(personModelDefinition.dataSourceName);
        });

        it("Should initialize the model fields", function () {
            var personModel = baseModelService.defineModel(personModelDefinition);
            var phoneNumberModel = baseModelService.defineModel(phoneNumberModelDefinition);

            personModel.fields.id.type.should.equal("String");
            personModel.fields.id.primaryKey.should.equal(true);
            personModel.fields.id.unique.should.equal(false);
            personModel.fields.id.index.should.equal(false);
            personModel.fields.id.notNull.should.equal(false);

            personModel.fields.firstName.type.should.equal("String");
            personModel.fields.firstName.primaryKey.should.equal(false);
            personModel.fields.firstName.unique.should.equal(false);
            personModel.fields.firstName.index.should.equal("firstName");
            personModel.fields.firstName.notNull.should.equal(true);

            personModel.fields.lastName.type.should.equal("String");
            personModel.fields.lastName.primaryKey.should.equal(false);
            personModel.fields.lastName.unique.should.equal(false);
            personModel.fields.lastName.index.should.equal(false);
            personModel.fields.lastName.notNull.should.equal(false);

            personModel.fields.added.type.should.equal("Date");
            personModel.fields.added.primaryKey.should.equal(false);
            personModel.fields.added.unique.should.equal(false);
            personModel.fields.added.index.should.equal("added");
            personModel.fields.added.notNull.should.equal(false);
            should.equal(typeof personModel.fields.added.getDefaultValue, 'function');

            phoneNumberModel.fields.id.type.should.equal("String");
            phoneNumberModel.fields.id.primaryKey.should.equal(true);
            phoneNumberModel.fields.id.unique.should.equal(false);
            phoneNumberModel.fields.id.index.should.equal(false);
            phoneNumberModel.fields.id.notNull.should.equal(false);

            phoneNumberModel.fields.number.type.should.equal("String");
            phoneNumberModel.fields.number.primaryKey.should.equal(false);
            phoneNumberModel.fields.number.unique.should.equal(false);
            phoneNumberModel.fields.number.index.should.equal(false);
            phoneNumberModel.fields.number.notNull.should.equal(false);

            phoneNumberModel.fields.primary.type.should.equal("Boolean");
            phoneNumberModel.fields.primary.primaryKey.should.equal(false);
            phoneNumberModel.fields.primary.unique.should.equal(false);
            phoneNumberModel.fields.primary.index.should.equal("primary");
            phoneNumberModel.fields.primary.notNull.should.equal(false);
        });

        it("Should initialize the model association hasOne fields", function () {
            var phoneNumberModel = baseModelService.defineModel(phoneNumberModelDefinition);

            phoneNumberModel.fields.personId.type.should.equal("String");
            phoneNumberModel.fields.personId.primaryKey.should.equal(false);
            phoneNumberModel.fields.personId.unique.should.equal(false);
            phoneNumberModel.fields.personId.index.should.equal("personId");
            phoneNumberModel.fields.personId.notNull.should.equal(false);
        });

        it("Should initialize the model associations", function () {
            var personModel = baseModelService.defineModel(personModelDefinition);
            var phoneNumberModel = baseModelService.defineModel(phoneNumberModelDefinition);

            var phoneNumbersAssociation = personModel.getAssociationByAlias('phoneNumbers');
            var personAssociation = phoneNumberModel.getAssociationByAlias('person');

            phoneNumbersAssociation.invalid.should.equal(false);
            phoneNumbersAssociation.type.should.equal('hasMany');
            phoneNumbersAssociation.modelName.should.equal(phoneNumberModel.modelName);
            phoneNumbersAssociation.alias.should.equal('phoneNumbers');
            phoneNumbersAssociation.mappedBy.should.equal('personId');

            personAssociation.invalid.should.equal(false);
            personAssociation.type.should.equal('hasOne');
            personAssociation.modelName.should.equal(personModel.modelName);
            personAssociation.alias.should.equal('person');
            personAssociation.foreignKey.should.equal('personId');
        });
    });
});