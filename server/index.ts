import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import os from "os";

async function createApp(): Promise<{ app: express.Express; server: import("http").Server }> {
  const app = express();
  app.set("env", "development");
  console.log("ENV =", app.get("env"));

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

  return { app, server };
}

const { app, server } = await createApp();

// On Vercel we export the app for serverless; locally we listen on a port
if (process.env.VERCEL !== "1") {
  const requestedPort = Number(process.env.PORT) || 5000;
  const host = process.env.HOST || "0.0.0.0";

  const getLocalIP = (): string | null => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const nets = interfaces[name];
      if (nets) {
        for (const net of nets) {
          if (net.family === "IPv4" && !net.internal) {
            return net.address;
          }
        }
      }
    }
    return null;
  };

  const tryListen = (port: number, maxAttempts: number = 100): void => {
    if (maxAttempts <= 0) {
      throw new Error("Could not find an available port after multiple attempts");
    }

    const errorHandler = (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        log(`Port ${port} is in use, trying port ${port + 1}...`);
        server.removeListener("error", errorHandler);
        tryListen(port + 1, maxAttempts - 1);
      } else {
        server.removeListener("error", errorHandler);
        throw err;
      }
    };

    server.once("error", errorHandler);

    try {
      server.listen(port, host, () => {
        server.removeListener("error", errorHandler);
        const bound = server.address();
        const actualPort = bound && typeof bound === "object" ? bound.port : port;
        const localIP = getLocalIP();
        if (actualPort !== requestedPort) {
          log(`Port ${requestedPort} was in use, serving on port ${actualPort} instead`);
        }
        log(`✓ Server is running!`);
        log(`  Local:   http://localhost:${actualPort}`);
        if (localIP) {
          log(`  Network: http://${localIP}:${actualPort}`);
        }
      });
    } catch (err) {
      server.removeListener("error", errorHandler);
      throw err;
    }
  };

  tryListen(requestedPort);
}

export default app;
