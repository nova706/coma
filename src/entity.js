angular.module('recall').factory("recallEntity", [
    '$log',
    '$q',

    function ($log, $q) {

        /**
         * An Entity is an object that represents an instance of a Model. The Entity instance exposes save and remove
         * operations as well as dirty checking and validation.
         *
         * @param {Object} object The object to construct the entity from
         * @param {Object} model The model that created the Entity
         * @param {Boolean} [persisted = false] Set to true if this model was created from an object that came from an adapter.
         * @constructor
         */
        var Entity = function (object, model, persisted) {
            model.extendFromRawObject(this, object);

            Object.defineProperty(this, "$entity", {value: {
                lastDirtyCheck: new Date().getTime(),
                lastDirtyState: false,
                persisted: persisted === true,
                saveInProgress: false,
                storedState: null
            }});
            Object.defineProperty(this, "$model", {value: model});

            this.$convertAssociationsToEntities();
            this.$storeState();
        };

        /**
         * Retrieves the Primary Key for the Entity.
         * @returns {String|Number} The Primary Key
         */
        Entity.prototype.$getPrimaryKey = function () {
            return this[this.$model.primaryKeyFieldName];
        };

        /**
         *
         */
        Entity.prototype.$convertAssociationsToEntities = function () {
            var i;
            var alias;
            var ForeignModel;
            var a;
            for (i = 0; i < this.$model.associations.length; i++) {
                alias = this.$model.associations[i].alias;
                ForeignModel = this.$model.associations[i].getModel();

                if (this.$model.associations[i].type === 'hasOne') {
                    if (this[alias] !== undefined && !this[alias].$entity) {
                        this[alias] = new ForeignModel.Entity(this[alias], this.$entity.persisted);
                    }
                } else if (this.$model.associations[i].type === 'hasMany') {
                    if (this[alias] !== undefined && this[alias] instanceof Array) {
                        for (a = 0; a < this[alias].length; a++) {
                            if (!this[alias][a].$entity) {
                                this[alias][a] = new ForeignModel.Entity(this[alias][a], this.$entity.persisted);
                            }
                        }
                    }
                }
            }
        };

        /**
         * Expands a given association on an Entity
         *
         * @param {String} associationName The alias of the association to expand
         * @returns {promise}
         */
        Entity.prototype.$expand = function (associationName) {
            var association = this.$model.getAssociationByAlias(associationName);

            if (!association) {
                return $q.reject('Entity: $expand could not find the association.');
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
            var matchesType = false;
            var fieldIsUndefined;
            for (field in this.$model.fields) {
                if (this.$model.fields.hasOwnProperty(field)) {
                    fieldIsUndefined = (this[field] === null || this[field] === undefined);
                    if (this.$model.fields[field].notNull === true && fieldIsUndefined) {
                        $log.debug("Entity: $isValid returned false", "NotNull field was null", field, this);
                        return false;
                    }
                    switch (this.$model.fields[field].type) {
                        case 'STRING':
                            matchesType = typeof this[field] === 'string';
                            break;
                        case 'NUMBER':
                            matchesType = typeof this[field] === 'number';
                            break;
                        case 'BOOLEAN':
                            matchesType = this[field] === true || this[field] === false;
                            break;
                        case 'DATE':
                            matchesType = this[field] instanceof Date || !isNaN(Date.parse(this[field]));
                            break;
                    }
                    if (!matchesType && !fieldIsUndefined) {
                        $log.debug("Entity: $isValid returned false", field + " was not a " + this.$model.fields[field].type, this);
                        return false;
                    }
                    if (typeof this.$model.fields[field].validate === "function" && !this.$model.fields[field].validate(this[field])) {
                        $log.debug("Entity: $isValid returned false", "Custom validator failed", field, this);
                        return false;
                    }
                }
            }
            return true;
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
            var dfd = $q.defer();
            var self = this;

            if (!self.$isValid()) {
                $log.warn("Entity: $save: aborted", self, self[self.$model.primaryKeyFieldName]);
                self.$reset();
                return $q.reject("aborted");
            }

            self.$entity.saveInProgress = true;
            var itemToSave = self.$model.preSave(self);

            var updateSavedState = function (entity, succeeded) {
                entity.$entity.saveInProgress = false;
                if (succeeded !== false) {
                    entity.$storeState();
                    entity.$entity.persisted = true;
                } else {
                    entity.$reset();
                }
            };

            // The model exists in the DB
            if (self.$entity.persisted && itemToSave[self.$model.primaryKeyFieldName]) {
                itemToSave = self.$model.preUpdate(itemToSave);

                var pk = itemToSave[self.$model.primaryKeyFieldName];
                self.$model.adapter.update(self.$model, pk, itemToSave, queryOptions).then(function (response) {
                    var result = self.$model.transformResult(response.data);
                    self.$model.extendFromRawObject(self, result);
                    updateSavedState(self, true);
                    $log.debug("Entity: $save: update", self, itemToSave, response);
                    dfd.resolve(self);
                }, function (e) {
                    updateSavedState(self, false);
                    $log.error("Entity: $save: update", self, itemToSave, e);
                    dfd.reject(e);
                });
            } else {
                // The model is new
                itemToSave = self.$model.preCreate(itemToSave);
                self.$model.adapter.create(self.$model, itemToSave, queryOptions).then(function (response) {
                    var result = self.$model.transformResult(response.data);
                    self.$model.extendFromRawObject(self, result);
                    updateSavedState(self, true);
                    $log.debug("Entity: $save: create", self, itemToSave, response);
                    dfd.resolve(self);
                }, function (e) {
                    updateSavedState(self, false);
                    $log.error("Entity: $save: create", self, itemToSave, e);
                    dfd.reject(e);
                });
            }

            return dfd.promise;
        };

        /**
         * Removes the model from the adapter.
         *
         * @method $remove
         * @param {PreparedQueryOptions} queryOptions
         * @returns {promise}
         */
        Entity.prototype.$remove = function (queryOptions) {
            if (this[this.$model.primaryKeyFieldName]) {
                return this.$model.adapter.remove(this.$model, this[this.$model.primaryKeyFieldName], queryOptions);
            }
            $log.error('Entity: $remove', 'The primary key was not found');
            return $q.reject("The primary key was not found.");
        };

        /**
         * Stores the model's state so that it can later be reset to the state if needed. This is called
         * on $save so that the model's state is always at the latest save point.
         *
         * @method $storeState
         */
        Entity.prototype.$storeState = function () {
            this.$entity.storedState = this.$model.getRawModelObject(this, false);
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
            if (this.$entity.lastDirtyCheck && delta < this.$model.dirtyCheckThreshold) {
                return this.$entity.lastDirtyState;
            }

            this.$entity.lastDirtyCheck = new Date().getTime();

            // TODO: This does not dirty check associations
            var field;
            var viewValue;
            var storedValue;
            for (field in this.$model.fields) {
                if (this.$model.fields.hasOwnProperty(field)) {
                    storedValue = this.$entity.storedState[field];
                    viewValue = this[field];

                    if (storedValue !== viewValue) {
                        $log.debug("Entity: $isDirty", this[this.$model.primaryKeyFieldName], true, delta);
                        this.$entity.lastDirtyState = true;
                        return true;
                    }
                }
            }

            $log.debug("Entity: $isDirty", this[this.$model.primaryKeyFieldName], false, delta);
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

            $log.debug("Entity: $reset", this[this.$model.primaryKeyFieldName], changedProperties);
            return changedProperties;
        };

        return Entity;
    }
]);