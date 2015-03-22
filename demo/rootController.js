/**
 * Root Controller.
 * Binds to the root view to provide common functionality to all states inheriting from the root state.
 */
angular.module('comaDemo').controller('RootCtrl', [
    '$scope',
    'Person',
    'comaPreparedQueryOptions',

    function ($scope, Person, PreparedQueryOptions) {

        $scope.localPerson = null;
        $scope.remotePerson = null;
        $scope.localPeople = [];
        $scope.remotePeople = [];
        $scope.view = 'local';

        $scope.viewPerson = function (person) {
            if (($scope.localPerson && person.id === $scope.localPerson.id) || ($scope.remotePerson && person.id === $scope.remotePerson.id)) {
                $scope.localPerson = null;
                $scope.remotePerson = null;
                return;
            }
            var i;
            for (i = 0; i < $scope.localPeople.length; i++) {
                if ($scope.localPeople[i].id === person.id) {
                    $scope.localPerson = $scope.localPeople[i];
                }
            }
            for (i = 0; i < $scope.remotePeople.length; i++) {
                if ($scope.remotePeople[i].id === person.id) {
                    $scope.remotePerson = $scope.remotePeople[i];
                }
            }
        };

        var queryPeople = function () {
            var queryOptions = new PreparedQueryOptions().$orderBy('lastModified desc');
            var i;
            Person.find(queryOptions).then(function (response) {
                $scope.localPeople = response.results;
                if ($scope.localPerson) {
                    for (i = 0; i < $scope.localPeople.length; i++) {
                        if ($scope.localPeople[i].id === $scope.localPerson.id) {
                            $scope.localPerson = $scope.localPeople[i];
                        }
                    }
                }
            });
            Person.find(queryOptions, true).then(function (response) {
                $scope.remotePeople = response.results;
                if ($scope.remotePerson) {
                    for (i = 0; i < $scope.remotePeople.length; i++) {
                        if ($scope.remotePeople[i].id === $scope.remotePerson.id) {
                            $scope.remotePerson = $scope.remotePeople[i];
                        }
                    }
                }
            });
        };

        $scope.createPerson = function (remote) {
            var person = new Person({
                firstName: 'John',
                lastName: 'Doe'
            });
            person.$save(remote).then(function () {
                if (remote) {
                    $scope.remotePeople.push(person);
                } else {
                    $scope.localPeople.push(person);
                }
            });
        };

        $scope.removePerson = function (person, $index, remote) {
            person.$remove().then(function () {
                if (remote) {
                    $scope.remotePeople.splice($index, 1);
                    if ($scope.remotePerson && $scope.remotePerson.id === person.id) {
                        $scope.remotePerson = null;
                    }
                } else {
                    $scope.localPeople.splice($index, 1);
                    if ($scope.localPerson && $scope.localPerson.id === person.id) {
                        $scope.localPerson = null;
                    }
                }
            });
        };

        $scope.syncPeople = function () {
            Person.synchronize().then(function () {
                queryPeople();
            });
        };

        $scope.dropDatabase = function () {
            if (confirm("Are you sure? This will delete your local database.")) {
                window.indexedDB.deleteDatabase("comaDemo");
            }
        };

        queryPeople();
    }
]);