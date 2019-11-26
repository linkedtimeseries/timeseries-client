import DataFetcher from "../../lib/Fetcher/DataFetcher";

const datafetcher = new DataFetcher();

const url = "http://localhost:5000/data/14/8392/5467?page=2019-11-09T02:00:00.000Z";

const response = datafetcher.getDataFragment(url).then(
    (res) => {console.log("joepie");
    },
);
