import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import os from "os";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use PORT environment variable or default to 5000
  // This allows the server to run on any port locally or on Replit
  const requestedPort = Number(process.env.PORT) || 5000;
  const host = process.env.HOST || "0.0.0.0";
  
  // Function to get local network IP address
  const getLocalIP = (): string | null => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const nets = interfaces[name];
      if (nets) {
        for (const net of nets) {
          // Skip internal (loopback) and non-IPv4 addresses
          if (net.family === "IPv4" && !net.internal) {
            return net.address;
          }
        }
      }
    }
    return null;
  };
  
  // Function to try listening on a port, and if it's in use, try the next one
  const tryListen = (port: number, maxAttempts: number = 100): void => {
    if (maxAttempts <= 0) {
      throw new Error("Could not find an available port after multiple attempts");
    }

    // Set up error handler before attempting to listen
    const errorHandler = (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        // Port is in use, try the next one
        log(`Port ${port} is in use, trying port ${port + 1}...`);
        // Remove this error handler and try the next port
        server.removeListener("error", errorHandler);
        tryListen(port + 1, maxAttempts - 1);
      } else {
        // Some other error occurred - remove handler and rethrow
        server.removeListener("error", errorHandler);
        throw err;
      }
    };

    server.once("error", errorHandler);

    // Attempt to listen on the port
    try {
      server.listen(port, host, () => {
        // Successfully listening - remove error handler since we don't need it anymore
        server.removeListener("error", errorHandler);
        
        // Get local IP for network access
        const localIP = getLocalIP();
        
        // Log server access information
        if (port !== requestedPort) {
          log(`Port ${requestedPort} was in use, serving on port ${port} instead`);
        }
        
        log(`✓ Server is running!`);
        log(`  Local:   http://localhost:${port}`);
        if (localIP) {
          log(`  Network: http://${localIP}:${port}`);
        }
      });
    } catch (err) {
      // Synchronous errors (unlikely with listen, but handle just in case)
      server.removeListener("error", errorHandler);
      throw err;
    }
  };

  // Start listening, will automatically find available port if needed
  tryListen(requestedPort);
})();
