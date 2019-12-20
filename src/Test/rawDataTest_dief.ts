import DataFetcher from "../Fetcher/DataFetcher";
// tslint:disable-next-line:no-var-requires
const fs = require("fs");

const polygon = [{lat: 51.247948256199855, lng: 4.3948650278756585},
    {lat: 51.247946204391134, lng: 4.4163950267780425},
    {lat: 51.23452080628115, lng: 4.416370424386079},
    {lat: 51.23463220868682, lng: 4.394649463052668}];
const fromDate = "2019-11-09T00:00:00.000Z";
const toDate = "2019-11-16T00:00:00.000Z";
let rawData = [];
let rawTimeStamps = [];
let datafetcher = new DataFetcher();
const metric = "http://example.org/data/airquality.no2::number";
const methods: CallableFunction[] = [onRawDataAvgDay];
let start;
let methodIndex = -1;
let currentListener;

function rawWeekData(method: CallableFunction) {
    datafetcher = new DataFetcher();
    datafetcher.clearCache();
    currentListener = datafetcher.addFragmentListener(method);
    rawData = [];
    rawTimeStamps = [];
    start = Date.now();
    datafetcher.getPolygonObservations(polygon,
        fromDate,
        toDate);
}

function onRawDataAvgMin(data) {
    datafetcher.getCurrentObservations(metric, "average", "min");
    rawTimeStamps.push(Date.now() - start);
    checkTestFinished(data);
}

function onRawDataAvgHour(data) {
    datafetcher.getCurrentObservations(metric, "average", "hour");
    rawTimeStamps.push(Date.now() - start);
    checkTestFinished(data);
}

let avgCounter = 0;
function onRawDataAvgDay(data) {
    avgCounter++;
    if (avgCounter === 24) {
        datafetcher.getCurrentObservations(metric, "average", "day");
        rawTimeStamps.push(Date.now() - start);
        avgCounter = 0;
    }
    checkTestFinished(data);
}

function onRawDataMedianMin(data) {
    datafetcher.getCurrentObservations(metric, "median", "min");
    rawTimeStamps.push(Date.now() - start);
    checkTestFinished(data);
}

function onRawDataMedianHour(data) {
    datafetcher.getCurrentObservations(metric, "median", "hour");
    rawTimeStamps.push(Date.now() - start);
    checkTestFinished(data);
}

let medianCounter = 0;
function onRawDataMedianDay(data) {
    medianCounter++;
    if (medianCounter === 24) {
        datafetcher.getCurrentObservations(metric, "median", "day");
        rawTimeStamps.push(Date.now() - start);
        medianCounter = 0;
    }
    console.log(medianCounter);
    checkTestFinished(data);
}

function checkTestFinished(data) {
    if  (new Date(data.endDateString) >= new Date(toDate) && methodIndex < methods.length) {
        console.log(methodIndex);

        fs.writeFile(`./src/Test/testData/cached/${methods[methodIndex].name}_dief.txt`,
            JSON.stringify(rawTimeStamps), (err) => {
                if (err) {
                    return console.log(err);
                }

                console.log("The timestamp file was saved!");
                startNextRawWeekTest();
            });
    }
}

function startNextRawWeekTest() {
    methodIndex ++;
    if (methodIndex < methods.length) {
        rawWeekData(methods[methodIndex]);
    }

}

startNextRawWeekTest();
