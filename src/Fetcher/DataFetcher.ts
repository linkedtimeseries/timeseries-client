import * as d3 from 'd3'
import Observation from '../DataTypes/Observation';
const request = require("request");

export default class DataFetcher {

    observations: Observation[] = [];
    parseDate = d3.timeParse('%Y-%m-%dT%H:%M:%S.%LZ');
    private basepropertyUrl = 'http://example.org/data/airquality';
    public no2Observations: Observation[] = [];
    private chartProps: any;

    constructor() {}

    public async getObservationsDataFragment(): Promise<Observation[]>  {
        return new Promise(resolve => {
            fetch('http://localhost:3000/data/14/8392/5467?page=2019-08-06T00:00:00.000Z')
                .then(response => response.json())
                .then(body => {
                    resolve(body['@graph'].slice(1));
                });
        });
    }

    public filterObservations(obs: Observation[]): void {
        // will be expanded later on
        obs.forEach( ob => {
            switch (ob.observedProperty) {
                case this.basepropertyUrl + '.no2::number':
                    this.no2Observations.push(ob);
                    break;
            }
        });
    }
}
