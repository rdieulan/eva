"use strict";
// Server entry point
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var cors_1 = require("cors");
var path_1 = require("path");
var url_1 = require("url");
var routes_1 = require("./src/routes");
var __filename = (0, url_1.fileURLToPath)(import.meta.url);
var __dirname = path_1.default.dirname(__filename);
var app = (0, express_1.default)();
var PORT = process.env.PORT || 3001;
var isProduction = process.env.NODE_ENV === 'production';
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Request logger
app.use(function (req, res, next) {
    var start = Date.now();
    res.on('finish', function () {
        var duration = Date.now() - start;
        console.log("[".concat(req.method, "] ").concat(req.path, " - ").concat(res.statusCode, " (").concat(duration, "ms)"));
    });
    next();
});
// API routes
app.use('/api', routes_1.default);
// Serve frontend in production
if (isProduction) {
    var distPath_1 = path_1.default.join(__dirname, '..', 'dist');
    app.use(express_1.default.static(distPath_1));
    app.use(function (_req, res) {
        res.sendFile(path_1.default.join(distPath_1, 'index.html'));
    });
}
// Start server
app.listen(PORT, function () {
    console.log("Server started on http://localhost:".concat(PORT, " (").concat(isProduction ? 'production' : 'development', ")"));
});
