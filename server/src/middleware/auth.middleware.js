"use strict";
// Authentication middleware
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = verifyToken;
exports.authMiddleware = authMiddleware;
exports.adminMiddleware = adminMiddleware;
var jsonwebtoken_1 = require("jsonwebtoken");
var JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';
/**
 * Verify a JWT token
 */
function verifyToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch (_a) {
        return null;
    }
}
/**
 * Authentication middleware - requires valid JWT token
 */
function authMiddleware(req, res, next) {
    var authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('[AUTH] Middleware: Missing or invalid Authorization header');
        return res.status(401).json({ error: 'Token manquant' });
    }
    var token = authHeader.substring(7);
    var payload = verifyToken(token);
    if (!payload) {
        console.log('[AUTH] Middleware: Invalid token');
        return res.status(401).json({ error: 'Token invalide' });
    }
    console.log('[AUTH] Middleware: Token valid for user', payload.email);
    req.user = payload;
    next();
}
/**
 * Admin middleware - requires ADMIN role (must be used after authMiddleware)
 */
function adminMiddleware(req, res, next) {
    var _a, _b;
    console.log('[AUTH] Admin middleware check - User:', (_a = req.user) === null || _a === void 0 ? void 0 : _a.email, '- Role:', (_b = req.user) === null || _b === void 0 ? void 0 : _b.role);
    if (!req.user || req.user.role !== 'ADMIN') {
        console.log('[AUTH] Admin middleware: Access denied - not an admin');
        return res.status(403).json({ error: 'Accès refusé - Admin requis' });
    }
    console.log('[AUTH] Admin middleware: Access granted');
    next();
}
