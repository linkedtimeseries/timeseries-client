import DataFetcher from "../Fetcher/DataFetcher";
// tslint:disable-next-line:no-var-requires
const urlParser = require("url");
// tslint:disable-next-line:no-var-requires
const fs = require("fs");

const polygon = [{lat: 51.247948256199855, lng: 4.3948650278756585},
    {lat: 51.247946204391134, lng: 4.4163950267780425},
    {lat: 51.23452080628115, lng: 4.416370424386079},
    {lat: 51.23463220868682, lng: 4.394649463052668}];
const fromDate = "2019-11-09T00:00:00.000Z";
const toDate = "2019-11-16T00:00:00.000Z";
let summariesData = [];
let summariesTimeStamps = [];
let datafetcher = new DataFetcher();
const methods: CallableFunction[] = [summariesWeekAvgHourData];
let start;
let methodIndex = -1;
let currentListener;

let timestampsSaved = true;
let dataSaved = true;

function summariesWeekAvgMinData(method: CallableFunction) {
    datafetcher = new DataFetcher();
    datafetcher.clearCache();
    currentListener = datafetcher.addDataListener(method);
    summariesData = [];
    summariesTimeStamps = [];
    start = Date.now();
    datafetcher.getPolygonObservations(polygon, fromDate, toDate, "average", "min");
}

function summariesWeekAvgHourData(method: CallableFunction) {
    datafetcher = new DataFetcher();
    currentListener = datafetcher.addDataListener(method);
    summariesData = [];
    summariesTimeStamps = [];
    start = Date.now();
    datafetcher.getPolygonObservations(polygon, fromDate, toDate, "average", "hour");
}

function summariesWeekAvgDayData(method: CallableFunction) {
    datafetcher = new DataFetcher();
    currentListener = datafetcher.addDataListener(method);
    summariesData = [];
    summariesTimeStamps = [];
    start = Date.now();
    datafetcher.getPolygonObservations(polygon, fromDate, toDate, "average", "day");
}

function summariesWeekMedianMinData(method: CallableFunction) {
    datafetcher = new DataFetcher();
    currentListener = datafetcher.addDataListener(method);
    summariesData = [];
    summariesTimeStamps = [];
    start = Date.now();
    datafetcher.getPolygonObservations(polygon, fromDate, toDate, "median", "min");
}

function summariesWeekMedianHourData(method: CallableFunction) {
    datafetcher = new DataFetcher();
    currentListener = datafetcher.addDataListener(method);
    summariesData = [];
    summariesTimeStamps = [];
    start = Date.now();
    datafetcher.getPolygonObservations(polygon, fromDate, toDate, "median", "hour");
}

function summariesWeekMedianDayData(method: CallableFunction) {
    datafetcher = new DataFetcher();
    currentListener = datafetcher.addDataListener(method);
    summariesData = [];
    summariesTimeStamps = [];
    start = Date.now();
    datafetcher.getPolygonObservations(polygon, fromDate, toDate, "median", "day");
}

function onSummariesData(data) {
    const summariesLength = JSON.stringify(data).length;
    summariesTimeStamps.push(Date.now() - start);
    summariesData.push(summariesLength);
    checkTestFinished(data);
}

function checkTestFinished(data) {
    if  (new Date(data.endDateString) >= new Date(toDate) && methodIndex < methods.length) {
        const cumulSummaries = [];
        summariesData.reduce((a, b, i) => cumulSummaries[i] = a + b, 0);
        fs.writeFile(`./src/Test/testData/uncached/uncached_${methods[methodIndex].name}.txt`,
            JSON.stringify(cumulSummaries), (err) => {
                if (err) {
                    return console.log(err);
                }
                console.log("The file was saved!");
                dataSaved = true;
                startNextSummariesWeekTest();
            });

        fs.writeFile(`./src/Test/testData/uncached/uncached_${methods[methodIndex].name}_timestamps.txt`,
            JSON.stringify(summariesTimeStamps), (err) => {
                if (err) {
                    return console.log(err);
                }

                console.log("The timestamps file was saved!");
                timestampsSaved = true;
                startNextSummariesWeekTest();
            });
    }
}

function startNextSummariesWeekTest() {
    if (dataSaved && timestampsSaved) {
        timestampsSaved = false;
        dataSaved = false;
        methodIndex++;
        if (methodIndex < methods.length) {
            methods[methodIndex](onSummariesData);
        }
    }
}

startNextSummariesWeekTest();
