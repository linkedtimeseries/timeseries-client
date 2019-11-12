# timeseries-client
## Introduction

This package allows you to consume air quality time series fragments.

## Prerequisites

Currently, in order to be able to query data fragments, a local running instance of an AirQualityServer is required. 
The code for this server can be acquired from https://github.com/sigvevermandere/AirQualityExpressServer. Instructions on how to setup the 
server can also be found there.

## How to use it

The main method here is `getPolygonObservations`, which has the following parameters:

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

This method will request all data within the given area and time interval, starting at the back of the time interval and going to the front.
