/**
 * Define the Angular Module and configure Recall
 */
angular.module('recallDemo', ['recall', 'recall.adapter.indexedDB', 'recall.adapter.oDataREST']).config([
    'recallProvider',
    'recallIndexedDBAdapterProvider',
    'recallODataRESTAdapterProvider',

    function (recallProvider, recallIndexedDBAdapterProvider, recallODataRESTAdapterProvider) {

        // Specify both local and remote adapters to enable synchronization
        recallProvider.setLocalAdapter('recallIndexedDBAdapter');
        recallProvider.setRemoteAdapter('recallODataRESTAdapter');

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