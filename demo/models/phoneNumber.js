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
                }
            },
            associations: [
                {
                    hasOne: 'person',
                    as: 'person',
                    foreignKey: 'personId'
                }
            ]
        });
    }
]);