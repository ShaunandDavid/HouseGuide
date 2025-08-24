import { Request, Response, NextFunction } from 'express';
import os from 'os';
import { performance } from 'perf_hooks';

// Performance monitoring
export class PerformanceMonitor {
  private static metrics: Map<string, any[]> = new Map();
  private static startTime = Date.now();

  static recordMetric(name: string, value: number, tags?: Record<string, string>) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    this.metrics.get(name)?.push({
      value,
      timestamp: Date.now(),
      tags
    });

    // Keep only last 1000 metrics per name
    const metrics = this.metrics.get(name);
    if (metrics && metrics.length > 1000) {
      metrics.shift();
    }
  }

  static getMetrics() {
    const uptime = Date.now() - this.startTime;
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      uptime,
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      system: {
        loadAverage: os.loadavg(),
        freeMemory: os.freemem(),
        totalMemory: os.totalmem(),
        cpuCount: os.cpus().length
      },
      customMetrics: Object.fromEntries(this.metrics)
    };
  }

  static middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = performance.now();
      
      res.on('finish', () => {
        const duration = performance.now() - start;
        
        this.recordMetric('http_request_duration_ms', duration, {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode.toString()
        });

        this.recordMetric('http_requests_total', 1, {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode.toString()
        });

        // Record slow requests
        if (duration > 1000) {
          console.warn(`Slow request detected: ${req.method} ${req.path} took ${duration.toFixed(2)}ms`);
        }
      });

      next();
    };
  }
}

// Error tracking
export class ErrorTracker {
  private static errors: any[] = [];
  private static errorCounts: Map<string, number> = new Map();

  static trackError(error: Error, context?: any) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      name: error.name,
      context
    };

    this.errors.push(errorEntry);
    
    // Keep only last 100 errors
    if (this.errors.length > 100) {
      this.errors.shift();
    }

    // Count error types
    const errorKey = `${error.name}:${error.message}`;
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);

    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('ERROR_TRACKED:', errorEntry);
    }

    // In production, send to error tracking service (e.g., Sentry)
    if (process.env.NODE_ENV === 'production') {
      // TODO: Integrate with Sentry or similar service
      this.sendToErrorService(errorEntry);
    }
  }

  static sendToErrorService(error: any) {
    // Placeholder for error service integration
    // In production, this would send to Sentry, DataDog, etc.
    console.log('Would send to error service:', error.message);
  }

  static getErrorReport() {
    const topErrors = Array.from(this.errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([error, count]) => ({ error, count }));

    return {
      recentErrors: this.errors.slice(-10),
      totalErrors: this.errors.length,
      topErrors,
      errorRate: this.calculateErrorRate()
    };
  }

  private static calculateErrorRate(): number {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    
    const recentErrors = this.errors.filter(e => 
      new Date(e.timestamp).getTime() > oneHourAgo
    );

    return recentErrors.length;
  }

  static middleware() {
    return (err: Error, req: Request, res: Response, next: NextFunction) => {
      this.trackError(err, {
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      if (res.headersSent) {
        return next(err);
      }

      res.status(500).json({
        error: process.env.NODE_ENV === 'production' 
          ? 'Internal server error' 
          : err.message
      });
    };
  }
}

// Health check system
export class HealthCheck {
  private static checks: Map<string, () => Promise<boolean>> = new Map();

  static registerCheck(name: string, check: () => Promise<boolean>) {
    this.checks.set(name, check);
  }

  static async runChecks() {
    const results: Record<string, any> = {};
    
    for (const [name, check] of this.checks) {
      try {
        const start = performance.now();
        const healthy = await check();
        const duration = performance.now() - start;
        
        results[name] = {
          healthy,
          responseTime: duration,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        results[name] = {
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        };
      }
    }

    const allHealthy = Object.values(results).every(r => r.healthy);
    
    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      checks: results,
      timestamp: new Date().toISOString()
    };
  }

  static middleware() {
    return async (req: Request, res: Response) => {
      const health = await this.runChecks();
      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);
    };
  }
}

// Database connection health check
HealthCheck.registerCheck('database', async () => {
  try {
    // Check if database is accessible
    const { storage } = await import('./storage');
    const houses = await storage.getAllHouses();
    return true;
  } catch {
    return false;
  }
});

// Memory health check
HealthCheck.registerCheck('memory', async () => {
  const memoryUsage = process.memoryUsage();
  const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  return heapUsedPercent < 90; // Healthy if less than 90% heap used
});

// Disk space health check (if needed)
HealthCheck.registerCheck('diskSpace', async () => {
  // This is a simplified check - in production, check actual disk usage
  const freeMemory = os.freemem();
  const totalMemory = os.totalmem();
  const freePercent = (freeMemory / totalMemory) * 100;
  return freePercent > 10; // Healthy if more than 10% free
});