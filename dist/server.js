"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const database_1 = require("./config/database");
const PORT = env_1.env.PORT || 5000;
const startServer = async () => {
    try {
        await database_1.prisma.$connect();
        console.log('✅ Connected to the database');
        const server = app_1.default.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
        });
        // Graceful Shutdown
        const shutdown = async () => {
            console.log('🛑 Shutting down server...');
            server.close(async () => {
                await database_1.prisma.$disconnect();
                console.log('✅ Server shut down successfully');
                process.exit(0);
            });
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
