import DataFetcher from "../../lib/Fetcher/DataFetcher";
// tslint:disable-next-line:no-var-requires
const urlParser = require("url");

const datafetcher = new DataFetcher();

const baseUrl = "http://localhost:5000/data/14";
const xTile = 8392;
const yTile = 5467;

const page = "2019-11-09T00:00:00.000Z";
let url = `${baseUrl}/${xTile}/${yTile}?page=${page}`;

async function testBandwidth() {
    const rawData = [];
    const summariesData = [];
    const factors = [];

    for (let i = 0; i < 20; i++) {
        const rawResp = await datafetcher.getDataFragment(url);
        const rawLength = JSON.stringify(rawResp).length;
        rawData.push(rawLength);
        const summariesResp = await datafetcher.getDataFragment(url + "&aggrMethod=average&aggrPeriod=hour");
        const summariesLength = JSON.stringify(summariesResp).length;
        summariesData.push(summariesLength);
        factors.push(rawLength / summariesLength);
        const dateString = urlParser.parse(url, true).query.page;
        const date: Date = new Date(dateString);
        console.log(date);
        date.setHours(date.getHours() + 1);
        console.log(date);
        url = `${baseUrl}/${xTile}/${yTile}?page=${date.toISOString()}`;
    }

    console.log(rawData);
    console.log(summariesData);
    console.log(factors);
}

testBandwidth();
