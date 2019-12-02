import Config from "../Config/Config";
import Observation from "../DataTypes/Observation";
import {FragmentEvent} from "../EventEmitter/FragmentEvent";
import {Tile} from "../Polygon/Tile";
import PolygonUtils from "../Polygon/Utils";
// tslint:disable-next-line:no-var-requires
const moment = require("moment");
// tslint:disable-next-line:no-var-requires
const UriTemplate = require("uritemplate");
// tslint:disable-next-line:no-var-requires
const http = require("follow-redirects").http;
// tslint:disable-next-line:no-var-requires
const CacheableRequest = require("cacheable-request");
// tslint:disable-next-line:no-var-requires
const urlParser = require("url");

export default class DataFetcher {

    private baseUrl =  process.env.BASEURL;
    private observations: Record<string, Observation[]> = {};
    private fragEvent: FragmentEvent<object> = new FragmentEvent();
    private urlTemplate = UriTemplate.parse(this.baseUrl + "/{x}/{y}{?page,aggrMethod,aggrPeriod}");
    private currentDate: Date = new Date();
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
        fromDate: string,
        toDate: string,
        aggrMethod?: string,
        aggrPeriod?: string) {
        const polygonUtils: PolygonUtils = new PolygonUtils(geometry);
        const tiles: Tile[] = polygonUtils.calculateTilesWithinPolygon();
        console.log("request sent");
        console.log(tiles);
        fromDate = this.dateOffsetCorrection(fromDate, true, aggrPeriod);
        toDate = this.dateOffsetCorrection(toDate, false, aggrPeriod);
        console.log("[LOG] fromDate after offset correction: " + fromDate);
        console.log("[LOG] toDate after offset correction: " + toDate);
        this.observations = {};
        this.startDate = new Date(fromDate);
        this.endDate = new Date(toDate);
        this.currentDate = new Date(toDate);

        this.getObservationsRecursive(tiles, polygonUtils, aggrMethod, aggrPeriod);
    }

    public dateOffsetCorrection(datestr: string, isStartDate: boolean, aggrPeriod?: string) {
        let date: Date = new Date(datestr);
        if (typeof aggrPeriod === "undefined") {
            return datestr;
        }
        let interval: number = 0;
        switch (aggrPeriod) {
            case "min":
                if (date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0) {
                    interval = Config.context.min;
                    date.setUTCSeconds(0, 0);
                }
                break;
            case "hour":
                if (date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0) {
                    interval = Config.context.hour;
                    date.setUTCMinutes(0, 0, 0);
                }
                break;
            case "day":
                if (date.getUTCHours() ||
                   date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0) {
                    interval = Config.context.day;
                    date.setUTCHours(0, 0, 0, 0);
                }
                break;
        }
        date = new Date(date.getTime() + interval);
        console.log(date.toISOString());
        return date.toISOString();
    }

    /**
     * Fetch fragments. After each request, the previous date of the fragment is checked
     * and also fetched if necessary.
     * @param tiles: the requested tiles
     * @param fromDate: the start date of the request
     * @param currDate: the current date for which the fragment needs to be requested.
     * @param toDate: the end date of the request.
     * @param polygonUtils
     * @param aggrMethod
     * @param aggrPeriod
     */
    public async getObservationsRecursive(
        tiles: Tile[],
        polygonUtils: PolygonUtils,
        aggrMethod?: string,
        aggrPeriod?: string) {
        this.getTilesDataFragmentsTemporal(tiles, polygonUtils, aggrMethod, aggrPeriod)
            .then((response) => {
                // console.log("[LOG] response after temporal: " + response);
                console.log("current date: " + this.currentDate);
                console.log("fromDate: " + this.startDate);
                if (this.currentDate > this.startDate) {
                    // console.log("next");
                    // console.log(urlParser.parse(response.previous).query);
                    // console.log(urlParser.parse(response.previous).query.page);
                    this.getObservationsRecursive(tiles, polygonUtils, aggrMethod, aggrPeriod);
                }
                console.log("[LOG] finished");
        });
    }

    public getAggrInterval(aggrPeriod?: string) {
        // if undefined, then there is no aggregation period and we only need to run getTilesDataFragmentsTemporal once
        if (typeof aggrPeriod === "undefined") {
            return 0;
        }
        switch (aggrPeriod) {
            case "min":
                return Config.context.min;
            case "hour":
                return Config.context.hour;
            case "day":
                return Config.context.day;
            case "month":
                return Config.context.month;
            case "year":
                return Config.context.year;
            default:
                return 0;
        }
    }

    public dateCheck(date: (Date | string)) {
        if (typeof date === "string") {
            date = new Date(date);
        }
        return date;
    }

    public async getTilesDataFragmentsTemporal(
        tiles: Tile[],
        polygonUtils: PolygonUtils,
        aggrMethod?: string,
        aggrPeriod?: string,
    ): Promise<any> {

        const aggrInterval = this.getAggrInterval(aggrPeriod);
        // console.log("[LOG] aggrInterval: " + aggrInterval);
        let aggrCurrent = this.currentDate.getTime();
        const aggrStart = aggrCurrent;
        const aggrEnd = aggrCurrent - aggrInterval;
        const temporalObs: Record<string, Observation[]> = {};
        let startUrl: string = "";
        let previousUrl: string = "";
        let endUrl: string = "";
        while (aggrCurrent >= aggrEnd) {
            console.log("aggrCurrent: " + new Date(aggrCurrent).toISOString());
            console.log("aggrEnd: " + new Date(aggrEnd).toISOString());
            const fragResponse = await
                this.getTilesDataFragmentsSpatial(tiles, polygonUtils, aggrMethod, aggrPeriod);

            // const event: object =  {startUrl: fragmentStart, endUrl: fragmentEnd, previous: fragmentPrevious};
            // this.currentDate = new Date(fragResponse.fragmentStart);
            startUrl = fragResponse.fragmentStart;
            previousUrl = fragResponse.fragmentPrevious;
            endUrl = fragResponse.fragmentEnd;
            const previousDate = urlParser.parse(previousUrl, true).query.page;
            console.log("previousUrl: " + previousDate);
            aggrCurrent = new Date(previousDate).getTime();
            if (aggrCurrent >= aggrEnd) {
                this.currentDate = new Date(previousDate);
            }
            // console.log("current date: " + this.currentDate);
            for (const key of Object.keys(fragResponse.fragObs)) {
                if (! (key in temporalObs)) {
                    temporalObs[key] = [];
                }
                temporalObs[key] = fragResponse.fragObs[key].concat(temporalObs[key]);
            }
        }
        // console.log("[LOG] aggrCurrent: " + aggrCurrent);
        // console.log("[LOG] aggrEnd: " + aggrEnd);
        const mergedObs = this.mergeAggregatesTemporal(temporalObs, aggrMethod, aggrStart, aggrInterval);
        this.addObservations(mergedObs);
        // console.log(mergedObs);
        // console.log({startUrl, endUrl, previous: previousUrl});
        const startDateString: string = new Date(aggrEnd).toISOString();
        const endDateString: string = new Date(aggrStart).toISOString();
        // const previousDateString: string = urlParser.parse(previousUrl, true).query.page;
        this.fragEvent.emit({startDateString, endDateString});
        // this.fragEvent.emit(event);
        return {start: startUrl, previous: previousUrl};
    }

    public mergeAggregatesTemporal(obs: Record<string, any[]>,
                                   aggrMethod: string, aggrStart: number, aggrInterval: number):
        Record<string, Observation[]> {
        // console.log(aggrMethod);
        if (typeof aggrMethod !== "undefined") {
            const mergedSummaries: Record<string, Observation[]> = {};
            Object.entries(obs).forEach(
                ([key, values]) => {
                    const phenomenonStart: string = values[0].phenomenonTime["time:hasBeginning"]["time:inXSDDateTimeStamp"];
                    const phenomenonEnd: string = values[0].phenomenonTime["time:hasEnd"]["time:inXSDDateTimeStamp"];
                    // console.log("[LOG] phenomenonInterval: "
                    //    + (new Date(phenomenonEnd).getTime() - new Date(phenomenonStart).getTime()));
                    // console.log("[LOG] aggrInterval: " + aggrInterval);
                    if (new Date(phenomenonEnd).getTime() - new Date(phenomenonStart).getTime() === aggrInterval) {
                        mergedSummaries[key] = values;
                    } else {
                        if (aggrMethod === "average") {
                            // console.log("[LOG] merge averages temporal");
                            mergedSummaries[key] = [this.mergeAveragesTemporal(values)];
                        } else if (aggrMethod === "median") {
                            // console.log("[LOG] merge medians temporal");
                            mergedSummaries[key] = [this.mergeMediansTemporal(values)];
                        }
                    }
                });
            return mergedSummaries;
        }
        return obs;
    }

    public mergeAveragesTemporal(obs: any[]) {
        const startOb = obs[0];
        let count: number = 0;
        let total: number = 0;
        let sensors: Set<any> = new Set([]);
        for (const ob of obs) {
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
        startOb.Output = {count, total};
        startOb.madeBySensor = Array.from(sensors);
        startOb.hasSimpleResult = total / count;
        return startOb;
    }

    public mergeMediansTemporal(obs: any[]) {
        const startOb = obs[0];
        startOb.hasSimpleResult = this.getMedian(obs);
        return startOb;
    }

    /**
     * Fetch all fragments of a list of tiles for a certain date and merges them.
     * @param tiles: tiles for which data has to be requested.
     * @param fromDate: the start date of the request
     * @param currDate: the current date for which all fragments need to be requested.
     * @param toDate: the end date of the request.
     * @param polygonUtils
     * @param aggrMethod
     * @param aggrPeriod
     * @returns response: the startDate, endDate and previousDate of the fragment.
     */
    public async getTilesDataFragmentsSpatial(
        tiles: Tile[],
        polygonUtils: PolygonUtils,
        aggrMethod?: string,
        aggrPeriod?: string): Promise<{fragObs: Record<string, Observation[]>,
        fragmentStart: string, fragmentEnd: string, fragmentPrevious: string}> {
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
            params.page = this.currentDate.toISOString();
            if (typeof aggrMethod !== "undefined") {
                params.aggrMethod = aggrMethod;
            }
            if (typeof aggrPeriod !== "undefined") {
                if (aggrPeriod !== "min" && aggrPeriod !== "hour") {
                    aggrPeriod = "hour";
                }
                params.aggrPeriod = aggrPeriod;
            }
            const url = this.urlTemplate.expand(params).replace(/%3A/g, ":");
            // console.log(url);
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
            const filteredFragmentObs = this.filterObservations(fragmentObs, polygonUtils);
            for (const key of Object.keys(filteredFragmentObs)) {
                if (! (key in unsortedObs)) {
                    unsortedObs[key] = [];
                }
                unsortedObs[key].push(filteredFragmentObs[key]);
            }
        }
        let allFragObs = this.mergeObservations(unsortedObs);
        // console.log(allFragObs);
        allFragObs = this.mergeAggregatesSpatial(allFragObs, aggrMethod, tiles.length);
        // console.log(allFragObs);
        return {fragObs: allFragObs, fragmentStart, fragmentEnd, fragmentPrevious};
    }

    public mergeAggregatesSpatial(obs: Record<string, Observation[]>,
                                  aggrMethod: string,
                                  nrTiles: number): Record<string, Observation[]> {
        if (aggrMethod === "average") {
            const mergedAverages: Record<string, Observation[]> = {};
            Object.entries(obs).forEach(
                ([key, values]) => mergedAverages[key] = this.mergeAveragesSpatial(values));
            return mergedAverages;
        } else if (aggrMethod === "median") {
            const mergedMedians: Record<string, Observation[]> = {};
            Object.entries(obs).forEach(
                ([key, values]) => mergedMedians[key] = this.mergeMediansSpatial(values));
            return obs;
        }
        return obs;
    }

    public mergeAveragesSpatial(obs: any[]): any[] {
        let currOb = obs[0];
        let total = 0;
        let count = 0;
        let sensors: Set<any> = new Set([]);
        // console.log(obs);
        const mergedObs: any[] = [];
        for (const ob of obs) {
            if (currOb.resultTime !== ob.resultTime) {
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
        // console.log(mergedObs);
        return mergedObs;
    }

    public mergeMediansSpatial(obs: any[]): any[] {
        const mergedObs: any[] = [];
        let currOb = obs[0];
        let medianObs: any[] = [];
        console.log(obs);
        obs.forEach((ob) => {
            if (ob.resultTime !== currOb.resultTime) {
                currOb.hasSimpleResult = this.getMedian(medianObs);
                mergedObs.push(currOb);
                medianObs = [];
                currOb = ob;
            }
            medianObs.push(ob);
        });

        if (medianObs.length) {
            currOb.hasSimpleResult = this.getMedian(medianObs);
            mergedObs.push(currOb);
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

    public parseISOString(s: string) {
        const b = s.split(/\D+/);
        return new Date(Date.UTC(Number(b[0]), Number(b[1]) - 1,
            Number(b[2]), Number(b[3]), Number(b[4]), Number(b[5]), Number(b[6])));
    }

    /**
     * Fetch a single fragment.
     * @param url: url for the fragment to be requested.
     * @returns promise for the requested fragment
     */
    public async getDataFragment(url: string): Promise<any> {
        console.log(url);
        return new Promise((resolve, reject) => {
            const cacheableRequest = new CacheableRequest(http.request);
            let body: any = [];
            const cacheReq = cacheableRequest(url);
            cacheReq.on("response", (res: any) => {
                res.on("data", (chunk: any) => {
                    body.push(chunk);
                });
                res.on("end", () => {
                    body = Buffer.concat(body).toString();
                    // console.log(JSON.parse(body));
                    resolve(JSON.parse(body));
                    // at this point, `body` has the entire request body stored in it as a string
                });
            });
            cacheReq.on("request", (req: any) => {
                // console.log(req);
                req.end();
            });

            cacheReq.on("error", (err: any) => reject(err));
        });
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
     * @param polygonUtils
     * @returns filtered list of observations
     */
    public filterObservations(obs: Observation[],
                              polygonUtils: PolygonUtils): Record<string, Observation[]> {
        const fragmentObservations: Record<string, Observation[]> = {};
        obs.forEach( (ob) => {
            const resultDate = new Date(ob.resultTime);
            if (resultDate <= this.endDate && resultDate >= this.startDate
                && (("lat" in ob && polygonUtils.polygonContainsPoint({lat: ob.lat, lon: ob.long}))
                    || ! ("lat" in ob))) {
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
     * @param aggrMethod
     * @param aggrPeriod
     */
    public getCurrentObservations(metric: string, aggrMethod?: string, aggrPeriod?: string) {
        if (typeof aggrMethod !== "undefined") {
            return this.calculateSummaries(metric, aggrMethod, aggrPeriod);
        }
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

    private calculateSummaries(metric: string, aggrMethod: string, aggrPeriod: string) {
        const aggrInterval = this.getAggrInterval(aggrPeriod);
        if (aggrMethod === "average") {
            return this.calculateAverages(this.observations[metric], aggrInterval, metric);
        } else if (aggrMethod === "median") {
            return this.calculateMedians(this.observations[metric], aggrInterval, metric);
        } else {
            return this.observations[metric];
        }
    }

    private convertSensors(sensors: Set<string>): string[] {
        const sensorArr: string[] = [];
        for (const sensorId of sensors) {
            sensorArr.push(sensorId);
        }
        return sensorArr;
    }

    private buildAggregateObservation(
        time: number,
        value: (number | string),
        metricId: string,
        sensors: Set<string>,
        usedProcedure: string,
        aggrInterval: number,
    ) {
        const date = new Date(time);
        const sensorArr = this.convertSensors(sensors);
        return {
            "@id": process.env.BASEURL + "/" + time,
            "@type": "sosa:Observation",
            "hasSimpleResult": value,
            "resultTime": date.toISOString(),
            "phenomenonTime": {"rdf:type": "time:Interval",
                "time:hasBeginning": {"rdf:type": "time:Instant",
                    "time:inXSDDateTimeStamp": new Date(time).toISOString() },
                "time:hasEnd": {
                    "rdf:type": "time:Instant",
                    "time:inXSDDateTimeStamp": new Date(time + aggrInterval).toISOString() }},
            "observedProperty":  metricId,
            "madeBySensor": sensorArr,
            "usedProcedure": process.env.BASEURL + "/id/" + usedProcedure,
            "hasFeatureOfInterest": process.env.BASEURL + "/AirQuality",
        };
    }

    private calculateMedians(obs: any[], aggrInterval: number, metric: string) {
        const medianObservations = [];
        // startDate + 5 minutes
        let nextMedian: number = this.currentDate.getTime();
        nextMedian += aggrInterval;
        const tempSensors = new Set<string>();
        const usedProcedure = "median";

        let startIntervalIndex = 0;
        for (let i = 0; i < obs.length; i++) {
            tempSensors.add(obs[i].madeBySensor);
            if (new Date(obs[i].resultTime).getTime() >= nextMedian) {
                if (i > startIntervalIndex) {
                    const medianResults = obs.slice(startIntervalIndex, i);
                    const median = this.getMedian(medianResults);
                    medianObservations.push(this.buildAggregateObservation(
                        nextMedian - aggrInterval,
                        median,
                        metric,
                        tempSensors,
                        usedProcedure,
                        aggrInterval,
                    ));
                }
                startIntervalIndex = i;
                tempSensors.clear();
                nextMedian += aggrInterval;
            }
        }
        const medianResults = obs.slice(startIntervalIndex);
        const median = this.getMedian(medianResults);
        medianObservations.push(this.buildAggregateObservation(
            nextMedian - aggrInterval,
            median,
            metric,
            tempSensors,
            usedProcedure,
            aggrInterval,
        ));
        return medianObservations;
    }

    private calculateAverages(obs: any[], aggrInterval: number, metric: string) {
        const avgObservations = [];
        console.log(obs);
        let nextAvg: number = this.startDate.getTime();
        nextAvg += aggrInterval;
        // total of observation values between a time interval
        let tempTotal: number = 0;
        // total count of observations between a time interval
        let count: number = 0;
        const tempSensors = new Set<string>();
        const usedProcedure = "average";
        for (const ob of obs) {
            if (new Date(ob.resultTime).getTime() <= nextAvg) {
                tempTotal = tempTotal + Number(ob.hasSimpleResult);
                count++;
                tempSensors.add(ob.madeBySensor);
            } else {
                // only add an average if there are values in the time interval
                if (count > 0) {
                    console.log("joep");
                    const nextObs: any = this.buildAggregateObservation(
                        nextAvg - aggrInterval,
                        tempTotal / count,
                        metric,
                        tempSensors,
                        usedProcedure,
                        aggrInterval,
                    );
                    nextObs.Output = { count, total: tempTotal};
                    avgObservations.push(nextObs);
                }
                nextAvg += aggrInterval;
                tempTotal = 0;
                count = 0;
                tempSensors.clear();
            }
        }
        if (count > 0) {
            const lastObs: any = this.buildAggregateObservation(
                nextAvg - aggrInterval,
                tempTotal / count,
                metric,
                tempSensors,
                usedProcedure,
                aggrInterval,
            );
            lastObs.Output = {count, total: tempTotal};
            avgObservations.push(lastObs);
        }
        return avgObservations;
    }
}
