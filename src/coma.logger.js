angular.module('coma.logger', []).provider('comaLogger', [

    function () {
        var providerConfig = {};

        providerConfig.logLevel = 0;
        this.setLogLevel = function (logLevel) {
            providerConfig.logLevel = logLevel;
            return this;
        };

        this.$get = [function () {
            var logLevel = providerConfig.logLevel;
            var prefix = "";

            var printInfo = function (message) {
                console.log(message);
            };

            var printWarn = function (message) {
                message.unshift("WARNING");
                if (typeof console.warn === 'function') {
                    console.warn(message);
                } else {
                    printInfo(message);
                }
            };

            var printError = function (message) {
                message.unshift("ERROR");
                if (typeof console.error === 'function') {
                    console.error(message);
                } else {
                    printWarn(message);
                }
            };

            var loggingAvailable = function () {
                return typeof console.log === 'function' && logLevel > 0;
            };

            /**
             * The logging utility provides basic logging for debugging the client application.
             * log can be used to log messages to the console. log.error will show an alert message
             * to the user.
             *
             * @class Log
             * @module System
             */
            var log = function (logLevel, prefix) {
                this.prefix = prefix;
                this.logLevel = Math.min(providerConfig.logLevel, logLevel);
            };

            /**
             * Log a debug level message using the method arguments as the output.
             *
             * @method info
             */
            log.prototype.debug = function () {
                if (loggingAvailable() && this.logLevel > 3) {
                    var message = Array.prototype.slice.call(arguments);
                    message.unshift(this.prefix);
                    printInfo(message);
                }
            };

            /**
             * Log an info level message using the method arguments as the output.
             *
             * @method info
             */
            log.prototype.info = function () {
                if (loggingAvailable() && this.logLevel > 2) {
                    var message = Array.prototype.slice.call(arguments);
                    message.unshift(this.prefix);
                    printInfo(message);
                }
            };

            /**
             * Log a warning level message using the method arguments as the output.
             *
             * @method warn
             */
            log.prototype.warn = function () {
                if (loggingAvailable() && this.logLevel > 1) {
                    var message = Array.prototype.slice.call(arguments);
                    message.unshift(this.prefix);
                    printWarn(message);
                }
            };

            /**
             * Log an error level message using the method arguments as the output. This will also present an alert.
             *
             * @method error
             */
            log.prototype.error = function () {
                if (loggingAvailable() && this.logLevel > 0) {
                    var message = Array.prototype.slice.call(arguments);
                    message.unshift(this.prefix);
                    printError(message);
                }
            };

            return log;
        }];
    }
]);