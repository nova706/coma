/*globals Dropbox*/
angular.module('recall.adapter.dropboxDatastore').factory('recallDropboxDatastoreService', [
    '$q',

    function ($q) {

        var dropboxDatastoreService = {};

        dropboxDatastoreService.connect = function (clientKey, authDriver) {
            var dfd = $q.defer();

            if (!clientKey) {
                return $q.reject("Client key not set");
            }

            var client = new Dropbox.Client({key: clientKey});

            if (authDriver) {
                client.authDriver(authDriver);
            }

            client.authenticate({interactive: false}, function (error) {
                if (error) {
                    dfd.reject(error);
                } else if (client.isAuthenticated()) {
                    var datastoreManager = client.getDatastoreManager();
                    datastoreManager.openDefaultDatastore(function (error, datastore) {
                        if (error) {
                            dfd.reject(error);
                        } else {
                            dfd.resolve(datastore);
                        }
                    });
                } else {
                    dfd.reject("Could not authenticate");
                }
            });

            return dfd.promise;
        };

        dropboxDatastoreService.create = function (db, theModel, modelInstance) {
            var dfd = $q.defer();

            try {
                var table = db.getTable(theModel.dataSourceName);

                var pk = modelInstance[theModel.primaryKeyFieldName];
                delete modelInstance[theModel.primaryKeyFieldName];

                // Use get or insert to force the record primary key.
                var result = table.getOrInsert(pk, modelInstance);

                result = transformResult(theModel, result);
                dfd.resolve(result);
            } catch (e) {
                dfd.reject(e);
            }

            return dfd.promise;
        };

        dropboxDatastoreService.findOne = function (db, theModel, pk) {
            var dfd = $q.defer();

            try {
                var table = db.getTable(theModel.dataSourceName);
                var result = table.get(pk);

                if (result) {
                    result = transformResult(theModel, result);
                    dfd.resolve(result);
                } else {
                    dfd.resolve(null);
                }
            } catch(e) {
                dfd.reject(e);
            }

            return dfd.promise;
        };

        dropboxDatastoreService.find = function (db, theModel, includeDeleted) {
            var dfd = $q.defer();

            try {
                var table = db.getTable(theModel.dataSourceName);
                var results = [];

                if (!includeDeleted && theModel.deletedFieldName) {
                    var query = {};
                    query[theModel.deletedFieldName] = false;
                    results = table.query(query);
                } else {
                    results = table.query();
                }

                var i;
                for (i = 0; i < results.length; i++) {
                    results[i] = transformResult(theModel, results[i]);
                }

                dfd.resolve(results);
            } catch(e) {
                dfd.reject(e);
            }

            return dfd.promise;
        };

        dropboxDatastoreService.update = function (db, theModel, pk, modelInstance) {
            var dfd = $q.defer();

            try {
                var table = db.getTable(theModel.dataSourceName);
                var result = table.get(pk);
                delete modelInstance[theModel.primaryKeyFieldName];

                if (result) {

                    result = updateResult(theModel, modelInstance, result);
                    dfd.resolve(result);

                } else {
                    dfd.reject(null);
                }
            } catch(e) {
                dfd.reject(e);
            }

            return dfd.promise;
        };

        dropboxDatastoreService.remove = function (db, theModel, pk) {
            var dfd = $q.defer();

            try {
                var table = db.getTable(theModel.dataSourceName);
                var result = table.get(pk);

                if (result) {
                    result.deleteRecord();
                }
                dfd.resolve(null);
            } catch(e) {
                dfd.reject(e);
            }

            return dfd.promise;
        };

        dropboxDatastoreService.findByAssociation = function (db, model, pk, mappedBy) {
            var dfd = $q.defer();

            try {
                var table = db.getTable(model.dataSourceName);

                var query = {};
                query[model.deletedFieldName] = false;
                var results = table.query(query);
                var theResults = [];

                var i;
                for (i = 0; i < results.length; i++) {
                    if (results[i].get(mappedBy) === pk) {
                        theResults.push(transformResult(model, results[i]));
                    }
                }

                dfd.resolve(theResults);
            } catch (e) {
                dfd.reject(e);
            }

            return dfd.promise;
        };

        var transformResult = function (theModel, result) {
            var rawObj = {};

            var field;
            for (field in theModel.fields) {
                if (theModel.fields.hasOwnProperty(field)) {
                    rawObj[field] = result.get(field);
                }
            }
            rawObj[theModel.primaryKeyFieldName] = result.getId();

            return rawObj;
        };

        var updateResult = function (theModel, modelInstance, result) {
            var field;
            for (field in theModel.fields) {
                if (theModel.fields.hasOwnProperty(field)) {
                    result.set(field, modelInstance[field]);
                }
            }
            return transformResult(theModel, result);
        };

        return dropboxDatastoreService;

    }
]);