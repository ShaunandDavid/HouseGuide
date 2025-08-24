import express, { type Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { PerformanceMonitor, ErrorTracker, HealthCheck } from "./monitoring";
import { securityMiddleware } from "./security";

// Print environment variables on boot (masked)
console.log('=== ENVIRONMENT CONFIGURATION ===');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✓ Set (PostgreSQL)' : '✗ Not set (using in-memory)');
console.log('SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? '✓ Set' : '✗ Not set');
console.log('SENDGRID_FROM_EMAIL:', process.env.SENDGRID_FROM_EMAIL || 'Not set');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? `✓ Set (${process.env.JWT_SECRET.length} chars)` : '✗ Not set');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('FRONTEND_URL:', process.env.FRONTEND_URL || 'Not set');
console.log('================================');

const app = express();
app.set("trust proxy", 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for Vite dev server
  crossOriginEmbedderPolicy: false
}));

// Enhanced security headers for production
if (process.env.NODE_ENV === 'production') {
  app.use(securityMiddleware.addSecurityHeaders);
}
// CORS configuration - EXACT origin match required for cookies
const corsOptions = {
  origin: process.env.FRONTEND_URL, // EXACT, no trailing slash
  credentials: true,
  methods: ["GET","POST","PUT","DELETE","PATCH","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
console.log('CORS configured with origin:', corsOptions.origin);

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: { error: "Too many authentication attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false
});

app.use("/api/auth", authLimiter);

// Add general rate limiting for all API endpoints in production
if (process.env.NODE_ENV === 'production') {
  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: "Too many requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use("/api", apiLimiter);
}

// Performance monitoring
app.use(PerformanceMonitor.middleware());

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
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
  // Health check on boot
  try {
    const { storage } = await import('./storage');
    const houses = await storage.getAllHouses();
    console.log(`HEALTH CHECK: Database connection successful - ${houses.length} houses found`);
  } catch (error) {
    console.error('HEALTH CHECK: Database connection failed:', error);
  }
  
  const server = await registerRoutes(app);
  
  // Health check endpoint
  app.get('/api/health/detailed', HealthCheck.middleware());
  
  // Metrics endpoint (protected in production)
  app.get('/api/metrics', (req, res) => {
    if (process.env.NODE_ENV === 'production' && req.headers['x-metrics-key'] !== process.env.METRICS_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json(PerformanceMonitor.getMetrics());
  });

  // Enhanced error handling with tracking
  app.use(ErrorTracker.middleware());
  
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Track error for monitoring
    ErrorTracker.trackError(err, {
      url: _req.url,
      method: _req.method,
      ip: _req.ip
    });
    
    // Log error for debugging but don't crash server
    console.error('Server error:', err);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Serve React frontend in production
  if (process.env.NODE_ENV === "production") {
    const clientPath = path.resolve(import.meta.dirname, "dist/public");
    
    // Cache assets with immutable headers (hashed filenames)
    app.use("/assets", express.static(path.join(clientPath, "assets"), {
      maxAge: "1y",
      immutable: true,
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    }));
    
    // Serve other static files with short cache
    app.use(express.static(clientPath, {
      maxAge: "1h",
      setHeaders: (res, filePath) => {
        // Never cache index.html
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
      }
    }));
    
    // SPA fallback - always serve index.html with no-cache
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(clientPath, "index.html"));
    });
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
