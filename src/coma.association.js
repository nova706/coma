angular.module('coma').factory("comaAssociation", [
    '$log',
    '$q',
    'comaPredicate',
    'comaPreparedQueryOptions',

    function ($log, $q, Predicate, PreparedQueryOptions) {

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

        Association.prototype.expand = function (entity, remote) {
            var dfd = $q.defer();
            var self = this;
            var Model = self.getModel();

            if (!Model) {
                return $q.reject('Association: Expand could not find the association\'s Model');
            }

            var adapter = (remote === true && Model.remoteAdapter) ? Model.remoteAdapter : Model.localAdapter;

            if (self.type === 'hasOne') {

                adapter.findOne(Model, entity[self.mappedBy]).then(function (response) {
                    entity[self.alias] = Model.getRawModelObject(response.data);
                    entity.$entity.storedState[self.alias] = Model.getRawModelObject(response.data);
                    $log.debug("Association: Expand", self.type, self.alias, entity, response);
                    dfd.resolve();
                }, function (e) {
                    $log.error("Association: Expand", self.type, self.alias, entity, e);
                    dfd.reject(e);
                });

            } else if (self.type === 'hasMany') {

                var predicate = new Predicate(self.mappedBy).equals(entity.$getPrimaryKey());
                var queryOptions = new PreparedQueryOptions().$filter(predicate);

                adapter.find(Model, queryOptions).then(function (response) {
                    var base = [];
                    var stored = [];
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
            }

            return dfd.promise();
        };

        // Implemented by the baseModelService
        Association.getAssociationModel = null;

        return Association;
    }
]);