
import { bboxPolygon, booleanContains, booleanDisjoint,
    degreesToRadians, Feature, intersect, point, Polygon, polygon, Position, union} from "@turf/turf";
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
    private readonly polygon: Feature<Polygon>;
    private readonly bbox: IBoundingBox;
    private readonly tBoundingBox: ITilesBoundingBox;

    constructor(input: Array<{lat: number, lng: number}>) {
        this.polygon = this.createPolygon(input);
        this.bbox = this.calculateBBox(input);
        this.tBoundingBox = this.calculateTilesWithinBBox();
        console.log(this.tBoundingBox);
    }

    public calculateTilePolygon(): Feature<Polygon> | undefined {
        const tilePolys: Array<Array<Feature<Polygon> | undefined>> =
            this.calculateBBoxTilesWithinPolygon();
        const firstPolyWithIndex: (
            {tile: Feature<Polygon>, row: number, col: number} | undefined
            ) =
            this.findFirstTileInGrid(tilePolys);
        if (typeof firstPolyWithIndex === "undefined") {
            return;
        }
        tilePolys[firstPolyWithIndex.row][firstPolyWithIndex.col] = undefined;
        const resultPolygon = this.calculateTilePolygonRecursive(
            firstPolyWithIndex.tile, firstPolyWithIndex.row, firstPolyWithIndex.col, tilePolys);
        return this.simplifyPolygon(resultPolygon);
    }

    public calculateTilesWithinPolygon(): Tile[] {
        const tiles: Tile[] = [];
        this.calculateTileGridWithinPolygon().forEach((tileRow) => {
            tileRow.forEach((tile) => {
                if (tile instanceof Tile) {
                    tiles.push(tile);
                }
            });
        });
        return tiles;
    }

    public polygonContainsPoint(p: {lat: number, lon: number}) {
        return booleanContains(this.polygon, point([p.lat, p.lon]));
    }

    private createPolygon(coords: Array<{lat: number, lng: number}>): Feature<Polygon> {
        const turfCoords: Position[] = [];
        coords.forEach( (coord) => {
            turfCoords.push([coord.lat, coord.lng]);
        });
        turfCoords.push([coords[0].lat, coords[0].lng]);
        return polygon([turfCoords]);
    }

    private getBbox() {
        return this.bbox;
    }

    private calculateBBox(coords: Array<{lat: number, lng: number}>): IBoundingBox {
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
            if (coord.lng < minLon) {
                minLon = coord.lng;
            }
            if (coord.lng > maxLon) {
                maxLon = coord.lng;
            }
        });
        return {minLat, minLon, maxLat, maxLon};
    }

    private getTile(lat: number, lon: number, zoom: number): Tile {
        const xtile: number = Math.floor( (lon + 180) / 360 * Math.pow(2, zoom) );
        const ytile: number = Math.floor( (1 - Math.log(Math.tan(degreesToRadians(lat)) + 1 /
            Math.cos(degreesToRadians(lat))) / Math.PI) / 2 * Math.pow(2, zoom) );
        return {xTile: xtile, yTile: ytile, zoom};
    }

    private calculateTilesWithinBBox(): ITilesBoundingBox {
        const minTile = this.getTile(this.bbox.minLat, this.bbox.minLon, Config.context.zoom);
        const maxTile = this.getTile(this.bbox.maxLat, this.bbox.maxLon, Config.context.zoom);

        return {minTile, maxTile};
    }

    private findFirstTileInGrid(tilePolys: Array<Array<Feature<Polygon> | undefined>>):
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

    private calculateTilePolygonRecursive(
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

    private addTileToUnion(
        currTile: Feature<Polygon>,
        row: number,
        col: number,
        tilePolys: Array<Array<Feature<Polygon> | undefined>>,
    ): Feature<Polygon> {
        if (row >= 0 && row < tilePolys.length &&
            col >= 0 && col < tilePolys[0].length && typeof tilePolys[row][col] !== "undefined") {
            currTile =
                union(currTile, tilePolys[row][col] as Feature<Polygon>) as
                    Feature<Polygon>;
            tilePolys[row][col] = undefined;
            currTile = this.calculateTilePolygonRecursive(currTile, row, col, tilePolys);
        }
        return currTile;
    }

    private calculateBBoxTilesWithinPolygon(): Array<Array<Feature<Polygon> | undefined>> {
        const rows = this.tBoundingBox.minTile.yTile - this.tBoundingBox.maxTile.yTile + 1;
        const cols = this.tBoundingBox.maxTile.xTile - this.tBoundingBox.minTile.xTile + 1;

        const tilePolys: Array<Array<Feature<Polygon> | undefined>> = [];
        for (let i = 0; i < rows; i++) {
            tilePolys[i] = [];
            for (let j = 0; j < cols; j++) {
                tilePolys[i][j] = undefined;
            }
        }
        const tileGrid = this.calculateTileGridWithinPolygon();
        for (let i = 0; i < tileGrid.length; i++) {
            for (let j = 0; j < tileGrid[0].length; j++) {
                const tile = tileGrid[i][j];
                if (tile instanceof Tile) {
                    const bb = globalMercator.googleToBBox(
                        [(tile as Tile).xTile, (tile as Tile).yTile, Config.context.zoom]);
                    tilePolys[i][j] = bboxPolygon([bb[1], bb[0], bb[3], bb[2]]);
                }
            }
        }
        return tilePolys;
    }

    private calculateTileGridWithinPolygon(): Array<Array<Tile | undefined>> {
        const rows = this.tBoundingBox.minTile.yTile - this.tBoundingBox.maxTile.yTile + 1;
        const cols = this.tBoundingBox.maxTile.xTile - this.tBoundingBox.minTile.xTile + 1;
        console.log(rows);
        console.log(cols);
        const tilePolys: Array<Array<Tile | undefined>> = [];
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
                const bboxPoly: Feature<Polygon> = bboxPolygon([bb[1], bb[0], bb[3], bb[2]]);
                // console.log("run");
                // console.log(this.polygon);
                // console.log(bboxPoly);
                // console.log(intersect(this.polygon, bboxPoly));
                // console.log(booleanDisjoint(this.polygon, bboxPoly));
                if (! booleanDisjoint(this.polygon, bboxPoly)) {
                    console.log("succes");
                    tilePolys[currY - offsetYtile][currX - offsetXtile] = new Tile(currX, currY, Config.context.zoom);
                }
            }
        }
        return tilePolys;
    }

    private simplifyPolygon(poly: Feature<Polygon>): Feature<Polygon> {
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
}
