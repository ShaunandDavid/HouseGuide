import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { registerRoutes } from '../../server/routes';
import { MemStorage } from '../../server/storage';
import type { Guide } from '../../shared/schema';

describe('Authentication System', () => {
  let app: express.Application;
  let storage: MemStorage;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    storage = new MemStorage();
    registerRoutes(app);
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123!',
          name: 'Test User',
          houseName: 'Test House'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('requiresVerification', true);
      
      const guide = await storage.getGuideByEmail('test@example.com');
      expect(guide).toBeDefined();
      expect(guide?.email).toBe('test@example.com');
      expect(guide?.isEmailVerified).toBe(false);
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'SecurePass123!',
          name: 'Test User',
          houseName: 'Test House'
        });

      expect(response.status).toBe(500);
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak',
          name: 'Test User',
          houseName: 'Test House'
        });

      expect(response.status).toBe(500);
    });

    it('should prevent duplicate email registration', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'SecurePass123!',
          name: 'Test User',
          houseName: 'Test House'
        });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'AnotherPass123!',
          name: 'Another User',
          houseName: 'Another House'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('User already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a verified test user
      const hashedPassword = await bcrypt.hash('TestPass123!', 12);
      const house = await storage.createHouse({ name: 'Test House' });
      await storage.createGuide({
        email: 'verified@example.com',
        password: hashedPassword,
        name: 'Verified User',
        houseName: 'Test House'
      });
      const guide = await storage.getGuideByEmail('verified@example.com');
      if (guide) {
        await storage.updateGuide(guide.id, {
          isEmailVerified: true,
          houseId: house.id
        });
      }
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'verified@example.com',
          password: 'TestPass123!'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('guide');
      expect(response.body.guide.email).toBe('verified@example.com');
      expect(response.headers['set-cookie']).toBeDefined();
      
      // Verify cookie contains valid JWT
      const cookies = response.headers['set-cookie'];
      expect(cookies[0]).toContain('authToken');
      expect(cookies[0]).toContain('HttpOnly');
      expect(cookies[0]).toContain('Secure');
    });

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'verified@example.com',
          password: 'WrongPassword!'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('INVALID_PASSWORD');
    });

    it('should reject login for unverified email', async () => {
      // Create unverified user
      const hashedPassword = await bcrypt.hash('TestPass123!', 12);
      await storage.createGuide({
        email: 'unverified@example.com',
        password: hashedPassword,
        name: 'Unverified User',
        houseName: 'Test House'
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'unverified@example.com',
          password: 'TestPass123!'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('UNVERIFIED_EMAIL');
      expect(response.body.requiresVerification).toBe(true);
    });

    it('should reject login for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'AnyPassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('NOT_FOUND');
    });

    it('should handle missing credentials', async () => {
      const response1 = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(response1.status).toBe(400);
      expect(response1.body.error).toBe('Email and password are required');

      const response2 = await request(app)
        .post('/api/auth/login')
        .send({ password: 'TestPass123!' });

      expect(response2.status).toBe(400);
      expect(response2.body.error).toBe('Email and password are required');
    });
  });

  describe('GET /api/auth/verify-email', () => {
    it('should verify email with valid token', async () => {
      // Create user with verification token
      await storage.createGuide({
        email: 'toverify@example.com',
        password: 'hashed',
        name: 'To Verify',
        houseName: 'Test House'
      });
      const guide = await storage.getGuideByEmail('toverify@example.com');
      
      const response = await request(app)
        .get(`/api/auth/verify-email?token=${guide?.verificationToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const verifiedGuide = await storage.getGuideByEmail('toverify@example.com');
      expect(verifiedGuide?.isEmailVerified).toBe(true);
    });

    it('should reject invalid verification token', async () => {
      const response = await request(app)
        .get('/api/auth/verify-email?token=invalid-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Invalid or expired verification token');
    });

    it('should handle missing token', async () => {
      const response = await request(app)
        .get('/api/auth/verify-email');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Verification token is required');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should clear authentication cookie', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('authToken=;');
    });
  });

  describe('Protected Routes', () => {
    let authToken: string;

    beforeEach(async () => {
      // Create authenticated user and get token
      const hashedPassword = await bcrypt.hash('TestPass123!', 12);
      const house = await storage.createHouse({ name: 'Test House' });
      await storage.createGuide({
        email: 'auth@example.com',
        password: hashedPassword,
        name: 'Auth User',
        houseName: 'Test House'
      });
      const guide = await storage.getGuideByEmail('auth@example.com');
      if (guide) {
        await storage.updateGuide(guide.id, {
          isEmailVerified: true,
          houseId: house.id
        });
        authToken = jwt.sign(
          { userId: guide.id, email: guide.email, houseId: house.id },
          process.env.JWT_SECRET!,
          { expiresIn: '24h' }
        );
      }
    });

    it('should allow access with valid token', async () => {
      const response = await request(app)
        .get('/api/whoami')
        .set('Cookie', `authToken=${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toBe('auth@example.com');
    });

    it('should reject access without token', async () => {
      const response = await request(app)
        .get('/api/whoami');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should reject access with invalid token', async () => {
      const response = await request(app)
        .get('/api/whoami')
        .set('Cookie', 'authToken=invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('TOKEN_VERIFY_FAIL');
    });

    it('should reject expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: 'test-id', email: 'test@example.com', houseId: 'house-id' },
        process.env.JWT_SECRET!,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/api/whoami')
        .set('Cookie', `authToken=${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('TOKEN_EXPIRED');
    });
  });
});