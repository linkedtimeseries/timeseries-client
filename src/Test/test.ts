import DataFetcher from "../../src/Fetcher/DataFetcher";
// tslint:disable-next-line:no-var-requires
const urlParser = require("url");

const baseUrl = "http://localhost:5000/data/14";
const xTile = 8392;
const yTile = 5467;

const page = "2019-11-09T00:00:00.000Z";
const url = `${baseUrl}/${xTile}/${yTile}?page=${page}`;

// async function getTestData() {
//     const rawData = [];
//     const rawTimeStamps = [];
//     const summariesData = [];
//     const summariesTimeStamps = [];
//     const factors = [];
//
//     for (let i = 0; i < 20; i++) {
//         const rawRespStart = Date.now();
//         const rawResp = await datafetcher.getDataFragment(url);
//         const rawRespEnd = Date.now();
//         const rawLength = JSON.stringify(rawResp).length;
//         rawData.push(rawLength);
//         rawTimeStamps.push(rawRespEnd - rawRespStart);
//         const summariesRespStart = Date.now();
//         const summariesResp = await datafetcher.getDataFragment(url + "&aggrMethod=average&aggrPeriod=hour");
//         const summariesRespEnd = Date.now();
//         const summariesLength = JSON.stringify(summariesResp).length;
//         summariesData.push(summariesLength);
//         summariesTimeStamps.push(summariesRespEnd - summariesRespStart);
//         factors.push(rawLength / summariesLength);
//         const dateString = urlParser.parse(url, true).query.page;
//         const date: Date = new Date(dateString);
//         console.log(date);
//         date.setHours(date.getHours() + 1);
//         console.log(date);
//         url = `${baseUrl}/${xTile}/${yTile}?page=${date.toISOString()}`;
//     }
//
//     return {rawData, summariesData, factors, rawTimeStamps, summariesTimeStamps};
// }
//
// async function testBandwidth() {
//     const response = await getTestData();
//
//     console.log(response.rawData);
//     console.log(response.summariesData);
//     console.log(response.factors);
// }
//
// async function testDieft() {
//     const response = await getTestData();
//     let cumulRaw = [];
//     let cumulSummaries = [];
//     response.rawData.reduce((a, b, i) => cumulRaw[i] = a + b, 0);
//     cumulRaw = cumulRaw.map((el) => el / cumulRaw[cumulRaw.length - 1]);
//     response.summariesData.reduce((a, b, i) => cumulSummaries[i] = a + b, 0);
//     cumulSummaries = cumulSummaries.map((el) => el / cumulSummaries[cumulSummaries.length - 1]);
//
//     console.log(cumulRaw);
//     console.log(response.rawTimeStamps);
//     console.log(response.rawTimeStamps.reduce((a, b) => a + b, 0));
//     console.log(cumulSummaries);
//     console.log(response.summariesTimeStamps);
//     console.log(response.summariesTimeStamps.reduce((a, b) => a + b, 0));
// }

async function weekTest() {
    const datafetcher = new DataFetcher();
    datafetcher.addFragmentListener(onData);
    // datafetcher.hallo();
}

function onData(data) {
    console.log("hoezee");
}
weekTest();
