export class Tile {
    public xTile: number;
    public yTile: number;
    public zoom: number;

    constructor(x: number, y: number, zoom: number) {
        this.xTile = x;
        this.yTile = y;
        this.zoom = zoom;
    }
}
