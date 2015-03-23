angular.module('coma').factory("comaAssociation", [
    '$log',

    function ($log) {

        /**
         * Association class
         * @param {Object|Association} definition
         * @constructor
         */
        var Association = function (definition) {
            this.invalid = false;

            if (definition.type) {
                this.type = definition.type;
            } else if (typeof definition.hasOne === 'string') {
                this.type = 'hasOne';
            } else if (typeof definition.hasMany === 'string') {
                this.type = 'hasMany';
            }

            this.modelName = definition.modelName || definition.hasOne || definition.hasMany;
            this.alias = definition.as || definition.alias || this.modelName;
            this.mappedBy = definition.mappedBy || definition.foreignKey;
            this.getModel = function () {
                return Association.getAssociationModel(this.modelName);
            };

            if (!this.modelName || !this.type || !this.mappedBy) {
                $log.error('Association: The association definition is invalid', definition);
                this.invalid = true;
            }
        };

        // Implemented by the baseModelService
        Association.getAssociationModel = null;

        return Association;
    }
]);