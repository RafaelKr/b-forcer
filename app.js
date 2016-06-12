'use strict';

const cluster = require('cluster');
const ProgressBar = require('ascii-progress');

// Options
let passwordLength = 4;
global.chars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
global.connectionsPerWorker = 1;

initFunctions();

if( cluster.isMaster ) {

    let workerCount = require('os').cpus().length;

    let combinations = Math.pow(chars.length, passwordLength);
    let workerRange = Math.floor(combinations / workerCount);

    let workers = {};
    let workerOffset = -1;

    let statistics = {
        progress: {
            statusbar: new ProgressBar({
                schema: '[:bar] :current/:total :percent :elapseds :etas',
                total : combinations
            }),
            infobar: new ProgressBar({
                schema: 'Failed Requests: :failed | :found codes found | :reqs Reqs/s'
            })
        },
        runningWorkers: [],
        requestsPerSecond: 0,
        succeededRequests: 0,
        failedRequests: 0,
        found: 0
    };

    for( let id = 1; id <= workerCount; id++ ) {
        workers[id] = ({
            id: id,
            running: false,
            statistics: {},
            data: {
                id: id,
                offset: workerOffset + 1,
                range: workerRange
            }
        });

        workerOffset += workerRange;
    }

    // if combinations / workerCount is odd, one worker has to test more combinations to test all combinations
    workers[workerCount].data.range = workerRange + (combinations - (workerRange * workerCount));

    let workerPromises = {
        started: [],
        finished: []
    };

    let startStartTime = Date.now();
    let endStartTime = Date.now();

    for( let id in workers ) {
        let worker = workers[id];

        workerPromises.started.push(new Promise(function(started) {
            workerPromises.finished.push(new Promise(function(finished) {
                worker.process = cluster.fork();

                worker.process.on( 'message', ( msg ) => {
                    switch( msg.type ) {
                        case 'statistics':
                            workers[id].statistics = msg.data;
                            statistics.succeededRequests += workers[id].statistics.sinceLast.succeededRequests;
                            statistics.failedRequests += workers[id].statistics.sinceLast.failedRequests;
                            statistics.found += workers[id].statistics.sinceLast.found;
                            workers[id].statusbar.tick( workers[id].statistics.sinceLast.succeededRequests, {
                                id: id
                            });
                            workers[id].infobar.tick( workers[id].statistics.sinceLast.succeededRequests, {
                                failed: workers[id].statistics.total.failedRequests,
                                found: workers[id].statistics.total.found,
                                reqs: workers[id].statistics.sinceLast.succeededRequests + workers[id].statistics.sinceLast.failedRequests
                            });
                            statistics.progress.statusbar.tick( workers[id].statistics.sinceLast.succeededRequests );
                            break;
                        case 'ready':
                            worker.process.send({
                                type: 'params',
                                data: worker.data
                            });
                            worker.running = true;
                            worker.statistics = msg.data;
                            statistics.runningWorkers.push(id);
                            worker.statusbar = new ProgressBar({
                                schema: ':id [:bar] :percent :current/:total :elapseds :etas',
                                total : workers[id].data.range
                            });
                            worker.infobar = new ProgressBar({
                                schema: 'Failed Requests: :failed | :found codes found | :reqs Reqs/s'
                            });
                            break;
                        case 'start':
                            started();
                            break;
                        case 'end':
                            worker.running = false;
                            workers[id].statistics = msg.statistics;
                            statistics.runningWorkers.splice(statistics.runningWorkers.indexOf(id), 1);

                            statistics.succeededRequests += workers[id].statistics.sinceLast.succeededRequests;
                            statistics.failedRequests += workers[id].statistics.sinceLast.failedRequests;
                            statistics.found += workers[id].statistics.sinceLast.found;
                            workers[id].statusbar.tick( workers[id].statistics.sinceLast.succeededRequests, {
                                id: id
                            });
                            workers[id].infobar.tick( workers[id].statistics.sinceLast.succeededRequests, {
                                failed: workers[id].statistics.total.failedRequests,
                                found: workers[id].statistics.total.found,
                                reqs: workers[id].statistics.sinceLast.succeededRequests + workers[id].statistics.sinceLast.failedRequests
                            });
                            statistics.progress.statusbar.tick( workers[id].statistics.sinceLast.succeededRequests );
                            worker.process.disconnect();
                            finished();
                            break;
                    }
                });
            }));
        }));
    }

    Promise.all(workerPromises.started)
    .then(() => {
        console.debug( 'all workers started in ' + (Date.now() - startStartTime) + 'ms' );

        console.log( '\nTotal Progress' );
        statistics.progress.statusbar.tick(0);
        statistics.progress.infobar.tick(0, {
            failed: 0,
            found: 0
        });

        console.log( '\nProgress per Worker' );
        for( let id in workers ) {
            workers[id].statusbar.tick( 0, {
                id: id
            });
            workers[id].infobar.tick( 0, {
                failed: 0,
                found: 0
            });
        }

        setInterval(function () {
            let reqs = 0;

            for( let id in workers ) {
                reqs += workers[id].statistics.sinceLast.succeededRequests + workers[id].statistics.sinceLast.failedRequests;
            }

            statistics.progress.infobar.tick( 0, {
                failed: statistics.failedRequests,
                found: statistics.found,
                reqs: reqs
            });
        }, 1000);
    });

    Promise.all(workerPromises.finished)
    .then(() => {
        let logProgress = new ProgressBar({
            schema: '\n' + formatConsoleDate(new Date()) + ' all workers finished after ' + (Date.now() - endStartTime) + ' ms'
        });

        logProgress.tick(0);
    });

} else {
    let worker = require('./worker');
}

function initFunctions() {
    // console.log = function () {
    //     let output = arguments;
    //
    //     if( arguments instanceof Object && !(arguments instanceof Array) ) {
    //         for( let key in arguments ) {
    //             output.push( arguments[key] );
    //         }
    //     }
    //
    //     process.stdout.write( output.join(' ') );
    // }

    console.debug = function() {
        let output = [formatConsoleDate(new Date())];

        for( let key in arguments ) {
            output.push( arguments[key] );
        }

        console.log.apply( console, output );
    };

    if( process.argv.indexOf('--hide-timestamps') > -1 ) {
        console.debug = console.log;
    }
}

function formatConsoleDate( date ) {
    var hour = date.getHours();
    var minutes = date.getMinutes();
    var seconds = date.getSeconds();
    var milliseconds = date.getMilliseconds();

    return '[' +
           ((hour < 10) ? '0' + hour: hour) +
           ':' +
           ((minutes < 10) ? '0' + minutes: minutes) +
           ':' +
           ((seconds < 10) ? '0' + seconds: seconds) +
           '.' +
           ('00' + milliseconds).slice(-3) +
           ']';
}
