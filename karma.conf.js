module.exports = function (config) {
    config.set({
        basePath: '',

        frameworks: ['mocha', 'sinon-chai'],

        files: [
            'tests/lib/angular.js',
            'tests/lib/angular-mocks.js',
            'src/**/*.js',
            'tests/src/*.js'
        ],

        exclude: [],

        preprocessors: {
            'src/**/*.js': ['coverage']
        },

        coverageReporter: {
            reporters: [
                {type: 'html', dir: 'coverage/'},
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