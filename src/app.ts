import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';

import path from 'path';

import hpp from 'hpp';
import rateLimit from 'express-rate-limit';

const app = express();

// Trust proxy if behind a load balancer (e.g., Heroku, AWS ELB, Nginx)
app.set('trust proxy', 1);

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads')));

// Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Rate Limiting (Global)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api', limiter);

app.use(
  cors({
    origin: [env.PUBLIC_WEB_URL, env.ADMIN_WEB_URL, env.SUPER_ADMIN_WEB_URL],
    credentials: true,
  })
);

// Logging
app.use(pinoHttp());

// Body parser
app.use(express.json());
app.use(hpp()); // Prevent HTTP Parameter Pollution

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
import routes from './modules';
app.use('/api/v1', routes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export default app;
