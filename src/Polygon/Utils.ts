
import turf = require("@turf/turf");
import globalMercator = require("global-mercator");
import Config from "../Config/Config";
import {Tile} from "./Tile";

export interface IBoundingBox {
    minLat: number;
    minLon: number;
    maxLat: number;
    maxLon: number;
}

export interface ITilesBoundingBox {
    minTile: Tile;
    maxTile: Tile;
}

export default class PolygonUtils {
    private polygon: turf.Feature<turf.Polygon>;
    private readonly bbox: IBoundingBox;
    private readonly tBoundingBox: ITilesBoundingBox;

    constructor(private input: Array<{lat: number, lon: number}>) {
        this.polygon = this.createPolygon(input);
        this.bbox = this.calculateBBox(input);
        this.tBoundingBox = this.calculateTilesWithinBBox();
    }

    public createPolygon(coords: Array<{lat: number, lon: number}>): turf.Feature<turf.Polygon> {
        const turfCoords: turf.Position[] = [];
        coords.forEach( (coord) => {
            turfCoords.push([coord.lat, coord.lon]);
        });
        return turf.polygon([turfCoords]);
    }

    public getBbox() {
        return this.bbox;
    }

    public calculateBBox(coords: Array<{lat: number, lon: number}>): IBoundingBox {
        let minLat = Number.MAX_SAFE_INTEGER;
        let maxLat = - Number.MAX_SAFE_INTEGER;
        let minLon = Number.MAX_SAFE_INTEGER;
        let maxLon = - Number.MAX_SAFE_INTEGER;

        coords.forEach( (coord) => {
            if (coord.lat < minLat) {
                minLat = coord.lat;
            }
            if (coord.lat > maxLat) {
                maxLat = coord.lat;
            }
            if (coord.lon < minLon) {
                minLon = coord.lon;
            }
            if (coord.lon > maxLon) {
                maxLon = coord.lon;
            }
        });
        return {minLat, minLon, maxLat, maxLon};
    }

    public getTileURL(lat: number, lon: number, zoom: number): Tile {
        const xtile: number = Math.floor( (lon + 180) / 360 * Math.pow(2, zoom) );
        const ytile: number = Math.floor( (1 - Math.log(Math.tan(this.toRad(lat)) + 1 /
            Math.cos(this.toRad(lat))) / Math.PI) / 2 * Math.pow(2, zoom) );
        return {xTile: xtile, yTile: ytile, zoom};
    }

    public calculateTilesWithinBBox(): ITilesBoundingBox {
        const minTile = this.getTileURL(this.bbox.minLat, this.bbox.minLon, Config.context.zoom);
        const maxTile = this.getTileURL(this.bbox.maxLat, this.bbox.maxLon, Config.context.zoom);

        minTile.xTile += 1;
        minTile.yTile += 1;
        maxTile.xTile -= 1;
        maxTile.yTile -= 1;
        return {minTile, maxTile};
    }

    public calculateTilesWithinPolygon(): Tile[] {
        const tiles: Tile[] = [];
        for (let currX = this.tBoundingBox.minTile.xTile; currX <= this.tBoundingBox.maxTile.xTile; currX++) {
            for (let currY = this.tBoundingBox.minTile.yTile; currY <= this.tBoundingBox.maxTile.yTile; currY++) {
                const bb = globalMercator.googleToBBox([currX, currY, Config.context.zoom]);
                const bboxPolygon: turf.Feature<turf.Polygon> = turf.bboxPolygon([bb[1], bb[0], bb[3], bb[2]]);
                if (turf.booleanContains(this.polygon, bboxPolygon)) {
                    tiles.push(new Tile(currX, currY, Config.context.zoom));
                }
            }
        }
        return tiles;
    }

    private toRad(num: number) {
        return num * Math.PI / 180;
    }

}
