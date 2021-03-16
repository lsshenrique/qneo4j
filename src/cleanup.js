'use strict';

const drivers = [];

function exitHandler(options, exitCode) {
    if (options.cleanup) {
        for (const driver of drivers) {
            if (driver.close) driver.close();
        }
    }

    if (exitCode instanceof Error) {
        // eslint-disable-next-line no-console
        console.error('ERROR', exitCode);
    }

    if (options.exit) {
        process.exit();
    }
}

// do something when app is closing
process.on('exit', exitHandler.bind(null, { cleanup: true }));

// catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit: true }));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));

// catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));

exports.regiter = function(qneo4jDriver) {
    drivers.push(qneo4jDriver);
};

exports.exitHandler = exitHandler;