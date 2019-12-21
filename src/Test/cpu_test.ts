// tslint:disable-next-line:no-var-requires
const Influx = require("influx");
const start = "2019-12-21T15:27:36.466394691Z";

const influx = new Influx.InfluxDB({
    host: "localhost",
    database: "cadvisor_db",
    port: 8086,
});

function getCPUUsage(query: string) {
    console.log(query);
    influx.query(query)
        .catch((err) => {
            console.log(err);
        })
        .then((res) => {
            // const result = JSON.parse(res);
            console.log(res);
        });
}

getCPUUsage("SELECT time, value FROM \"cpu_usage_total\" where container_name = 'airqualityexpressserver_aqs1_1' and time >= '2019-12-21T15:27:36.466394691Z'");
