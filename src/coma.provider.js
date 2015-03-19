angular.module('coma').provider('coma', [
    function () {
        var config = {};

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

        this.$get = ['comaBaseModelService', function (comaBaseModelService) {
            var service = {
                config: config
            };

            // To Avoid circular dependency, add the config to the baseModelService
            comaBaseModelService.setDirtyCheckThreshold(config.dirtyCheckThreshold);
            comaBaseModelService.setDefaultAdapter(config.adapter);

            // Add Aliases from the base model service
            service.getModels = comaBaseModelService.getModels;
            service.getModel = comaBaseModelService.getModel;
            service.defineModel = comaBaseModelService.defineModel;

            return service;
        }];
    }
]);