/**
 * Define the Angular Module and any required dependencies
 */
angular.module('comaDemo', ['coma', 'coma.adapter.indexedDB', 'coma.adapter.oDataREST']).config([
    'comaProvider',
    'comaIndexedDBAdapterProvider',
    'comaODataRESTAdapterProvider',

    function (comaProvider, comaIndexedDBAdapterProvider, comaODataRESTAdapterProvider) {
        comaProvider.setLocalAdapter('comaIndexedDBAdapter');
        comaProvider.setRemoteAdapter('comaODataRESTAdapter');
        comaProvider.setLastModifiedField('lastModified');
        comaIndexedDBAdapterProvider.setDbName("comaDemo");
        comaIndexedDBAdapterProvider.setDbVersion(1);
        comaODataRESTAdapterProvider.setServerAPILocation('/api/');
    }
]);

/**
 * Functions to perform when the app is run (after configuration).
 *  - Set the app version
 */
angular.module('comaDemo').run([
    '$rootScope',

    function ($rootScope) {
        console.log('App Started');

        $rootScope.version = '0.0.1';
    }
]);