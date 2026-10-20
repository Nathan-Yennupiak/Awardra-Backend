"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const pino_http_1 = __importDefault(require("pino-http"));
const env_1 = require("./config/env");
const path_1 = __importDefault(require("path"));
const hpp_1 = __importDefault(require("hpp"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const app = (0, express_1.default)();
// Trust proxy if behind a load balancer (e.g., Heroku, AWS ELB, Nginx)
app.set('trust proxy', 1);
// Serve uploaded files
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'public/uploads')));
// Security Middleware
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
// Rate Limiting (Global)
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api', limiter);
app.use((0, cors_1.default)({
    origin: [env_1.env.PUBLIC_WEB_URL, env_1.env.ADMIN_WEB_URL, env_1.env.SUPER_ADMIN_WEB_URL],
    credentials: true,
}));
// Logging
app.use((0, pino_http_1.default)());
// Body parser
app.use(express_1.default.json());
app.use((0, hpp_1.default)()); // Prevent HTTP Parameter Pollution
// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
// API Routes
const modules_1 = __importDefault(require("./modules"));
app.use('/api/v1', modules_1.default);
// 404 Handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});
// Error Handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(env_1.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
});
exports.default = app;
