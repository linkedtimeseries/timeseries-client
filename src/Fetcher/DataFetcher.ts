import * as d3 from 'd3'
import Observation from '../DataTypes/Observation';
const request = require("request");

export default class DataFetcher {

    private baseUrl =  'http://localhost:3000/data/14';
    private basepropertyUrl = 'http://example.org/data/airquality';
    public no2Observations: Observation[] = [];
    public o3Observations: Observation[] = [];
    public pm10Observations: Observation[] = [];

    constructor() {}

    public async getObservations(fromDate: (Date | string), toDate: (Date | string)) : Promise<Observation[]> {
        console.log('test');
        return this.getObservationsRecursive(fromDate, `${this.baseUrl}/8392/5467?page=${toDate}`, []);
    }

    public async getObservationsRecursive(fromDate: (Date | string), url: string, obs: Observation[]): Promise<Observation[]> {
        return this.getDataFragment(url).then(response => {
            // this way, the observations stay ordered while we go back in time
            obs = response['@graph'].slice(1).concat(obs);
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

    public filterObservations(obs: Observation[], fromDate: (string | Date), toDate: (string | Date)): void {
        if (typeof fromDate === 'string') {
            fromDate = new Date(fromDate);
        }

        if (typeof toDate === 'string') {
            toDate = new Date(toDate);
        }
        this.no2Observations = [];
        this.o3Observations = [];


        // will be expanded later on
        obs.forEach( ob => {
            let resultDate = new Date(ob.resultTime);
            if (resultDate <= toDate && resultDate >= fromDate) {
                switch (ob.observedProperty) {
                    case this.basepropertyUrl + '.no2::number':
                        this.no2Observations.push(ob);
                        break;
                    case this.basepropertyUrl + '.o3::number':
                        this.o3Observations.push(ob);
                        break;
                    case this.basepropertyUrl + '.pm10::number':
                        this.pm10Observations.push(ob);
                        break;
                }
            }
        });
    }
}
