/**
 * Root Controller.
 * Binds to the root view to provide common functionality to all states inheriting from the root state.
 */
angular.module('comaDemo').controller('RootCtrl', [
    '$scope',
    'Person',
    'PhoneNumber',
    'comaPreparedQueryOptions',

    function ($scope, Person, PhoneNumber, PreparedQueryOptions) {

        $scope.viewPerson = null;
        $scope.viewPhoneNumber = null;

        var queryPhoneNumbers = function () {
            PhoneNumber.find().then(function (response) {
                $scope.phoneNumbers = response.results;
                if ($scope.phoneNumbers[0]) {
                    $scope.phoneNumbers[0].someOtherProperty = 'test';
                }
            });
        };

        var queryPeople = function () {
            var queryOptions = new PreparedQueryOptions().$expand('phoneNumbers').$orderBy('added desc');
            Person.find(queryOptions).then(function (response) {
                $scope.people = response.results;
            });
        };

        $scope.createPerson = function () {
            var person = new Person({
                firstName: 'John',
                lastName: 'Doe'
            });
            person.$save().then(function () {
                $scope.people.push(person);
            });
        };

        $scope.removePerson = function (person, $index) {
            person.$remove().then(function () {
                $scope.people.splice($index, 1);
            });
        };

        $scope.addPhoneNumber = function (person) {
            var phoneNumber = new PhoneNumber({
                number: '555-555-5555',
                primary: true,
                personId: person.id
            });
            phoneNumber.$save().then(function () {
                $scope.phoneNumbers.push(phoneNumber);
                person.phoneNumbers.push(phoneNumber);
            });
        };

        $scope.removePhoneNumber = function (phoneNumber) {
            var i;
            for (i = 0; i < $scope.phoneNumbers.length; i++) {
                if ($scope.phoneNumbers[i].id === phoneNumber.id) {
                    $scope.phoneNumbers[i].$remove().then(function () {
                        $scope.phoneNumbers.splice(i, 1);
                    });
                    break;
                }
            }
        };

        $scope.dropDatabase = function () {
            window.indexedDB.deleteDatabase("comaDemo");
            location.reload();
        };

        queryPhoneNumbers();
        queryPeople();
    }
]);