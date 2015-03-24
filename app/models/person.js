/**
 * The Person model is used to demo local <-> remote sync.
 */
angular.module('recallDemo').factory('Person', [
    'recall',

    function (recall) {
        return recall.defineModel({
            name: "person",
            dataSourceName: "people",
            fields: {
                id: {
                    primaryKey: true,
                    type: "String"
                },
                firstName: {
                    type: "String",
                    index: "firstName",
                    notNull: true
                },
                lastName: "String",
                lastModified: {
                    type: "Date",
                    index: true
                }
            },
            associations: [
                {
                    hasMany: 'phoneNumber',
                    as: 'phoneNumbers',
                    mappedBy: 'personId'
                }
            ],
            transformResult: function (entity) {
                entity.lastModified = new Date(entity.lastModified);
                return entity;
            }
        });
    }
]);