angular.module('coma').factory("comaModelField", [
    '$log',

    function ($log) {

        /**
         * Model Field class to make all model fields consistent
         * @param {String} name
         * @param {Object | String} definition The Field Definition or the Field Type
         * @constructor
         */
        var ModelField = function (name, definition) {
            this.invalid = false;
            this.name = name;

            if (typeof definition === 'string') {
                this.type = definition;
                this.primaryKey = false;
                this.unique = false;
                this.index = false;
                this.notNull = false;
            } else {
                this.type = definition.type;
                this.primaryKey = definition.primaryKey === true;
                this.unique = definition.unique === true;
                this.index = (typeof definition.index === 'string') ? definition.index : (definition.index === true) ? name : false;
                this.notNull = definition.notNull === true;

                if (typeof definition.getDefaultValue === 'function') {
                    this.getDefaultValue = definition.getDefaultValue;
                }
            }

            // The adapter or the adapter's handler should enforce uniqueness of the primary key.
            // The index on the primary key should be handled automatically without needing to specify an index.
            // In order to pass validation during creation, the primary key should not be set as notNull.
            // This of course should be enforced by the adapter or the adapter's handler.
            if (this.primaryKey) {
                this.notNull = false;
                this.unique = false;
                this.index = false;
            }

            // TODO: Better field validation
            if (!this.name || !this.type) {
                this.invalid = true;
                $log.error('ModelField: The field definition is invalid', this, definition);
            }
        };

        return ModelField;
    }
]);