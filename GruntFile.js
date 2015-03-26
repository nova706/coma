/*globals module*/
module.exports = function(grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        uglify: {
            options: {
                banner: '/*! <%= pkg.name %> <%= grunt.template.today("dd-mm-yyyy") %> */\n'
            },
            min: {
                options: {
                    mangle: true,
                    sourceMap: true,
                    sourceMapName: 'dist/recall.min.map'
                },
                files: {
                    'dist/recall.min.js': ['src/**/*.js']
                }
            },
            concat: {
                options: {
                    mangle: false,
                    beautify: true,
                    compress: false,
                    preserveComments: true
                },
                files: {
                    'dist/recall.js': ['src/**/*.js']
                }
            }
        },
        karma: {
            main: {
                configFile: './karma.conf.js'
            },
            server: {
                configFile: './karma.conf.js',
                preprocessors: {},
                reporters: ['progress'],
                browsers: ['Chrome'],
                singleRun: false
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-karma');

    grunt.registerTask('default', ['uglify', 'karma:main']);
};