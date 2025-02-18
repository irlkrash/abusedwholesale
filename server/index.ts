import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
// Increase JSON payload limit to 50MB for handling image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Request logging middleware - only for API routes
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    });
  }
  next();
});

(async () => {
  try {
    const server = await registerRoutes(app);

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Error:', err);
      if (!res.headersSent) {
        const status = err.status || err.statusCode || 500;
        res.status(status).json({ 
          message: err.message || "Internal Server Error"
        });
      }
    });

    // Setup Vite or static files based on environment
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Simplified port binding with a single retry
    const port = 5000;
    server.listen(port, "0.0.0.0")
      .once('listening', () => {
        log(`Server started successfully on port ${port}`);
      })
      .once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          log(`Port ${port} in use, trying ${port + 1}...`);
          server.listen(port + 1, "0.0.0.0")
            .once('listening', () => {
              log(`Server started successfully on port ${port + 1}`);
            })
            .once('error', (err) => {
              console.error('Failed to start server:', err);
              process.exit(1);
            });
        } else {
          console.error('Failed to start server:', err);
          process.exit(1);
        }
      });

  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
})();