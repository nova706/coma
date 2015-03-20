module.exports = function (config) {
    config.set({
        basePath: '',

        frameworks: ['mocha', 'sinon-chai'],

        files: [
            'tests/lib/angular.js',
            'tests/lib/angular-mocks.js',
            'tests/helpers/mockIndexedDB.js',
            'src/**/*.js',
            'tests/src/**/*.js'
        ],

        exclude: [],

        preprocessors: {
            'src/**/*.js': ['coverage']
        },

        coverageReporter: {
            dir: 'coverage/',
            reporters: [
                {type: 'lcov', subdir: 'lcov'},
                {type: 'text-summary'}
            ]
        },

        reporters: ['progress', 'coverage'],

        colors: true,

        logLevel: config.LOG_INFO,

        autoWatch: false,

        browsers: ['PhantomJS'],

        singleRun: true
    });
};