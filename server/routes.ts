import type { Express } from "express";
import express from "express";
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
import { readFileSync } from "fs";
import { join } from "path";
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";

const readEnvNumber = (key: string, fallback: number) => {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const MIN_CLASSIFY_TEXT_CHARS = Math.max(0, Math.floor(readEnvNumber("MIN_CLASSIFY_TEXT_CHARS", 40)));
const MIN_NOTE_TEXT_CHARS = Math.max(0, Math.floor(readEnvNumber("MIN_NOTE_TEXT_CHARS", 20)));
const MIN_NOTE_CONFIDENCE = Math.min(1, Math.max(0, readEnvNumber("MIN_NOTE_CONFIDENCE", 0.6)));
const MIN_SEGMENT_CONFIDENCE = Math.min(1, Math.max(0, readEnvNumber("MIN_SEGMENT_CONFIDENCE", 0.6)));

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

  // AI Classification endpoint
  app.post("/api/classify", requireAuth, async (req: any, res) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      // PII Redaction for HIPAA compliance (same as voice notes)
      const REDACTION_REGEXES: Array<[RegExp, string]> = [
        [/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE]"],
        [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]"],
        [/\b\d{1,5}\s+[A-Za-z0-9.\-]+\s+(Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr)\b/gi, "[ADDRESS]"],
        [/\b(Sponsor|Therapist|Doctor|Case\s*Manager)\s*:\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/g, "[REDACTED_NAME]"],
        [/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, "[DATE]"], // Date patterns
        [/\b\d{4}-\d{2}-\d{2}\b/g, "[DATE]"], // ISO date patterns
        [/\b[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?=\s*(?:DOB|Born|Birth))/gi, "[PATIENT_NAME]"],
      ];

      const redactPII = (text: string): string => {
        let out = text;
        for (const [rx, repl] of REDACTION_REGEXES) out = out.replace(rx, repl);
        return out;
      };

      const redactedText = redactPII(text);

      if (redactedText.trim().length < MIN_CLASSIFY_TEXT_CHARS) {
        return res.json({ label: null, confidence: 0 });
      }

      if (!process.env.OPENAI_API_KEY) {
        // Fallback to keyword classification if no AI key
        const classifyModule = await import('./classify-keywords.js');
        const result = classifyModule.classifyDocumentByKeywords(redactedText);
        return res.json(result);
      }

      // Use OpenAI for better classification
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert at classifying sober living facility documents. Classify the document as either 'commitment' (goals, pledges, recovery plans, AA/NA step work) or 'writeup' (incidents, violations, warnings, disciplinary actions). Note: Text may contain [PHONE], [EMAIL], [ADDRESS], [DATE], and [REDACTED_NAME] placeholders for privacy. Respond with JSON: {label: 'commitment' or 'writeup', confidence: 0-1}"
          },
          {
            role: "user",
            content: redactedText
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 100
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      res.json(result);
    } catch (error) {
      console.error('Classification error:', error);
      // Fallback to keyword classification
      const classifyModule = await import('./classify-keywords.js');
      const result = classifyModule.classifyDocumentByKeywords(req.body.text || '');
      res.json(result);
    }
  });

  // Admin drill endpoints
  const { drillRoutes } = await import('./emergency-drill');
  app.post('/api/admin/drill', drillRoutes.startDrill);
  app.get('/api/admin/drill/history', drillRoutes.getDrillHistory);
  app.get('/api/admin/drill/status', drillRoutes.getDrillStatus);
  app.post('/api/admin/drill/abort', (req, res) => {
    // Emergency abort procedure
    res.json({ message: 'Drill aborted - manual intervention completed' });
  });

  // Compliance binder download endpoint
  app.get('/api/compliance-binder', (req, res) => {
    const filePath = join(process.cwd(), 'client/public/HIPAA_Compliance_Binder_1756850255321.zip');
    res.download(filePath, 'HouseGuide_HIPAA_Compliance_Binder.zip', (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(404).json({ error: 'File not found' });
      }
    });
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

      const guide = await storage.getGuideByEmail(email.toLowerCase());
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
  
  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  // Configure multer for file uploads
  const storage_multer = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      // Create unique filename with timestamp and random string
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2);
      const extension = path.extname(file.originalname);
      const filename = `${timestamp}-${randomString}${extension}`;
      cb(null, filename);
    }
  });
  
  const upload = multer({
    storage: storage_multer,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      // Allow images and documents
      const allowedMimes = [
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'text/plain'
      ];
      
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
      }
    }
  });
  
  // Multipart file upload endpoint
  app.post("/api/files/upload", requireAuth, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const { residentId, houseId, type, ocrText } = req.body;
      
      if (!residentId || !houseId) {
        // Clean up uploaded file if validation fails
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "residentId and houseId are required" });
      }
      
      // Create file URL (relative path for serving)
      const fileUrl = `/uploads/${req.file.filename}`;
      
      // Create file record
      const fileRecord = await storage.createFile({
        residentId,
        houseId,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        url: fileUrl,
        size: req.file.size,
        type: type || 'general',
        ocrText: ocrText || null,
        createdBy: req.guide.id
      });
      
      res.status(201).json({
        file: fileRecord,
        uploadedFile: {
          filename: req.file.filename,
          originalname: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          path: fileUrl
        }
      });
      
    } catch (error) {
      // Clean up uploaded file if there's an error
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error('Failed to cleanup uploaded file:', unlinkError);
        }
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.error('File upload error:', error);
      }
      res.status(500).json({ error: "Failed to upload file" });
    }
  });
  
  // Serve uploaded files
  app.use('/uploads', express.static(uploadsDir));

  // Object Storage endpoints for meeting photos
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", requireAuth, async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  app.put("/api/meeting-photos", requireAuth, async (req: any, res) => {
    if (!req.body.photoUrl) {
      return res.status(400).json({ error: "photoUrl is required" });
    }

    const userId = req.guide?.id;
    
    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.photoUrl,
        {
          owner: userId,
          visibility: "public", // Meeting photos are publicly viewable
        },
      );

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error) {
      console.error("Error setting meeting photo:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Legacy file creation endpoint (for base64 - keeping for compatibility)
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
      // Add houseId and createdBy before validation
      const goalData = {
        ...req.body,
        houseId: req.guide.houseId!,
        createdBy: req.guide.id
      };
      
      const validatedData = insertGoalSchema.parse(goalData);
      
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
      // Add houseId and createdBy before validation
      const checklistData = {
        ...req.body,
        houseId: req.guide.houseId!,
        createdBy: req.guide.id
      };
      
      const validatedData = insertChecklistSchema.parse(checklistData);
      
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
      // Add houseId and createdBy before validation
      const choreData = {
        ...req.body,
        houseId: req.guide.houseId!,
        createdBy: req.guide.id
      };
      
      const validatedData = insertChoreSchema.parse(choreData);
      
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
      // Add houseId and createdBy before validation
      const accomplishmentData = {
        ...req.body,
        houseId: req.guide.houseId!,
        createdBy: req.guide.id
      };
      
      const validatedData = insertAccomplishmentSchema.parse(accomplishmentData);
      
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
      // Add houseId and createdBy before validation
      const incidentData = {
        ...req.body,
        houseId: req.guide.houseId!,
        createdBy: req.guide.id
      };
      
      const validatedData = insertIncidentSchema.parse(incidentData);
      
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
      // Add houseId and createdBy before validation
      const meetingData = {
        ...req.body,
        houseId: req.guide.houseId!,
        createdBy: req.guide.id
      };
      
      const validatedData = insertMeetingSchema.parse(meetingData);
      
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
      // Add houseId and createdBy before validation
      const feeData = {
        ...req.body,
        houseId: req.guide.houseId!,
        createdBy: req.guide.id
      };
      
      const validatedData = insertProgramFeeSchema.parse(feeData);
      
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
  // AI-powered note classification helper
  const classifyNoteText = async (text: string): Promise<string> => {
    const trimmedText = text.trim();
    if (!trimmedText) {
      return 'general';
    }

    // Fast keyword matching first (free, instant)
    const lowerText = trimmedText.toLowerCase();
    const keywords: Record<string, string[]> = {
      sponsor: ['sponsor', 'step work', 'big book', 'aa', 'na', 'meeting', 'recovery'],
      work_school: ['job', 'work', 'interview', 'school', 'class', 'shift', 'employed', 'hired'],
      medical: ['doctor', 'appointment', 'medication', 'meds', 'therapy', 'counseling', 'psychiatrist'],
      chores: ['chore', 'clean', 'dishes', 'laundry', 'room', 'trash', 'kitchen', 'bathroom'],
      demeanor: ['attitude', 'mood', 'positive', 'negative', 'anxious', 'happy', 'upset', 'behavior'],
    };

    for (const [category, words] of Object.entries(keywords)) {
      if (words.some(word => lowerText.includes(word))) {
        return category;
      }
    }

    if (trimmedText.length < MIN_NOTE_TEXT_CHARS) {
      return 'general';
    }

    // AI fallback for ambiguous notes (only if OPENAI_API_KEY configured)
    if (process.env.OPENAI_API_KEY) {
      try {
        const { OpenAI } = await import("openai");
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const completion = await client.chat.completions.create({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [{
            role: "system",
            content: "Classify this sober living resident note into ONE category: work_school, demeanor, sponsor, medical, chores, or general. Respond ONLY with JSON: {\"category\":\"...\",\"confidence\":0-1}. Be conservative; if unsure, set confidence <= 0.5."
          }, {
            role: "user", 
            content: trimmedText
          }],
          temperature: 0,
          max_tokens: 60,
          response_format: { type: "json_object" }
        });

        const raw = completion.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(raw);
        const result = String(parsed.category || 'general').toLowerCase().trim();
        const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
        const validCategories = ['work_school', 'demeanor', 'sponsor', 'medical', 'chores', 'general'];
        if (!validCategories.includes(result)) {
          return 'general';
        }
        return confidence >= MIN_NOTE_CONFIDENCE ? result : 'general';
      } catch (e) {
        console.error('AI classification failed, using general:', e);
        return 'general';
      }
    }

    return 'general';
  };

  app.post("/api/notes", requireAuth, async (req: any, res) => {
    try {
      // Auto-classify if no category provided or category is "general"
      let category = req.body.category;
      if (!category || category === 'general') {
        category = await classifyNoteText(req.body.text || '');
      }

      const noteData = {
        ...req.body,
        category,
        houseId: req.guide.houseId!,
        createdBy: req.guide.id
      };

      const validatedData = insertNoteSchema.parse(noteData);
      const note = await storage.createNote(validatedData);

      res.status(201).json(note);
    } catch (error) {
      console.error('Create note error:', error);
      res.status(500).json({ error: "Failed to create note" });
    }
  });


  // Voice Note Categorization (AI-powered)
  app.post("/api/notes/categorize-voice", requireAuth, async (req: any, res) => {
    try {
      const { transcript, residentId } = req.body;

      if (!transcript || typeof transcript !== 'string') {
        return res.status(400).json({ error: "Transcript is required" });
      }

      if (!residentId) {
        return res.status(400).json({ error: "Resident ID is required" });
      }

      // PII Redaction for HIPAA compliance
      const REDACTION_REGEXES: Array<[RegExp, string]> = [
        [/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE]"],
        [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]"],
        [/\b\d{1,5}\s+[A-Za-z0-9.\-]+\s+(Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr)\b/gi, "[ADDRESS]"],
        [/\b(Sponsor|Therapist|Doctor|Case\s*Manager)\s*:\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/g, "[REDACTED_NAME]"],
      ];

      const redactPII = (text: string): string => {
        let out = text;
        for (const [rx, repl] of REDACTION_REGEXES) out = out.replace(rx, repl);
        return out;
      };

      const redactedTranscript = redactPII(transcript);

      // AI Categorization using OpenAI
      const { OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const systemPrompt = `You are a professional case management assistant for sober living facilities. Your job is to analyze comprehensive voice notes about residents and categorize the content into specific recovery areas.

CATEGORIES (use these exact values):
- "work_school": Employment, job searches, interviews, workplace issues, education, classes, GED, college
- "demeanor": Attitude, behavior, participation in groups, social interactions, mood, cooperation
- "sponsor": AA/NA meetings, sponsor relationships, step work, recovery program participation
- "medical": Doctor appointments, therapy, medication compliance, mental health, physical health
- "chores": House responsibilities, cleaning, compliance with rules, curfew, assignments

INSTRUCTIONS:
1. Break down the voice note into meaningful segments
2. Assign each segment to the most appropriate category
3. Provide confidence scores (0-1) and brief reasoning
4. Focus on actionable, specific content rather than vague statements
5. Ensure segments are substantial enough to be meaningful in reports

Return valid JSON only.`;

      const userPrompt = `Analyze this comprehensive voice note about a resident and categorize the content:

"${redactedTranscript}"

Break this down into categorized segments that will be useful for weekly reports and case management.`;

      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 2000
      });

      const responseText = completion.choices[0].message.content;
      if (!responseText) {
        throw new Error("Empty response from AI");
      }

      const aiResponse = JSON.parse(responseText);

      const validCategories = ['work_school', 'demeanor', 'sponsor', 'medical', 'chores', 'general'];
      const rawSegments = Array.isArray(aiResponse.segments) ? aiResponse.segments : [];
      const normalizedSegments = rawSegments.map((segment: any) => {
        const confidence = typeof segment.confidence === 'number' ? segment.confidence : 0;
        const category = String(segment.category || 'general').toLowerCase().trim();
        const reason = typeof segment.reason === 'string' ? segment.reason : 'AI classification';
        const safeCategory = validCategories.includes(category) ? category : 'general';
        if (confidence < MIN_SEGMENT_CONFIDENCE) {
          return {
            ...segment,
            category: 'general',
            confidence,
            reason: 'Low confidence; saved as General.'
          };
        }
        return {
          ...segment,
          category: safeCategory,
          confidence,
          reason
        };
      });
      
      const result = {
        segments: normalizedSegments,
        fullTranscript: transcript,
        summary: aiResponse.summary || "Voice note processed successfully"
      };

      res.json(result);
    } catch (error) {
      console.error('Voice note categorization error:', error);
      
      // Fallback to keyword-based categorization
      try {
        const { transcript } = req.body;
        const sentences = transcript.split(/[.!?]+/).filter((s: string) => s.trim().length > 10);
        
        const categoryKeywords = {
          work_school: /\b(job|work|shift|hire|resume|interview|clocked|school|class|credits|ged|college|study|employment|workplace)\b/i,
          demeanor: /\b(attitude|behavior|mood|positive|negative|group|participate|cooperative|social|interaction|engagement)\b/i,
          sponsor: /\b(aa|na|sponsor|mentor|meeting|12[-\s]?step|home\s*group|recovery|program|spiritual)\b/i,
          medical: /\b(doctor|therapy|therapist|medication|appointment|mental|health|medical|treatment|counseling)\b/i,
          chores: /\b(chore|dish|trash|laundry|clean|inspection|curfew|compliance|rule|assignment|duty|responsibility)\b/i
        };

        const segments = sentences.map((sentence: string) => {
          let bestCategory: keyof typeof categoryKeywords = 'demeanor';
          let maxMatches = 0;

          for (const [category, regex] of Object.entries(categoryKeywords)) {
            const matches = (sentence.match(regex) || []).length;
            if (matches > maxMatches) {
              maxMatches = matches;
              bestCategory = category as keyof typeof categoryKeywords;
            }
          }

          return {
            text: sentence.trim(),
            category: bestCategory,
            confidence: maxMatches > 0 ? 0.7 : 0.3,
            reason: maxMatches > 0 ? "Keyword-based classification" : "Default classification"
          };
        }).filter((segment: any) => segment.text.length > 10);

        const normalizedSegments = segments.map((segment: any) => {
          if (segment.confidence < MIN_SEGMENT_CONFIDENCE) {
            return {
              ...segment,
              category: 'general',
              reason: 'Low confidence; saved as General.'
            };
          }
          return segment;
        });

        const fallbackResult = {
          segments: normalizedSegments,
          fullTranscript: transcript,
          summary: "Voice note categorized using keyword fallback system"
        };
        
        res.json(fallbackResult);
      } catch (fallbackError) {
        res.status(500).json({ error: "Failed to categorize voice note" });
      }
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
      // First add the required fields from authenticated context
      const reportData = {
        ...req.body,
        houseId: req.guide.houseId!,
        createdBy: req.guide.id
      };
      
      // Then validate the complete data
      const validatedData = insertWeeklyReportSchema.parse(reportData);
      
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

      // Get resident and house info
      const resident = await storage.getResident(residentId);
      if (!resident) {
        return res.status(404).json({ error: "Resident not found" });
      }

      const house = await storage.getHouse(resident.house);
      if (!house) {
        return res.status(404).json({ error: "House not found" });
      }

      // Collect all data for the week
      const [goals, chores, accomplishments, incidents, meetings, programFees, notes, checklist] = await Promise.all([
        storage.getGoalsByResident(residentId),
        storage.getChoresByResident(residentId),
        storage.getAccomplishmentsByResident(residentId),
        storage.getIncidentsByResident(residentId),
        storage.getMeetingsByResident(residentId),
        storage.getProgramFeesByResident(residentId),
        storage.getNotesByResident(residentId),
        storage.getChecklistByResident(residentId)
      ]);

      // Filter data to the specified week (basic implementation)
      const weekStartDate = new Date(weekStart);
      const weekEndDate = new Date(weekEnd);
      
      const filterByWeek = (items: any[], dateField: string) => {
        return items.filter(item => {
          const itemDate = new Date(item[dateField] || item.created);
          return itemDate >= weekStartDate && itemDate <= weekEndDate;
        });
      };

      const weekData = {
        resident: {
          id: resident.id,
          firstName: resident.firstName,
          lastInitial: resident.lastInitial
        },
        house: {
          id: house.id,
          name: house.name
        },
        period: {
          weekStart,
          weekEnd
        },
        data: {
          goals: filterByWeek(goals, 'created'),
          chores: filterByWeek(chores, 'assignedDate'),
          accomplishments: filterByWeek(accomplishments, 'dateAchieved'),
          incidents: filterByWeek(incidents, 'dateOccurred'),
          meetings: filterByWeek(meetings, 'dateAttended'),
          programFees: filterByWeek(programFees, 'dueDate'),
          notes: filterByWeek(notes, 'created'),
          checklist: checklist // Include current checklist status
        }
      };

      // Try AI generation, fallback to template if not available
      let draft;
      try {
        // Lazy load AI service to avoid startup errors
        const { aiService } = await import('./ai/index');
        
        // Load the report template using ES modules compatible path
        const { dirname } = await import('path');
        const { fileURLToPath } = await import('url');
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        
        const templatePath = process.env.WEEKLY_REPORT_TEMPLATE_PATH || join(__dirname, 'templates', 'weeklyReport.md');
        const template = readFileSync(templatePath, 'utf-8');

        // Generate report with AI
        draft = await aiService.generateWeeklyReport(weekData, template);
      } catch (aiError) {
        console.log('AI generation failed, using template fallback:', aiError);
        // Fallback to basic template
        // Use the original perfect template format
        const sponsorInfo = weekData.data.meetings.length > 0 ? weekData.data.meetings.map(m => m.meetingType).join(', ') : 'No updates this week';
        const workInfo = weekData.data.goals.length > 0 ? weekData.data.goals.map(g => `${g.title} (${g.status})`).join(', ') : 'No updates this week';
        const choresInfo = weekData.data.chores.length > 0 ? weekData.data.chores.map(c => `${c.choreName} (${c.status})`).join(', ') : 'No updates this week';
        // Include both incidents AND notes for demeanor - notes often contain social/behavioral observations
        const demeanorItems = [];
        if (weekData.data.incidents.length > 0) {
          demeanorItems.push(...weekData.data.incidents.map(i => `${i.incidentType} incident (${i.severity})`));
        }
        if (weekData.data.notes.length > 0) {
          demeanorItems.push(...weekData.data.notes.map(n => n.text.substring(0, 100) + (n.text.length > 100 ? '...' : '')));
        }
        const demeanorInfo = demeanorItems.length > 0 ? demeanorItems.join(', ') : 'No incidents or behavioral notes this week';
        const professionalInfo = weekData.data.accomplishments.length > 0 ? weekData.data.accomplishments.map(a => a.title).join(', ') : 'No updates this week';
        
        draft = `Resident: ${resident.firstName} ${resident.lastInitial}.  Week of: ${weekStart}

__Sponsor/Mentor:__ ${sponsorInfo}

__Work/School:__ ${workInfo}

__Chores/Compliance:__ ${choresInfo}

__Demeanor / Participation:__ ${demeanorInfo}

__Professional Help / Appointments:__ ${professionalInfo}`;
      }
      
      res.json({ draft, weekData });
    } catch (error) {
      console.error('Generate weekly report error:', error);
      res.status(500).json({ 
        error: "Failed to generate weekly report", 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Check AI provider status
  app.get("/api/ai/status", requireAuth, async (req: any, res) => {
    try {
      // Lazy load AI service to avoid startup errors
      const { aiService } = await import('./ai/index');
      const isAvailable = await aiService.isProviderAvailable();
      res.json({ 
        available: isAvailable, 
        provider: process.env.AI_PROVIDER || 'openai'
      });
    } catch (error) {
      console.error('AI status check error:', error);
      res.json({ available: false, provider: 'none' });
    }
  });

  // Generate comprehensive house report for director
  app.post("/api/reports/house/comprehensive", requireAuth, async (req: any, res) => {
    try {
      const { weekStart, weekEnd } = req.body;
      
      if (!weekStart || !weekEnd) {
        return res.status(400).json({ error: "weekStart and weekEnd are required" });
      }

      const houseId = req.guide.houseId;
      if (!houseId) {
        return res.status(400).json({ error: "Guide must be associated with a house" });
      }

      // Get house info
      const house = await storage.getHouse(houseId);
      if (!house) {
        return res.status(404).json({ error: "House not found" });
      }

      // Get all residents in the house
      const residents = await storage.getResidentsByHouse(houseId);
      if (residents.length === 0) {
        return res.status(404).json({ error: "No residents found in house" });
      }

      // Filter to active residents only
      const activeResidents = residents.filter(r => r.status === 'active');

      const weekStartDate = new Date(weekStart);
      const weekEndDate = new Date(weekEnd);
      
      const filterByWeek = (items: any[], dateField: string) => {
        return items.filter(item => {
          const itemDate = new Date(item[dateField] || item.created);
          return itemDate >= weekStartDate && itemDate <= weekEndDate;
        });
      };

      // Collect comprehensive data for all residents
      const residentReports = await Promise.all(
        activeResidents.map(async (resident) => {
          const [goals, chores, accomplishments, incidents, meetings, programFees, notes, checklist] = await Promise.all([
            storage.getGoalsByResident(resident.id),
            storage.getChoresByResident(resident.id),
            storage.getAccomplishmentsByResident(resident.id),
            storage.getIncidentsByResident(resident.id),
            storage.getMeetingsByResident(resident.id),
            storage.getProgramFeesByResident(resident.id),
            storage.getNotesByResident(resident.id),
            storage.getChecklistByResident(resident.id)
          ]);

          const weekData = {
            resident: {
              id: resident.id,
              firstName: resident.firstName,
              lastInitial: resident.lastInitial
            },
            house: {
              id: house.id,
              name: house.name
            },
            period: {
              weekStart,
              weekEnd
            },
            data: {
              goals: filterByWeek(goals, 'created'),
              chores: filterByWeek(chores, 'assignedDate'),
              accomplishments: filterByWeek(accomplishments, 'dateAchieved'),
              incidents: filterByWeek(incidents, 'dateOccurred'),
              meetings: filterByWeek(meetings, 'dateAttended'),
              programFees: filterByWeek(programFees, 'dueDate'),
              notes: filterByWeek(notes, 'created'),
              checklist: checklist
            }
          };

          // Try AI generation for each resident
          let report;
          try {
            // Lazy load AI service to avoid startup errors
            const { aiService } = await import('./ai/index');
            
            // Load the report template
            const { dirname } = await import('path');
            const { fileURLToPath } = await import('url');
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = dirname(__filename);
            
            const templatePath = process.env.WEEKLY_REPORT_TEMPLATE_PATH || join(__dirname, 'templates', 'weeklyReport.md');
            const template = readFileSync(templatePath, 'utf-8');

            // Generate report with AI
            report = await aiService.generateWeeklyReport(weekData, template);
          } catch (aiError) {
            console.log('AI generation failed for resident, using template fallback:', aiError);
            // Fallback to basic template
            const sponsorInfo = weekData.data.meetings.length > 0 ? weekData.data.meetings.map(m => m.meetingType).join(', ') : 'No updates this week';
            const workInfo = weekData.data.goals.length > 0 ? weekData.data.goals.map(g => `${g.title} (${g.status})`).join(', ') : 'No updates this week';
            const choresInfo = weekData.data.chores.length > 0 ? weekData.data.chores.map(c => `${c.choreName} (${c.status})`).join(', ') : 'No updates this week';
            // Include both incidents AND notes for demeanor
            const demeanorItems = [];
            if (weekData.data.incidents.length > 0) {
              demeanorItems.push(...weekData.data.incidents.map(i => `${i.incidentType} incident (${i.severity})`));
            }
            if (weekData.data.notes.length > 0) {
              demeanorItems.push(...weekData.data.notes.map(n => n.text.substring(0, 100) + (n.text.length > 100 ? '...' : '')));
            }
            const demeanorInfo = demeanorItems.length > 0 ? demeanorItems.join(', ') : 'No incidents or behavioral notes this week';
            const professionalInfo = weekData.data.accomplishments.length > 0 ? weekData.data.accomplishments.map(a => a.title).join(', ') : 'No updates this week';
            
            report = `Resident: ${resident.firstName} ${resident.lastInitial}.  Week of: ${weekStart}

__Sponsor/Mentor:__ ${sponsorInfo}

__Work/School:__ ${workInfo}

__Chores/Compliance:__ ${choresInfo}

__Demeanor / Participation:__ ${demeanorInfo}

__Professional Help / Appointments:__ ${professionalInfo}`;
          }
          
          return {
            resident,
            weekData: weekData.data,
            report
          };
        })
      );

      // Generate comprehensive house summary with AI
      const totalResidents = activeResidents.length;
      const totalIncidents = residentReports.reduce((sum, r) => sum + r.weekData.incidents.length, 0);
      const totalMeetings = residentReports.reduce((sum, r) => sum + r.weekData.meetings.length, 0);
      const totalAccomplishments = residentReports.reduce((sum, r) => sum + r.weekData.accomplishments.length, 0);
      const totalGoals = residentReports.reduce((sum, r) => sum + r.weekData.goals.length, 0);
      const totalChores = residentReports.reduce((sum, r) => sum + r.weekData.chores.length, 0);
      const totalNotes = residentReports.reduce((sum, r) => sum + r.weekData.notes.length, 0);
      const outstandingFees = residentReports.reduce((sum, r) => {
        const unpaidFees = r.weekData.programFees.filter(f => f.status !== 'paid');
        return sum + unpaidFees.reduce((feeSum, fee) => feeSum + (fee.amount || 0), 0);
      }, 0);

      // Generate executive summary with AI if available
      let executiveSummary = '';
      try {
        if (process.env.OPENAI_API_KEY) {
          const OpenAI = (await import('openai')).default;
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          
          const summaryPrompt = `You are a professional sober living facility director. Create an executive summary for the weekly house report.

House: ${house.name}
Week: ${weekStart} to ${weekEnd}
Total Residents: ${totalResidents}
Total Incidents: ${totalIncidents}
Total Meetings Attended: ${totalMeetings}
Total Accomplishments: ${totalAccomplishments}
Total Goals Set: ${totalGoals}
Total Chores Assigned: ${totalChores}
Total Notes: ${totalNotes}
Outstanding Fees: $${outstandingFees.toFixed(2)}

Provide:
1. Overall house performance assessment
2. Key highlights and concerns
3. Trends and patterns observed
4. Recommendations for the coming week
5. Critical items requiring immediate attention

Keep it professional, concise, and actionable. Focus on insights that help facility management.`;
          
          const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are an experienced sober living facility director writing executive summaries for house reports. Be professional, insightful, and focus on actionable recommendations."
              },
              {
                role: "user",
                content: summaryPrompt
              }
            ],
            temperature: 0.3,
            max_tokens: 800
          });
          
          executiveSummary = response.choices[0]?.message?.content || '';
        }
      } catch (error) {
        console.log('Failed to generate executive summary:', error);
      }

      // Create comprehensive report with executive summary and individual reports
      let comprehensiveReport = '';
      
      // Add executive summary if generated
      if (executiveSummary) {
        comprehensiveReport = `EXECUTIVE SUMMARY\n${'='.repeat(80)}\n\n${executiveSummary}\n\n`;
      }
      
      // Add house statistics
      comprehensiveReport += `HOUSE STATISTICS - ${house.name}\n${'='.repeat(80)}\n\n`;
      comprehensiveReport += `Reporting Period: ${weekStart} to ${weekEnd}\n`;
      comprehensiveReport += `Total Active Residents: ${totalResidents}\n`;
      comprehensiveReport += `Total Incidents: ${totalIncidents}\n`;
      comprehensiveReport += `Total Meetings Attended: ${totalMeetings}\n`;
      comprehensiveReport += `Total Accomplishments: ${totalAccomplishments}\n`;
      comprehensiveReport += `Total Goals Set: ${totalGoals}\n`;
      comprehensiveReport += `Total Chores Assigned: ${totalChores}\n`;
      comprehensiveReport += `Total Clinical Notes: ${totalNotes}\n`;
      comprehensiveReport += `Outstanding Program Fees: $${outstandingFees.toFixed(2)}\n\n`;
      
      // Add individual resident reports with clear separation
      comprehensiveReport += `INDIVIDUAL RESIDENT REPORTS\n${'='.repeat(80)}\n\n`;
      comprehensiveReport += residentReports.map((r, index) => {
        const separator = index < residentReports.length - 1 ? '\n\n' + '-'.repeat(80) + '\n\n' : '';
        return r.report + separator;
      }).join('');
      
      res.json({ 
        comprehensiveReport,
        house,
        totalResidents,
        residentReports: residentReports.map(r => ({
          resident: r.resident,
          summary: {
            incidents: r.weekData.incidents.length,
            meetings: r.weekData.meetings.length,
            accomplishments: r.weekData.accomplishments.length,
            outstandingFees: r.weekData.programFees.filter(f => f.status !== 'paid').reduce((sum, fee) => sum + (fee.amount || 0), 0)
          }
        }))
      });
    } catch (error) {
      console.error('Generate comprehensive house report error:', error);
      res.status(500).json({ 
        error: "Failed to generate comprehensive house report", 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
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
