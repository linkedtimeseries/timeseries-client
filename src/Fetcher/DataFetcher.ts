import Observation from "../DataTypes/Observation";
import {FragmentEvent} from "../EventEmitter/FragmentEvent";
import {Tile} from "../Polygon/Tile";
import PolygonUtils from "../Polygon/Utils";
// tslint:disable-next-line:no-var-requires
const UriTemplate = require("uritemplate");

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
    private observations: Record<string, Observation[]> = {};
    private fragEvent: FragmentEvent<object> = new FragmentEvent();
    private urlTemplate = UriTemplate.parse(this.baseUrl + "/{x}/{y}{?page,aggrMethod,aggrPeriod}");
    private startDate: Date = new Date();
    private endDate: Date = new Date();

    /**
     * Recursively requests all necessary fragments to fulfill the request
     * in temporal and spatial dimension.
     * other methods can subscribe to the received fragments by calling addFragmentListener
     * @param geometry: array of coordinates containing all the requested tiles
     * @param fromDate: the start date of the request
     * @param toDate: the end date of the request
     * @param aggrMethod
     * @param aggrPeriod
     */
    public async getPolygonObservations(
        geometry: Array<{lat: number, lng: number}>,
        fromDate: (Date | string),
        toDate: (Date | string),
        aggrMethod?: string,
        aggrPeriod?: string) {
        const polygonUtils: PolygonUtils = new PolygonUtils(geometry);
        const tiles: Tile[] = polygonUtils.calculateTilesWithinPolygon();
        console.log("request sent");
        console.log(tiles);
        this.observations = {};
        if (typeof toDate === "string") {
            toDate = new Date(toDate);
        }
        this.endDate = toDate;
        this.getObservationsRecursive(tiles, fromDate, toDate, toDate, aggrMethod, aggrPeriod);
    }

    /**
     * Fetch fragments. After each request, the previous date of the fragment is checked
     * and also fetched if necessary.
     * @param tiles: the requested tiles
     * @param fromDate: the start date of the request
     * @param currDate: the current date for which the fragment needs to be requested.
     * @param toDate: the end date of the request.
     * @param aggrMethod
     * @param aggrPeriod
     */
    public async getObservationsRecursive(
        tiles: Tile[],
        fromDate: (Date | string),
        currDate: (Date | string),
        toDate: (Date | string),
        aggrMethod?: string,
        aggrPeriod?: string) {
        this.getTilesDataFragments(tiles, fromDate, currDate, toDate, aggrMethod, aggrPeriod).then((response) => {
            if (new Date(response.startDate) > new Date(fromDate)) {
                console.log("next");
                const prevDate = DataFetcher.parseURL(response.previous).searchObject.page;
                this.getObservationsRecursive(tiles, fromDate, prevDate, toDate, aggrMethod, aggrPeriod);
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

    /**
     * Fetch all fragments of a list of tiles for a certain date and merges them.
     * @param tiles: tiles for which data has to be requested.
     * @param fromDate: the start date of the request
     * @param currDate: the current date for which all fragments need to be requested.
     * @param toDate: the end date of the request.
     * @param aggrMethod
     * @param aggrPeriod
     * @returns response: the startDate, endDate and previousDate of the fragment.
     */
    public async getTilesDataFragments(
        tiles: Tile[],
        fromDate: (Date | string),
        currDate: (Date | string),
        toDate: (Date | string),
        aggrMethod?: string,
        aggrPeriod?: string): Promise<any> {
        if (toDate instanceof Date) {
            toDate = toDate.toISOString();
        }
        if (currDate instanceof Date) {
            currDate = currDate.toISOString();
        }
        let fragmentStart: string = "";
        let fragmentPrevious: string = "";
        let fragmentEnd: string = "";
        const unsortedObs: Record<string, Observation[][]> = {};
        let response: any = {};
        // console.log("fragment");
        for (const tile of tiles) {
            const params: any = {};
            params.x = tile.xTile;
            params.y = tile.yTile;
            params.page = currDate;
            if (typeof aggrMethod !== "undefined") {
                params.aggrMethod = aggrMethod;
            }
            if (typeof aggrPeriod !== "undefined") {
                params.aggrPeriod = aggrPeriod;
            }
            const url = this.urlTemplate.expand(params).replace(/%3A/g, ":");
            response = await this.getDataFragment(url);
            fragmentStart = response.startDate;
            fragmentEnd = response.endDate;
            fragmentPrevious = response.previous;
            const template = response["dcterms:isPartOf"]["hydra:search"]["hydra:template"];
            this.urlTemplate = UriTemplate.parse(template);
            if (response["@graph"].length <= 1) {
                continue;
            }
            const fragmentObs = response["@graph"].slice(1);
            const filteredFragmentObs = this.filterObservations(fragmentObs, fromDate, toDate);
            for (const key of Object.keys(filteredFragmentObs)) {
                if (! (key in unsortedObs)) {
                    unsortedObs[key] = [];
                }
                unsortedObs[key].push(filteredFragmentObs[key]);
            }
        }
        console.log(unsortedObs);
        let allFragObs = this.mergeObservations(unsortedObs);
        // console.log(allFragObs);
        const responseAggrMethod = DataFetcher.parseURL(response["@id"]).searchObject.aggrMethod;
        // console.log(allFragObs);
        allFragObs = this.mergeAggregates(allFragObs, responseAggrMethod, tiles.length);
        const event: object =  {startDate: fragmentStart, endDate: fragmentEnd, previous: fragmentPrevious};
        this.startDate = new Date(fragmentStart);
        this.addObservations(allFragObs);
        this.fragEvent.emit(event);
        return event;
    }

    public mergeAggregates(obs: Record<string, Observation[]>,
                           aggrMethod: string,
                           nrTiles: number): Record<string, Observation[]> {
        if (aggrMethod === "average") {
            const mergedAverages: Record<string, Observation[]> = {};
            Object.entries(obs).forEach(
                ([key, values]) => mergedAverages[key] = this.mergeAverages(values));
            return mergedAverages;
        } else if (aggrMethod === "median") {
            // const mergedMedians: Record<string, Observation[]> = {};
            // Object.entries(obs).forEach(
            //     ([key, values]) => mergedMedians[key] = this.mergeMedians(values, nrTiles));
            return obs;
        }
        return obs;
    }

    public mergeAverages(obs: any[]): any[] {
        let currOb = obs[0];
        let total = 0;
        let count = 0;
        let sensors: Set<any> = new Set([]);
        console.log(obs);
        const mergedObs: any[] = [];
        for (const ob of obs) {
            if (! (ob.resultTime instanceof Date)) {
                ob.resultTime = new Date(ob.resultTime);
            }

            if (currOb.resultTime.getTime() !== ob.resultTime.getTime()) {
                if (count > 0) {
                    const newOb = JSON.parse(JSON.stringify(currOb));
                    newOb.Output = {count, total};
                    newOb.madeBySensor = Array.from(sensors);
                    newOb.hasSimpleResult = total / count;
                    mergedObs.push(newOb);
                }
                currOb = ob;
                total = 0;
                count = 0;
                sensors.clear();
            }
            if ("Output" in ob) {
                total += ob.Output.total;
                count += ob.Output.count;
                if (sensors.size > 0) {
                    sensors = new Set([...Array.from(sensors), ...ob.madeBySensor]);
                } else {
                    sensors = new Set(ob.madeBySensor);
                }
            }
        }
        if (count > 0) {
            const ob = obs[obs.length - 1];
            ob.Output = {count, total};
            ob.madeBySensor = Array.from(sensors);
            ob.hasSimpleResult = total / count;
            mergedObs.push(ob);
        }
        console.log(mergedObs);
        return mergedObs;
    }

    public mergeMedians(obs: any[], nrTiles: number): any[] {
        let i = 0;
        const mergedObs: any[] = [];
        console.log(obs);
        while (i < obs.length) {
            const obsSlice = obs.slice(i, i + nrTiles);
            obs[i].hasSimpleResult = this.getMedian(obsSlice);
            mergedObs.push(obs[i]);
            i += nrTiles;
        }
        // console.log(mergedObs);
        return mergedObs;
    }

    public getMedian(obs: any[]) {
        if (obs.length === 0) {
            return 0;
        }
        obs.sort((a, b) => a.hasSimpleResult - b.hasSimpleResult);
        const half = Math.floor(obs.length / 2);

        if (obs.length % 2) {
            return obs[half].hasSimpleResult;
        }

        return (obs[half - 1].hasSimpleResult + obs[half].hasSimpleResult) / 2.0;
    }

    /**
     * Fetch a single fragment.
     * @param url: url for the fragment to be requested.
     * @returns promise for the requested fragment
     */
    public async getDataFragment(url: string): Promise<any> {
        console.log(url);
        return fetch(url)
                .then((response) => response.json());
    }

    /**
     * Add observations to the global list of observations.
     * @param obs
     */
    public addObservations(obs: Record<string, Observation[]>): void {
        for (const key of Object.keys(obs)) {
            if (!(key in this.observations)) {
                this.observations[key] = obs[key];
            } else {
                this.observations[key] = obs[key].concat(this.observations[key]);
            }
        }
    }

    /**
     * Merge observations with the same time range but of different tiles.
     * @param unsortedObs: the observations that need to be merged
     * @returns flattened list with all observations sorted according to metric.
     */
    public mergeObservations(unsortedObs: Record<string, Observation[][]>): Record<string, Observation[]> {
        const mergedObs: Record<string, Observation[]> = {};
        for (const key of Object.keys(unsortedObs)) {
            mergedObs[key] = this.mergeMetric(unsortedObs[key]);
        }
        return mergedObs;
    }

    /**
     * Merge k lists of observations.
     * @param unsortedObs
     * @returns flattened list with sorted observations.
     */
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

    /**
     * Add a listener to the fragEvent. This makes sure that the listener is notified each time
     * a new fragment is requested and ready.
     * @param method: the method that will be triggered each time a new fragment is ready
     */
    public addFragmentListener(method: CallableFunction) {
        this.fragEvent.on((observations) => method(observations));
    }

    /**
     * Helper method for mergeMetric.
     * @param hasReachedEnd
     */
    public finishedMerging(hasReachedEnd: boolean[]): boolean {
        return ! hasReachedEnd.includes(false);
    }

    /**
     * Helper method for mergeMetric.
     * @param dates
     * @param hasReachedEnd
     */
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

    /**
     * Filter observations according to fromDate and toDate.
     * @param obs: the list of observations to be filtered.
     * @param fromDate: start of the filter interval
     * @param toDate: end of the filter interval
     * @returns filtered list of observations
     */
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

    /**
     * Get received observations of a certain metric.
     * @param metric
     */
    public getCurrentObservations(metric: string) {
        return this.observations[metric];
    }

    public containsInterval(startDate: (Date | string), endDate: (Date | string)): boolean {
        if (typeof startDate === "string") {
            startDate = new Date(startDate);
        }
        if (typeof endDate === "string") {
            endDate = new Date(endDate);
        }
        return this.startDate <= startDate
            && this.endDate >= endDate;
    }

    /**
     * Get all received observations.
     */
    public getAllCurrentObservations() {
        return this.observations;
    }
}
