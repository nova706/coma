/**
 * The recallProvider is the entry point for common configuration options. Specific adapters may have their own
 * configuration options
 */
angular.module('recall').provider('recall', [
    function () {
        var config = {};

        // The default adapter to use unless otherwise specified by the model Definition
        config.adapter = null;
        this.setAdapter = function (adapter) {
            config.adapter = adapter;
            return this;
        };

        // Time in milliseconds to throttle Entity dirty checking. This allows for multiple digest cycles to pass
        // between checking if an Entity is dirty by examining its stored state
        config.dirtyCheckThreshold = 30;
        this.setDirtyCheckThreshold = function (dirtyCheckThreshold) {
            config.dirtyCheckThreshold = dirtyCheckThreshold;
            return this;
        };

        // The default last modified field name. To enable synchronization, this must be set.
        config.lastModifiedFieldName = null;
        this.setLastModifiedFieldName = function (lastModifiedFieldName) {
            config.lastModifiedFieldName = lastModifiedFieldName;
            return this;
        };

        // The default soft delete field name. To enable synchronization, this must be set.
        config.deletedFieldName = null;
        this.setDeletedFieldName = function (deletedFieldName) {
            config.deletedFieldName = deletedFieldName;
            return this;
        };

        this.$get = ['$injector', 'recallModel', 'recallAssociation', function ($injector, Model, Association) {

            var service = {
                adapter: config.adapter,
                lastModifiedFieldName: config.lastModifiedFieldName,
                deletedFieldName: config.deletedFieldName,
                dirtyCheckThreshold: config.dirtyCheckThreshold,
                models: {}
            };

            /**
             * Get an array of the defined Models.
             * @returns {Entity[]} The models
             */
            service.getModels = function () {
                var theModels = [];
                var model;
                for (model in this.models) {
                    if (this.models.hasOwnProperty(model)) {
                        theModels.push(this.models[model]);
                    }
                }
                return theModels;
            };

            /**
             * Gets a defined model by its name
             * @param {String} modelName
             * @returns {Entity} The model or null if the model is not found
             */
            service.getModel = function (modelName) {
                return this.models[modelName] || null;
            };

            // Create a proxy on Association class
            Association.getAssociationModel = function (modelName) {
                return service.getModel(modelName);
            };

            /**
             * Creates a model based on a definition.
             * @param {Object} modelDefinition The definition of the model including fields and associations
             * @param {Object} [adapter] The adapter that is used to perform the CRUD actions
             * @returns {Model} The model
             */
            service.defineModel = function (modelDefinition, adapter) {
                adapter = adapter || this.adapter;

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
                if (this.models[modelDefinition.name]) {
                    return this.models[modelDefinition.name];
                }

                var model = new Model(modelDefinition);
                model.setLastModifiedFieldName(this.lastModifiedFieldName);
                model.setDeletedFieldName(this.deletedFieldName);
                model.setAdapter(adapter);
                model.setDirtyCheckThreshold(this.dirtyCheckThreshold);

                var fieldsValid = model.initializeModelFields();

                if (!fieldsValid) {
                    return null;
                }

                model.initializeAssociations();

                // Call the model validation on the adapter after all Entity properties and methods are set.
                if (typeof adapter.modelValidationHook === 'function' && !adapter.modelValidationHook(model)) {
                    return null;
                }

                this.models[model.modelName] = model;

                return model;
            };

            return service;
        }];
    }
]);