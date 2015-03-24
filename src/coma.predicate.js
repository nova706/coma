angular.module('coma').factory('comaPredicate', [
    function () {
        /*
         * BASED ON:
         * Predicate
         * version: 1.1.2
         * author: David Hamilton
         * license: https://github.com/nova706/PreparedQueryOptions/blob/master/LICENSE.txt (MIT)
         * https://github.com/nova706/PreparedQueryOptions
         *
         */

        /**
         * A predicate is used for the $filter operator in a query. Predicates can be joined to query
         * using a group of filters with the 'and' operator.
         *
         * This is a helper class for the PreparedQueryOptions class to assist in building complex
         * filter clauses.
         *
         * @class Predicate
         * @constructor
         * @param {String} [property] The property to filter by.
         * @param {Function} [parser] A function that returns the predicate string.
         */
        function Predicate(property, parser) {
            this.property = property;
            this.parser = parser;
            return this;
        }

        /**
         * Joins a provided set of predicates using the group operator and returns a new Predicate
         *
         * @method join
         * @param {Predicate[]} predicates Array of predicates to join.
         * @param {String} [groupOperator] The operator for the filter set ('and' 'or').
         * @return {Predicate} Predicate object.
         */
        Predicate.join = function (predicates, groupOperator) {
            if (predicates instanceof Array && predicates.length > 0) {
                return new Predicate().join(predicates, groupOperator);
            }
            return null;
        };

        /**
         * Sets the property of a predicate
         *
         * @method setProperty
         * @param {String} property
         * @return {Predicate} Predicate object.
         */
        Predicate.prototype.setProperty = function (property) {
            this.property = property;
            return this;
        };

        /**
         * Modifies an existing predicate setting the operator to 'eq' and the value to the input parameter
         *
         * @method equals
         * @param {String|Number|Boolean} (value) The value to match.
         * @return {Predicate} Used for chaining function calls
         */
        Predicate.prototype.equals = function (value) {
            this.parser = function () {
                return this.property + ' eq ' + escapeValue(value);
            };
            return this;
        };

        /**
         * Modifies an existing predicate setting the operator to 'ne' and the value to the input parameter
         *
         * @method notEqualTo
         * @param {String|Number|Boolean} (value) The value to match.
         * @return {Predicate} Used for chaining function calls
         */
        Predicate.prototype.notEqualTo = function (value) {
            this.parser = function () {
                return this.property + ' ne ' +  escapeValue(value);
            };
            return this;
        };

        /**
         * Modifies an existing predicate setting the operator to 'gt' and the value to the input parameter
         *
         * @method greaterThan
         * @param {String|Number|Boolean} (value) The value to match.
         * @return {Predicate} Used for chaining function calls
         */
        Predicate.prototype.greaterThan = function (value) {
            this.parser = function () {
                return this.property + ' gt ' +  escapeValue(value);
            };
            return this;
        };

        /**
         * Modifies an existing predicate setting the operator to 'ge' and the value to the input parameter
         *
         * @method greaterThanOrEqualTo
         * @param {String|Number|Boolean} (value) The value to match.
         * @return {Predicate} Used for chaining function calls
         */
        Predicate.prototype.greaterThanOrEqualTo = function (value) {
            this.parser = function () {
                return this.property + ' ge ' +  escapeValue(value);
            };
            return this;
        };

        /**
         * Modifies an existing predicate setting the operator to 'lt' and the value to the input parameter
         *
         * @method lessThan
         * @param {String|Number|Boolean} (value) The value to match.
         * @return {Predicate} Used for chaining function calls
         */
        Predicate.prototype.lessThan = function (value) {
            this.parser = function () {
                return this.property + ' lt ' +  escapeValue(value);
            };
            return this;
        };

        /**
         * Modifies an existing predicate setting the operator to 'le' and the value to the input parameter
         *
         * @method lessThanOrEqualTo
         * @param {String|Number|Boolean} (value) The value to match.
         * @return {Predicate} Used for chaining function calls
         */
        Predicate.prototype.lessThanOrEqualTo = function (value) {
            this.parser = function () {
                return this.property + ' le ' +  escapeValue(value);
            };
            return this;
        };

        /**
         * Modifies an existing predicate setting the operation to substringof and the value to the input parameter
         *
         * @method contains
         * @param {String|Number|Boolean} (value) The value to match.
         * @return {Predicate} Used for chaining function calls
         */
        Predicate.prototype.contains = function (value) {
            this.parser = function () {
                return 'substringof(' +  escapeValue(value) + ', ' + this.property + ')';
            };
            return this;
        };

        /**
         * Modifies an existing predicate setting the operation to startswith and the value to the input parameter
         *
         * @method startsWith
         * @param {String|Number|Boolean} (value) The value to match.
         * @return {Predicate} Used for chaining function calls
         */
        Predicate.prototype.startsWith = function (value) {
            this.parser = function () {
                return 'startswith(' + this.property + ', ' +  escapeValue(value) + ')';
            };
            return this;
        };

        /**
         * Modifies an existing predicate setting the operation to endswith and the value to the input parameter
         *
         * @method startsWith
         * @param {String|Number|Boolean} (value) The value to match.
         * @return {Predicate} Used for chaining function calls
         */
        Predicate.prototype.endsWith = function (value) {
            this.parser = function () {
                return 'endswith(' + this.property + ', ' +  escapeValue(value) + ')';
            };
            return this;
        };

        /**
         * Joins an existing predicate with additional predicates using the group operator
         *
         * @method join
         * @param {Predicate|Predicate[]} predicates A single predicate or an array of predicates to join to the existing one.
         * @param {String} [groupOperator] The operator for the filter set ('and' 'or').
         * @return {Predicate} Used for chaining function calls
         */
        Predicate.prototype.join = function (predicates, groupOperator) {
            var initialPredicate;

            if (this.property && typeof this.parser === 'function') {
                initialPredicate = new Predicate(this.property, this.parser);
            }

            var newPredicates = [];
            if (predicates instanceof Predicate) {
                newPredicates.push(predicates);
            } else if (predicates instanceof Array && predicates.length > 0) {
                var i;
                for (i = 0; i < predicates.length; i++) {
                    if (predicates[i]) {
                        newPredicates.push(predicates[i]);
                    }
                }
            }

            if (newPredicates.length > 0) {
                delete this.parser;
                delete this.property;

                this.joinedPredicates = (this.joinedPredicates) ? this.joinedPredicates.concat(newPredicates) : newPredicates;
                if (groupOperator || !this.groupOperator) {
                    this.groupOperator = (groupOperator === 'or') ? 'or' : 'and';
                }
                if (initialPredicate) {
                    this.joinedPredicates.unshift(initialPredicate);
                }
            }

            return this;
        };

        /**
         * Joins an existing predicate with additional predicates using the 'and' group operator
         *
         * @method and
         * @param {Predicate|Predicate[]} predicates A single predicate or an array of predicates to join to the existing one.
         * @return {Predicate} Used for chaining function calls
         */
        Predicate.prototype.and = function (predicates) {
            return this.join(predicates, 'and');
        };

        /**
         * Joins an existing predicate with additional predicates using the 'or' group operator
         *
         * @method or
         * @param {Predicate|Predicate[]} predicates A single predicate or an array of predicates to join to the existing one.
         * @return {Predicate} Used for chaining function calls
         */
        Predicate.prototype.or = function (predicates) {
            return this.join(predicates, 'or');
        };

        /**
         * Evaluate an object to see if it matches the predicate filter conditions.
         *
         * @method test
         * @param {Object} object The object to test against the predicate.
         * @param {Boolean} [failOnMissingAssociation=true] Should the test fail when the a filter is performed against an expanded association that is not present
         * @return {Boolean} True if the object matches the filter conditions.
         */
        Predicate.prototype.test = function (object, failOnMissingAssociation) {
            return testPredicate(this, object, failOnMissingAssociation);
        };

        /**
         * Builds and returns a URL parameter string based on the predicate.
         *
         * @method parsePredicate
         * @param {Boolean} [nested = false] Used for building the nested group during recursion
         * @returns {String}
         */
        Predicate.prototype.parsePredicate = function (nested) {
            nested = (nested === true);
            var urlString = '';

            if (this.property && typeof this.parser === 'function') {
                return this.parser();
            }

            if (this.joinedPredicates && this.joinedPredicates.length > 0) {
                var i;
                var predicate;
                var predicateString;
                for (i = 0; i < this.joinedPredicates.length; i++) {
                    predicate = this.joinedPredicates[i];
                    predicateString = predicate.parsePredicate(true);
                    urlString += (i > 0) ? ' ' + this.groupOperator + ' ' + predicateString : predicateString;
                }
            }

            return nested ? '(' + urlString + ')' : urlString;
        };

        /**
         * Creates a predicate structure from a string
         *
         * @method fromString
         * @param {String} predicateString
         * @return {Predicate|null} null if the predicate could not be built from the string
         */
        Predicate.fromString = function (predicateString) {
            if (typeof predicateString !== "string") {
                return null;
            }

            // Extract all the filters out of the predicate string
            var conditionMatcher = new RegExp("(substringof\\(.+?\\)|startswith\\(.+?\\)|endswith\\(.+?\\)|[\\w\\.]+?\\s(?:eq|ne|gt|ge|lt|le)\\s(?:\\w+|\\'.+?\\'))", "g");
            var filters = predicateString.match(conditionMatcher);

            if (!filters) {
                return null;
            }

            // Convert each filter into a predicate
            var i;
            for (i = 0; i < filters.length; i++) {
                filters[i] = getPredicateFromSegment(filters[i]);
                if (filters[i] === null) {
                    return null;
                }
            }

            if (filters.length === 0) {
                return null;
            }

            // Remove all predicates from string
            i = 0;
            predicateString = predicateString.replace(conditionMatcher, function () {
                return i++;
            });

            if (filters.length === 1) {
                if (predicateString.replace(/[0-9]|\s|and|or/g, "") !== "") {
                    return null;
                }
                return filters[0];
            }

            return buildPredicateFromMap(predicateString, filters);
        };

        /**
         * Builds a predicate based on a predicate map and array of extracted filters
         * @param {String} predicateMap A String representing a map of a predicate where the indexes map to the filters array
         *                              "1 and (2 or 3)" where filters.length === 3
         * @param {Predicate[]} filters An array of Predicates whose index map to the indexes on the predicateMap
         * @returns {Predicate|Null} The resulting Predicate or null if the map is invalid
         */
        var buildPredicateFromMap = function (predicateMap, filters) {
            var closeParenthesisIndex;
            var openParenthesisIndex;
            var groupString;
            var filterIndexes;
            var groupPredicate = null;
            var groupFilters;
            var operator;
            var testNextLevel = true;

            while (testNextLevel) {
                closeParenthesisIndex = predicateMap.indexOf(')');
                if (closeParenthesisIndex !== -1) {
                    openParenthesisIndex = predicateMap.lastIndexOf('(', closeParenthesisIndex);
                    groupString = predicateMap.substring(openParenthesisIndex + 1, closeParenthesisIndex);
                    predicateMap = predicateMap.substring(0, openParenthesisIndex) + filters.length + predicateMap.substring(closeParenthesisIndex + 1);
                } else {
                    groupString = predicateMap;
                    testNextLevel = false;
                }

                // If the group contains invalid characters then return null as an invalid predicate string.
                if (groupString.replace(/[0-9]|\s|and|or/g, "") !== "") {
                    return null;
                }

                // If the group uses both 'and' and 'or' then return null as an invalid predicate string.
                if (groupString.indexOf('and') >= 0 && groupString.indexOf('or') >= 0) {
                    return null;
                }

                filterIndexes = groupString.match(/[0-9]+/g);
                groupFilters = [];
                var i;
                for (i = 0; i < filterIndexes.length; i++) {
                    groupFilters.push(filters[Number(filterIndexes[i])]);
                }
                operator = groupString.indexOf('or') >= 0 ? 'or' : 'and';
                groupPredicate = new Predicate().join(groupFilters, operator);
                filters.push(groupPredicate);
            }

            return groupPredicate;
        };

        /**
         * Takes a predicate's value and if it is a string, adds single quotes around it.
         *
         * @method escapeValue
         * @param {String|Boolean|Number|Date} value
         * @returns {string} The string value
         */
        var escapeValue = function (value) {
            if (value instanceof Date) {
                value = value.toISOString();
            }
            return (typeof value === 'string') ? "'" + value + "'" : value.toString();
        };

        /**
         * Returns the raw value of the predicate string
         *
         * @method convertValueToType
         * @param {String} value
         * @returns {String|Boolean|Number}
         */
        var convertValueToType = function (value) {
            if (typeof value === 'string') {
                if (value.indexOf("'") >= 0) {
                    return value.replace(/\'/g, '');
                }
                if (value.toLowerCase() === 'true') {
                    return true;
                }
                if (value.toLowerCase() === 'false') {
                    return false;
                }
            }
            if (!isNaN(value)) {
                return Number(value);
            }
            return value;
        };

        /**
         * Tests a predicate group to see if the object matches
         * @param {Predicate} predicate
         * @param {Object} object
         * @returns {Boolean} True if the object matches the predicate
         */
        var testPredicateGroup = function (predicate, object) {
            var result;
            var i;
            for (i = 0; i < predicate.joinedPredicates.length; i++) {
                result = testPredicate(predicate.joinedPredicates[i], object);

                // If the operator is 'and' and any of the filters do not match, return false.
                if (predicate.groupOperator === 'and' && result === false) {
                    return false;
                }

                // If the operator is 'or' and any of the filters match, return true.
                if (predicate.groupOperator === 'or' && result === true) {
                    return true;
                }
            }

            // The operator was 'and' and all of the filters matched or the operator was 'or' and none of the filters matched.
            return predicate.groupOperator === 'and';
        };

        /**
         * Tests an object to see if the filter conditions match a given predicate. Used for recursive tests.
         *
         * @param {Predicate} predicate
         * @param {Object} object
         * @param {Boolean} [failOnMissingAssociation=true] Should the test fail when the a filter is performed against an expanded association that is not present
         */
        var testPredicate = function (predicate, object, failOnMissingAssociation) {
            if (predicate.joinedPredicates && predicate.joinedPredicates.length > 0) {
                return testPredicateGroup(predicate, object);
            }
            if (predicate.property) {
                var propertyPath = predicate.property.split('.');
                var objectValue = object;
                var i;
                for (i = 0; i < propertyPath.length; i++) {
                    if (objectValue.hasOwnProperty(propertyPath[i]) && objectValue[propertyPath[i]] !== undefined) {
                        objectValue = objectValue[propertyPath[i]];
                    } else {
                        return (failOnMissingAssociation === false);
                    }
                }

                var condition = predicate.parsePredicate();
                if (condition.indexOf('(') >= 0) {
                    return testComplexPredicate(condition, objectValue);
                }
                return testSimplePredicate(condition, objectValue);
            }

            return false;
        };

        /**
         * Tests a complex predicate that uses startswith, endswith, or substringof
         * @param {String} condition The Predicate condition
         * @param {String|Number|Boolean} objectValue The value that is being tested
         * @returns {Boolean} True if the object value matches the condition
         */
        var testComplexPredicate = function (condition, objectValue) {
            var value;
            var operator = condition.substr(0, condition.indexOf('('));
            var start = condition.indexOf('(') + 1;
            var end = condition.indexOf(')') - start;
            var conditionParams = condition.substr(start, end);
            conditionParams = conditionParams.replace(/\'/g, '').split(', ');

            switch (operator) {
                case 'startswith':
                    value = conditionParams[1].toLowerCase();
                    return (objectValue.indexOf(value) === 0);
                case 'endswith':
                    value = conditionParams[1].toLowerCase();
                    return (objectValue.indexOf(value) === objectValue.length - 1 - value.length);
                case 'substringof':
                    value = conditionParams[0].toLowerCase();
                    return (objectValue.indexOf(value) >= 0);
            }

            return false;
        };

        /**
         * Tests a simple predicate that uses lt, gt, le, ge, ne, or eq
         * @param {String} condition The Predicate condition
         * @param {String|Number|Boolean} objectValue The value that is being tested
         * @returns {Boolean} True if the object value matches the condition
         */
        var testSimplePredicate = function (condition, objectValue) {
            var conditionParams = condition.split(' ');
            var operator = conditionParams[1];

            var value = conditionParams.slice(2).join(' ');
            value = convertValueToType(value);

            // If both the predicate value and the object values are Date-like, convert them to dates to compare
            if (objectValue instanceof Date && !isNaN(Date.parse(value))) {
                value = Date.parse(value);
                objectValue = objectValue.getTime();
            } else if (typeof objectValue === 'string' && !isNaN(Date.parse(objectValue))) {
                objectValue = Date.parse(objectValue);
                value = Date.parse(value);
            }

            /* jshint eqeqeq: false */
            switch (operator) {
                case 'lt':
                    return objectValue < value;
                case 'gt':
                    return objectValue > value;
                case 'le':
                    return objectValue <= value;
                case 'ge':
                    return objectValue >= value;
                case 'ne':
                    return objectValue != value;
                case 'eq':
                    return objectValue == value;
            }
            /* jshint eqeqeq: true */

            return false;
        };

        /**
         * Builds a predicate from a complex segment that uses startswith, endswith, or substringof
         * @param {String} condition The predicate condition
         * @returns {Predicate} The resulting Predicate
         */
        var getComplexPredicateFromSegment = function (condition) {
            var predicate;
            var value;
            var parenPos = condition.indexOf('(');
            var operator = condition.substring(0, parenPos);
            var conditionParams = condition.substring(parenPos + 1, condition.indexOf(')')).split(', ');

            switch (operator) {
                case 'startswith':
                    value = convertValueToType(conditionParams[1]);
                    predicate = new Predicate(conditionParams[0]).startsWith(value);
                    break;
                case 'endswith':
                    value = convertValueToType(conditionParams[1]);
                    predicate = new Predicate(conditionParams[0]).endsWith(value);
                    break;
                case 'substringof':
                    value = convertValueToType(conditionParams[0]);
                    predicate = new Predicate(conditionParams[1]).contains(value);
                    break;
            }

            return predicate;
        };

        /**
         * Builds a predicate from a simple segment that uses eq, ne, gt, ge, lt, or le
         * @param {String} condition The predicate condition
         * @returns {Predicate} The resulting Predicate
         */
        var getSimplePredicateFromSegment = function (condition) {
            var conditionParams = condition.split(' ');
            var operator = conditionParams[1];
            var value = convertValueToType(conditionParams.slice(2).join(' '));

            var predicate = new Predicate(conditionParams[0]);

            switch (operator) {
                case 'eq':
                    predicate.equals(value);
                    break;
                case 'ne':
                    predicate.notEqualTo(value);
                    break;
                case 'gt':
                    predicate.greaterThan(value);
                    break;
                case 'ge':
                    predicate.greaterThanOrEqualTo(value);
                    break;
                case 'lt':
                    predicate.lessThan(value);
                    break;
                case 'le':
                    predicate.lessThanOrEqualTo(value);
                    break;
            }
            return predicate;
        };

        /**
         * Creates a predicate from a single condition eg: "property eq 'value'"
         *
         * @param {String} condition
         * @return {Predicate} The predicate built from the condition
         */
        var getPredicateFromSegment = function (condition) {
            if (condition.indexOf('(') >= 0) {
                return getComplexPredicateFromSegment(condition);
            }
            return getSimplePredicateFromSegment(condition);
        };

        return Predicate;
    }
]);