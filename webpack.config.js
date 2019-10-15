const path = require('path');

module.exports = {
    entry: './src/index.ts',
    devtool: "source-map",//"cheap-module-source-map"
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: [ '.ts', '.js' ],
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        libraryTarget: "umd",
        library: "TimeSeriesClientSide"
    },
    node: {
        fs: "empty",
        net: "empty",
        tls: "empty"
    },
    target: "web",
    devServer: {
        contentBase: path.join(__dirname, 'dist'),
        compress: true,
        port: 9000
    },
    mode: 'production'
};


