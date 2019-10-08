export default class Observation {
    public hasSimpleResult: number;
    public resultTime: Date | string;
    public observedProperty: string;
    public madeBySensor: string;
    public hasFeatureOfInterest: string;
    public lat: number;
    public long: number;

    constructor(observation: any) {
        this.hasSimpleResult = observation.hasSimpleResult;
        this.resultTime = observation.resultTime;
        this.observedProperty = observation.observedProperty;
        this.madeBySensor = observation.madeBySensor;
        this.hasFeatureOfInterest = observation.hasFeatureOfInterest;
        this.lat = observation.lat;
        this.long = observation.long;

    }
}
