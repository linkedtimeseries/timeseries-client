
import { bboxPolygon, booleanContains, Feature, Polygon, polygon, Position, union} from "@turf/turf";
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
    private polygon: Feature<Polygon>;
    private readonly bbox: IBoundingBox;
    private readonly tBoundingBox: ITilesBoundingBox;

    constructor(input: Array<{lat: number, lng: number}>) {
        this.polygon = this.createPolygon(input);
        console.log(this.polygon);
        this.bbox = this.calculateBBox(input);
        this.tBoundingBox = this.calculateTilesWithinBBox();
    }

    public createPolygon(coords: Array<{lat: number, lng: number}>): Feature<Polygon> {
        const turfCoords: Position[] = [];
        console.log(coords);
        coords.forEach( (coord) => {
            console.log(coord);
            turfCoords.push([coord.lat, coord.lng]);
        });
        turfCoords.push([coords[0].lat, coords[0].lng]);
        console.log("turfcoords: " + turfCoords);
        return polygon([turfCoords]);
    }

    public getBbox() {
        return this.bbox;
    }

    public calculateBBox(coords: Array<{lat: number, lng: number}>): IBoundingBox {
        let minLat = Number.MAX_SAFE_INTEGER;
        let maxLat = - Number.MAX_SAFE_INTEGER;
        let minLon = Number.MAX_SAFE_INTEGER;
        let maxLon = - Number.MAX_SAFE_INTEGER;

        coords.forEach( (coord) => {
            console.log(coord);
            if (coord.lat < minLat) {
                minLat = coord.lat;
            }
            if (coord.lat > maxLat) {
                maxLat = coord.lat;
            }
            if (coord.lng < minLon) {
                minLon = coord.lng;
            }
            if (coord.lng > maxLon) {
                maxLon = coord.lng;
            }
        });
        console.log({minLat, minLon, maxLat, maxLon});
        return {minLat, minLon, maxLat, maxLon};
    }

    public getTile(lat: number, lon: number, zoom: number): Tile {
        const xtile: number = Math.floor( (lon + 180) / 360 * Math.pow(2, zoom) );
        const ytile: number = Math.floor( (1 - Math.log(Math.tan(this.toRad(lat)) + 1 /
            Math.cos(this.toRad(lat))) / Math.PI) / 2 * Math.pow(2, zoom) );
        return {xTile: xtile, yTile: ytile, zoom};
    }

    public calculateTilesWithinBBox(): ITilesBoundingBox {
        const minTile = this.getTile(this.bbox.minLat, this.bbox.minLon, Config.context.zoom);
        const maxTile = this.getTile(this.bbox.maxLat, this.bbox.maxLon, Config.context.zoom);

        minTile.xTile += 1;
        minTile.yTile += 1;
        maxTile.xTile -= 1;
        maxTile.yTile -= 1;
        console.log({minTile, maxTile});
        return {minTile, maxTile};
    }

    public calculateTilePolygon(): Feature<Polygon> | undefined {
        const tilePolys: Array<Array<Feature<Polygon> | undefined>> =
            this.calculateTilesWithinPolygon();
        const firstPolyWithIndex: (
            {tile: Feature<Polygon>, row: number, col: number} | undefined
            ) =
            this.findFirstTileInGrid(tilePolys);
        if (typeof firstPolyWithIndex === "undefined") {
            return;
        }
        return this.calculateTilePolygonRecursive(
            firstPolyWithIndex.tile, firstPolyWithIndex.row, firstPolyWithIndex.col, tilePolys);
    }

    public findFirstTileInGrid(tilePolys: Array<Array<Feature<Polygon> | undefined>>):
        ({tile: Feature<Polygon>, row: number, col: number} | undefined) {
        for (let i = 0; i < tilePolys.length; i++) {
            for (let j = 0; j < tilePolys[i].length; j++) {
                if (typeof tilePolys[i][j] !== "undefined") {
                    const tilePoly: Feature<Polygon> =
                        tilePolys[i][j] as Feature<Polygon>;
                    return {tile: tilePoly, row: i, col: j};
                }
            }
        }
        return;
    }

    public calculateTilePolygonRecursive(
        currTile: Feature<Polygon>,
        row: number,
        col: number,
        tilePolys: Array<Array<Feature<Polygon> | undefined>>,
    ): Feature<Polygon> {
        // tile to the left
        currTile = this.addTileToUnion(currTile, row, col - 1, tilePolys);
        // tile to the upper left
        currTile = this.addTileToUnion(currTile, row + 1, col - 1, tilePolys);
        // upper tille
        currTile = this.addTileToUnion(currTile, row + 1, col, tilePolys);
        // upper right tile
        currTile = this.addTileToUnion(currTile, row + 1, col + 1, tilePolys);
        // right tile
        currTile = this.addTileToUnion(currTile, row, col + 1, tilePolys);
        // lower right tile
        currTile = this.addTileToUnion(currTile, row - 1, col + 1, tilePolys);
        // lower tile
        currTile = this.addTileToUnion(currTile, row - 1, col, tilePolys);
        // lower left tile
        currTile = this.addTileToUnion(currTile, row - 1, col - 1, tilePolys);
        return currTile;
    }

    public addTileToUnion(
        currTile: Feature<Polygon>,
        row: number,
        col: number,
        tilePolys: Array<Array<Feature<Polygon> | undefined>>,
    ): Feature<Polygon> {
        if (row >= 0 && col >= 0 && typeof tilePolys[row][col] !== "undefined") {
            currTile =
                union(currTile, tilePolys[row][col - 1] as Feature<Polygon>) as
                    Feature<Polygon>;
            tilePolys[row][col - 1] = undefined;
            this.calculateTilePolygonRecursive(currTile, row, col - 1, tilePolys);
        }
        return currTile;
    }

    public calculateTilesWithinPolygon(): Array<Array<Feature<Polygon> | undefined>> {
        const rows = this.tBoundingBox.maxTile.yTile - this.tBoundingBox.minTile.yTile;
        const cols = this.tBoundingBox.maxTile.xTile - this.tBoundingBox.minTile.xTile;
        // TODO: check if this works
        const tilePolys: Array<Array<Feature<Polygon> | undefined>> =
            new Array<Array<Feature<Polygon> | undefined>>(rows).map(
                () => new Array<Feature<Polygon> | undefined>(cols).fill(undefined));
        for (let currX = this.tBoundingBox.minTile.xTile; currX <= this.tBoundingBox.maxTile.xTile; currX++) {
            for (let currY = this.tBoundingBox.minTile.yTile; currY <= this.tBoundingBox.maxTile.yTile; currY++) {
                const bb = globalMercator.googleToBBox([currX, currY, Config.context.zoom]);
                const bboxPoly: Feature<Polygon> = bboxPolygon([bb[1], bb[0], bb[3], bb[2]]);
                if (booleanContains(this.polygon, bboxPoly)) {
                    tilePolys[rows - currY][cols - currX] = bboxPoly;
                }
            }
        }
        return tilePolys;
    }

    private toRad(num: number) {
        return num * Math.PI / 180;
    }

}
