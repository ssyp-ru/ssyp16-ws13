import * as http from 'http';
function fetchConfig(host: string, port: number, cb: Function) {
    var cfg = '';
    let req = http.request(
        {
            host: host,
            port: port + 2,
            path: '/config'
        },
        (res) => {
            console.log(`STATUS: ${res.statusCode}`);
            console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
            res.setEncoding('utf8');
            res
                .on('data', (chunk: string) => {
                    cfg += chunk;
                })
                .on('end', () => {
                    cb(cfg);
                });
        })
        .on('error', (e) => {
            console.error(e);
            cb(null);
        });
    req.end();
}
fetchConfig('127.0.0.1', 19246, (v) => console.log(v));