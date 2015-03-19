angular.module('coma').factory("comaBaseModelService", [
    '$q',
    'comaLogger',
    'comaPreparedQueryOptions',
    'comaPredicate',

    function ($q, CommaLogger, PreparedQueryOptions, Predicate) {
        var log = new CommaLogger(4, "Coma Model");
        var baseModelService = {};

        var propagateError = function (e) {
            return $q.reject(e);
        };

        // Convenience class for logging.
        var ComaModel = function (model) {
            angular.extend(this, model);
        };

        // Convenience class for logging.
        var Representation = function (response) {
            angular.extend(this, response);
        };

        // Convenience class for logging.
        var ServerResponse = function (response) {
            angular.extend(this, response);
        };

        // TODO: Validated the model definition
        baseModelService.defineModel = function (modelDefinition, adapter, config, getModel) {

            /**
             * An Entity is an object that represents an instance of a Model. The class has basic CRUD operations as
             * well as some utilities. The Entity instance exposes save and move operations as well as dirty checking.
             *
             * @param {Object} object The object to construct the entity from
             * @param {Boolean} [fromAdapter = false] Set to true if this model was created from an object that came
             *                                         from a adapter.
             * @constructor
             */
            var Entity = function (object, fromAdapter) {
                Entity.extendFromRawObject(this, object);

                this.$entity = {
                    fromAdapter: fromAdapter === true,
                    lastDirtyCheck: new Date().getTime(),
                    lastDirtyState: false,
                    saveInProgress: false,
                    storedState: null
                };

                this.$storeState();
            };

            Entity.fields = {};
            Entity.associations = [];
            Entity.primaryKeyFieldName = null;
            Entity.name = modelDefinition.name;
            Entity.dataSourceName = modelDefinition.dataSourceName || modelDefinition.name;

            var initializeEntityFields = function () {
                var field;
                for (field in modelDefinition.fields) {
                    if (modelDefinition.fields.hasOwnProperty(field)) {
                        if (typeof modelDefinition.fields[field] === "string") {
                            Entity.fields[field] = {
                                type: modelDefinition.fields[field],
                                unique: false,
                                index: false
                            };
                        } else {
                            Entity.fields[field] = modelDefinition.fields[field];
                            if (modelDefinition.fields[field].primaryKey) {
                                Entity.primaryKeyFieldName = field;
                            }
                            if (Entity.fields[field].unique !== true) {
                                Entity.fields[field].unique = false;
                            }
                            if (!Entity.fields[field].index) {
                                Entity.fields[field].index = false;
                            }
                        }
                    }
                }
            };
            initializeEntityFields();

            // TODO: Support many to many associations
            var initializeAssociations = function () {
                if (!modelDefinition.associations) {
                    return;
                }
                var i;
                for (i = 0; i < modelDefinition.associations.length; i++) {
                    if (typeof modelDefinition.associations[i].hasOne === 'string' && modelDefinition.associations[i].foreignKey) {
                        Entity.associations.push({
                            modelName: modelDefinition.associations[i].hasOne,
                            type: 'hasOne',
                            alias: modelDefinition.associations[i].as || modelDefinition.associations[i].hasOne,
                            foreignKey: modelDefinition.associations[i].foreignKey,
                            foreignKeyType: modelDefinition.associations[i].foreignKeyType
                        });
                        Entity.fields[modelDefinition.associations[i].foreignKey] = {
                            type: modelDefinition.associations[i].foreignKeyType,
                            unique: modelDefinition.associations[i].unique === false,
                            index: modelDefinition.associations[i].foreignKey
                        };
                    } else if (typeof modelDefinition.associations[i].hasMany === 'string') {
                        Entity.associations.push({
                            modelName: modelDefinition.associations[i].hasMany,
                            type: 'hasMany',
                            alias: modelDefinition.associations[i].as || modelDefinition.associations[i].hasMany,
                            foreignKey: modelDefinition.associations[i].mappedBy,
                            foreignKeyType: Entity.fields[Entity.primaryKeyFieldName].type
                        });
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
             * a adapter.
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
             * foreignKey field for on one to n associations and sets the association to the raw association object.
             *
             * @param {Object} modelEntity
             * @param {Boolean} [includeExpandedAssociations = true] Include the expanded association in the raw object.
             * @returns {Object} The raw object
             */
            Entity.getRawModelObject = function (modelEntity, includeExpandedAssociations) {
                var object = {};
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
                    ForeignModel = getModel(Entity.associations[i].modelName);

                    if (Entity.associations[i].type === 'hasOne') {
                        if (modelEntity[alias] !== undefined && includeExpandedAssociations !== false) {
                            foreignKey = modelEntity[alias][ForeignModel.primaryKeyFieldName];
                            object[Entity.associations[i].foreignKey] = foreignKey;
                            object[alias] = ForeignModel.getRawModelObject(modelEntity[alias]);
                        }
                        if (modelEntity[Entity.associations[i].foreignKey]) {
                            object[Entity.associations[i].foreignKey] = modelEntity[Entity.associations[i].foreignKey];
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
                            entity[field] = Entity.fields[field].getDefaultValue();
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
                    log.error('FindOne', 'The primary key was not supplied');
                    return $q.reject("The primary key was not supplied.");
                }
                return adapter.findOne(new ComaModel(Entity), pk, queryOptions).then(function (response) {
                    var result = Entity.transformResult(response);
                    var entity = new Entity(result, true);
                    log.debug("FindOne", new Representation(entity), new ServerResponse(response), queryOptions);
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
                return adapter.find(new ComaModel(Entity), queryOptions).then(function (response) {
                    var responseResults = [];
                    var pointerToResults = adapter.resultsField;
                    if (pointerToResults) {
                        responseResults = response[pointerToResults];
                    } else {
                        responseResults = response;
                    }

                    var results = [];
                    var i;
                    for (i = 0; i < responseResults.length; i++) {
                        results.push(new Entity(Entity.transformResult(responseResults[i]), true));
                    }

                    var clientResponse = {
                        results: results,
                        totalCount: response[adapter.totalCountField]
                    };
                    log.debug("Find", new Representation(clientResponse), new ServerResponse(response), queryOptions);
                    return clientResponse;
                }, propagateError);
            };

            /**
             * Removes the model from the adapter given a primary key.
             *
             * @method remove
             * @returns {promise}
             */
            Entity.remove = function (pk) {
                if (!pk) {
                    log.error('Remove', 'The primary key was not supplied');
                    return $q.reject("The primary key was not supplied.");
                }
                return adapter.remove(new ComaModel(Entity), pk);
            };

            /**
             * Expands a given association on an Entity
             *
             * @param {String} associationName The alias of the association to expand
             * @returns {promise}
             */
            Entity.prototype.$expand = function (associationName) {
                var dfd = $q.defer();
                var self = this;
                var association = Entity.getAssociationByAlias(associationName);
                if (association) {
                    var Model = getModel(association.modelName);
                    if (Model && association.type === 'hasOne' && self[association.foreignKey] !== undefined) {
                        adapter.findOne(new ComaModel(Model), self[association.foreignKey]).then(function (result) {
                            self[association.alias] = Model.getRawModelObject(result);
                            self.$entity.storedState[association.alias] = Model.getRawModelObject(result);
                            log.debug("$expand", association.type, associationName, self, new ServerResponse(result));
                            dfd.resolve();
                        }, function (e) {
                            log.error("$expand", association.type, associationName, self, e);
                            dfd.reject(e);
                        });
                    } else if (Model && association.type === 'hasMany') {

                        var predicate = new Predicate(association.foreignKey).equals(self[Entity.primaryKeyFieldName]);
                        var queryOptions = new PreparedQueryOptions().$filter(predicate);

                        adapter.find(new ComaModel(Model), queryOptions).then(function (response) {
                            var responseResults = [];
                            var pointerToResults = adapter.resultsField;
                            if (pointerToResults) {
                                responseResults = response[pointerToResults];
                            } else {
                                responseResults = response;
                            }

                            var base = [];
                            var stored = [];
                            var i;
                            for (i = 0; i < responseResults.length; i++) {
                                base.push(Model.getRawModelObject(responseResults[i]));
                                stored.push(Model.getRawModelObject(responseResults[i]));
                            }
                            self[association.alias] = base;
                            self.$entity.storedState[association.alias] = stored;
                            log.debug("$expand", association.type, associationName, self, new ServerResponse(response));
                            dfd.resolve();
                        }, function (e) {
                            log.error("$expand", association.type, associationName, self, e);
                            dfd.reject(e);
                        });
                    } else {
                        dfd.resolve();
                    }
                } else {
                    dfd.resolve();
                }
                return dfd.promise;
            };

            /**
             * Validates an entity against the model's field definition.
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
                            log.debug("$isValid returned false", "NotNull field was null", field, this);
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
                            log.debug("$isValid returned false", "The type was not " + Entity.fields[field].type, field, this);
                            return false;
                        }
                        if (typeof Entity.fields[field].validate === "function") {
                            valid = Entity.fields[field].validate(this[field]);
                            if (!valid) {
                                log.debug("$isValid returned false", "Custom validator failed", field, this);
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
             * @returns {promise} Resolves with the model
             */
            Entity.prototype.$save = function () {
                var self = this;
                var itemToSave = Entity.preSave(this);

                this.$entity.saveInProgress = true;

                // The model exists in the DB
                if (self.$entity.fromAdapter && itemToSave[Entity.primaryKeyFieldName]) {
                    itemToSave = Entity.preUpdate(itemToSave);

                    if (!self.$isValid()) {
                        log.warn("$save: aborted", self, self[Entity.primaryKeyFieldName]);
                        return $q.reject("aborted");
                    }

                    return adapter.update(new ComaModel(Entity), itemToSave[Entity.primaryKeyFieldName], itemToSave).then(function (response) {
                        var result = Entity.transformResult(response);
                        Entity.extendFromRawObject(self, result);
                        self.$storeState();
                        self.$entity.fromAdapter = true;
                        self.$entity.saveInProgress = false;
                        log.debug("$save: update", self, itemToSave, new ServerResponse(response));
                        return self;
                    }, function (e) {
                        self.$reset();
                        self.$entity.saveInProgress = false;
                        log.error("$save: update", self, itemToSave, e);
                        return $q.reject(e);
                    });
                }

                // The model is new
                itemToSave = Entity.preCreate(itemToSave);

                if (!self.$isValid()) {
                    log.warn("$save: aborted", self, self[Entity.primaryKeyFieldName]);
                    return $q.reject("aborted");
                }

                return adapter.create(new ComaModel(Entity), itemToSave).then(function (response) {
                    var result = Entity.transformResult(response);
                    Entity.extendFromRawObject(self, result);
                    self.$storeState();
                    self.$entity.fromAdapter = true;
                    self.$entity.saveInProgress = false;
                    log.debug("$save: create", self, itemToSave, new ServerResponse(response));
                    return self;
                }, function (e) {
                    self.$reset();
                    self.$entity.saveInProgress = false;
                    log.error("$save: create", self, itemToSave, e);
                    return $q.reject(e);
                });
            };

            /**
             * Removes the model from the adapter.
             *
             * @method $remove
             * @returns {promise}
             */
            Entity.prototype.$remove = function () {
                if (this[Entity.primaryKeyFieldName]) {
                    return Entity.remove(this[Entity.primaryKeyFieldName]);
                }
                log.error('$remove', 'The primary key was not found');
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
                if (this.$entity.lastDirtyCheck && delta < config.dirtyCheckThreshold) {
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
                            log.debug("$isDirty", this[Entity.primaryKeyFieldName], true, delta);
                            this.$entity.lastDirtyState = true;
                            return true;
                        }
                    }
                }

                log.debug("$isDirty", this[Entity.primaryKeyFieldName], false, delta);
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

                log.debug("$reset", this[Entity.primaryKeyFieldName], changedProperties);
                return changedProperties;
            };

            return Entity;
        };

        return baseModelService;
    }
]);