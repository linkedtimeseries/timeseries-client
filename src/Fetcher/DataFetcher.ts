import * as d3 from 'd3'
import Observation from '../DataTypes/Observation';
const request = require("request");

export default class DataFetcher {

    observations: Observation[] = [];
    parseDate = d3.timeParse('%Y-%m-%dT%H:%M:%S.%LZ');
    private baseUrl =  'http://localhost:3000/data/14';
    private basepropertyUrl = 'http://example.org/data/airquality';
    public no2Observations: Observation[] = [];
    private chartProps: any;

    constructor() {}

    public async getObservations(fromDate: (Date | string), toDate: (Date | string)) : Promise<Observation[]> {
        console.log('test');
        return this.getObservationsRecursive(fromDate, `${this.baseUrl}/8392/5467?page=${toDate}`, []);
    }

    public async getObservationsRecursive(fromDate: (Date | string), url: string, obs: Observation[]): Promise<Observation[]> {
        return this.getDataFragment(url).then(response => {
            obs.concat(response['@graph'].slice(1));
            console.log('current response: ' + JSON.stringify(response));
            console.log('startDate: ' + JSON.stringify(response.startDate));
            console.log('previous: ' + JSON.stringify(response.previous));
            // TODO: lelijkheid fiksen
            console.log('edited: ' + JSON.stringify(response.previous.substring(response.previous.indexOf('page='))));
            if (new Date(response.startDate) > new Date(fromDate)) {
                return this.getObservationsRecursive(fromDate, `${this.baseUrl}/8392/5467?` + response.previous.substring(response.previous.indexOf('page=')), obs);
            }
            else {
                return obs;
            }
        })
    }



    public async getObservationsDataFragment(date: (Date | string)): Promise<Observation[]>  {
        if (date instanceof Date) {
            date = date.toISOString();
        }
        return new Promise(resolve => {
            this.getDataFragment(`${this.baseUrl}/8392/5467?page=${date}`)
                .then(body => {
                    resolve(body['@graph'].slice(1));
                });
        });
    }

    public async getDataFragment(url: string): Promise<any> {
        return new Promise(resolve => {
            fetch(url)
                .then(response => response.json())
                .then(body => resolve(body))
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
