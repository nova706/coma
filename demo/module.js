/**
 * Define the Angular Module and configure Coma
 */
angular.module('comaDemo', ['coma', 'coma.adapter.indexedDB', 'coma.adapter.oDataREST']).config([
    'comaProvider',
    'comaIndexedDBAdapterProvider',
    'comaODataRESTAdapterProvider',

    function (comaProvider, comaIndexedDBAdapterProvider, comaODataRESTAdapterProvider) {

        // Specify both local and remote adapters to enable synchronization
        comaProvider.setLocalAdapter('comaIndexedDBAdapter');
        comaProvider.setRemoteAdapter('comaODataRESTAdapter');

         // Set last modified and deleted fields to enable synchronization
        comaProvider.setLastModifiedFieldName('lastModified');
        comaProvider.setDeletedFieldName('deleted');

        // Setup the IndexedDB Adapter and initialize it
        comaIndexedDBAdapterProvider.setDbName("comaDemo");
        comaIndexedDBAdapterProvider.setDbVersion(1);
        comaIndexedDBAdapterProvider.dropDatabase();

        // Setup the OData REST Adapter
        comaODataRESTAdapterProvider.setServerAPILocation('/api/');
    }
]);