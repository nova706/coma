angular.module('coma').factory('comaPreparedQueryOptions', [
    'comaPredicate',

    function (Predicate) {
        /*
         * PreparedQueryOptions
         * version: 1.1.2
         * author: David Hamilton
         * license: https://github.com/nova706/PreparedQueryOptions/blob/master/LICENSE.txt (MIT)
         * https://github.com/nova706/PreparedQueryOptions
         *
         */

        /**
         * PreparedQueryOptions are used to set, store and parse OData query parameters. Instead of passing
         * multiple arguments to methods for each query option, simply pass the preparedQueryOptions object.
         * Use the parseOptions method on the object to return an OData string for a query.
         *
         * @class PreparedQueryOptions
         * @constructor
         */
        function PreparedQueryOptions() {
            /**
             * Stores the query options that have been set.
             * @property options
             * @type Object
             * @default {}
             */
            this.options = {};
        }

        var isPredicate = function (object) {
            return object && typeof object === "object" && typeof object.parsePredicate === "function";
        };

        /**
         * Sets the number of results to retrieve. Passing a null top value will clear the top option. Negating the value
         * will return the current top value.
         *
         * @method $top
         * @param {Number} [top] Number of results to query for.
         * @return {PreparedQueryOptions|Number} PreparedQueryOptions object or the current $top value.
         */
        PreparedQueryOptions.prototype.$top = function (top) {
            if (arguments.length === 0) {
                return this.options.$top || null;
            }
            if (typeof top === 'number' && top >= 0) {
                this.options.$top = top;
            }
            if (top === null) {
                delete this.options.$top;
            }
            return this;
        };

        /**
         * Sets the index of the first result to retrieve. Passing a null skip value will clear the skip option. Negating the
         * value will return the current skip value.
         *
         * @method $skip
         * @param {Number} [skip] The index of the first result to retrieve
         * @return {PreparedQueryOptions|Number} PreparedQueryOptions object or the current $skip value.
         */
        PreparedQueryOptions.prototype.$skip = function (skip) {
            if (arguments.length === 0) {
                return this.options.$skip || null;
            }
            if (typeof skip === 'number' && skip >= 0) {
                this.options.$skip = skip;
            }
            if (skip === null) {
                delete this.options.$skip;
            }
            return this;
        };

        /**
         * Sets orderBy string. Passing a null order by value will clear the order by option. Negating the value will return
         * the current order by value.
         *
         * @method $orderBy
         * @param {String} [orderBy] The orderBy string used to retrieve the results in a sorted order.
         * @return {PreparedQueryOptions|String} PreparedQueryOptions object or the current $orderby value.
         */
        PreparedQueryOptions.prototype.$orderBy = function (orderBy) {
            if (arguments.length === 0) {
                return this.options.$orderby || null;
            }
            if (orderBy && typeof orderBy === 'string') {
                this.options.$orderby = orderBy;
            }
            if (orderBy === null) {
                delete this.options.$orderby;
            }
            return this;
        };

        /**
         * Sets expand string. Passing a null expand value will clear the expand option. Negating the value will return the
         * current expand value.
         *
         * @method $expand
         * @param {String | Array} [foreignKey] The foreignKey to expand when retrieving the results.
         * @return {PreparedQueryOptions|String} PreparedQueryOptions object or the current $expand value.
         */
        PreparedQueryOptions.prototype.$expand = function (foreignKey) {
            if (arguments.length === 0) {
                return this.options.$expand || null;
            }
            if (typeof foreignKey === 'string') {
                this.options.$expand = foreignKey;
            } else if (foreignKey instanceof Array) {
                this.options.$expand = foreignKey.join(',');
            }
            if (foreignKey === null) {
                delete this.options.$expand;
            }
            return this;
        };

        /**
         * Sets select string. Passing a null select value will clear the select option. Negating the value will return the
         * current select value.
         *
         * @method $select
         * @param {String | Array} [property] A single property name or array of property names to select.
         * @return {PreparedQueryOptions|String} PreparedQueryOptions object or the current $select value.
         */
        PreparedQueryOptions.prototype.$select = function (property) {
            if (arguments.length === 0) {
                return this.options.$select || null;
            }
            if (typeof property === 'string') {
                this.options.$select = property;
            } else if (property instanceof Array) {
                this.options.$select = property.join(',');
            }
            if (property === null) {
                delete this.options.$select;
            }
            return this;
        };

        /**
         * Enables or disables inline count. Passing a null inline count value will clear the inline count option. Negating
         * the value will return the current inline count value: "allpages" or null.
         *
         * @method $inlineCount
         * @param {Boolean} [enable=true] Flag to enable or disable inline count.
         * @return {PreparedQueryOptions|String} PreparedQueryOptions object or the current $inlinecount value.
         */
        PreparedQueryOptions.prototype.$inlineCount = function (enable) {
            if (arguments.length === 0) {
                return this.options.$inlinecount || null;
            }
            if (enable !== false && enable !== null) {
                this.options.$inlinecount = "allpages";
            } else {
                delete this.options.$inlinecount;
            }
            return this;
        };

        /**
         * Sets the filter option. Include the Predicate class to assist in building complex filter clauses.
         * Passing a null filter value will clear the filter option. Negating the value will return the current filter value.
         *
         * @method $filter
         * @param {String | Predicate} [filter] The filter clause to use when retrieving the results.
         * @return {PreparedQueryOptions|Predicate} PreparedQueryOptions object or the current $filter predicate.
         */
        PreparedQueryOptions.prototype.$filter = function (filter) {
            if (arguments.length === 0) {
                return this.options.$filter || null;
            }
            if (filter && typeof filter === 'string') {
                this.options.$filter = Predicate.fromString(filter);
            } else if (isPredicate(filter)) {
                this.options.$filter = filter;
            }
            if (filter === null) {
                delete this.options.$filter;
            }
            return this;
        };

        /**
         * Sets a custom query option parameter. Passing a null value will clear the filter. Negating the value will return
         * the current custom filter value.
         *
         * @method custom
         * @param {String} optionName The name of the option. Must not start with '$'.
         * @param {String|Number|Boolean} [value] The string value of the option.
         * @return {PreparedQueryOptions} PreparedQueryOptions object or the current custom filter value.
         */
        PreparedQueryOptions.prototype.custom = function (optionName, value) {
            if (arguments.length === 1) {
                return this.options[optionName] || null;
            }
            if (optionName && typeof optionName === 'string' && optionName.indexOf('$') !== 0 && value && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) {
                this.options[optionName] = value;
            }
            if (optionName && value === null) {
                delete this.options[optionName];
            }
            return this;
        };

        /**
         * Extend existing query with options from another query. Only the original query will be modified. Any
         * matching options will be overridden in the original query.
         *
         * @method extend
         * @param {PreparedQueryOptions} preparedQueryOptions The prepared query objects with the properties to be added.
         * @return {PreparedQueryOptions} PreparedQueryOptions object.
         */
        PreparedQueryOptions.prototype.extend = function (preparedQueryOptions) {
            var key;
            for (key in preparedQueryOptions.options) {
                if (preparedQueryOptions.options.hasOwnProperty(key)) {
                    this.options[key] = preparedQueryOptions.options[key];
                }
            }
            return this;
        };

        /**
         * Builds and returns a URL parameter string based on the query options.
         *
         * @method parseOptions
         * @returns {String}
         * @example '$top=25&$skip=0'
         */
        PreparedQueryOptions.prototype.parseOptions = function () {
            var parameters = '';

            var appendSeparator = function () {
                parameters += (parameters === '') ? '?' : '&';
            };

            var option;
            for (option in this.options) {
                if (this.options.hasOwnProperty(option)) {
                    appendSeparator();
                    if (isPredicate(this.options[option])) {
                        parameters += option + '=' + this.options[option].parsePredicate();
                    } else {
                        parameters += option + '=' + this.options[option];
                    }
                }
            }

            return parameters;
        };

        /**
         * Class method to create a new PreparedQueryOptions object from a simple object
         *
         * @method fromObject
         * @param {Object} object the object to build from
         * @returns {PreparedQueryOptions}
         */
        PreparedQueryOptions.fromObject = function (object) {
            var preparedQueryOptions = new PreparedQueryOptions();
            var property;
            for (property in object) {
                if (object.hasOwnProperty(property) && typeof preparedQueryOptions[property] === "function") {
                    preparedQueryOptions[property](object[property]);
                }
            }
            return preparedQueryOptions;
        };

        return PreparedQueryOptions;
    }
]);