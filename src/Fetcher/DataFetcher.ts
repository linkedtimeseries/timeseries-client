import {Feature, Polygon} from "@turf/turf";
import Observation from "../DataTypes/Observation";
import {FragmentEvent} from "../EventEmitter/FragmentEvent";
import {Tile} from "../Polygon/Tile";
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

    private baseUrl =  "http://localhost:5000/data/14";
    private basepropertyUrl = "http://example.org/data/airquality";
    private observations: Record<string, Observation[]> = {};
    private fragEvent: FragmentEvent<object> = new FragmentEvent();

    public async getPolygonObservations(
        geometry: Array<{lat: number, lng: number}>, fromDate: (Date | string), toDate: (Date | string)) {
        console.log("hallo");
        const polygonUtils: PolygonUtils = new PolygonUtils(geometry);
        const tiles: Tile[] = polygonUtils.calculateTilesWithinPolygon();
        console.log("request sent");
        console.log(tiles);
        this.observations = {};
        this.getObservationsRecursive(tiles, fromDate, toDate, toDate, []);
    }

    public testLib() {
        console.log("test");
    }

    public async getObservationsRecursive(
        tiles: Tile[],
        fromDate: (Date | string),
        currDate: (Date | string),
        toDate: (Date | string),
        obs: Observation[]) {
        this.getTilesDataFragments(tiles, fromDate, currDate, toDate).then((response) => {
            if (new Date(response.startDate) > new Date(fromDate)) {
                console.log("next");
                const prevDate = DataFetcher.parseURL(response.previous).searchObject.page;
                this.getObservationsRecursive(tiles, fromDate, prevDate, toDate, obs);
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

    public async getTilesDataFragments(
        tiles: Tile[],
        fromDate: (Date | string),
        currDate: (Date | string),
        toDate: (Date | string)): Promise<any> {
        if (toDate instanceof Date) {
            toDate = toDate.toISOString();
        }
        let fragmentStart: string = "";
        let fragmentPrevious: string = "";
        let fragmentEnd: string = "";
        const unsortedObs: Record<string, Observation[][]> = {};
        console.log("fragment");
        for (let i = 0; i < tiles.length; i++) {
            const url = `${this.baseUrl}/${tiles[i].xTile}/${tiles[i].yTile}?page=${currDate}`;
            const response = await this.getDataFragment(url);
            const fragmentObs = response["@graph"].slice(1);
            const filteredFragmentObs = this.filterObservations(fragmentObs, fromDate, toDate);
            for (const key of Object.keys(filteredFragmentObs)) {
                if (! (key in unsortedObs)) {
                    unsortedObs[key] = [];
                }
                unsortedObs[key].push(filteredFragmentObs[key]);
            }
            fragmentStart = response.startDate;
            fragmentEnd = response.endDate;
            fragmentPrevious = response.previous;
        }
        console.log(unsortedObs);
        const allFragObs = this.mergeObservations(unsortedObs);
        console.log(allFragObs);
        const response: object =  {startDate: fragmentStart, endDate: fragmentEnd, previous: fragmentPrevious};
        this.addObservations(allFragObs);
        this.fragEvent.emit(response);
        return response;
    }

    public async getDataFragment(url: string): Promise<any> {
        console.log(url);
        return fetch(url)
                .then((response) => response.json());
    }

    public addObservations(obs: Record<string, Observation[]>): void {
        for (const key of Object.keys(obs)) {
            if (!(key in this.observations)) {
                this.observations[key] = obs[key];
            } else {
                this.observations[key] = obs[key].concat(this.observations[key]);
            }
        }
    }

    public mergeObservations(unsortedObs: Record<string, Observation[][]>): Record<string, Observation[]> {
        const mergedObs: Record<string, Observation[]> = {};
        for (const key of Object.keys(unsortedObs)) {
            console.log(unsortedObs[key]);
            mergedObs[key] = this.mergeMetric(unsortedObs[key]);
        }
        return mergedObs;
    }

    public mergeMetric(unsortedObs: Observation[][]): Observation[] {
        const obs: Observation[] = [];
        const indices: number[] = new Array(unsortedObs.length).fill(0);
        const currDates: Date[] = [];
        const hasReachedEnd: boolean[] = [];
        unsortedObs.forEach((obsList) => {
            currDates.push(new Date(obsList[0].resultTime));
            hasReachedEnd.push(false);
        });

        while (! this.finishedMerging(hasReachedEnd)) {
            const minDate = this.minDate(currDates, hasReachedEnd);
            const minIndex = currDates.indexOf(minDate);
            obs.push(unsortedObs[minIndex][indices[minIndex]]);
            indices[minIndex] += 1;
            if (indices[minIndex] < unsortedObs[minIndex].length) {
                currDates[minIndex] = new Date(unsortedObs[minIndex][indices[minIndex]].resultTime);
            } else {
                hasReachedEnd[minIndex] = true;
            }
        }
        return obs;
    }

    public addFragmentListener(method: CallableFunction) {
        this.fragEvent.on((observations) => method(observations));
    }

    public finishedMerging(hasReachedEnd: boolean[]): boolean {
        return ! hasReachedEnd.includes(false);
    }

    public minDate(dates: Date[], hasReachedEnd: boolean[]) {
        let minIndex: number = 0;
        let minDate: Date = dates[minIndex];
        for (let i = 0; i < dates.length; i++) {
            if ((dates[i] < minDate || hasReachedEnd[minIndex]) && ! hasReachedEnd[i]) {
                minDate = dates[i];
                minIndex = i;
            }
        }
        return minDate;
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
        return fragmentObservations;
    }

    public getCurrentObservations(metric: string) {
        // console.log(this.observations);
        return this.observations[metric];
    }

    public getAllCurrentObservations() {
        return this.observations;
    }
}
