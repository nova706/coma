/**
 * Demo Controller to show usage of Recall functionality
 */
angular.module('recallDemo').controller('RootCtrl', [
    '$scope',
    'Person',
    'recallPreparedQueryOptions',

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
            var personFound = false;

            // Find all people from the local adapter
            Person.find(queryOptions).then(function (response) {
                $scope.localPeople = response.results;
                if ($scope.localPerson) {
                    personFound = false;
                    for (i = 0; i < $scope.localPeople.length; i++) {
                        if ($scope.localPeople[i].id === $scope.localPerson.id) {
                            $scope.localPerson = $scope.localPeople[i];
                            personFound = true;
                        }
                    }
                    if (!personFound) {
                        $scope.localPerson = null;
                    }
                }
            });

            // Find all people from the remote adapter
            Person.find(queryOptions, true).then(function (response) {
                $scope.remotePeople = response.results;
                if ($scope.remotePerson) {
                    personFound = false;
                    for (i = 0; i < $scope.remotePeople.length; i++) {
                        if ($scope.remotePeople[i].id === $scope.remotePerson.id) {
                            $scope.remotePerson = $scope.remotePeople[i];
                            personFound = true;
                        }
                    }
                    if (!personFound) {
                        $scope.remotePerson = null;
                    }
                }
            });
        };

        // Creates a new Person entity and saves it to the adapter
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

        // Removes a person entity from the adapter
        $scope.removePerson = function (person, $index, $event, remote) {
            $event.stopPropagation();
            person.$remove().then(function () {
                if (remote) {
                    $scope.remotePeople.splice($index, 1);
                } else {
                    $scope.localPeople.splice($index, 1);
                }
                if ($scope.remotePerson && $scope.remotePerson.id === person.id) {
                    $scope.remotePerson = null;
                }
                if ($scope.localPerson && $scope.localPerson.id === person.id) {
                    $scope.localPerson = null;
                }
            });
        };

        // Synchronizes people
        $scope.syncPeople = function () {
            Person.synchronize().then(function () {
                queryPeople();
            });
        };

        queryPeople();
    }
]);