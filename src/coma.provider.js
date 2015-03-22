angular.module('coma').provider('coma', [
    function () {
        var config = {};

        config.localAdapter = null;
        this.setLocalAdapter = function (localAdapter) {
            config.localAdapter = localAdapter;
            return this;
        };

        config.remoteAdapter = null;
        this.setRemoteAdapter = function (remoteAdapter) {
            config.remoteAdapter = remoteAdapter;
            return this;
        };

        config.dirtyCheckThreshold = 30;
        this.setDirtCheckThreshold = function (dirtyCheckThreshold) {
            config.dirtyCheckThreshold = dirtyCheckThreshold;
            return this;
        };

        config.lastModifiedFieldName = null;
        this.setLastModifiedFieldName = function (lastModifiedFieldName) {
            config.lastModifiedFieldName = lastModifiedFieldName;
            return this;
        };

        config.deletedFieldName = null;
        this.setDeletedFieldName = function (deletedFieldName) {
            config.deletedFieldName = deletedFieldName;
            return this;
        };

        this.$get = ['comaBaseModelService', function (comaBaseModelService) {
            var service = {
                config: config
            };

            // To Avoid circular dependency, add the config to the baseModelService
            comaBaseModelService.setDirtyCheckThreshold(config.dirtyCheckThreshold);
            comaBaseModelService.setLastModifiedFieldName(config.lastModifiedFieldName);
            comaBaseModelService.setDeletedFieldName(config.deletedFieldName);
            if (config.localAdapter) {
                comaBaseModelService.setLocalAdapter(config.localAdapter);
            }
            if (config.remoteAdapter) {
                comaBaseModelService.setRemoteAdapter(config.remoteAdapter);
            }

            // Add Aliases from the base model service
            service.getModels = comaBaseModelService.getModels;
            service.getModel = comaBaseModelService.getModel;
            service.defineModel = comaBaseModelService.defineModel;

            return service;
        }];
    }
]);