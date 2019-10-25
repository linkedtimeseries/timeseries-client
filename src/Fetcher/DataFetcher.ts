import {Feature, Polygon} from "@turf/turf";
import Observation from "../DataTypes/Observation";
import {FragmentEvent} from "../EventEmitter/FragmentEvent";
import PolygonUtils from "../Polygon/Utils";

export default class DataFetcher {

    public static parseURL(url: string) {
        const parser = document.createElement("a");
        const searchObject: any = {};
        let queries;
        let split;

        // Let the browser do the work
        parser.href = url;
        // Convert query string to object
        queries = parser.search.replace(/^\?/, "").split("&");
        queries.forEach((element) => {
            split = element.split("=");
            searchObject[split[0]] = split[1];
        });
        return {
            protocol: parser.protocol,
            host: parser.host,
            hostname: parser.hostname,
            port: parser.port,
            pathname: parser.pathname,
            search: parser.search,
            searchObject,
            hash: parser.hash,
        };
    }

    private baseUrl =  "http://localhost:5000/data/14/geometry";
    private basepropertyUrl = "http://example.org/data/airquality";
    private observations: Record<string, Observation[]> = {};
    private fragEvent: FragmentEvent<Record<string, Observation[]>> = new FragmentEvent();

    public async getPolygonObservations(
        geometry: Array<{lat: number, lng: number}>, fromDate: (Date | string), toDate: (Date | string)) {
        const polygonUtils: PolygonUtils = new PolygonUtils(geometry);
        const polygon: Feature<Polygon> = polygonUtils.calculateTilePolygon() as Feature<Polygon>;
        const coordinateString: string = (polygon.geometry as Polygon).coordinates[0].join(";");
        console.log("request sent");
        this.observations = {};
        this.getObservationsRecursive(coordinateString, fromDate, toDate,
            `${this.baseUrl}?geometry=${coordinateString}&page=${toDate}`, []);
    }

    public async getObservationsRecursive(
        coordinateString: string,
        fromDate: (Date | string),
        toDate: (Date | string),
        url: string, obs: Observation[]) {
        this.getDataFragment(url).then((response) => {
            console.log(response);
            const fragmentObs = response["@graph"].slice(1);
            obs = fragmentObs.concat(obs);
            // console.log('current response: ' + JSON.stringify(response));
            this.filterObservations(fragmentObs, fromDate, toDate);
            this.fragEvent.emit(response);
            console.log("startDate: " + JSON.stringify(response.startDate));
            console.log("previous: " + JSON.stringify(response.previous));
            console.log("edited: " + JSON.stringify(DataFetcher.parseURL(response.previous).searchObject.page));
            if (new Date(response.startDate) > new Date(fromDate)) {
                const prevDate = DataFetcher.parseURL(response.previous).searchObject.page;
                this.getObservationsRecursive(coordinateString, fromDate, toDate,
                    `${this.baseUrl}?geometry=${coordinateString}&page=${prevDate}`, obs);
            }
        });
    }

    public async getObservationsDataFragment(date: (Date | string)): Promise<Observation[]>  {
        if (date instanceof Date) {
            date = date.toISOString();
        }
        return new Promise((resolve) => {
            this.getDataFragment(`${this.baseUrl}/8392/5467?page=${date}`)
                .then((body) => {
                    resolve(body["@graph"].slice(1));
                });
        });
    }

    public async getDataFragment(url: string): Promise<any> {
        console.log(url);
        return fetch(url)
                .then((response) => response.json());
    }

    public addFragmentListener(method: CallableFunction) {
        this.fragEvent.on((observations) => method(observations));
    }

    public filterObservations(obs: Observation[],
                              fromDate: (string | Date),
                              toDate: (string | Date)): Record<string, Observation[]> {
        if (typeof fromDate === "string") {
            fromDate = new Date(fromDate);
        }

        if (typeof toDate === "string") {
            toDate = new Date(toDate);
        }

        const fragmentObservations: Record<string, Observation[]> = {};
        // will be expanded later on
        obs.forEach( (ob) => {
            const resultDate = new Date(ob.resultTime);
            if (resultDate <= toDate && resultDate >= fromDate) {
                if (!(ob.observedProperty in fragmentObservations)) {
                    fragmentObservations[ob.observedProperty] = [];
                }
                fragmentObservations[ob.observedProperty].push(ob);
            }
        });
        for (const key in fragmentObservations) {
            if (!(key in this.observations)) {
                this.observations[key] = fragmentObservations[key];
            } else {
                this.observations[key] = fragmentObservations[key].concat(this.observations[key]);
            }
        }
        return fragmentObservations;
    }

    public getCurrentObservations(metric: string) {
        return this.observations[metric];
    }

    public getAllCurrentObservations() {
        return this.observations;
    }
}
