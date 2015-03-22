angular.module('comaDemo').factory('Person', [
    'coma',

    function (coma) {
        return coma.defineModel({
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
                entity.lastModified = moment(entity.lastModified).toDate();
                return entity;
            }
        });
    }
]);