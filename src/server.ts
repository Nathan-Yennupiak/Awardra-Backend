import app from './app';
import { env } from './config/env';
import { prisma } from './config/database';

const PORT = env.PORT || 5000;

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Connected to the database');

    const server = app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });

    // Graceful Shutdown
    const shutdown = async () => {
      console.log('🛑 Shutting down server...');
      server.close(async () => {
        await prisma.$disconnect();
        console.log('✅ Server shut down successfully');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
