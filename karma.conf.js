module.exports = function (config) {
    config.set({
        basePath: '',

        frameworks: ['mocha', 'sinon-chai'],

        files: [
            'https://ajax.googleapis.com/ajax/libs/angularjs/1.3.15/angular.js',
            'https://ajax.googleapis.com/ajax/libs/angularjs/1.3.15/angular-mocks.js',
            'tests/helpers/mockIndexedDB.js',
            'src/**/*.js',
            'tests/src/**/*.js'
        ],

        exclude: [],

        preprocessors: {
            'src/**/*.js': ['coverage']
        },

        coverageReporter: {
            dir: 'buildOutput/',
            reporters: [
                {type: 'lcov', subdir: 'coverage'},
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