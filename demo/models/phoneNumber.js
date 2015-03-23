angular.module('comaDemo').factory('PhoneNumber', [
    'coma',

    function (coma) {
        return coma.defineModel({
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