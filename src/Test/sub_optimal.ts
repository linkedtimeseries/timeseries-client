import DataFetcher from "../Fetcher/DataFetcher";
// tslint:disable-next-line:no-var-requires
const fs = require("fs");

const polygon = [{lat: 51.249737031298054, lng: 4.390548326781084},
    {lat: 51.249617644679304, lng: 4.426600183602956},
    {lat: 51.22919803601266, lng: 4.42440655342685},
    {lat: 51.23069100411485, lng: 4.389308447033172}];
const fromDate = "2019-11-01T00:00:00.000Z";
const toDate = "2019-11-31T00:00:00.000Z";
const metric = "http://example.org/data/airquality.no2::number";
let datafetcher = new DataFetcher();
let start;
let methodIndex = -1;
let dataSaved = true;
const methods: CallableFunction[] = [rawWeekData, summariesWeekMedianHourData];

function rawWeekData(method: CallableFunction) {
    datafetcher = new DataFetcher();
    datafetcher.addDataListener(method);
    datafetcher.clearCache();
    start = Date.now();
    datafetcher.getPolygonObservations(polygon,
        fromDate,
        toDate);
}

function summariesWeekMedianHourData(method: CallableFunction) {
    datafetcher = new DataFetcher();
    datafetcher.addDataListener(method);
    start = Date.now();
    datafetcher.getPolygonObservations(polygon, fromDate, toDate, "median", "hour");
}

function onData(data) {
    checkTestFinished(data);
}

function checkTestFinished(data) {
    if  (new Date(data.endDateString) >= new Date(toDate)) {
        let obs;
        if (! methodIndex) {
            obs = datafetcher.getCurrentObservations(metric, "median", "hour");
        } else {
            obs = datafetcher.getCurrentObservations(metric);
        }
        console.log(methods[methodIndex].name);
        fs.writeFile(`./src/Test/testData/subOptimality/${methods[methodIndex].name}.txt`,
            JSON.stringify(obs), (err) => {
            if (err) {
                return console.log(err);
            }

            console.log("The data file was saved!");
            dataSaved = true;
            startNextRawWeekTest();
        });
    }
}

function startNextRawWeekTest() {
    if (dataSaved) {
        dataSaved = false;
        methodIndex ++;
        if (methodIndex < methods.length) {
            methods[methodIndex](onData);
        }
    }
}

startNextRawWeekTest();
