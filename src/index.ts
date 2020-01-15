
import Observation from "./DataTypes/Observation";
import DataFetcher from "./Fetcher/DataFetcher";
import Utils from "./Polygon/Utils";

export { default as DataFetcher} from "./Fetcher/DataFetcher";
export { default as Observation} from "./DataTypes/Observation";
export { default as Utils} from "./Polygon/Utils";

if (!process.env.BASEURL) { process.env.BASEURL = "https://lodi.ilabt.imec.be/air/data/14"; }

export default {
    DataFetcher,
    Observation,
    Utils,
};
