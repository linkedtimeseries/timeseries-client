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
const methods: CallableFunction[] = [onRawDataAvgDay];
let start;
let methodIndex = -1;
let currentListener;
let timestampsSaved = true;
let dataSaved = true;

function rawWeekData(method: CallableFunction) {
    datafetcher = new DataFetcher();
    datafetcher.clearCache();
    currentListener = datafetcher.addDataListener(method);
    rawData = [];
    rawTimeStamps = [];
    start = Date.now();
    datafetcher.getPolygonObservations(polygon,
        fromDate,
        toDate);
}

function onRawDataAvgMin(data) {
    // datafetcher.getCurrentObservations(metric, "average", "min");
    rawTimeStamps.push(Date.now() - start);
    const rawLength = JSON.stringify(data.data).length;
    rawData.push(rawLength);
    checkTestFinished(data);
}

function onRawDataAvgHour(data) {
    // datafetcher.getCurrentObservations(metric, "average", "hour");
    rawTimeStamps.push(Date.now() - start);
    const rawLength = JSON.stringify(data.data).length;
    rawData.push(rawLength);
    checkTestFinished(data);
}

function onRawDataAvgDay(data) {
    // datafetcher.getCurrentObservations(metric, "average", "day");
    rawTimeStamps.push(Date.now() - start);
    const rawLength = JSON.stringify(data.data).length;
    rawData.push(rawLength);
    checkTestFinished(data);
}

function onRawDataMedianMin(data) {
    // datafetcher.getCurrentObservations(metric, "median", "min");
    rawTimeStamps.push(Date.now() - start);
    const rawLength = JSON.stringify(data.data).length;
    rawData.push(rawLength);
    checkTestFinished(data);
}

function onRawDataMedianHour(data) {
    // datafetcher.getCurrentObservations(metric, "median", "hour");
    rawTimeStamps.push(Date.now() - start);
    const rawLength = JSON.stringify(data.data).length;
    rawData.push(rawLength);
    checkTestFinished(data);
}

function onRawDataMedianDay(data) {
    // datafetcher.getCurrentObservations(metric, "median", "day");
    rawTimeStamps.push(Date.now() - start);
    const rawLength = JSON.stringify(data.data).length;
    rawData.push(rawLength);
    checkTestFinished(data);
}

function checkTestFinished(data) {
    if  (new Date(data.endDateString) >= new Date(toDate) && methodIndex < methods.length) {
        const cumulRaw = [];
        console.log(methodIndex);
        rawData.reduce((a, b, i) => cumulRaw[i] = a + b, 0);
        console.log(methods[methodIndex].name);
        fs.writeFile(`./src/Test/testData/uncached/uncached_${methods[methodIndex].name}.txt`,
            JSON.stringify(cumulRaw), (err) => {
            if (err) {
                return console.log(err);
            }

            console.log("The data file was saved!");
            dataSaved = true;
            startNextRawWeekTest();
        });

        fs.writeFile(`./src/Test/testData/uncached/uncached_${methods[methodIndex].name}_timestamps.txt`,
            JSON.stringify(rawTimeStamps), (err) => {
                if (err) {
                    return console.log(err);
                }

                console.log("The timestamps file was saved!");
                timestampsSaved = true;
                startNextRawWeekTest();
            });
    }
}

function startNextRawWeekTest() {
    if (dataSaved && timestampsSaved) {
        dataSaved = false;
        timestampsSaved = false;
        methodIndex ++;
        if (methodIndex < methods.length) {
            rawWeekData(methods[methodIndex]);
        }
    }
}

startNextRawWeekTest();
