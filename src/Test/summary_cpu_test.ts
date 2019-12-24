// tslint:disable-next-line:no-var-requires
const Influx = require("influx");

import DataFetcher from "../Fetcher/DataFetcher";
// tslint:disable-next-line:no-var-requires
const fs = require("fs");

const polygon = [{lat: 51.247948256199855, lng: 4.3948650278756585},
    {lat: 51.247946204391134, lng: 4.4163950267780425},
    {lat: 51.23452080628115, lng: 4.416370424386079},
    {lat: 51.23463220868682, lng: 4.394649463052668}];
const fromDate = "2019-11-09T00:00:00.000Z";
const toDate = "2019-11-16T00:00:00.000Z";
let datafetcher = new DataFetcher();
const metric = "http://example.org/data/airquality.no2::number";
let start;
const methods: CallableFunction[] = [summariesWeekMedianMinData];
const influx = new Influx.InfluxDB({
    host: "localhost",
    database: "cadvisor_db",
    port: 8086,
});
let cpu1Saved = true;
let cpu2Saved = true;
let methodIndex = -1;
const queryTemplate = "SELECT time, value FROM \"cpu_usage_total\" where container_name = 'airqualityexpressserver_aqs1_1' and time >= ";
const queryTemplate2 = "SELECT time, value FROM \"cpu_usage_total\" where container_name = 'airqualityexpressserver_aqs2_1' and time >= ";

function summariesWeekAvgMinData() {
    datafetcher = new DataFetcher();
    datafetcher.clearCache();
    datafetcher.addDataListener(checkTestFinished);
    start = Date.now();
    datafetcher.getPolygonObservations(polygon, fromDate, toDate, "average", "min");
}

function summariesWeekAvgHourData() {
    datafetcher = new DataFetcher();
    datafetcher.clearCache();
    datafetcher.addDataListener(checkTestFinished);
    start = Date.now();
    datafetcher.getPolygonObservations(polygon, fromDate, toDate, "average", "hour");
}

function summariesWeekAvgDayData() {
    datafetcher = new DataFetcher();
    datafetcher.clearCache();
    datafetcher.addDataListener(checkTestFinished);
    start = Date.now();
    datafetcher.getPolygonObservations(polygon, fromDate, toDate, "average", "day");
}

function summariesWeekMedianMinData() {
    datafetcher = new DataFetcher();
    datafetcher.clearCache();
    datafetcher.addDataListener(checkTestFinished);
    start = Date.now();
    datafetcher.getPolygonObservations(polygon, fromDate, toDate, "median", "min");
}

function summariesWeekMedianHourData() {
    datafetcher = new DataFetcher();
    datafetcher.clearCache();
    datafetcher.addDataListener(checkTestFinished);
    start = Date.now();
    datafetcher.getPolygonObservations(polygon, fromDate, toDate, "median", "hour");
}

function summariesWeekMedianDayData() {
    datafetcher = new DataFetcher();
    datafetcher.clearCache();
    datafetcher.addDataListener(checkTestFinished);
    start = Date.now();
    datafetcher.getPolygonObservations(polygon, fromDate, toDate, "median", "day");
}

function checkTestFinished(data) {
    if  (new Date(data.endDateString) >= new Date(toDate) && methodIndex < methods.length) {
        console.log(start);
        getCPUUsage(new Date(start).toISOString());
    }
}

function startNextSummariesWeekTest() {
    if (cpu1Saved && cpu2Saved) {
        cpu1Saved = false;
        cpu2Saved = false;
        methodIndex++;
        if (methodIndex < methods.length) {
            methods[methodIndex]();
        }
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getCPUUsage(param: string) {
    const query = queryTemplate + "\'" + param + "\'";
    const query2 = queryTemplate2 + "\'" + param + "\'";
    await sleep(60000);
    console.log(query);
    influx.query(query)
        .catch((err) => {
            console.log(err);
        })
        .then((res) => {
            // const result = JSON.parse(res);
            // console.log(res);
            fs.writeFile(`./src/Test/testData/cpuData/${methods[methodIndex].name}_aqs1_cpu.txt`,
                JSON.stringify(res), (err) => {
                    if (err) {
                        return console.log(err);
                    }
                    console.log("The cpu file 1 was saved!");
                    cpu1Saved = true;
                    startNextSummariesWeekTest();
                });
        });
    influx.query(query2)
        .catch((err) => {
            console.log(err);
        })
        .then((res) => {
            // const result = JSON.parse(res);
            console.log(res);
            fs.writeFile(`./src/Test/testData/cpuData/${methods[methodIndex].name}_aqs2_cpu.txt`,
                JSON.stringify(res), (err) => {
                    if (err) {
                        return console.log(err);
                    }
                    console.log("The cpu file 2 was saved!");
                    cpu2Saved = true;
                    startNextSummariesWeekTest();
                });
        });
}

startNextSummariesWeekTest();
// getCPUUsage("SELECT time, value FROM \"cpu_usage_total\" where container_name =
// 'airqualityexpressserver_aqs1_1' and time >= '2019-12-21T15:27:36.466394691Z'");
