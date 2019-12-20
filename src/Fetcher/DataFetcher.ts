import Config from "../Config/Config";
import Observation from "../DataTypes/Observation";
import {FragmentEvent} from "../EventEmitter/FragmentEvent";
import {Listener} from "../EventEmitter/Listener";
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
let cacheableRequest = new CacheableRequest(http.request);
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
    private dataEvent: FragmentEvent<object> = new FragmentEvent();

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
        // console.log(geometry);
        const tiles: Tile[] = polygonUtils.calculateTilesWithinPolygon();
        // console.log("request sent");
        // console.log(tiles);
        fromDate = this.dateOffsetCorrection(fromDate, aggrPeriod);
        toDate = this.dateOffsetCorrection(toDate, aggrPeriod);
        this.observations = {};
        this.startDate = new Date(fromDate);
        this.endDate = new Date(toDate);
        this.currentDate = new Date(fromDate);
        await this.getObservationsRecursive(tiles, polygonUtils, aggrMethod, aggrPeriod);
        return;
    }

    /**
     * Aligns a date with a given aggregation period
     * @param datestr: the string of the date
     * @param aggrPeriod: the aggregation period
     */
    public dateOffsetCorrection(datestr: string, aggrPeriod?: string) {
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
                if (date.getUTCHours() !== 0 ||
                   date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0) {
                    interval = Config.context.day;
                    date.setUTCHours(0, 0, 0, 0);
                }
                break;
        }
        date = new Date(date.getTime() + interval);
        // console.log(date.toISOString());
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
        await this.getTilesDataFragmentsTemporal(tiles, polygonUtils, aggrMethod, aggrPeriod)
            .then((response) => {
                // console.log("[LOG] response after temporal: " + response);
                // console.log("current date: " + this.currentDate);
                // console.log("fromDate: " + this.startDate);
                if (this.currentDate < this.endDate) {
                    // this.currentDate = new Date(response.next);
                    // console.log("next");
                    // console.log(urlParser.parse(response.previous).query);
                    // console.log(urlParser.parse(response.previous).query.page);
                    this.getObservationsRecursive(tiles, polygonUtils, aggrMethod, aggrPeriod);
                    return;
                }
                // console.log("[LOG] finished");
        });
        return;
    }

    /**
     * returns an interval in milliseconds
     * @param aggrPeriod: the string of the interval to be returned
     */
    public getAggrInterval(aggrPeriod?: string) {
        // if undefined, then there is no aggregation period and we only need to run getTilesDataFragmentsTemporal once
        if (typeof aggrPeriod === "undefined") {
            return 1;
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
                return 1;
        }
    }

    /**
     * Type check for a date. If the date is a string, it gets converted
     * @param date
     */
    public dateCheck(date: (Date | string)) {
        if (typeof date === "string") {
            date = new Date(date);
        }
        return date;
    }

    /**
     * Requests data over all given tiles, over the given aggregation period (this is 0 when raw data is requested)
     * @param tiles: the tiles over which data is queried
     * @param polygonUtils: methods to help filter the queried data
     * @param aggrMethod: method to aggregate data (none if raw data is requested)
     * @param aggrPeriod: period over which data needs to be aggregated
     */
    public async getTilesDataFragmentsTemporal(
        tiles: Tile[],
        polygonUtils: PolygonUtils,
        aggrMethod?: string,
        aggrPeriod?: string,
    ): Promise<any> {

        const aggrInterval = this.getAggrInterval(aggrPeriod);
        // console.log("[LOG] aggrInterval: " + aggrInterval);
        // console.log(this.currentDate);
        let aggrCurrent = this.currentDate.getTime();
        const aggrStart = aggrCurrent;
        const aggrEnd = aggrStart + aggrInterval;

        const temporalObs: Record<string, Observation[]> = {};
        let nextDate: string = "";
        let endDateString: string = "";
        while (aggrCurrent < aggrEnd) {
            const fragResponse = await
                this.getTilesDataFragmentsSpatial(tiles, polygonUtils, aggrMethod, aggrPeriod);

            endDateString = fragResponse.fragmentEnd;
            nextDate = urlParser.parse(fragResponse.fragmentNext, true).query.page;
            aggrCurrent = new Date(nextDate).getTime();
            this.currentDate = new Date(nextDate);

            for (const key of Object.keys(fragResponse.fragObs)) {
                if (! (key in temporalObs)) {
                    temporalObs[key] = [];
                }
                temporalObs[key] = temporalObs[key].concat(fragResponse.fragObs[key]);
            }
            // console.log(temporalObs);
        }
        const aggregateObs = this.aggregatesTemporal(temporalObs, aggrMethod, aggrStart, aggrInterval);
        this.addObservations(aggregateObs);
        const startDateString: string = new Date(aggrStart).toISOString();
        // console.log({startDateString, endDateString});
        this.fragEvent.emit({startDateString, endDateString});
        return {start: startDateString, next: nextDate};
    }

    /**
     * If the aggregation period is longer than the time span of the fragments, additional merging in the temporal
     * dimension is required to get the correct result
     * @param obs: the observations to be merged
     * @param aggrMethod: the aggregation method
     * @param aggrStart: the time at which aggregation starts
     * @param aggrInterval: the interval over which needs to be aggregated
     */
    public aggregatesTemporal(obs: Record<string, any[]>,
                              aggrMethod: string, aggrStart: number, aggrInterval: number):
        Record<string, Observation[]> {
        if (typeof aggrMethod !== "undefined") {
            const mergedSummaries: Record<string, Observation[]> = {};
            Object.entries(obs).forEach(
                ([key, values]) => {
                    const phenomenonStart: string = values[0].phenomenonTime["time:hasBeginning"]["time:inXSDDateTimeStamp"];
                    const phenomenonEnd: string = values[0].phenomenonTime["time:hasEnd"]["time:inXSDDateTimeStamp"];
                    if (new Date(phenomenonEnd).getTime() - new Date(phenomenonStart).getTime() === aggrInterval) {
                        mergedSummaries[key] = values;
                    } else {
                        if (aggrMethod === "average") {
                            mergedSummaries[key] = [this.averagesTemporal(values)];
                        } else if (aggrMethod === "median") {
                            mergedSummaries[key] = [this.mediansTemporal(values)];
                        }
                    }
                });
            return mergedSummaries;
        }
        return obs;
    }

    /**
     * Apply averaging to observations in time
     * @param obs
     */
    public averagesTemporal(obs: any[]) {
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

    /**
     * Apply medians to observations in time
     * @param obs
     */
    public mediansTemporal(obs: any[]) {
        const startOb = obs[0];
        startOb.hasSimpleResult = this.getMedian(obs);
        return startOb;
    }

    /**
     * Fetch all fragments of a list of tiles for a certain date and merges them.
     * @param tiles: tiles for which data has to be requested.
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
        fragmentStart: string, fragmentEnd: string, fragmentNext: string}> {
        let fragmentStart: string = "";
        let fragmentNext: string = "";
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
            fragmentNext = response.next;
            // for testing purposes
            this.dataEvent.emit({startDateString: response.startDate, endDateString: response.endDate, data: response});
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
        allFragObs = this.aggregatesSpatial(allFragObs, aggrMethod);
        // console.log(allFragObs);
        return {fragObs: allFragObs, fragmentStart, fragmentEnd, fragmentNext};
    }

    /**
     * Apply aggregates to observations in spatial dimension
     * @param obs: the observations to be aggregated
     * @param aggrMethod: the method used to aggregate
     */
    public aggregatesSpatial(obs: Record<string, Observation[]>, aggrMethod: string): Record<string, Observation[]> {
        if (aggrMethod === "average") {
            const mergedAverages: Record<string, Observation[]> = {};
            Object.entries(obs).forEach(
                ([key, values]) => mergedAverages[key] = this.averagesSpatial(values));
            return mergedAverages;
        } else if (aggrMethod === "median") {
            const mergedMedians: Record<string, Observation[]> = {};
            Object.entries(obs).forEach(
                ([key, values]) => mergedMedians[key] = this.mediansSpatial(values));
            return mergedMedians;
        }
        return obs;
    }

    /**
     * Apply averaging to observations in spatial dimension
     * @param obs
     */
    public averagesSpatial(obs: any[]): any[] {
        let currOb = obs[0];
        let total = 0;
        let count = 0;
        let sensors: Set<any> = new Set([]);
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
        return mergedObs;
    }

    /**
     * Apply medians to observations in spatial dimension
     * @param obs
     */
    public mediansSpatial(obs: any[]): any[] {
        const mergedObs: any[] = [];
        let currOb = obs[0];
        let medianObs: any[] = [];
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
        return mergedObs;
    }

    /**
     * Get medians of observations
     * @param obs
     */
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
        return new Promise((resolve, reject) => {
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
                this.observations[key] = this.observations[key].concat(obs[key]);
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
     * @returns listener object that was added
     */
    public addFragmentListener(method: CallableFunction) {
        const lst = (observations) => method(observations);
        this.fragEvent.on(lst);
        return lst;
    }

    public addDataListener(method: CallableFunction) {
        const lst = (data) => method(data);
        this.dataEvent.on(lst);
        return lst;
    }

    public removeAllFragmentListeners() {
        this.fragEvent = new FragmentEvent();
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
     * @param polygonUtils
     * @returns filtered list of observations
     */
    public filterObservations(obs: Observation[],
                              polygonUtils: PolygonUtils): Record<string, Observation[]> {
        const fragmentObservations: Record<string, Observation[]> = {};
        obs.forEach( (ob) => {
            const resultDate = new Date(ob.resultTime);
            if (resultDate < this.endDate && resultDate >= this.startDate
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

    public clearCache() {
        cacheableRequest = new CacheableRequest(http.request);
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

    /**
     * Build a new aggregate observation
     * @param time
     * @param value
     * @param metricId
     * @param sensors
     * @param usedProcedure
     * @param aggrInterval
     */
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

    /**
     * Calculate medians of a list of observations
     * @param obs
     * @param aggrInterval
     * @param metric
     */
    private calculateMedians(obs: any[], aggrInterval: number, metric: string) {
        const medianObservations = [];
        // startDate + 5 minutes
        let nextMedian: number = this.startDate.getTime();
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

    /**
     * Calculate averages of a list of observations
     * @param obs
     * @param aggrInterval
     * @param metric
     */
    private calculateAverages(obs: any[], aggrInterval: number, metric: string) {
        const avgObservations = [];
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
                    // console.log("joep");
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
