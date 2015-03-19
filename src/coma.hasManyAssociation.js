angular.module('coma').factory("comaHasManyAssociation", [
    '$log',

    function ($log) {

        /**
         * Has Many Association class
         * @param {Object} definition
         * @constructor
         */
        var HasManyAssociation = function (definition) {
            this.invalid = false;
            this.type = 'hasMany';

            this.modelName = definition.modelName || definition.hasMany;
            this.alias = definition.as || this.modelName;
            this.mappedBy = definition.mappedBy;
            this.getModel = function () {
                return HasManyAssociation.getAssociationModel(this.modelName);
            };

            if (!this.modelName || !this.mappedBy) {
                $log.error('HasManyAssociation: The association definition is invalid', definition);
                this.invalid = true;
            }
        };

        // Implemented by the baseModelService
        HasManyAssociation.getAssociationModel = null;

        return HasManyAssociation;
    }
]);