angular.module('recall').factory("recallAssociation", [
    '$injector',
    '$log',
    '$q',
    'recallPredicate',
    'recallPreparedQueryOptions',

    function ($injector, $log, $q, Predicate, PreparedQueryOptions) {

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
            this.getOptions = definition.getOptions || function () { return new PreparedQueryOptions() };

            if (!this.modelName || !this.type || !this.mappedBy) {
                $log.error('Association: The association definition is invalid', definition);
                this.invalid = true;
            }
        };

        /**
         * Gets the Association's Model
         * @returns {Object} The model
         */
        Association.prototype.getModel = function () {
            var recallService = $injector.get('recall');
            return recallService.getModel(this.modelName);
        };

        /**
         * Expands the association and adds it to the entity
         * @param {Entity} entity The entity to add the expanded association to
         * @returns {promise}
         */
        Association.prototype.expand = function (entity) {
            var dfd = $q.defer();
            var self = this;
            var Model = self.getModel();

            if (!Model) {
                return $q.reject('Association: Expand could not find the association\'s Model');
            }

            var queryOptions = self.getOptions(entity);

            if (self.type === 'hasOne') {

                Model.adapter.findOne(Model, entity[self.mappedBy], queryOptions).then(function (response) {
                    entity[self.alias] = Model.getRawModelObject(response.data);
                    // TODO: The association should be an entity and should have transformResult called
                    entity.$entity.storedState[self.alias] = Model.getRawModelObject(response.data);
                    $log.debug("Association: Expand", self.type, self.alias, entity, response);
                    dfd.resolve();
                }, function (e) {
                    $log.error("Association: Expand", self.type, self.alias, entity, e);
                    dfd.reject(e);
                });

            } else if (self.type === 'hasMany') {

                var predicate = new Predicate(self.mappedBy).equals(entity.$getPrimaryKey());
                var existingPredicate = queryOptions.$filter();
                if (existingPredicate) {
                    predicate = Predicate.and([predicate, existingPredicate]);
                }
                queryOptions.$filter(predicate);

                Model.adapter.find(Model, queryOptions).then(function (response) {
                    var base = [];
                    var stored = [];
                    // TODO: The associations should be entities and should have transformResult called
                    var i;
                    for (i = 0; i < response.data.length; i++) {
                        base.push(Model.getRawModelObject(response.data[i]));
                        stored.push(Model.getRawModelObject(response.data[i]));
                    }
                    entity[self.alias] = base;
                    entity.$entity.storedState[self.alias] = stored;
                    $log.debug("Association: Expand", self.type, self.alias, entity, response);
                    dfd.resolve();
                }, function (e) {
                    $log.error("Association: Expand", self.type, self.alias, entity, e);
                    dfd.reject(e);
                });
            } else {
                $log.error("Association: Expand Association type not supported", self.type, self.alias, entity);
                dfd.reject("Association type not supported");
            }

            return dfd.promise;
        };

        return Association;
    }
]);