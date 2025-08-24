import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { registerRoutes } from '../../server/routes';
import { MemStorage } from '../../server/storage';
import type { Guide, House } from '../../shared/schema';

describe('Resident Management', () => {
  let app: express.Application;
  let storage: MemStorage;
  let authToken: string;
  let testHouse: House;
  let testGuide: Guide;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    storage = new MemStorage();
    registerRoutes(app);

    // Setup authenticated user
    testHouse = await storage.createHouse({ name: 'Test Care Facility' });
    testGuide = await storage.createGuide({
      email: 'manager@facility.com',
      password: 'hashed',
      name: 'Facility Manager',
      houseName: testHouse.name
    });
    await storage.updateGuide(testGuide.id, {
      isEmailVerified: true,
      houseId: testHouse.id
    });

    authToken = jwt.sign(
      { userId: testGuide.id, email: testGuide.email, houseId: testHouse.id },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );
  });

  describe('POST /api/residents', () => {
    it('should create a new resident', async () => {
      const response = await request(app)
        .post('/api/residents')
        .set('Cookie', `authToken=${authToken}`)
        .send({
          house: testHouse.id,
          firstName: 'John',
          lastInitial: 'D',
          status: 'active',
          residentId: 'RES001'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.firstName).toBe('John');
      expect(response.body.lastInitial).toBe('D');
      expect(response.body.status).toBe('active');
      expect(response.body.house).toBe(testHouse.id);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/residents')
        .set('Cookie', `authToken=${authToken}`)
        .send({
          house: testHouse.id,
          // Missing firstName and lastInitial
        });

      expect(response.status).toBe(500);
    });

    it('should reject unauthorized requests', async () => {
      const response = await request(app)
        .post('/api/residents')
        .send({
          house: testHouse.id,
          firstName: 'John',
          lastInitial: 'D'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should prevent cross-facility resident creation', async () => {
      const otherHouse = await storage.createHouse({ name: 'Other Facility' });
      
      const response = await request(app)
        .post('/api/residents')
        .set('Cookie', `authToken=${authToken}`)
        .send({
          house: otherHouse.id,
          firstName: 'Jane',
          lastInitial: 'S'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied to this facility');
    });
  });

  describe('GET /api/residents', () => {
    beforeEach(async () => {
      // Create test residents
      await storage.createResident({
        house: testHouse.id,
        firstName: 'Alice',
        lastInitial: 'A',
        status: 'active'
      });
      await storage.createResident({
        house: testHouse.id,
        firstName: 'Bob',
        lastInitial: 'B',
        status: 'inactive'
      });
      await storage.createResident({
        house: testHouse.id,
        firstName: 'Charlie',
        lastInitial: 'C',
        status: 'graduated'
      });
    });

    it('should list all residents for authorized facility', async () => {
      const response = await request(app)
        .get('/api/residents')
        .set('Cookie', `authToken=${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(3);
      expect(response.body[0].firstName).toBe('Alice');
      expect(response.body[1].firstName).toBe('Bob');
      expect(response.body[2].firstName).toBe('Charlie');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/residents?limit=2&offset=1')
        .set('Cookie', `authToken=${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].firstName).toBe('Bob');
      expect(response.body[1].firstName).toBe('Charlie');
    });

    it('should not show residents from other facilities', async () => {
      const otherHouse = await storage.createHouse({ name: 'Other Facility' });
      await storage.createResident({
        house: otherHouse.id,
        firstName: 'David',
        lastInitial: 'D',
        status: 'active'
      });

      const response = await request(app)
        .get('/api/residents')
        .set('Cookie', `authToken=${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
      expect(response.body.every((r: any) => r.house === testHouse.id)).toBe(true);
    });
  });

  describe('GET /api/residents/:id', () => {
    it('should retrieve a specific resident', async () => {
      const resident = await storage.createResident({
        house: testHouse.id,
        firstName: 'Test',
        lastInitial: 'R',
        status: 'active'
      });

      const response = await request(app)
        .get(`/api/residents/${resident.id}`)
        .set('Cookie', `authToken=${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(resident.id);
      expect(response.body.firstName).toBe('Test');
    });

    it('should return 404 for non-existent resident', async () => {
      const response = await request(app)
        .get('/api/residents/non-existent-id')
        .set('Cookie', `authToken=${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Resident not found');
    });

    it('should prevent access to residents from other facilities', async () => {
      const otherHouse = await storage.createHouse({ name: 'Other Facility' });
      const otherResident = await storage.createResident({
        house: otherHouse.id,
        firstName: 'Other',
        lastInitial: 'O',
        status: 'active'
      });

      const response = await request(app)
        .get(`/api/residents/${otherResident.id}`)
        .set('Cookie', `authToken=${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied to this resident');
    });
  });

  describe('PATCH /api/residents/:id', () => {
    it('should update resident information', async () => {
      const resident = await storage.createResident({
        house: testHouse.id,
        firstName: 'Update',
        lastInitial: 'T',
        status: 'active'
      });

      const response = await request(app)
        .patch(`/api/residents/${resident.id}`)
        .set('Cookie', `authToken=${authToken}`)
        .send({
          status: 'graduated',
          dischargeDate: '2024-01-15',
          dischargeReason: 'Successfully completed program'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('graduated');
      expect(response.body.dischargeDate).toBe('2024-01-15');
      expect(response.body.dischargeReason).toBe('Successfully completed program');
    });

    it('should validate update data', async () => {
      const resident = await storage.createResident({
        house: testHouse.id,
        firstName: 'Test',
        lastInitial: 'V',
        status: 'active'
      });

      const response = await request(app)
        .patch(`/api/residents/${resident.id}`)
        .set('Cookie', `authToken=${authToken}`)
        .send({
          status: 'invalid-status'
        });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/residents/:id', () => {
    it('should delete a resident and associated data', async () => {
      const resident = await storage.createResident({
        house: testHouse.id,
        firstName: 'Delete',
        lastInitial: 'M',
        status: 'inactive'
      });

      const response = await request(app)
        .delete(`/api/residents/${resident.id}`)
        .set('Cookie', `authToken=${authToken}`);

      expect(response.status).toBe(204);
      
      const deletedResident = await storage.getResident(resident.id);
      expect(deletedResident).toBeUndefined();
    });

    it('should prevent deletion from other facilities', async () => {
      const otherHouse = await storage.createHouse({ name: 'Other Facility' });
      const otherResident = await storage.createResident({
        house: otherHouse.id,
        firstName: 'Other',
        lastInitial: 'X',
        status: 'active'
      });

      const response = await request(app)
        .delete(`/api/residents/${otherResident.id}`)
        .set('Cookie', `authToken=${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied to this resident');
    });
  });
});