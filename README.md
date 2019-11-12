# timeseries-client
## Introduction

This package allows you to consume air quality time series fragments.

## Prerequisites

Currently, in order to be able to query data fragments, a local running instance of an AirQualityServer is required. 
The code for this server can be acquired from https://github.com/sigvevermandere/AirQualityExpressServer. Instructions on how to setup the 
server can also be found there.

## Install it

Clone this repository and run `npm install`.
To run in the browser, run `npm run webpack` to generate a file `bundle.js` and import it into your project.

## How to use it

The main method here is `getPolygonObservations` in the `DataFetcher` class, which has the following parameters:

```
geometry: Array<{lat: number, lng: number}>,
fromDate: (Date | string),
toDate: (Date | string),
aggrMethod?: string,
aggrPeriod?: string
```

`geometry` contains the area over which data will be requested and is defined as an array of coordinates. 
`fromDate` and `toDate` define the time interval over which data will be requested. 
`aggrMethod` and `aggrPeriod` are two optional parameters that define an aggregation method and period that can be applied to the data.
Currently, possible values for `aggrMethod` are `average` and `median`. Possible values for `aggrPeriod` are `min`, `hour` and `day`.

This method will asynchronously request all data within the given area and time interval, starting at the back of the time interval and going to the front. Queried data is stored in the `DataFetcher` class and can be queried with `getCurrentObservations(metric: string)`, where `metric` is the air quality metric for which the data will be returned. To get all the data, use `getAllCurrentObservations`.

To be notified when new data arrives, methods can subscribe to the datafetcher using `addFragmentListener(method: CallableFunction)`. The datafetcher will execute each subscriber every time a request is completed and pass the `startDate`, `endDate` and `previous` properties of the completed request.

Example: 

´´´
let datafetcher = new TimeSeriesClientSide.DataFetcher();
// Subscribe a method
datafetcher.addFragmentListener(showData);
// Request all the data within the given polygon between 8 and 9 November.
datafetcher.getPolygonObservations([{lat: 51.24925948378325, lng: 4.391884628594368},
{lat: 51.24914009674451, lng: 4.420790593889175},
{lat: 51.23307965364257, lng: 4.419932000834682},
{lat: 51.23331851079149, lng: 4.3922662240518004}],
"2019-11-08T00:00:00.000Z",
"2019-11-09T00:00:00.000Z");

// Log all the received data
function showData(data) {
  console.log(datafetcher.getAllObservations());
}
´´´

## Demo

An interactive demo is available on https://github.com/linkedtimeseries/timeseries-client-demo



