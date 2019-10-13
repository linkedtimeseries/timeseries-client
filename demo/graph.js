let datafetcher = new AQClientSide.DataFetcher();


function toISO(date) {
    return date + 'Z';
}


function getAirQualityData() {
    const fromDate = toISO(document.getElementById('start').value);
    const toDate = toISO(document.getElementById('end').value);
    console.log(fromDate);
    datafetcher.getObservations(fromDate, toDate)
        .then(response => {
            datafetcher.filterObservations(response, fromDate, toDate);
            console.log(datafetcher.no2Observations);
            buildChart(datafetcher.no2Observations);
        });
}

// set the dimensions and margins of the graph
var margin = {top: 20, right: 20, bottom: 30, left: 50},
    width = 960 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;

// parse the date / time
var parseTime = d3.timeParse('%Y-%m-%dT%H:%M:%S.%LZ');

// set the ranges
var x = d3.scaleTime().range([0, width]);
var y = d3.scaleLinear().range([height, 0]);

// define the line
var valueline = d3.line()
    .x(function (d) {
        return x(d.resultTime);
    })
    .y(function (d) {
        return y(d.hasSimpleResult);
    });

// Define the axes
var xAxis = d3.axisBottom().scale(x);

var yAxis = d3.axisLeft().scale(y);

// append the svg obgect to the body of the page
// appends a 'group' element to 'svg'
// moves the 'group' element to the top left margin
var svg = d3.select("body").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform",
        "translate(" + margin.left + "," + margin.top + ")");

// Add the X Axis
svg.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + height + ")")
    .call(xAxis);

// Add the Y Axis
svg.append("g")
    .attr("class", "y axis")
    .call(yAxis);

// Add the valueline path.
svg.append("path")
    .attr("class", "line");

function buildChart(data) {
    // format the data
    data.forEach(function (d) {
        d.resultTime = parseTime(d.resultTime);
    });

    // Scale the range of the data
    x.domain(d3.extent(data, function (d) {
        return d.resultTime;
    }));
    y.domain([d3.min(data, d => d.hasSimpleResult),
        d3.max(data, function (d) {
            return d.hasSimpleResult;
        })]);

    var svg = d3.select("body").transition();

    // Make the changes
    svg.select(".line")   // change the line
        .duration(750)
        .attr("d", valueline(data));
    svg.select(".x.axis") // change the x axis
        .duration(750)
        .call(d3.axisBottom(x));
    svg.select(".y.axis") // change the y axis
        .duration(750)
        .call(d3.axisLeft(y));


}


