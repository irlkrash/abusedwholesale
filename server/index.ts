import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Increase timeout and payload limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

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
  try {
    const server = await registerRoutes(app);

    // Enhanced error handling middleware
    app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
      console.error('Error:', err);
      const status = err.status || err.statusCode || 500;
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
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Configure server timeouts and keepalive
    server.keepAliveTimeout = 65000; // Slightly higher than ALB's idle timeout
    server.headersTimeout = 66000; // Slightly higher than keepAliveTimeout

    // Improved server listening with error handling
    const port = process.env.PORT || 5000;
    const startServer = (p: number) => {
      server.listen(p, "0.0.0.0")
        .once('listening', () => {
          log(`Server started successfully on port ${p}`);
        })
        .once('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            log(`Port ${p} in use, trying ${p + 1}...`);
            startServer(p + 1);
          } else {
            console.error('Failed to start server:', err);
            process.exit(1);
          }
        });
    };
    
    startServer(port);

  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
})();