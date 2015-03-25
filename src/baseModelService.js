angular.module('recall').factory("recallBaseModelService", [
    '$injector',
    '$log',
    '$q',
    'recallAssociation',
    'recallModelField',

    function ($injector,
              $log,
              $q,
              Association,
              ModelField) {

        var baseModelService = {
            dirtyCheckThreshold: 30,
            lastModifiedFieldName: "",
            deletedFieldName: "",
            adapter: {},
            models: {}
        };

        // Bubbles an error promise to the top.
        var propagateError = function (e) {
            return $q.reject(e);
        };

        // Convenience class for logging.
        var RecallModel = function (model) {
            angular.extend(this, model);
        };

        // Convenience class for logging.
        var Response = function (response) {
            angular.extend(this, response);
        };

        // Convenience class for logging.
        var RawModelInstance = function () { return this; };

        // Initialize the getModel functions on the associations
        Association.getAssociationModel = function (modelName) {
            return baseModelService.getModel(modelName);
        };

        /**
         * Set the dirty check threshold used by the entity dirty checking
         * @param {Number} [dirtyCheckThreshold=30] in Milliseconds
         */
        baseModelService.setDirtyCheckThreshold = function (dirtyCheckThreshold) {
            baseModelService.dirtyCheckThreshold = dirtyCheckThreshold || 30;
        };

        /**
         * Sets the field to be used as the last modified field required for synchronization.
         * @param {String} lastModifiedFieldName
         */
        baseModelService.setLastModifiedFieldName = function (lastModifiedFieldName) {
            baseModelService.lastModifiedFieldName = lastModifiedFieldName;
        };

        /**
         * Sets the field to be used as the deleted field required for synchronization.
         * @param {String} deletedFieldName
         */
        baseModelService.setDeletedFieldName = function (deletedFieldName) {
            baseModelService.deletedFieldName = deletedFieldName;
        };

        /**
         * Sets the adapter to use for CRUD operations.
         * @param {Object|String} adapter The adapter object or the name of the adapter factory to inject.
         */
        baseModelService.setAdapter = function (adapter) {
            baseModelService.adapter = adapter;
        };

        /**
         * Get an array of the defined Models.
         * @returns {Entity[]} The models
         */
        baseModelService.getModels = function () {
            var theModels = [];
            var model;
            for (model in baseModelService.models) {
                if (baseModelService.models.hasOwnProperty(model)) {
                    theModels.push(baseModelService.models[model]);
                }
            }
            return theModels;
        };

        /**
         * Gets a defined model by its name
         * @param {String} modelName
         * @returns {Entity} The model or null if the model is not found
         */
        baseModelService.getModel = function (modelName) {
            return baseModelService.models[modelName] || null;
        };

        /**
         * Creates a model based on a definition.
         * @param {Object} modelDefinition The definition of the model including fields and associations
         * @param {Object} [adapter] The adapter that is used to perform the CRUD actions
         * @returns {Entity} The model
         */
        baseModelService.defineModel = function (modelDefinition, adapter) {
            adapter = adapter || baseModelService.adapter;

            // If the adapter is a string, assume it is the name of the adapter factory and inject it
            adapter = (typeof adapter === 'string') ? $injector.get(adapter) : adapter;

            // If there was no adapter set, then return out as the model can not be used.
            if (!adapter) {
                return null;
            }

            // TODO: Validated the model definition
            if (!modelDefinition || !modelDefinition.name) {
                return null;
            }

            // If the model is already defined, just return it.
            if (baseModelService.models[modelDefinition.name]) {
                return baseModelService.models[modelDefinition.name];
            }

            /**
             * An Entity is an object that represents an instance of a Model. The class has basic CRUD operations as
             * well as some utilities. The Entity instance exposes save and move operations as well as dirty checking.
             *
             * @param {Object} object The object to construct the entity from
             * @param {Boolean} [persisted = false] Set to true if this model was created from an object that came
             *                                         from an adapter.
             * @constructor
             */
            var Entity = function (object, persisted) {
                Entity.extendFromRawObject(this, object);

                this.$entity = {
                    adapter: adapter,
                    lastDirtyCheck: new Date().getTime(),
                    lastDirtyState: false,
                    persisted: persisted === true,
                    saveInProgress: false,
                    storedState: null
                };

                this.$storeState();
            };

            Entity.fields = {};
            Entity.associations = [];
            Entity.primaryKeyFieldName = null;
            Entity.lastModifiedFieldName = baseModelService.lastModifiedFieldName;
            Entity.deletedFieldName = baseModelService.deletedFieldName;
            Entity.adapter = adapter;
            Entity.modelName = modelDefinition.name;
            Entity.dataSourceName = modelDefinition.dataSourceName || modelDefinition.name;

            // Initializes the fields using the common ModelField class
            var initializeEntityFields = function () {
                var field;
                var modelField;
                var lastModifiedField;
                var deletedField;
                for (field in modelDefinition.fields) {
                    if (modelDefinition.fields.hasOwnProperty(field)) {
                        modelField = new ModelField(field, modelDefinition.fields[field]);

                        if (modelField.primaryKey) {
                            Entity.primaryKeyFieldName = field;
                        }

                        if (!modelField.invalid) {
                            Entity.fields[field] = modelField;
                        }

                        if (field === baseModelService.lastModifiedFieldName) {
                            lastModifiedField = modelField;
                        }

                        if (field === baseModelService.deletedFieldName) {
                            deletedField = field;
                        }
                    }
                }
                if (lastModifiedField && lastModifiedField.type !== "Date") {
                    $log.error('BaseModelService: The last modified field is not a Date field');
                    return false;
                }
                if (baseModelService.lastModifiedFieldName && !lastModifiedField) {
                    Entity.fields[baseModelService.lastModifiedFieldName] = new ModelField(baseModelService.lastModifiedFieldName, {
                        type: "Date",
                        index: true
                    });
                }
                if (baseModelService.deletedFieldName && !deletedField) {
                    Entity.fields[baseModelService.deletedFieldName] = new ModelField(baseModelService.deletedFieldName, {
                        type: "Boolean",
                        index: true
                    });
                }
                return true;
            };
            if (!initializeEntityFields()) {
                return null;
            }

            // TODO: Support many to many associations
            // Initialize the Model associations using the HasOneAssociation and HasManyAssociation classes
            var initializeAssociations = function () {
                if (!modelDefinition.associations) {
                    return;
                }
                var i;
                var association;
                for (i = 0; i < modelDefinition.associations.length; i++) {
                    association = new Association(modelDefinition.associations[i]);

                    if (association && !association.invalid) {
                        if (association.type === 'hasOne') {
                            if (!Entity.fields[association.mappedBy]) {
                                // If no field is defined for the foreign key, define one assuming the same foreign key type.
                                Entity.fields[association.mappedBy] = new ModelField(association.mappedBy, {
                                    type: Entity.fields[Entity.primaryKeyFieldName].type,
                                    index: association.mappedBy
                                });
                            } else {
                                Entity.fields[association.mappedBy].index = association.mappedBy;
                            }
                        }

                        Entity.associations.push(association);
                    }
                }
            };
            initializeAssociations();

            /**
             * Gets a Model Association by the alias name. The alias is defined as the "as" property on an alias if
             * defined and falls back to the model name if "as" is not defined.
             *
             * @param {String} alias The association's alias
             * @returns {Object} The association object
             */
            Entity.getAssociationByAlias = function (alias) {
                var i;
                for (i = 0; i < Entity.associations.length; i++) {
                    if (Entity.associations[i].alias === alias) {
                        return Entity.associations[i];
                    }
                }
            };

            /**
             * Extends an entity with a raw object. The raw object could be input from a controller or the result from
             * an adapter.
             *
             * @param {Object} entity The entity to extend
             * @param {Object} rawObject The object to extend from.
             */
            Entity.extendFromRawObject = function (entity, rawObject) {
                angular.extend(entity, Entity.getRawModelObject(rawObject));
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
            Entity.getRawModelObject = function (modelEntity, includeExpandedAssociations) {
                var object = new RawModelInstance();
                var field;
                for (field in Entity.fields) {
                    if (Entity.fields.hasOwnProperty(field)) {
                        object[field] = modelEntity[field];
                    }
                }
                var i;
                var alias;
                var foreignKey;
                var ForeignModel;
                var a;
                for (i = 0; i < Entity.associations.length; i++) {
                    alias = Entity.associations[i].alias;
                    ForeignModel = Entity.associations[i].getModel();

                    if (Entity.associations[i].type === 'hasOne') {
                        if (modelEntity[alias] !== undefined && includeExpandedAssociations !== false) {
                            foreignKey = modelEntity[alias][ForeignModel.primaryKeyFieldName];
                            object[Entity.associations[i].mappedBy] = foreignKey;
                            object[alias] = ForeignModel.getRawModelObject(modelEntity[alias]);
                        }
                        if (modelEntity[Entity.associations[i].mappedBy]) {
                            object[Entity.associations[i].mappedBy] = modelEntity[Entity.associations[i].mappedBy];
                        }
                    } else if (Entity.associations[i].type === 'hasMany' && includeExpandedAssociations !== false) {
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
            Entity.applyDefaultValues = function (entity) {
                var field;
                for (field in Entity.fields) {
                    if (Entity.fields.hasOwnProperty(field)) {
                        if (typeof Entity.fields[field].getDefaultValue === 'function' && entity[field] === undefined) {
                            entity[field] = Entity.fields[field].getDefaultValue(entity);
                        }
                    }
                }
            };

            /**
             * Transforms all objects returned by adapter transactions. This calls the transformResult function defined
             * in the model.
             *
             * @method transformResult
             * @param {Object} resultEntity
             * @returns {Object} The transformed result
             */
            Entity.transformResult = function (resultEntity) {
                resultEntity = Entity.getRawModelObject(resultEntity);
                if (typeof modelDefinition.transformResult === 'function') {
                    return modelDefinition.transformResult(resultEntity);
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
            Entity.preSave = function (entity) {
                entity = Entity.getRawModelObject(entity);
                if (typeof modelDefinition.preSave === 'function') {
                    return modelDefinition.preSave(entity);
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
            Entity.preCreate = function (rawEntity) {
                Entity.applyDefaultValues(rawEntity);
                if (typeof modelDefinition.preCreate === 'function') {
                    return modelDefinition.preCreate(rawEntity);
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
            Entity.preUpdate = function (rawEntity) {
                if (typeof modelDefinition.preUpdate === 'function') {
                    return modelDefinition.preUpdate(rawEntity);
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
             * @returns {promise} Resolves with the model
             */
            Entity.findOne = function (pk, queryOptions) {
                if (!pk) {
                    $log.error('BaseModelService: FindOne', 'The primary key was not supplied');
                    return $q.reject("The primary key was not supplied.");
                }

                return Entity.adapter.findOne(new RecallModel(Entity), pk, queryOptions).then(function (response) {
                    var result = Entity.transformResult(response.data);
                    var entity = new Entity(result, true);
                    $log.debug("BaseModelService: FindOne", new Response(entity), response, queryOptions);
                    return entity;
                }, propagateError);
            };

            /**
             * Retrieves a list of models from the adapter. Query options can be passed to determine top, skip, order by,
             * select, expand, and filter operations.
             *
             * @method find
             * @param {Object} [queryOptions] Query options to use for retrieval
             * @returns {promise} Resolves with data.results and data.totalCount where results are models
             */
            Entity.find = function (queryOptions) {
                return Entity.adapter.find(new RecallModel(Entity), queryOptions).then(function (response) {
                    var results = [];
                    var i;
                    for (i = 0; i < response.data.length; i++) {
                        results.push(new Entity(Entity.transformResult(response.data[i]), true));
                    }

                    var clientResponse = {
                        results: results,
                        totalCount: response.count
                    };
                    $log.debug("BaseModelService: Find", new Response(clientResponse), response, queryOptions);
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
            Entity.remove = function (pk, queryOptions) {
                if (!pk) {
                    $log.error('BaseModelService: Remove', 'The primary key was not supplied');
                    return $q.reject("The primary key was not supplied.");
                }
                return Entity.adapter.remove(new RecallModel(Entity), pk, queryOptions);
            };

            /**
             * Retrieves the Primary Key for the Entity.
             * @returns {String|Number} The Primary Key
             */
            Entity.prototype.$getPrimaryKey = function () {
                return this[Entity.primaryKeyFieldName];
            };

            /**
             * Expands a given association on an Entity
             *
             * @param {String} associationName The alias of the association to expand
             * @returns {promise}
             */
            Entity.prototype.$expand = function (associationName) {
                var association = Entity.getAssociationByAlias(associationName);

                if (!association) {
                    return $q.reject('BaseModelService: $expand could not find the association to expand.', associationName, this);
                }

                return association.expand(this);
            };

            /**
             * Validates an entity against the model's field definition.
             * @returns {Boolean} True if the model validation succeeds
             */
            Entity.prototype.$isValid = function () {
                // TODO: This does not validate associations
                var field;
                var valid = true;
                var matchesType = false;
                var fieldIsUndefined;
                for (field in Entity.fields) {
                    if (Entity.fields.hasOwnProperty(field)) {
                        fieldIsUndefined = (this[field] === null || this[field] === undefined);
                        if (Entity.fields[field].notNull === true && fieldIsUndefined) {
                            $log.debug("BaseModelService: $isValid returned false", "NotNull field was null", field, this);
                            return false;
                        }
                        switch (Entity.fields[field].type) {
                        case 'String':
                            matchesType = typeof this[field] === 'string';
                            break;
                        case 'Number':
                            matchesType = typeof this[field] === 'number';
                            break;
                        case 'Boolean':
                            matchesType = this[field] === true || this[field] === false;
                            break;
                        case 'Date':
                            matchesType = this[field] instanceof Date && !isNaN(Date.parse(this[field]));
                            break;
                        }
                        if (!matchesType && !fieldIsUndefined) {
                            $log.debug("BaseModelService: $isValid returned false", "The type was not " + Entity.fields[field].type, field, this);
                            return false;
                        }
                        if (typeof Entity.fields[field].validate === "function") {
                            valid = Entity.fields[field].validate(this[field]);
                            if (!valid) {
                                $log.debug("BaseModelService: $isValid returned false", "Custom validator failed", field, this);
                                return false;
                            }
                        }
                    }
                }
                return valid;
            };

            /**
             * Persists the model with the adapter. This will update the model if it exists in the adapter or create
             * the model if it does not exist.
             *
             * @method $save
             * @param {PreparedQueryOptions} queryOptions
             * @returns {promise} Resolves with the model
             */
            Entity.prototype.$save = function (queryOptions) {
                var self = this;
                var itemToSave = Entity.preSave(this);

                this.$entity.saveInProgress = true;

                var updateSavedState = function (entity, succeeded) {
                    if (succeeded !== false) {
                        self.$storeState();
                        self.$entity.persisted = true;
                        self.$entity.saveInProgress = false;
                        self.$entity.adapter = Entity.adapter;
                    } else {
                        self.$reset();
                        self.$entity.saveInProgress = false;
                    }
                };

                // The model exists in the DB
                if (self.$entity.persisted && itemToSave[Entity.primaryKeyFieldName]) {
                    itemToSave = Entity.preUpdate(itemToSave);

                    if (!self.$isValid()) {
                        $log.warn("BaseModelService: $save: aborted", self, self[Entity.primaryKeyFieldName]);
                        self.$reset();
                        return $q.reject("aborted");
                    }

                    var pk = itemToSave[Entity.primaryKeyFieldName];
                    return Entity.adapter.update(new RecallModel(Entity), pk, itemToSave, queryOptions).then(function (response) {
                        var result = Entity.transformResult(response.data);
                        Entity.extendFromRawObject(self, result);
                        updateSavedState(self, true);
                        $log.debug("BaseModelService: $save: update", self, itemToSave, response);
                        return self;
                    }, function (e) {
                        updateSavedState(self, false);
                        $log.error("BaseModelService: $save: update", self, itemToSave, e);
                        return $q.reject(e);
                    });
                }

                // The model is new
                itemToSave = Entity.preCreate(itemToSave);

                if (!self.$isValid()) {
                    $log.warn("BaseModelService: $save: aborted", self, self[Entity.primaryKeyFieldName]);
                    self.$reset();
                    return $q.reject("aborted");
                }

                return Entity.adapter.create(new RecallModel(Entity), itemToSave, queryOptions).then(function (response) {
                    var result = Entity.transformResult(response.data);
                    Entity.extendFromRawObject(self, result);
                    updateSavedState(self, true);
                    $log.debug("BaseModelService: $save: create", self, itemToSave, response);
                    return self;
                }, function (e) {
                    updateSavedState(self, false);
                    $log.error("BaseModelService: $save: create", self, itemToSave, e);
                    return $q.reject(e);
                });
            };

            /**
             * Removes the model from the adapter.
             *
             * @method $remove
             * @param {PreparedQueryOptions} queryOptions
             * @returns {promise}
             */
            Entity.prototype.$remove = function (queryOptions) {
                if (this[Entity.primaryKeyFieldName]) {
                    return Entity.adapter.remove(new RecallModel(Entity), this[Entity.primaryKeyFieldName], queryOptions);
                }
                $log.error('BaseModelService: $remove', 'The primary key was not found');
                return $q.reject("The primary key was not found.");
            };

            /**
             * Stores the model's state so that it can later be reset to the state if needed. This is called
             * on $save so that the model's state is always at the latest save point.
             *
             * @method $storeState
             */
            Entity.prototype.$storeState = function () {
                this.$entity.storedState = Entity.getRawModelObject(this);
                this.$entity.lastDirtyCheck = new Date().getTime();
                this.$entity.lastDirtyState = false;
            };

            /**
             * Checks to see if the properties have diverged from the stored state. If so, this means that
             * the properties have been changed and have not been saved.
             *
             * @method $isDirty
             * @returns {Boolean} True if the properties are different than what is in the stored state.
             */
            Entity.prototype.$isDirty = function () {
                if (this.$entity.saveInProgress) {
                    return false;
                }

                if (!this.$entity.storedState) {
                    return false;
                }

                var now = new Date().getTime();
                var delta = now - this.$entity.lastDirtyCheck;
                if (this.$entity.lastDirtyCheck && delta < baseModelService.dirtyCheckThreshold) {
                    return this.$entity.lastDirtyState;
                }

                this.$entity.lastDirtyCheck = new Date().getTime();

                var raw = Entity.getRawModelObject(this);

                // TODO: This does not dirty check associations
                var field;
                var viewValue;
                var storedValue;
                for (field in Entity.fields) {
                    if (Entity.fields.hasOwnProperty(field)) {
                        storedValue = this.$entity.storedState[field];
                        viewValue = raw[field];

                        if (storedValue !== viewValue) {
                            $log.debug("BaseModelService: $isDirty", this[Entity.primaryKeyFieldName], true, delta);
                            this.$entity.lastDirtyState = true;
                            return true;
                        }
                    }
                }

                $log.debug("BaseModelService: $isDirty", this[Entity.primaryKeyFieldName], false, delta);
                this.$entity.lastDirtyState = false;
                return false;
            };

            /**
             * Resets a model back to its stored state. This will reset any pending changes back to the
             * entities last save or initial retrieval.
             *
             * @method $reset
             * @returns {Array} A list of the changed field names and their before and after values
             */
            Entity.prototype.$reset = function () {
                if (!this.$entity.storedState) {
                    this.$storeState();
                    return [];
                }

                if (!this.$isDirty()) {
                    return [];
                }

                var prop;
                var changedProperties = [];

                for (prop in this.$entity.storedState) {
                    if (this.$entity.storedState.hasOwnProperty(prop) && this[prop] !== this.$entity.storedState[prop]) {
                        changedProperties.push({
                            name: prop,
                            before: this[prop],
                            after: this.$entity.storedState[prop]
                        });
                        this[prop] = this.$entity.storedState[prop];
                    }
                }

                this.$entity.lastDirtyState = false;
                this.$entity.lastDirtyCheck = new Date().getTime();

                $log.debug("BaseModelService: $reset", this[Entity.primaryKeyFieldName], changedProperties);
                return changedProperties;
            };

            // Call the model validation on the adapter after all Entity properties and methods are set.
            if (typeof adapter.modelValidationHook === 'function' && !adapter.modelValidationHook(Entity)) {
                return null;
            }

            baseModelService.models[Entity.modelName] = Entity;

            return Entity;
        };

        return baseModelService;
    }
]);