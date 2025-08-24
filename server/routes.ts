import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { sendEmail, generateVerificationEmail } from "./email";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { 
  insertGuideSchema, insertHouseSchema, insertResidentSchema, insertFileSchema,
  insertReportSchema, insertGoalSchema, insertChecklistSchema, insertChoreSchema,
  insertAccomplishmentSchema, insertIncidentSchema, insertMeetingSchema, insertProgramFeeSchema, insertNoteSchema,
  insertWeeklyReportSchema
} from "@shared/schema";

// Authentication middleware
async function requireAuth(req: any, res: any, next: any) {
  const token = req.cookies?.authToken;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      email: string;
      houseId: string;
    };
    
    // Load user from database
    const guide = await storage.getGuide(decoded.userId);
    if (!guide) {
      console.error('AUTH: User not found:', decoded.userId);
      return res.status(401).json({ error: 'NOT_FOUND: User not found' });
    }
    
    if (!guide.isEmailVerified) {
      console.error('AUTH: Email not verified for user:', decoded.email);
      return res.status(401).json({ error: 'UNVERIFIED_EMAIL: Please verify your email' });
    }
    
    // Attach guide info to request for house-scoped access
    req.guide = guide;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      console.error('AUTH: Invalid token -', error.message);
      return res.status(401).json({ error: 'TOKEN_VERIFY_FAIL: Invalid authentication token' });
    }
    if (error instanceof jwt.TokenExpiredError) {
      console.error('AUTH: Token expired');
      return res.status(401).json({ error: 'TOKEN_EXPIRED: Authentication token expired' });
    }
    console.error('AUTH: Unknown error -', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Debug endpoint to test cookies
  app.get("/api/whoami", requireAuth, (req: any, res) => {
    res.json({ ok: true, user: req.guide?.email });
  });

  // Authentication endpoints
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Log DB check
      console.log('LOGIN: Checking database connection...');
      const dbHost = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : 'in-memory';
      console.log('LOGIN: DB Host:', dbHost);
      
      // Quick DB check
      try {
        const houses = await storage.getAllHouses();
        console.log(`LOGIN: DB Check - Found ${houses.length || 0} houses in database`);
      } catch (e) {
        console.log('LOGIN: DB Check - Using fallback storage');
      }
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const guide = await storage.getGuideByEmail(email);
      if (!guide) {
        console.error(`LOGIN: NOT_FOUND - User not found: ${email}`);
        return res.status(401).json({ error: "NOT_FOUND: Invalid credentials" });
      }

      // Check if email is verified
      if (!guide.isEmailVerified) {
        console.error(`LOGIN: UNVERIFIED_EMAIL - Email not verified: ${email}`);
        return res.status(403).json({ 
          error: "UNVERIFIED_EMAIL: Please verify your email address before signing in.",
          requiresVerification: true
        });
      }

      const isValidPassword = await bcrypt.compare(password, guide.password);
      if (!isValidPassword) {
        console.error(`LOGIN: INVALID_PASSWORD - Invalid password for: ${email}`);
        return res.status(401).json({ error: "INVALID_PASSWORD: Invalid credentials" });
      }

      // Validate that user has a house
      if (!guide.houseId) {
        console.error(`LOGIN: NO_HOUSE - User has no houseId: ${email}`);
        return res.status(500).json({ error: "Account setup incomplete. Please contact support." });
      }

      // Verify the house exists
      const house = await storage.getHouse(guide.houseId);
      if (!house) {
        console.error(`LOGIN: HOUSE_NOT_FOUND - House ${guide.houseId} not found for user: ${email}`);
        return res.status(500).json({ error: "Facility not found. Please contact support." });
      }

      console.log(`LOGIN: House verified - ID: ${house.id}, Name: ${house.name}`);

      // Create JWT token
      const token = jwt.sign(
        { userId: guide.id, email: guide.email, houseId: guide.houseId },
        process.env.JWT_SECRET!, 
        { expiresIn: "24h" }
      );

      // strip password
      const { password: _pw, ...userWithoutPassword } = guide;

      // ⬇⬇ Cross-site cookie: required when FRONTEND_URL != API origin
      res.cookie("authToken", token, {
        httpOnly: true,
        secure: true,        // REQUIRED with SameSite=None
        sameSite: "none",    // cross-origin
        path: "/",
        maxAge: 24 * 60 * 60 * 1000
      });

      // single JSON response (no duplicates below this)
      return res.json({ success: true, user: userWithoutPassword });
    } catch (error) {
      console.error('LOGIN: ERROR -', error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const validatedData = insertGuideSchema.parse(req.body);
      
      // Log DB check
      console.log('SIGNUP: Checking database connection...');
      const dbHost = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : 'in-memory';
      console.log('SIGNUP: DB Host:', dbHost);
      
      // Check if user already exists
      const existing = await storage.getGuideByEmail(validatedData.email);
      if (existing) {
        return res.status(409).json({ error: "User already exists" });
      }

      // First create the house
      const house = await storage.createHouse({
        name: validatedData.houseName
      });
      
      console.log(`SIGNUP: Created house - ID: ${house.id}, Name: ${house.name}`);

      // Hash password and create guide
      const hashedPassword = await bcrypt.hash(validatedData.password, 12);
      const guide = await storage.createGuide({
        ...validatedData,
        password: hashedPassword
      });
      
      // Update guide with houseId and get updated guide
      const updatedGuide = await storage.updateGuide(guide.id, { houseId: house.id });
      
      console.log(`SIGNUP: Created user - ID: ${updatedGuide.id}, Email: ${updatedGuide.email}, HouseID: ${updatedGuide.houseId}, Verified: ${updatedGuide.isEmailVerified}`);

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
          console.error('SIGNUP: Failed to send verification email');
        } else {
          console.log('SIGNUP: Verification email sent to', guide.email);
        }
      }

      res.status(201).json({ 
        message: "Registration successful! Please check your email to verify your account.",
        success: true,
        requiresVerification: true
      });
    } catch (error) {
      console.error('SIGNUP: ERROR -', error);
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

      // First try to find guide by verification token
      let guide = await storage.getGuideByVerificationToken(token);
      
      if (!guide) {
        console.log('VERIFY: Token not found:', token);
        return res.status(404).json({ error: "Invalid or expired verification token" });
      }

      if (guide.isEmailVerified) {
        console.log('VERIFY: Already verified:', guide.email);
        return res.json({ 
          message: "Email already verified! You can now sign in to manage your facility.", 
          success: true 
        });
      }

      // Mark email as verified
      await storage.updateGuide(guide.id, {
        isEmailVerified: true,
        verificationToken: undefined
      });
      
      console.log(`VERIFY: SUCCESS - Email verified for: ${guide.email}`);

      res.json({ 
        message: "Email verified successfully! You can now sign in to manage your facility.",
        success: true 
      });
    } catch (error) {
      console.error('VERIFY: ERROR -', error);
      res.status(500).json({ error: "Verification failed" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie('authToken');
    res.json({ success: true });
  });

  // Houses endpoints (protected)
  app.get("/api/houses/:idOrName", requireAuth, async (req, res) => {
    try {
      const { idOrName } = req.params;
      // Validate URL parameter
      if (!idOrName || idOrName.length > 80) {
        return res.status(400).json({ error: "Invalid house identifier" });
      }
      
      // Try to get house by ID first (UUID format), then by name
      let house;
      // Check if it looks like a UUID
      if (idOrName.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        house = await storage.getHouse(idOrName);
      }
      
      // If not found by ID or not a UUID, try by name
      if (!house) {
        house = await storage.getHouseByName(idOrName);
      }
      
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

  app.post("/api/residents", requireAuth, async (req: any, res) => {
    try {
      const validatedData = insertResidentSchema.parse(req.body);
      
      // Ensure resident is assigned to the guide's house (security)
      validatedData.house = req.guide.houseId!;
      
      const resident = await storage.createResident(validatedData);
      res.status(201).json(resident);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Create resident error:', error);
      }
      res.status(500).json({ error: "Failed to create resident" });
    }
  });

  app.patch("/api/residents/:id", requireAuth, async (req: any, res) => {
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

  app.delete("/api/residents/:id", requireAuth, async (req: any, res) => {
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
  app.post("/api/files", requireAuth, async (req: any, res) => {
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

  app.get("/api/files/by-resident/:residentId", requireAuth, async (req: any, res) => {
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

  app.delete("/api/files/:id", requireAuth, async (req: any, res) => {
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
  app.post("/api/reports", requireAuth, async (req: any, res) => {
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

  app.get("/api/reports/:residentId/:weekStart", requireAuth, async (req: any, res) => {
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
  app.get("/api/goals/by-resident/:residentId", requireAuth, async (req: any, res) => {
    try {
      const { residentId } = req.params;
      const goals = await storage.getGoalsByResident(residentId);
      res.json(goals);
    } catch (error) {
      console.error('Get goals error:', error);
      res.status(500).json({ error: "Failed to fetch goals" });
    }
  });

  app.post("/api/goals", requireAuth, async (req: any, res) => {
    try {
      const validatedData = insertGoalSchema.parse(req.body);
      
      // Ensure goal is scoped to guide's house and include audit trail
      validatedData.houseId = req.guide.houseId!;
      validatedData.createdBy = req.guide.id;
      
      const goal = await storage.createGoal(validatedData);
      res.status(201).json(goal);
    } catch (error) {
      console.error('Create goal error:', error);
      res.status(500).json({ error: "Failed to create goal" });
    }
  });

  app.patch("/api/goals/:id", requireAuth, async (req: any, res) => {
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

  app.delete("/api/goals/:id", requireAuth, async (req: any, res) => {
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
  app.get("/api/checklists/by-resident/:residentId", requireAuth, async (req: any, res) => {
    try {
      const { residentId } = req.params;
      const checklist = await storage.getChecklistByResident(residentId);
      res.json(checklist);
    } catch (error) {
      console.error('Get checklist error:', error);
      res.status(500).json({ error: "Failed to fetch checklist" });
    }
  });

  app.post("/api/checklists", requireAuth, async (req: any, res) => {
    try {
      const validatedData = insertChecklistSchema.parse(req.body);
      
      // Ensure checklist is scoped to guide's house and include audit trail
      validatedData.houseId = req.guide.houseId!;
      validatedData.createdBy = req.guide.id;
      
      // Check if checklist already exists for this resident
      const existingChecklist = await storage.getChecklistByResident(validatedData.residentId);
      
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
  app.get("/api/chores/by-resident/:residentId", requireAuth, async (req: any, res) => {
    try {
      const { residentId } = req.params;
      const chores = await storage.getChoresByResident(residentId);
      res.json(chores);
    } catch (error) {
      console.error('Get chores error:', error);
      res.status(500).json({ error: "Failed to fetch chores" });
    }
  });

  app.post("/api/chores", requireAuth, async (req: any, res) => {
    try {
      const validatedData = insertChoreSchema.parse(req.body);
      
      // Ensure chore is scoped to guide's house and include audit trail
      validatedData.houseId = req.guide.houseId!;
      validatedData.createdBy = req.guide.id;
      
      const chore = await storage.createChore(validatedData);
      res.status(201).json(chore);
    } catch (error) {
      console.error('Create chore error:', error);
      res.status(500).json({ error: "Failed to create chore" });
    }
  });

  app.patch("/api/chores/:id", requireAuth, async (req: any, res) => {
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

  app.delete("/api/chores/:id", requireAuth, async (req: any, res) => {
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
  app.get("/api/accomplishments/by-resident/:residentId", requireAuth, async (req: any, res) => {
    try {
      const { residentId } = req.params;
      const accomplishments = await storage.getAccomplishmentsByResident(residentId);
      res.json(accomplishments);
    } catch (error) {
      console.error('Get accomplishments error:', error);
      res.status(500).json({ error: "Failed to fetch accomplishments" });
    }
  });

  app.post("/api/accomplishments", requireAuth, async (req: any, res) => {
    try {
      const validatedData = insertAccomplishmentSchema.parse(req.body);
      
      // Ensure accomplishment is scoped to guide's house and include audit trail
      validatedData.houseId = req.guide.houseId!;
      validatedData.createdBy = req.guide.id;
      
      const accomplishment = await storage.createAccomplishment(validatedData);
      res.status(201).json(accomplishment);
    } catch (error) {
      console.error('Create accomplishment error:', error);
      res.status(500).json({ error: "Failed to create accomplishment" });
    }
  });

  app.patch("/api/accomplishments/:id", requireAuth, async (req: any, res) => {
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

  app.delete("/api/accomplishments/:id", requireAuth, async (req: any, res) => {
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
  app.get("/api/incidents/by-resident/:residentId", requireAuth, async (req: any, res) => {
    try {
      const { residentId } = req.params;
      const incidents = await storage.getIncidentsByResident(residentId);
      res.json(incidents);
    } catch (error) {
      console.error('Get incidents error:', error);
      res.status(500).json({ error: "Failed to fetch incidents" });
    }
  });

  app.post("/api/incidents", requireAuth, async (req: any, res) => {
    try {
      const validatedData = insertIncidentSchema.parse(req.body);
      
      // Ensure incident is scoped to guide's house and include audit trail
      validatedData.houseId = req.guide.houseId!;
      validatedData.createdBy = req.guide.id;
      
      const incident = await storage.createIncident(validatedData);
      res.status(201).json(incident);
    } catch (error) {
      console.error('Create incident error:', error);
      res.status(500).json({ error: "Failed to create incident" });
    }
  });

  app.patch("/api/incidents/:id", requireAuth, async (req: any, res) => {
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

  app.delete("/api/incidents/:id", requireAuth, async (req: any, res) => {
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
  app.get("/api/meetings/by-resident/:residentId", requireAuth, async (req: any, res) => {
    try {
      const { residentId } = req.params;
      const meetings = await storage.getMeetingsByResident(residentId);
      res.json(meetings);
    } catch (error) {
      console.error('Get meetings error:', error);
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  });

  app.post("/api/meetings", requireAuth, async (req: any, res) => {
    try {
      const validatedData = insertMeetingSchema.parse(req.body);
      
      // Ensure meeting is scoped to guide's house and include audit trail
      validatedData.houseId = req.guide.houseId!;
      validatedData.createdBy = req.guide.id;
      
      const meeting = await storage.createMeeting(validatedData);
      res.status(201).json(meeting);
    } catch (error) {
      console.error('Create meeting error:', error);
      res.status(500).json({ error: "Failed to create meeting" });
    }
  });

  app.patch("/api/meetings/:id", requireAuth, async (req: any, res) => {
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

  app.delete("/api/meetings/:id", requireAuth, async (req: any, res) => {
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
  app.get("/api/fees/by-resident/:residentId", requireAuth, async (req: any, res) => {
    try {
      const { residentId } = req.params;
      const fees = await storage.getProgramFeesByResident(residentId);
      res.json(fees);
    } catch (error) {
      console.error('Get fees error:', error);
      res.status(500).json({ error: "Failed to fetch fees" });
    }
  });

  app.post("/api/fees", requireAuth, async (req: any, res) => {
    try {
      const validatedData = insertProgramFeeSchema.parse(req.body);
      
      // Ensure fee is scoped to guide's house and include audit trail
      validatedData.houseId = req.guide.houseId!;
      validatedData.createdBy = req.guide.id;
      
      const fee = await storage.createProgramFee(validatedData);
      res.status(201).json(fee);
    } catch (error) {
      console.error('Create fee error:', error);
      res.status(500).json({ error: "Failed to create fee" });
    }
  });

  app.patch("/api/fees/:id", requireAuth, async (req: any, res) => {
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

  app.delete("/api/fees/:id", requireAuth, async (req: any, res) => {
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
  app.get("/api/notes/by-resident/:residentId", requireAuth, async (req: any, res) => {
    try {
      const { residentId } = req.params;
      const notes = await storage.getNotesByResident(residentId);
      res.json(notes);
    } catch (error) {
      console.error('Get notes error:', error);
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/notes", requireAuth, async (req: any, res) => {
    try {
      const validatedData = insertNoteSchema.parse(req.body);
      
      // Ensure note is scoped to guide's house and include audit trail
      validatedData.houseId = req.guide.houseId!;
      validatedData.createdBy = req.guide.id;
      
      const note = await storage.createNote(validatedData);
      res.status(201).json(note);
    } catch (error) {
      console.error('Create note error:', error);
      res.status(500).json({ error: "Failed to create note" });
    }
  });

  // Weekly Reports endpoints (AI Generated Reports)
  app.get("/api/reports/weekly/by-resident/:residentId", requireAuth, async (req: any, res) => {
    try {
      const { residentId } = req.params;
      const { from, to } = req.query;
      
      // Validate query parameters (basic date string validation)
      if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from as string)) {
        return res.status(400).json({ error: "Invalid 'from' date format. Use YYYY-MM-DD" });
      }
      if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to as string)) {
        return res.status(400).json({ error: "Invalid 'to' date format. Use YYYY-MM-DD" });
      }
      
      const reports = await storage.getWeeklyReportsByResident(residentId, from as string, to as string);
      res.json(reports);
    } catch (error) {
      console.error('Get weekly reports error:', error);
      res.status(500).json({ error: "Failed to fetch weekly reports" });
    }
  });

  app.post("/api/reports/weekly", requireAuth, async (req: any, res) => {
    try {
      const validatedData = insertWeeklyReportSchema.parse(req.body);
      
      // Ensure report is scoped to guide's house and include audit trail
      validatedData.houseId = req.guide.houseId!;
      validatedData.createdBy = req.guide.id;
      
      const report = await storage.createWeeklyReport(validatedData);
      res.status(201).json(report);
    } catch (error) {
      console.error('Create weekly report error:', error);
      res.status(500).json({ error: "Failed to create weekly report" });
    }
  });

  app.post("/api/reports/weekly/generate", requireAuth, async (req: any, res) => {
    try {
      const { residentId, weekStart, weekEnd } = req.body;
      
      if (!residentId || !weekStart || !weekEnd) {
        return res.status(400).json({ error: "residentId, weekStart, and weekEnd are required" });
      }
      
      // TODO: Implement AI report generation
      // For now, return a placeholder draft
      const draft = `# Weekly Report\n\n**Resident:** ${residentId}\n**Week:** ${weekStart} to ${weekEnd}\n\n## Summary\nNo updates this week.\n\n## Goals\nNo updates this week.\n\n## Incidents\nNo updates this week.\n\n## Meetings\nNo updates this week.\n\n## Chores\nNo updates this week.\n\n## Accomplishments\nNo updates this week.\n\n## Notes\nNo updates this week.`;
      
      res.json({ draft });
    } catch (error) {
      console.error('Generate weekly report error:', error);
      res.status(500).json({ error: "Failed to generate weekly report" });
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