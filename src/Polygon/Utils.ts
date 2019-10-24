
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
        // console.log(this.polygon);
        this.bbox = this.calculateBBox(input);
        this.tBoundingBox = this.calculateTilesWithinBBox();
    }

    public createPolygon(coords: Array<{lat: number, lng: number}>): Feature<Polygon> {
        const turfCoords: Position[] = [];
        // console.log(coords);
        coords.forEach( (coord) => {
            // console.log(coord);
            turfCoords.push([coord.lat, coord.lng]);
        });
        turfCoords.push([coords[0].lat, coords[0].lng]);
        // console.log("turfcoords: " + turfCoords);
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
            // console.log(coord);
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
        // console.log({minLat, minLon, maxLat, maxLon});
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
        // console.log(minTile);
        const maxTile = this.getTile(this.bbox.maxLat, this.bbox.maxLon, Config.context.zoom);
        // console.log(maxTile);

        minTile.xTile += 1;
        minTile.yTile -= 1;
        maxTile.xTile -= 1;
        maxTile.yTile += 1;
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
        console.log(tilePolys);
        if (typeof firstPolyWithIndex === "undefined") {
            return;
        }
        tilePolys[firstPolyWithIndex.row][firstPolyWithIndex.col] = undefined;
        const resultPolygon = this.calculateTilePolygonRecursive(
            firstPolyWithIndex.tile, firstPolyWithIndex.row, firstPolyWithIndex.col, tilePolys);
        return this.simplifyPolygon(resultPolygon);
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
        // upper tile
        currTile = this.addTileToUnion(currTile, row - 1, col, tilePolys);
        // right tile
        currTile = this.addTileToUnion(currTile, row, col + 1, tilePolys);
        // lower tile
        currTile = this.addTileToUnion(currTile, row + 1, col, tilePolys);
        return currTile;
    }

    public addTileToUnion(
        currTile: Feature<Polygon>,
        row: number,
        col: number,
        tilePolys: Array<Array<Feature<Polygon> | undefined>>,
    ): Feature<Polygon> {
        if (row >= 0 && row < tilePolys.length &&
            col >= 0 && col < tilePolys[0].length && typeof tilePolys[row][col] !== "undefined") {
            console.log(tilePolys[row][col]);
            console.log(currTile);
            currTile =
                union(currTile, tilePolys[row][col] as Feature<Polygon>) as
                    Feature<Polygon>;
            tilePolys[row][col] = undefined;
            currTile = this.calculateTilePolygonRecursive(currTile, row, col, tilePolys);
        }
        return currTile;
    }

    public calculateTilesWithinPolygon(): Array<Array<Feature<Polygon> | undefined>> {
        const rows = this.tBoundingBox.minTile.yTile - this.tBoundingBox.maxTile.yTile + 1;
        const cols = this.tBoundingBox.maxTile.xTile - this.tBoundingBox.minTile.xTile + 1;
        const tilePolys: Array<Array<Feature<Polygon> | undefined>> = [];
        for (let i = 0; i < rows; i++) {
            tilePolys[i] = [];
            for (let j = 0; j < cols; j++) {
                tilePolys[i][j] = undefined;
            }
        }
        const offsetXtile = this.tBoundingBox.minTile.xTile;
        const offsetYtile = this.tBoundingBox.maxTile.yTile;
        for (let currX = this.tBoundingBox.minTile.xTile; currX <= this.tBoundingBox.maxTile.xTile; currX++) {
            for (let currY = this.tBoundingBox.maxTile.yTile; currY <= this.tBoundingBox.minTile.yTile; currY++) {
                const bb = globalMercator.googleToBBox([currX, currY, Config.context.zoom]);
                // console.log(bb);
                const bboxPoly: Feature<Polygon> = bboxPolygon([bb[1], bb[0], bb[3], bb[2]]);
                if (booleanContains(this.polygon, bboxPoly)) {
                    // console.log("row: " + (currY - offsetYtile).toString());
                    // console.log("col: " + (currX - offsetXtile).toString());
                    tilePolys[currY - offsetYtile][currX - offsetXtile] = bboxPoly;
                }
            }
        }
        console.log(tilePolys);
        return tilePolys;
    }

    public simplifyPolygon(poly: Feature<Polygon>): Feature<Polygon> {
        const coordinates = (poly.geometry as Polygon).coordinates[0];
        const newCoordinates: Position[] = [];
        let prevCoord = coordinates[0];
        newCoordinates.push(prevCoord);
        for (let i = 1; i < coordinates.length - 1; i++) {
            prevCoord = coordinates[i - 1];
            const nextCoord = coordinates[i + 1];
            const currCoord = coordinates[i];
            if (! ((prevCoord[0] === currCoord[0] && nextCoord[0] === currCoord[0]) ||
                 (prevCoord[1] === currCoord[1] && nextCoord[1] === currCoord[1]))) {
                newCoordinates.push(currCoord);
            }
        }
        newCoordinates.push(coordinates[coordinates.length - 1]);
        return polygon([newCoordinates]);
    }

    // TODO: replace this with turf builtin
    private toRad(num: number) {
        return num * Math.PI / 180;
    }

}
