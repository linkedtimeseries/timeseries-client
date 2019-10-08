
let datafetcher = new AQClientSide.DataFetcher();

// datafetcher.getObservationsDataFragment('2019-08-06T00:00:00.000Z').then(response => {
//     datafetcher.filterObservations(response);
//     buildChart(datafetcher.no2Observations);
// });

datafetcher.getObservations('2019-08-05T00:00:00.000Z', '2019-08-06T00:00:00.000Z');

function buildChart(data) {
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

// append the svg obgect to the body of the page
// appends a 'group' element to 'svg'
// moves the 'group' element to the top left margin
    var svg = d3.select("body").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");


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

    // Add the valueline path.
    svg.append("path")
        .data([data])
        .attr("class", "line")
        .attr("d", valueline);

    // Add the X Axis
    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x));

    // Add the Y Axis
    svg.append("g")
        .call(d3.axisLeft(y));
}
