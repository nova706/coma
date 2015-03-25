/**
 * Define the Angular Module and configure Recall
 */
angular.module('recallDemo', ['recall', 'recall.adapter.indexedDB', 'recall.adapter.oDataREST', 'recall.adapter.sync']).config([
    'recallProvider',
    'recallIndexedDBAdapterProvider',
    'recallODataRESTAdapterProvider',
    'recallSyncAdapterProvider',

    function (recallProvider, recallIndexedDBAdapterProvider, recallODataRESTAdapterProvider, recallSyncAdapterProvider) {

        // Specify both slave and master adapters to enable synchronization
        recallSyncAdapterProvider.setSlave('recallIndexedDBAdapter');
        recallSyncAdapterProvider.setMaster('recallODataRESTAdapter');
        recallProvider.setAdapter('recallSyncAdapter');

         // Set last modified and deleted fields to enable synchronization
        recallProvider.setLastModifiedFieldName('lastModified');
        recallProvider.setDeletedFieldName('deleted');

        // Setup the IndexedDB Adapter and initialize it
        recallIndexedDBAdapterProvider.setDbName("recallDemo");
        recallIndexedDBAdapterProvider.setDbVersion(1);
        recallIndexedDBAdapterProvider.dropDatabase();

        // Setup the OData REST Adapter
        recallODataRESTAdapterProvider.setServerAPILocation('/api/');
    }
]);