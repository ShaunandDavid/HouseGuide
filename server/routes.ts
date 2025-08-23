import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { sendEmail, generateVerificationEmail } from "./email";
import bcrypt from "bcrypt";
import { 
  insertGuideSchema, insertHouseSchema, insertResidentSchema, insertFileSchema,
  insertReportSchema, insertGoalSchema, insertChecklistSchema, insertChoreSchema,
  insertAccomplishmentSchema, insertIncidentSchema, insertMeetingSchema, insertProgramFeeSchema, insertNoteSchema
} from "@shared/schema";

// Authentication middleware
async function requireAuth(req: any, res: any, next: any) {
  const token = req.cookies?.authToken;
  if (!token || !token.startsWith('auth-')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Extract guide ID from token
  const guideParts = token.split('-');
  if (guideParts.length < 2) {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
  
  const guideId = guideParts[1];
  try {
    const guide = await storage.getGuide(guideId);
    if (!guide || !guide.isEmailVerified) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Attach guide info to request for house-scoped access
    req.guide = guide;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication required' });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Authentication endpoints
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const guide = await storage.getGuideByEmail(email);
      if (!guide) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Check if email is verified
      if (!guide.isEmailVerified) {
        return res.status(403).json({ 
          error: "Please verify your email address before signing in. Check your email for the verification link.",
          requiresVerification: true
        });
      }

      const isValidPassword = await bcrypt.compare(password, guide.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Remove password from response
      const { password: _, ...userWithoutPassword } = guide;
      const token = `auth-${guide.id}-${Date.now()}`;
      
      // Set secure httpOnly cookie
      res.cookie('authToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });
      
      res.json({ 
        user: userWithoutPassword,
        success: true
      });
    } catch (error) {
      // Log without sensitive details in production
      if (process.env.NODE_ENV === 'development') {
        console.error('Login error:', error);
      }
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const validatedData = insertGuideSchema.parse(req.body);
      
      // Check if user already exists
      const existing = await storage.getGuideByEmail(validatedData.email);
      if (existing) {
        return res.status(409).json({ error: "User already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(validatedData.password, 12);
      const guide = await storage.createGuide({
        ...validatedData,
        password: hashedPassword
      });

      // Send verification email
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? `https://${req.headers.host}` 
        : `http://${req.headers.host}`;
        
      if (guide.verificationToken) {
        const emailParams = generateVerificationEmail(
          guide.email, 
          guide.verificationToken, 
          guide.houseName,
          baseUrl
        );
        
        const emailSent = await sendEmail(emailParams);
        if (!emailSent) {
          console.error('Failed to send verification email');
        }
      }

      res.status(201).json({ 
        message: "Registration successful! Please check your email to verify your account.",
        success: true,
        requiresVerification: true
      });
    } catch (error) {
      // Log without sensitive details in production
      if (process.env.NODE_ENV === 'development') {
        console.error('Registration error:', error);
      }
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // Email verification endpoint
  app.get("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "Verification token is required" });
      }

      const guide = await storage.getGuideByVerificationToken(token);
      if (!guide) {
        return res.status(404).json({ error: "Invalid or expired verification token" });
      }

      if (guide.isEmailVerified) {
        return res.json({ message: "Email already verified", success: true });
      }

      // Mark email as verified
      await storage.updateGuide(guide.id, {
        isEmailVerified: true,
        verificationToken: undefined
      });

      res.json({ 
        message: "Email verified successfully! You can now sign in to manage your facility.",
        success: true 
      });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Email verification error:', error);
      }
      res.status(500).json({ error: "Verification failed" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie('authToken');
    res.json({ success: true });
  });

  // Houses endpoints (protected)
  app.get("/api/houses/:name", requireAuth, async (req, res) => {
    try {
      const { name } = req.params;
      // Validate URL parameter
      if (!name || name.length > 80) {
        return res.status(400).json({ error: "Invalid house name" });
      }
      const house = await storage.getHouseByName(name);
      if (!house) {
        return res.status(404).json({ error: "House not found" });
      }
      res.json(house);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Get house error:', error);
      }
      res.status(500).json({ error: "Failed to fetch house" });
    }
  });

  app.post("/api/houses", requireAuth, async (req, res) => {
    try {
      const validatedData = insertHouseSchema.parse(req.body);
      const house = await storage.createHouse(validatedData);
      res.status(201).json(house);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Create house error:', error);
      }
      res.status(500).json({ error: "Failed to create house" });
    }
  });

  app.get("/api/houses", requireAuth, async (req, res) => {
    try {
      const houses = await storage.getAllHouses();
      res.json(houses);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Get houses error:', error);
      }
      res.status(500).json({ error: "Failed to fetch houses" });
    }
  });

  // Residents endpoints (protected)
  app.get("/api/residents/by-house/:houseId", requireAuth, async (req, res) => {
    try {
      const { houseId } = req.params;
      // Validate URL parameter
      if (!houseId || houseId.length > 50) {
        return res.status(400).json({ error: "Invalid house ID" });
      }
      const residents = await storage.getResidentsByHouse(houseId);
      res.json(residents);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Get residents by house error:', error);
      }
      res.status(500).json({ error: "Failed to fetch residents" });
    }
  });

  app.get("/api/residents/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      // Validate URL parameter
      if (!id || id.length > 50) {
        return res.status(400).json({ error: "Invalid resident ID" });
      }
      const resident = await storage.getResident(id);
      if (!resident) {
        return res.status(404).json({ error: "Resident not found" });
      }
      res.json(resident);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Get resident error:', error);
      }
      res.status(500).json({ error: "Failed to fetch resident" });
    }
  });

  app.post("/api/residents", async (req, res) => {
    try {
      const validatedData = insertResidentSchema.parse(req.body);
      const resident = await storage.createResident(validatedData);
      res.status(201).json(resident);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Create resident error:', error);
      }
      res.status(500).json({ error: "Failed to create resident" });
    }
  });

  app.patch("/api/residents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertResidentSchema.partial().parse(req.body);
      const resident = await storage.updateResident(id, validatedData);
      res.json(resident);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Update resident error:', error);
      }
      res.status(500).json({ error: "Failed to update resident" });
    }
  });

  app.delete("/api/residents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteResident(id);
      res.status(204).send();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Delete resident error:', error);
      }
      res.status(500).json({ error: "Failed to delete resident" });
    }
  });

  // Files endpoints
  app.post("/api/files", async (req, res) => {
    try {
      const validatedData = insertFileSchema.parse(req.body);
      const file = await storage.createFile(validatedData);
      res.status(201).json(file);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Create file error:', error);
      }
      res.status(500).json({ error: "Failed to create file" });
    }
  });

  app.get("/api/files/by-resident/:residentId", async (req, res) => {
    try {
      const { residentId } = req.params;
      const files = await storage.getFilesByResident(residentId);
      res.json(files);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Get files error:', error);
      }
      res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  app.delete("/api/files/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteFile(id);
      res.status(204).send();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Delete file error:', error);
      }
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // Reports endpoints
  app.post("/api/reports", async (req, res) => {
    try {
      const validatedData = insertReportSchema.parse(req.body);
      
      // Check if report already exists for this resident and week
      const existingReport = await storage.getReportByResidentAndWeek(
        validatedData.resident,
        validatedData.weekStart
      );
      
      let report;
      if (existingReport) {
        report = await storage.updateReport(existingReport.id, validatedData);
      } else {
        report = await storage.createReport(validatedData);
      }
      
      res.json(report);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Create/update report error:', error);
      }
      res.status(500).json({ error: "Failed to create/update report" });
    }
  });

  app.get("/api/reports/:residentId/:weekStart", async (req, res) => {
    try {
      const { residentId, weekStart } = req.params;
      const report = await storage.getReportByResidentAndWeek(residentId, weekStart);
      res.json(report);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Get report error:', error);
      }
      res.status(500).json({ error: "Failed to fetch report" });
    }
  });

  // Goals endpoints
  app.get("/api/goals/by-resident/:residentId", async (req, res) => {
    try {
      const { residentId } = req.params;
      const goals = await storage.getGoalsByResident(residentId);
      res.json(goals);
    } catch (error) {
      console.error('Get goals error:', error);
      res.status(500).json({ error: "Failed to fetch goals" });
    }
  });

  app.post("/api/goals", async (req, res) => {
    try {
      const validatedData = insertGoalSchema.parse(req.body);
      const goal = await storage.createGoal(validatedData);
      res.status(201).json(goal);
    } catch (error) {
      console.error('Create goal error:', error);
      res.status(500).json({ error: "Failed to create goal" });
    }
  });

  app.patch("/api/goals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertGoalSchema.partial().parse(req.body);
      const goal = await storage.updateGoal(id, validatedData);
      res.json(goal);
    } catch (error) {
      console.error('Update goal error:', error);
      res.status(500).json({ error: "Failed to update goal" });
    }
  });

  app.delete("/api/goals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteGoal(id);
      res.status(204).send();
    } catch (error) {
      console.error('Delete goal error:', error);
      res.status(500).json({ error: "Failed to delete goal" });
    }
  });

  // Checklists endpoints
  app.get("/api/checklists/by-resident/:residentId", async (req, res) => {
    try {
      const { residentId } = req.params;
      const checklist = await storage.getChecklistByResident(residentId);
      res.json(checklist);
    } catch (error) {
      console.error('Get checklist error:', error);
      res.status(500).json({ error: "Failed to fetch checklist" });
    }
  });

  app.post("/api/checklists", async (req, res) => {
    try {
      const validatedData = insertChecklistSchema.parse(req.body);
      
      // Check if checklist already exists for this resident
      const existingChecklist = await storage.getChecklistByResident(validatedData.resident);
      
      let checklist;
      if (existingChecklist) {
        checklist = await storage.updateChecklist(existingChecklist.id, validatedData);
      } else {
        checklist = await storage.createChecklist(validatedData);
      }
      
      res.json(checklist);
    } catch (error) {
      console.error('Create/update checklist error:', error);
      res.status(500).json({ error: "Failed to save checklist" });
    }
  });

  // Chores endpoints
  app.get("/api/chores/by-resident/:residentId", async (req, res) => {
    try {
      const { residentId } = req.params;
      const chores = await storage.getChoresByResident(residentId);
      res.json(chores);
    } catch (error) {
      console.error('Get chores error:', error);
      res.status(500).json({ error: "Failed to fetch chores" });
    }
  });

  app.post("/api/chores", async (req, res) => {
    try {
      const validatedData = insertChoreSchema.parse(req.body);
      const chore = await storage.createChore(validatedData);
      res.status(201).json(chore);
    } catch (error) {
      console.error('Create chore error:', error);
      res.status(500).json({ error: "Failed to create chore" });
    }
  });

  app.patch("/api/chores/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertChoreSchema.partial().parse(req.body);
      const chore = await storage.updateChore(id, validatedData);
      res.json(chore);
    } catch (error) {
      console.error('Update chore error:', error);
      res.status(500).json({ error: "Failed to update chore" });
    }
  });

  app.delete("/api/chores/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteChore(id);
      res.status(204).send();
    } catch (error) {
      console.error('Delete chore error:', error);
      res.status(500).json({ error: "Failed to delete chore" });
    }
  });

  // Accomplishments endpoints
  app.get("/api/accomplishments/by-resident/:residentId", async (req, res) => {
    try {
      const { residentId } = req.params;
      const accomplishments = await storage.getAccomplishmentsByResident(residentId);
      res.json(accomplishments);
    } catch (error) {
      console.error('Get accomplishments error:', error);
      res.status(500).json({ error: "Failed to fetch accomplishments" });
    }
  });

  app.post("/api/accomplishments", async (req, res) => {
    try {
      const validatedData = insertAccomplishmentSchema.parse(req.body);
      const accomplishment = await storage.createAccomplishment(validatedData);
      res.status(201).json(accomplishment);
    } catch (error) {
      console.error('Create accomplishment error:', error);
      res.status(500).json({ error: "Failed to create accomplishment" });
    }
  });

  app.patch("/api/accomplishments/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertAccomplishmentSchema.partial().parse(req.body);
      const accomplishment = await storage.updateAccomplishment(id, validatedData);
      res.json(accomplishment);
    } catch (error) {
      console.error('Update accomplishment error:', error);
      res.status(500).json({ error: "Failed to update accomplishment" });
    }
  });

  app.delete("/api/accomplishments/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteAccomplishment(id);
      res.status(204).send();
    } catch (error) {
      console.error('Delete accomplishment error:', error);
      res.status(500).json({ error: "Failed to delete accomplishment" });
    }
  });

  // Incidents endpoints
  app.get("/api/incidents/by-resident/:residentId", async (req, res) => {
    try {
      const { residentId } = req.params;
      const incidents = await storage.getIncidentsByResident(residentId);
      res.json(incidents);
    } catch (error) {
      console.error('Get incidents error:', error);
      res.status(500).json({ error: "Failed to fetch incidents" });
    }
  });

  app.post("/api/incidents", async (req, res) => {
    try {
      const validatedData = insertIncidentSchema.parse(req.body);
      const incident = await storage.createIncident(validatedData);
      res.status(201).json(incident);
    } catch (error) {
      console.error('Create incident error:', error);
      res.status(500).json({ error: "Failed to create incident" });
    }
  });

  app.patch("/api/incidents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertIncidentSchema.partial().parse(req.body);
      const incident = await storage.updateIncident(id, validatedData);
      res.json(incident);
    } catch (error) {
      console.error('Update incident error:', error);
      res.status(500).json({ error: "Failed to update incident" });
    }
  });

  app.delete("/api/incidents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteIncident(id);
      res.status(204).send();
    } catch (error) {
      console.error('Delete incident error:', error);
      res.status(500).json({ error: "Failed to delete incident" });
    }
  });

  // Meetings endpoints
  app.get("/api/meetings/by-resident/:residentId", async (req, res) => {
    try {
      const { residentId } = req.params;
      const meetings = await storage.getMeetingsByResident(residentId);
      res.json(meetings);
    } catch (error) {
      console.error('Get meetings error:', error);
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  });

  app.post("/api/meetings", async (req, res) => {
    try {
      const validatedData = insertMeetingSchema.parse(req.body);
      const meeting = await storage.createMeeting(validatedData);
      res.status(201).json(meeting);
    } catch (error) {
      console.error('Create meeting error:', error);
      res.status(500).json({ error: "Failed to create meeting" });
    }
  });

  app.patch("/api/meetings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertMeetingSchema.partial().parse(req.body);
      const meeting = await storage.updateMeeting(id, validatedData);
      res.json(meeting);
    } catch (error) {
      console.error('Update meeting error:', error);
      res.status(500).json({ error: "Failed to update meeting" });
    }
  });

  app.delete("/api/meetings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteMeeting(id);
      res.status(204).send();
    } catch (error) {
      console.error('Delete meeting error:', error);
      res.status(500).json({ error: "Failed to delete meeting" });
    }
  });

  // Program Fees endpoints
  app.get("/api/fees/by-resident/:residentId", async (req, res) => {
    try {
      const { residentId } = req.params;
      const fees = await storage.getProgramFeesByResident(residentId);
      res.json(fees);
    } catch (error) {
      console.error('Get fees error:', error);
      res.status(500).json({ error: "Failed to fetch fees" });
    }
  });

  app.post("/api/fees", async (req, res) => {
    try {
      const validatedData = insertProgramFeeSchema.parse(req.body);
      const fee = await storage.createProgramFee(validatedData);
      res.status(201).json(fee);
    } catch (error) {
      console.error('Create fee error:', error);
      res.status(500).json({ error: "Failed to create fee" });
    }
  });

  app.patch("/api/fees/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertProgramFeeSchema.partial().parse(req.body);
      const fee = await storage.updateProgramFee(id, validatedData);
      res.json(fee);
    } catch (error) {
      console.error('Update fee error:', error);
      res.status(500).json({ error: "Failed to update fee" });
    }
  });

  app.delete("/api/fees/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteProgramFee(id);
      res.status(204).send();
    } catch (error) {
      console.error('Delete fee error:', error);
      res.status(500).json({ error: "Failed to delete fee" });
    }
  });

  // Notes endpoints
  app.get("/api/notes/by-resident/:residentId", async (req, res) => {
    try {
      const { residentId } = req.params;
      const notes = await storage.getNotesByResident(residentId);
      res.json(notes);
    } catch (error) {
      console.error('Get notes error:', error);
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/notes", async (req, res) => {
    try {
      const validatedData = insertNoteSchema.parse(req.body);
      const note = await storage.createNote(validatedData);
      res.status(201).json(note);
    } catch (error) {
      console.error('Create note error:', error);
      res.status(500).json({ error: "Failed to create note" });
    }
  });

  // Error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({ error: "Internal server error" });
  });

  const httpServer = createServer(app);
  return httpServer;
}