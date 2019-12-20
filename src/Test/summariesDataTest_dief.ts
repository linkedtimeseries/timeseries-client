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
const methods: CallableFunction[] = [summariesWeekAvgMinData, summariesWeekAvgHourData, summariesWeekAvgDayData,
    summariesWeekMedianMinData, summariesWeekMedianHourData, summariesWeekMedianDayData];
let start;
let methodIndex = -1;
let currentListener;


function summariesWeekAvgMinData(method: CallableFunction) {
    datafetcher = new DataFetcher();
    datafetcher.clearCache();
    currentListener = datafetcher.addFragmentListener(method);
    summariesData = [];
    summariesTimeStamps = [];
    start = Date.now();
    datafetcher.getPolygonObservations(polygon, fromDate, toDate, "average", "min");
}

function summariesWeekAvgHourData(method: CallableFunction) {
    datafetcher = new DataFetcher();
    currentListener = datafetcher.addFragmentListener(method);
    summariesData = [];
    summariesTimeStamps = [];
    start = Date.now();
    datafetcher.getPolygonObservations(polygon, fromDate, toDate, "average", "hour");
}

function summariesWeekAvgDayData(method: CallableFunction) {
    datafetcher = new DataFetcher();
    currentListener = datafetcher.addFragmentListener(method);
    summariesData = [];
    summariesTimeStamps = [];
    start = Date.now();
    datafetcher.getPolygonObservations(polygon, fromDate, toDate, "average", "day");
}

function summariesWeekMedianMinData(method: CallableFunction) {
    datafetcher = new DataFetcher();
    currentListener = datafetcher.addFragmentListener(method);
    summariesData = [];
    summariesTimeStamps = [];
    start = Date.now();
    datafetcher.getPolygonObservations(polygon, fromDate, toDate, "median", "min");
}

function summariesWeekMedianHourData(method: CallableFunction) {
    datafetcher = new DataFetcher();
    currentListener = datafetcher.addFragmentListener(method);
    summariesData = [];
    summariesTimeStamps = [];
    start = Date.now();
    datafetcher.getPolygonObservations(polygon, fromDate, toDate, "median", "hour");
}

function summariesWeekMedianDayData(method: CallableFunction) {
    datafetcher = new DataFetcher();
    currentListener = datafetcher.addFragmentListener(method);
    summariesData = [];
    summariesTimeStamps = [];
    start = Date.now();
    datafetcher.getPolygonObservations(polygon, fromDate, toDate, "median", "day");
}

function onSummariesData(data) {
    // const summariesLength = JSON.stringify(data).length;
    summariesTimeStamps.push(Date.now() - start);
    // summariesData.push(summariesLength);
    checkTestFinished(data);
}

function checkTestFinished(data) {
    if  (new Date(data.endDateString) >= new Date(toDate) && methodIndex < methods.length) {
        fs.writeFile(`./src/Test/testData/cached/${methods[methodIndex].name}_timestamps.txt`,
            JSON.stringify(summariesTimeStamps), (err) => {
                if (err) {
                    return console.log(err);
                }
                console.log("The timestamp file was saved!");
                startNextSummariesWeekTest();
            });
    }
}

function startNextSummariesWeekTest() {
    methodIndex ++;
    if (methodIndex < methods.length) {
        methods[methodIndex](onSummariesData);
    }
}

startNextSummariesWeekTest();
