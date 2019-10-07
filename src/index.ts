const request = require("request");



export function getDataFragment () : void {
    request('http://localhost:3000/data/14/8392/5467?page=2019-08-06T00:00:00.000Z',
        (err: string, res: string, body: string) => {
        if (err) { return console.log(err); }
        console.log(res);
    });
}

