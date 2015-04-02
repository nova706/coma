angular.module('recall').factory("recallModelField", [
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

            this.primaryKey = false;
            this.unique = false;
            this.index = false;
            this.notNull = false;

            if (typeof definition === 'string') {
                this.type = definition.toUpperCase();
            } else if (definition.primaryKey === true) {
                asPrimaryKey(this, definition);
            } else {
                fromDefinition(this, definition);
            }

            if (!this.validateField()) {
                $log.error('ModelField: The field definition is invalid', this, definition);
            }
        };

        ModelField.prototype.validateField = function () {
            if (!this.name || !this.type) {
                this.invalid = true;
                return false;
            }
            if (this.name.match(/[^\w+]/) !== null) {
                this.invalid = true;
                return false;
            }
            this.invalid = false;
            return true;
        };

        var asPrimaryKey = function (field, definition) {
            // The adapter or the adapter's handler should enforce uniqueness of the primary key.
            // The index on the primary key should be handled automatically without needing to specify an index.
            // In order to pass validation during creation, the primary key should not be set as notNull.
            // This of course should be enforced by the adapter or the adapter's handler.
            field.primaryKey = true;
            field.type = definition.type ? definition.type.toUpperCase() : null;
            field.notNull = false;
            field.unique = false;
            field.index = false;

            if (typeof definition.getDefaultValue === 'function') {
                $log.warn('ModelField: getDefaultValue is ignored for the primary key');
            }
            if (typeof definition.validate === 'function') {
                $log.warn('ModelField: validate is ignored for the primary key');
            }
        };

        var fromDefinition = function (field, definition) {
            field.type = definition.type ? definition.type.toUpperCase() : null;
            field.unique = definition.unique === true;
            field.index = (typeof definition.index === 'string') ? definition.index : (definition.index === true) ? field.name : false;
            field.notNull = definition.notNull === true;

            if (typeof definition.getDefaultValue === 'function') {
                field.getDefaultValue = definition.getDefaultValue;
            }
            if (typeof definition.validate === 'function') {
                field.validate = definition.validate;
            }
        };

        return ModelField;
    }
]);