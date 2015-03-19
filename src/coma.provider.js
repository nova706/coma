angular.module('coma').provider('coma', [
    function () {
        var config = {};
        var models = {};

        config.adapter = 'comaIndexedDBAdapter'; // TODO: Add fallback for when indexedDB is not supported
        this.setAdapter = function (adapter) {
            config.adapter = adapter;
            return this;
        };

        config.dirtyCheckThreshold = 30;
        this.setDirtCheckThreshold = function (dirtyCheckThreshold) {
            config.dirtyCheckThreshold = dirtyCheckThreshold;
            return this;
        };

        this.$get = ['$injector', 'comaBaseModelService', function ($injector, comaBaseModelService) {
            var service = {
                config: config
            };

            service.getModels = function () {
                var theModels = [];
                var model;
                for (model in models) {
                    if (models.hasOwnProperty(model)) {
                        theModels.push(models[model]);
                    }
                }
                return theModels;
            };

            service.getModel = function (modelName) {
                return models[modelName];
            };

            service.defineModel = function (modelDefinition) {
                var adapter = $injector.get(config.adapter);
                if (!modelDefinition || !modelDefinition.name) {
                    return;
                }
                if (!models[modelDefinition.name]) {
                    models[modelDefinition.name] = comaBaseModelService.defineModel(modelDefinition, adapter, service.config, service.getModel);
                }
                return models[modelDefinition.name];
            };

            return service;
        }];
    }
]);