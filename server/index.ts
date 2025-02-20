import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { pool } from "./db";

const app = express();

// Optimize payload limits for production
const payloadLimit = process.env.NODE_ENV === 'production' ? '10mb' : '50mb';
app.use(express.json({ limit: payloadLimit }));
app.use(express.urlencoded({ extended: false, limit: payloadLimit }));

// Add CORS headers for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Enhanced request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  // Log request start
  log(`[${requestId}] ${req.method} ${req.path} started`);

  // Log response
  res.on("finish", () => {
    const duration = Date.now() - start;
    log(`[${requestId}] ${req.method} ${req.path} ${res.statusCode} completed in ${duration}ms`);
  });

  // Log errors
  res.on("error", (error) => {
    log(`[${requestId}] ${req.method} ${req.path} failed: ${error.message}`);
  });

  next();
});

(async () => {
  let httpServer: ReturnType<typeof createServer>;
  try {
    console.log('Starting server initialization...');
    console.log('Registering routes...');
    httpServer = await registerRoutes(app);

    // Enhanced error handling middleware
    app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
      console.error('Error:', err);
      const status = 'status' in err ? (err as any).status : 500;
      const message = err.message || "Internal Server Error";
      const stack = process.env.NODE_ENV === 'development' ? err.stack : undefined;

      // Log detailed error information
      console.error(`[ERROR] ${req.method} ${req.path} - Status: ${status} - Message: ${message}`);
      if (stack) console.error('Stack:', stack);

      if (!res.headersSent) {
        res.status(status).json({
          message,
          ...(stack && { stack })
        });
      }
    });

    // Setup Vite or static files based on environment
    if (app.get("env") === "development") {
      await setupVite(app, httpServer);
    } else {
      serveStatic(app);
    }

    // Configure server timeouts and keepalive
    httpServer.keepAliveTimeout = 65000;
    httpServer.headersTimeout = 66000;

    // Handle termination signals
    const gracefulShutdown = async (signal: string) => {
      console.log(`${signal} received. Starting graceful shutdown...`);

      if (httpServer) {
        httpServer.close(async () => {
          console.log('HTTP server closed');
          try {
            await pool.end();
            console.log('Database pool closed');
            process.exit(0);
          } catch (error) {
            console.error('Error closing database pool:', error);
            process.exit(1);
          }
        });

        // Force close after 10s
        setTimeout(() => {
          console.error('Could not close connections in time, forcefully shutting down');
          process.exit(1);
        }, 10000);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Improved error handling
    process.on('uncaughtException', (error: Error) => {
      console.error('Uncaught Exception:', error);
      console.error('Stack:', error.stack);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      console.error('Unhandled Rejection at:', promise);
      console.error('Reason:', reason);
      gracefulShutdown('UNHANDLED_REJECTION');
    });

    // Improved server listening with error handling and port configuration
    const startServer = async (initialPort: number): Promise<void> => {
      try {
        console.log('Environment:', process.env.NODE_ENV);
        console.log('Starting server on port:', initialPort);

        await new Promise<void>((resolve, reject) => {
          httpServer.listen(initialPort, '0.0.0.0', () => {
            console.log(`Server started successfully on port ${initialPort}`);
            resolve();
          });
          httpServer.on('error', (error: NodeJS.ErrnoException) => {
            if (error.code === 'EADDRINUSE') {
              console.log(`Port ${initialPort} is already in use. Trying next port...`);
              resolve(startServer(initialPort + 1));
            } else {
              reject(error);
            }
          });
        });
      } catch (error) {
        console.error('Server start error:', error);
        await pool.end();
        process.exit(1);
      }
    };

    // Use port 5000 as default for development
    const defaultPort = process.env.NODE_ENV === 'production' ? 8080 : 5000;
    const port = parseInt(process.env.PORT || defaultPort.toString());
    await startServer(port);

  } catch (error) {
    console.error('Failed to initialize application:', error);
    await pool.end();
    process.exit(1);
  }
})();