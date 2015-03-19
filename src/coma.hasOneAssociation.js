angular.module('coma').factory("comaHasOneAssociation", [
    '$log',

    function ($log) {

        /**
         * Has One Association class
         * @param {Object} definition
         * @constructor
         */
        var HasOneAssociation = function (definition) {
            this.invalid = false;
            this.type = 'hasOne';

            this.modelName = definition.modelName || definition.hasOne;
            this.alias = definition.as || this.modelName;
            this.foreignKey = definition.foreignKey;
            this.getModel = function () {
                return HasOneAssociation.getAssociationModel(this.modelName);
            };

            if (!this.modelName || !this.foreignKey) {
                $log.error('HasOneAssociation: The association definition is invalid', definition);
                this.invalid = true;
            }
        };

        // Implemented by the baseModelService
        HasOneAssociation.getAssociationModel = null;

        return HasOneAssociation;
    }
]);