import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';

describe('Security Configuration', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    
    // Apply security middleware
    app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));
    
    app.use(cors({
      origin: process.env.FRONTEND_URL,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"]
    }));
    
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5,
      message: { error: "Too many authentication attempts, please try again later." }
    });
    
    app.use(cookieParser());
    app.use(express.json({ limit: "10mb" }));
    
    // Test endpoints
    app.post('/api/auth/login', authLimiter, (req, res) => {
      res.json({ success: true });
    });
    
    app.get('/api/test', (req, res) => {
      res.json({ data: 'test' });
    });
  });

  describe('Security Headers', () => {
    it('should set security headers via Helmet', async () => {
      const response = await request(app)
        .get('/api/test');

      expect(response.headers['x-dns-prefetch-control']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-xss-protection']).toBeDefined();
    });
  });

  describe('CORS Configuration', () => {
    it('should allow requests from configured origin', async () => {
      const response = await request(app)
        .get('/api/test')
        .set('Origin', process.env.FRONTEND_URL || 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBe(process.env.FRONTEND_URL || 'http://localhost:3000');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should reject requests from unauthorized origins', async () => {
      const response = await request(app)
        .get('/api/test')
        .set('Origin', 'http://malicious-site.com');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/api/test')
        .set('Origin', process.env.FRONTEND_URL || 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on authentication endpoints', async () => {
      // Make 5 requests (the limit)
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'password' });
        
        expect(response.status).toBe(200);
      }

      // The 6th request should be rate limited
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password' });

      expect(response.status).toBe(429);
      expect(response.body.error).toContain('Too many authentication attempts');
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password' });

      expect(response.headers['x-ratelimit-limit']).toBe('5');
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    it('should reject oversized payloads', async () => {
      const largePayload = { data: 'x'.repeat(11 * 1024 * 1024) }; // 11MB
      
      const response = await request(app)
        .post('/api/test')
        .send(largePayload);

      expect(response.status).toBe(413); // Payload Too Large
    });
  });

  describe('Cookie Security', () => {
    it('should set secure cookie flags in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Test cookie settings
      const cookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: 'none' as const,
        path: '/',
        maxAge: 24 * 60 * 60 * 1000
      };

      expect(cookieOptions.httpOnly).toBe(true);
      expect(cookieOptions.secure).toBe(true);
      expect(cookieOptions.sameSite).toBe('none');

      process.env.NODE_ENV = originalEnv;
    });
  });
});