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

    const port = process.env.PORT || 5000;
    const startServer = async (attemptPort: number): Promise<void> => {
      try {
        await new Promise((resolve, reject) => {
          server.listen(attemptPort, "0.0.0.0", () => {
            log(`Server started successfully on port ${attemptPort}`);
            resolve(undefined);
          }).on('error', reject);
        });
      } catch (error: any) {
        if (error.code === 'EADDRINUSE') {
          log(`Port ${attemptPort} in use, trying ${attemptPort + 1}...`);
          await startServer(attemptPort + 1);
        } else {
          console.error('Failed to start server:', error);
          process.exit(1);
        }
      }
    };

    await startServer(port);

  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
})();