import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerGoogleCalendarOAuthRoute } from "./oauth-google-calendar";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleStripeWebhook } from "../stripe-webhook";
import { scheduledWeeklyBackupHandler } from "../scheduled-backup";
import { scheduledGanttDigestHandler } from "../scheduled-gantt-digest";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Stripe webhook MUST be registered before express.json()
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);
  
  // Configure body parser with larger size limit for file uploads
  // Redirecionamento de domínios secundários para o domínio primário configurado pela empresa
  app.use(async (req, res, next) => {
    try {
      const host = req.hostname || req.headers.host;
      if (host) {
        const { resolveTenantByHost } = await import("../tenant-resolver");
        const tenant = await resolveTenantByHost(host);
        if (tenant && !tenant.isPrimary && tenant.primaryDomain && tenant.primaryDomain !== tenant.domain) {
          const protocol = req.protocol || "https";
          const originalUrl = req.originalUrl || "/";
          return res.redirect(301, `${protocol}://${tenant.primaryDomain}${originalUrl}`);
        }
      }
    } catch {}
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Storage proxy for webdev assets
  registerStorageProxy(app);
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Google Calendar OAuth callback
  registerGoogleCalendarOAuthRoute(app);
  // Scheduled weekly backups — must be registered before the Vite/static fallthrough.
  app.post("/api/scheduled/weekly-backup", scheduledWeeklyBackupHandler);
  app.post("/api/scheduled/weekly-gantt-digest", scheduledGanttDigestHandler);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
