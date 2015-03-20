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
                added: {
                    type: "Date",
                    getDefaultValue: function () {
                        return new Date();
                    },
                    index: true
                },
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
            ]
        });
    }
]);