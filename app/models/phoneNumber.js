/**
 * The PhoneNumber model is used to demo association handling in entities.
 */
angular.module('recallDemo').factory('PhoneNumber', [
    'recall',

    function (recall) {
        return recall.defineModel({
            name: "phoneNumber",
            dataSourceName: "phonenumbers",
            fields: {
                id: {
                    primaryKey: true,
                    type: "String"
                },
                number: "String",
                primary: {
                    type: "Boolean",
                    index: "primary"
                },
                lastModified: {
                    type: "Date",
                    index: true
                }
            },
            associations: [
                {
                    hasOne: 'person',
                    as: 'person',
                    foreignKey: 'personId'
                }
            ],
            transformResult: function (entity) {
                entity.lastModified = new Date(entity.lastModified);
                return entity;
            }
        });
    }
]);