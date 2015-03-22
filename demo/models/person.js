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
                    getDefaultValue: function () {
                        return new Date();
                    },
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
            preSave: function (entity) {
                entity.lastModified = moment().toISOString();
                return entity;
            },
            transformResult: function (entity) {
                entity.lastModified = moment(entity.lastModified).toDate();
                return entity;
            }
        });
    }
]);