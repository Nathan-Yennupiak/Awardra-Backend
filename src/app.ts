import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { ApiError } from './utils/ApiError';

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

// Browser origins allowed to call the API. Each *_WEB_URL may hold several comma-separated
// URLs. Trailing slashes are stripped because browsers send the Origin header without one,
// and CORS matches it character for character.
const normalizeOrigin = (url: string) => url.trim().replace(/\/+$/, '');
const allowedOrigins = new Set(
  [env.PUBLIC_WEB_URL, env.ADMIN_WEB_URL, env.SUPER_ADMIN_WEB_URL]
    .flatMap((value) => value.split(','))
    .map(normalizeOrigin)
    .filter(Boolean)
);
console.log('🌐 CORS allowed origins:', [...allowedOrigins].join(', '));

app.use(
  cors({
    origin: (origin, callback) => {
      // Requests without an Origin header (server-side fetches, curl, Paystack webhooks) are not CORS requests.
      if (!origin || allowedOrigins.has(normalizeOrigin(origin))) return callback(null, true);
      console.warn(`CORS: rejected origin ${origin}`);
      callback(null, false);
    },
    credentials: true,
  })
);

// Logging
app.use(pinoHttp());

// Body parser. The raw bytes are kept because Paystack signs the exact request body;
// re-serialising the parsed JSON does not reliably reproduce it.
app.use(express.json({
  verify: (req, _res, buf) => {
    (req as express.Request).rawBody = buf;
  },
}));
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

  let status: number = err.statusCode || err.status || 500;
  let message: string = err.message || 'Internal Server Error';

  if (err.code === 'P2002') {
    // Prisma unique-constraint violation
    status = 409;
    message = 'A record with that value already exists';
  } else if (err.name === 'MulterError') {
    status = 400;
  }

  // Unexpected server errors may carry internal details (SQL, stack context); hide them in production.
  if (status >= 500 && !(err instanceof ApiError) && env.NODE_ENV === 'production') {
    message = 'Internal Server Error';
  }

  res.status(status).json({
    success: false,
    message,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export default app;
