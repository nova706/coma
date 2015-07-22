angular.module('recall').factory("recallModel", [
    '$log',
    '$q',
    'recallAssociation',
    'recallEntity',
    'recallModelField',

    function ($log,
              $q,
              Association,
              Entity,
              ModelField) {

        // Bubbles an error promise to the top.
        var propagateError = function (e) {
            return $q.reject(e);
        };

        /**
         * A Model is in charge of defining a structure for a type of Entity. The model provides CRUD operations for
         * that type of Entity as well as some other utility functions.
         *
         * Models should not be created directly. Instead, the recall service should be used as a proxy for creating
         * models.
         *
         * @constructor
         */
        var Model = function (modelDefinition) {
            this.modelName = modelDefinition.name;
            this.dataSourceName = modelDefinition.dataSourceName || modelDefinition.name;

            // Add the model definition to the Model as read only
            Object.defineProperty(this, "modelDefinition", {value: modelDefinition, writable: false});

            // Add a Constructor method to the Model for constructing new Entities from the Model: new Model.Entity();
            var self = this;
            Object.defineProperty(this, "Entity", {writable: false, configurable: false, value: function (obj, persisted) {
                return( new Entity(obj, self, persisted === true) );
            }});

            this.fields = {};
            this.associations = [];

            this.dirtyCheckThreshold = 30;

            this.primaryKeyFieldName = null;
            this.lastModifiedFieldName = null;
            this.deletedFieldName = null;
            this.adapter = null;
        };

        Model.prototype.setLastModifiedFieldName = function (lastModifiedFieldName) {
            this.lastModifiedFieldName = lastModifiedFieldName;
        };

        Model.prototype.setDeletedFieldName = function (deletedFieldName) {
            this.deletedFieldName = deletedFieldName;
        };

        Model.prototype.setAdapter = function (adapter) {
            this.adapter = adapter;
        };

        Model.prototype.setDirtyCheckThreshold = function (dirtyCheckThreshold) {
            this.dirtyCheckThreshold = dirtyCheckThreshold;
        };

        // Initializes the fields using the common ModelField class
        Model.prototype.initializeModelFields = function () {
            var modelDefinitionFields = this.modelDefinition.fields;
            var field;
            var modelField;
            var lastModifiedField;
            var deletedField;
            for (field in modelDefinitionFields) {
                if (modelDefinitionFields.hasOwnProperty(field)) {
                    modelField = new ModelField(field, modelDefinitionFields[field]);

                    if (modelField.primaryKey) {
                        this.primaryKeyFieldName = field;
                    }

                    if (modelField.invalid) {
                        return false;
                    } else {
                        this.fields[field] = modelField;
                    }

                    if (field === this.lastModifiedFieldName) {
                        lastModifiedField = modelField;
                    }

                    if (field === this.deletedFieldName) {
                        deletedField = field;
                    }
                }
            }
            if (lastModifiedField && lastModifiedField.type !== "DATE") {
                $log.error('Model: The last modified field is not a Date field');
                return false;
            }
            if (this.lastModifiedFieldName && !lastModifiedField) {
                this.fields[this.lastModifiedFieldName] = new ModelField(this.lastModifiedFieldName, {
                    type: "DATE",
                    index: true,
                    getDefaultValue: function () {
                        return new Date().toISOString();
                    }
                });
            }
            if (deletedField && deletedField.type !== "BOOLEAN") {
                $log.error('Model: The deletedField field is not a Boolean field');
                return false;
            }
            if (this.deletedFieldName && !deletedField) {
                this.fields[this.deletedFieldName] = new ModelField(this.deletedFieldName, {
                    type: "BOOLEAN",
                    index: true,
                    getDefaultValue: function () {
                        return false;
                    }
                });
            }
            return true;
        };

        // TODO: Support many to many associations
        // Initialize the Model associations using the HasOneAssociation and HasManyAssociation classes
        Model.prototype.initializeAssociations = function () {
            var modelDefinitionAssociations = this.modelDefinition.associations;
            if (!modelDefinitionAssociations) {
                return;
            }
            var i;
            var association;
            for (i = 0; i < modelDefinitionAssociations.length; i++) {
                association = new Association(modelDefinitionAssociations[i]);

                if (association && !association.invalid) {
                    if (association.type === 'hasOne') {
                        if (!this.fields[association.mappedBy]) {
                            // If no field is defined for the foreign key, define one assuming the same foreign key type.
                            this.fields[association.mappedBy] = new ModelField(association.mappedBy, {
                                type: this.fields[this.primaryKeyFieldName].type,
                                index: association.mappedBy
                            });
                        } else {
                            this.fields[association.mappedBy].index = association.mappedBy;
                        }
                    }

                    this.associations.push(association);
                }
            }
        };

        /**
         * Gets a Model Association by the alias name. The alias is defined as the "as" property on an alias if
         * defined and falls back to the model name if "as" is not defined.
         *
         * @param {String} alias The association's alias
         * @returns {Object} The association object
         */
        Model.prototype.getAssociationByAlias = function (alias) {
            var i;
            for (i = 0; i < this.associations.length; i++) {
                if (this.associations[i].alias === alias) {
                    return this.associations[i];
                }
            }
            return null;
        };

        /**
         * Extends an entity with a raw object. The raw object could be input from a controller or the result from
         * an adapter.
         *
         * @param {Object} entity The entity to extend
         * @param {Object} rawObject The object to extend from.
         */
        Model.prototype.extendFromRawObject = function (entity, rawObject) {
            angular.extend(entity, this.getRawModelObject(rawObject));
        };

        /**
         * Gets a raw representation of the model object to be used in adapter transactions. This returns an object
         * in which only the Model defined fields are set. This also looks through expanded associations to set the
         * foreignKey field for one to n associations and sets the association to the raw association object.
         *
         * @param {Object} modelEntity
         * @param {Boolean} [includeExpandedAssociations = true] Include the expanded association in the raw object.
         * @returns {Object} The raw object
         */
        Model.prototype.getRawModelObject = function (modelEntity, includeExpandedAssociations) {
            var object = {};
            var field;
            for (field in this.fields) {
                if (this.fields.hasOwnProperty(field)) {
                    object[field] = modelEntity[field];
                }
            }
            var i;
            var alias;
            var foreignKey;
            var ForeignModel;
            var a;
            for (i = 0; i < this.associations.length; i++) {
                alias = this.associations[i].alias;
                ForeignModel = this.associations[i].getModel();

                if (this.associations[i].type === 'hasOne') {
                    if (modelEntity[alias] !== undefined && modelEntity[alias] !== null) {
                        foreignKey = modelEntity[alias][ForeignModel.primaryKeyFieldName];
                        object[this.associations[i].mappedBy] = foreignKey;

                        if (includeExpandedAssociations !== false) {
                            object[alias] = ForeignModel.getRawModelObject(modelEntity[alias]);
                        }
                    }
                } else if (this.associations[i].type === 'hasMany' && includeExpandedAssociations !== false) {
                    if (modelEntity[alias] !== undefined && modelEntity[alias] instanceof Array) {
                        object[alias] = [];
                        for (a = 0; a < modelEntity[alias].length; a++) {
                            object[alias].push(ForeignModel.getRawModelObject(modelEntity[alias][a]));
                        }
                    }
                }
            }
            return object;
        };

        /**
         * Applies the default values on any undefined field in an entity.
         *
         * @param {Object} entity The entity to set the default values on
         */
        Model.prototype.applyDefaultValues = function (entity) {
            var field;
            for (field in this.fields) {
                if (this.fields.hasOwnProperty(field)) {
                    if (typeof this.fields[field].getDefaultValue === 'function' && entity[field] === undefined) {
                        entity[field] = this.fields[field].getDefaultValue(entity);
                    }
                }
            }
        };

        /**
         * Transforms all objects returned by adapter transactions. This calls the transformResult function defined
         * in the model. This also recursively calls transformResult on all associations.
         *
         * @method transformResult
         * @param {Object} resultEntity
         * @returns {Object} The transformed result
         */
        Model.prototype.transformResult = function (resultEntity) {
            var i;
            var alias;
            var ForeignModel;
            var a;
            for (i = 0; i < this.associations.length; i++) {
                alias = this.associations[i].alias;
                ForeignModel = this.associations[i].getModel();

                if (this.associations[i].type === 'hasOne') {
                    if (resultEntity[alias] !== undefined) {
                        resultEntity[alias] = ForeignModel.transformResult(resultEntity[alias]);
                    }
                } else if (this.associations[i].type === 'hasMany') {
                    if (resultEntity[alias] !== undefined && resultEntity[alias] instanceof Array) {
                        for (a = 0; a < resultEntity[alias].length; a++) {
                            resultEntity[alias][a] = ForeignModel.transformResult(resultEntity[alias][a]);
                        }
                    }
                }
            }

            resultEntity = this.getRawModelObject(resultEntity);
            if (typeof this.modelDefinition.transformResult === 'function') {
                resultEntity = this.modelDefinition.transformResult(resultEntity);
            }
            return resultEntity;
        };

        /**
         * Ran before the create and update adapter transactions. This calls the preSave function defined in the
         * model.
         *
         * @method preSave
         * @param {Object} entity
         * @returns {Object} The raw transformed entity
         */
        Model.prototype.preSave = function (entity) {
            entity = this.getRawModelObject(entity);
            if (typeof this.modelDefinition.preSave === 'function') {
                return this.modelDefinition.preSave(entity);
            }
            return entity;
        };

        /**
         * Ran before the create adapter transaction. This applies the default values to any undefined fields and
         * then calls the preCreate function defined in the model.
         *
         * @method preCreate
         * @param {Object} rawEntity
         * @returns {Object} The raw transformed entity
         */
        Model.prototype.preCreate = function (rawEntity) {
            this.applyDefaultValues(rawEntity);
            if (typeof this.modelDefinition.preCreate === 'function') {
                return this.modelDefinition.preCreate(rawEntity);
            }
            return rawEntity;
        };

        /**
         * Ran before the update adapter transaction. This calls the preUpdate function defined in the model.
         *
         * @method preUpdate
         * @param {Object} rawEntity
         * @returns {Object} The raw transformed entity
         */
        Model.prototype.preUpdate = function (rawEntity) {
            if (typeof this.modelDefinition.preUpdate === 'function') {
                return this.modelDefinition.preUpdate(rawEntity);
            }
            return rawEntity;
        };

        /**
         * Retrieves a single model from the adapter given a primary key. Query options can be passed to determine
         * select and expand operations.
         *
         * @method findOne
         * @param {String} pk The primary key of the model to retrieve
         * @param {Object} [queryOptions] Query options to use for retrieval
         * @returns {promise} Resolves with the Entity
         */
        Model.prototype.findOne = function (pk, queryOptions) {
            var self = this;
            if (!pk) {
                $log.error('Model: FindOne', 'The primary key was not supplied');
                return $q.reject("The primary key was not supplied.");
            }

            return this.adapter.findOne(this, pk, queryOptions).then(function (response) {
                var result = self.transformResult(response.data);
                var entity = new Entity(result, self, true);
                $log.debug("Model: FindOne", entity, response, queryOptions);
                return entity;
            }, propagateError);
        };

        /**
         * Retrieves a list of models from the adapter. Query options can be passed to determine top, skip, order by,
         * select, expand, and filter operations.
         *
         * @method find
         * @param {Object} [queryOptions] Query options to use for retrieval
         * @returns {promise} Resolves with data.results and data.totalCount where results are Entities
         */
        Model.prototype.find = function (queryOptions) {
            var self = this;
            return this.adapter.find(this, queryOptions).then(function (response) {
                var results = [];
                var i;
                for (i = 0; i < response.data.length; i++) {
                    results.push(new Entity(self.transformResult(response.data[i]), self, true));
                }

                var clientResponse = {
                    results: results,
                    totalCount: response.count
                };
                $log.debug("Model: Find", clientResponse, response, queryOptions);
                return clientResponse;
            }, propagateError);
        };

        /**
         * Removes the model from the adapter given a primary key.
         *
         * @method remove
         * @param {String} pk The primary key of the model to remove
         * @param {Object} [queryOptions] Query options
         * @returns {promise}
         */
        Model.prototype.remove = function (pk, queryOptions) {
            if (!pk) {
                $log.error('Model: Remove', 'The primary key was not supplied');
                return $q.reject("The primary key was not supplied.");
            }
            return this.adapter.remove(this, pk, queryOptions);
        };

        return Model;
    }
]);