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

        var queryPhoneNumbers = function () {
            var queryOptions = new PreparedQueryOptions().$expand('person');
            PhoneNumber.find(queryOptions).then(function (response) {
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

        $scope.createPhoneNumber = function () {
            var phoneNumber = new PhoneNumber({
                number: '555-555-5555',
                primary: true,
                personId: ($scope.people[0]) ? $scope.people[0].id : null
            });
            phoneNumber.$save().then(function () {
                $scope.phoneNumbers.push(phoneNumber);
            });
        };

        $scope.removePhoneNumber = function (phoneNumber, $index) {
            phoneNumber.$remove().then(function () {
                $scope.phoneNumbers.splice($index, 1);
            });
        };

        $scope.dropDatabase = function () {
            window.indexedDB.deleteDatabase("comaDemo");
            location.reload();
        };

        queryPhoneNumbers();
        queryPeople();
    }
]);