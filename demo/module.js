/**
 * Define the Angular Module and any required dependencies
 */
angular.module('comaDemo', ['coma', 'coma.adapter.indexedDB']).config([
    'comaIndexedDBAdapterProvider',
    'comaLoggerProvider',

    function (comaIndexedDBAdapterProvider, comaLoggerProvider) {
        comaLoggerProvider.setLogLevel(4);
        comaIndexedDBAdapterProvider.setLogLevel(4);
        comaIndexedDBAdapterProvider.setDbName("comaDemo");
        comaIndexedDBAdapterProvider.setDbVersion(1);
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