import { z } from "zod";
import { pgTable, varchar, boolean, timestamp, text, serial, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Guide (Auth User) Schema
export const insertGuideSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(120),
  houseName: z.string().min(1).max(80),
});

export type InsertGuide = z.infer<typeof insertGuideSchema>;

export interface Guide {
  id: string;
  email: string;
  name: string;
  password: string;
  houseName: string;
  houseId?: string;
  isEmailVerified: boolean;
  verificationToken?: string;
  created: string;
  updated: string;
}

// House Schema
export const insertHouseSchema = z.object({
  name: z.string().min(1).max(80),
});

export type InsertHouse = z.infer<typeof insertHouseSchema>;

export interface House {
  id: string;
  name: string;
  created: string;
  updated: string;
}

// Resident Schema
export const insertResidentSchema = z.object({
  house: z.string(),
  firstName: z.string().min(1).max(60),
  lastInitial: z.string().min(1).max(2),
  status: z.enum(["active", "inactive", "graduated"]).optional(),
  residentId: z.string().max(40).optional(),
  dischargeDate: z.string().optional(), // ISO date string
  dischargeReason: z.string().max(500).optional(),
});

export type InsertResident = z.infer<typeof insertResidentSchema>;

export interface Resident {
  id: string;
  house: string;
  firstName: string;
  lastInitial: string;
  status?: string;
  residentId?: string;
  dischargeDate?: string; // ISO date string
  dischargeReason?: string;
  created: string;
  updated: string;
}

// File Schema
export const insertFileSchema = z.object({
  resident: z.string(),
  type: z.enum(["commitment", "writeup"]),
  image: z.string(), // Base64 encoded image or file URL
  ocrText: z.string().optional(),
});

export type InsertFile = z.infer<typeof insertFileSchema>;

export interface FileRecord {
  id: string;
  resident: string;
  type: "commitment" | "writeup";
  image: string;
  ocrText?: string;
  created: string;
  updated: string;
}

// Note Schema
export const insertNoteSchema = z.object({
  resident: z.string(),
  type: z.enum(["general", "commitment", "writeup"]).optional(),
  text: z.string().max(65536).optional(),
});

export type InsertNote = z.infer<typeof insertNoteSchema>;

export interface Note {
  id: string;
  resident: string;
  type?: string;
  text?: string;
  created: string;
  updated: string;
}

// Report Schema
export const insertReportSchema = z.object({
  resident: z.string(),
  weekStart: z.string(), // Date string
  s1_sponsor: z.string().max(65536).optional(),
  s2_work: z.string().max(65536).optional(),
  s3_chores: z.string().max(65536).optional(),
  s4_demeanor: z.string().max(65536).optional(),
  s5_professional: z.string().max(65536).optional(),
});

export type InsertReport = z.infer<typeof insertReportSchema>;

export interface Report {
  id: string;
  resident: string;
  weekStart: string;
  s1_sponsor?: string;
  s2_work?: string;
  s3_chores?: string;
  s4_demeanor?: string;
  s5_professional?: string;
  created: string;
  updated: string;
}

// Goal Tracker Schema
export const insertGoalSchema = z.object({
  resident: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(65536).optional(),
  targetDate: z.string().optional(),
  status: z.enum(["not_started", "in_progress", "completed", "paused"]).default("not_started"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});

export type InsertGoal = z.infer<typeof insertGoalSchema>;

export interface Goal {
  id: string;
  resident: string;
  title: string;
  description?: string;
  targetDate?: string;
  status: "not_started" | "in_progress" | "completed" | "paused";
  priority: "low" | "medium" | "high";
  created: string;
  updated: string;
}

// Checklist Schema
export const insertChecklistSchema = z.object({
  resident: z.string(),
  phase: z.string().max(100).optional(),
  homeGroup: z.string().max(200).optional(),
  stepWork: z.string().max(500).optional(),
  professionalHelp: z.string().max(500).optional(),
  job: z.string().max(200).optional(),
  lastUpdated: z.string().optional(),
});

export type InsertChecklist = z.infer<typeof insertChecklistSchema>;

export interface Checklist {
  id: string;
  resident: string;
  phase?: string;
  homeGroup?: string;
  stepWork?: string;
  professionalHelp?: string;
  job?: string;
  lastUpdated?: string;
  created: string;
  updated: string;
}

// Chore Tracker Schema
export const insertChoreSchema = z.object({
  resident: z.string(),
  choreName: z.string().min(1).max(200),
  assignedDate: z.string(),
  dueDate: z.string().optional(),
  status: z.enum(["assigned", "in_progress", "completed", "missed"]).default("assigned"),
  notes: z.string().max(65536).optional(),
});

export type InsertChore = z.infer<typeof insertChoreSchema>;

export interface Chore {
  id: string;
  resident: string;
  choreName: string;
  assignedDate: string;
  dueDate?: string;
  status: "assigned" | "in_progress" | "completed" | "missed";
  notes?: string;
  created: string;
  updated: string;
}

// Accomplishment Tracker Schema
export const insertAccomplishmentSchema = z.object({
  resident: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(65536).optional(),
  dateAchieved: z.string(),
  category: z.enum(["personal", "work", "education", "recovery", "social", "other"]).default("personal"),
});

export type InsertAccomplishment = z.infer<typeof insertAccomplishmentSchema>;

export interface Accomplishment {
  id: string;
  resident: string;
  title: string;
  description?: string;
  dateAchieved: string;
  category: "personal" | "work" | "education" | "recovery" | "social" | "other";
  created: string;
  updated: string;
}

// Incident Tracker Schema
export const insertIncidentSchema = z.object({
  resident: z.string(),
  incidentType: z.enum(["behavioral", "medical", "property", "policy_violation", "other"]),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  description: z.string().min(1).max(65536),
  dateOccurred: z.string(),
  actionTaken: z.string().max(65536).optional(),
  followUpRequired: z.boolean().default(false),
});

export type InsertIncident = z.infer<typeof insertIncidentSchema>;

export interface Incident {
  id: string;
  resident: string;
  incidentType: "behavioral" | "medical" | "property" | "policy_violation" | "other";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  dateOccurred: string;
  actionTaken?: string;
  followUpRequired: boolean;
  created: string;
  updated: string;
}

// Meeting Tracker Schema
export const insertMeetingSchema = z.object({
  resident: z.string(),
  meetingType: z.enum(["aa", "na", "group_therapy", "individual_counseling", "house_meeting", "other"]),
  dateAttended: z.string(),
  duration: z.number().min(0).optional(), // minutes
  location: z.string().max(200).optional(),
  notes: z.string().max(65536).optional(),
});

export type InsertMeeting = z.infer<typeof insertMeetingSchema>;

export interface Meeting {
  id: string;
  resident: string;
  meetingType: "aa" | "na" | "group_therapy" | "individual_counseling" | "house_meeting" | "other";
  dateAttended: string;
  duration?: number; // minutes
  location?: string;
  notes?: string;
  created: string;
  updated: string;
}

// Program Fees Tracker Schema
export const insertProgramFeeSchema = z.object({
  resident: z.string(),
  feeType: z.enum(["rent", "program_fee", "fine", "deposit", "other"]),
  amount: z.number().min(0),
  dueDate: z.string(),
  paidDate: z.string().optional(),
  status: z.enum(["pending", "paid", "overdue", "waived"]).default("pending"),
  notes: z.string().max(65536).optional(),
});

export type InsertProgramFee = z.infer<typeof insertProgramFeeSchema>;

export interface ProgramFee {
  id: string;
  resident: string;
  feeType: "rent" | "program_fee" | "fine" | "deposit" | "other";
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: "pending" | "paid" | "overdue" | "waived";
  notes?: string;
  created: string;
  updated: string;
}

// Drizzle Table Definitions
export const guides = pgTable("guides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  password: varchar("password", { length: 255 }).notNull(),
  houseName: varchar("house_name", { length: 80 }).notNull(),
  houseId: varchar("house_id"),
  isEmailVerified: boolean("is_email_verified").default(false).notNull(),
  verificationToken: varchar("verification_token", { length: 255 }),
  created: timestamp("created").defaultNow().notNull(),
  updated: timestamp("updated").defaultNow().notNull(),
});

export const houses = pgTable("houses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 80 }).notNull(),
  created: timestamp("created").defaultNow().notNull(),
  updated: timestamp("updated").defaultNow().notNull(),
});

export const residents = pgTable("residents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  house: varchar("house").notNull(),
  firstName: varchar("first_name", { length: 60 }).notNull(),
  lastInitial: varchar("last_initial", { length: 2 }).notNull(),
  status: varchar("status", { length: 20 }).default("active"),
  residentId: varchar("resident_id", { length: 40 }),
  dischargeDate: varchar("discharge_date"),
  dischargeReason: varchar("discharge_reason", { length: 500 }),
  created: timestamp("created").defaultNow().notNull(),
  updated: timestamp("updated").defaultNow().notNull(),
});

export const files = pgTable("files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resident: varchar("resident").notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  image: text("image").notNull(),
  ocrText: text("ocr_text"),
  created: timestamp("created").defaultNow().notNull(),
  updated: timestamp("updated").defaultNow().notNull(),
});

export const notes = pgTable("notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resident: varchar("resident").notNull(),
  type: varchar("type", { length: 20 }),
  text: text("text"),
  created: timestamp("created").defaultNow().notNull(),
  updated: timestamp("updated").defaultNow().notNull(),
});

export const reports = pgTable("reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resident: varchar("resident").notNull(),
  weekStart: varchar("week_start").notNull(),
  s1_sponsor: text("s1_sponsor"),
  s2_work: text("s2_work"),
  s3_chores: text("s3_chores"),
  s4_demeanor: text("s4_demeanor"),
  s5_professional: text("s5_professional"),
  created: timestamp("created").defaultNow().notNull(),
  updated: timestamp("updated").defaultNow().notNull(),
});

export const goals = pgTable("goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resident: varchar("resident").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  targetDate: varchar("target_date"),
  status: varchar("status", { length: 20 }).default("not_started").notNull(),
  priority: varchar("priority", { length: 10 }).default("medium").notNull(),
  created: timestamp("created").defaultNow().notNull(),
  updated: timestamp("updated").defaultNow().notNull(),
});

export const checklists = pgTable("checklists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resident: varchar("resident").notNull(),
  phase: varchar("phase", { length: 100 }),
  homeGroup: varchar("home_group", { length: 200 }),
  stepWork: varchar("step_work", { length: 500 }),
  professionalHelp: varchar("professional_help", { length: 500 }),
  job: varchar("job", { length: 200 }),
  lastUpdated: varchar("last_updated"),
  created: timestamp("created").defaultNow().notNull(),
  updated: timestamp("updated").defaultNow().notNull(),
});

export const chores = pgTable("chores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resident: varchar("resident").notNull(),
  choreName: varchar("chore_name", { length: 200 }).notNull(),
  assignedDate: varchar("assigned_date").notNull(),
  dueDate: varchar("due_date"),
  status: varchar("status", { length: 20 }).default("assigned").notNull(),
  notes: text("notes"),
  created: timestamp("created").defaultNow().notNull(),
  updated: timestamp("updated").defaultNow().notNull(),
});

export const accomplishments = pgTable("accomplishments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resident: varchar("resident").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  dateAchieved: varchar("date_achieved").notNull(),
  category: varchar("category", { length: 20 }).default("personal").notNull(),
  created: timestamp("created").defaultNow().notNull(),
  updated: timestamp("updated").defaultNow().notNull(),
});

export const incidents = pgTable("incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resident: varchar("resident").notNull(),
  incidentType: varchar("incident_type", { length: 50 }).notNull(),
  dateOccurred: varchar("date_occurred").notNull(),
  description: text("description").notNull(),
  severity: varchar("severity", { length: 20 }).default("low").notNull(),
  resolved: boolean("resolved").default(false).notNull(),
  resolutionNotes: text("resolution_notes"),
  created: timestamp("created").defaultNow().notNull(),
  updated: timestamp("updated").defaultNow().notNull(),
});

export const meetings = pgTable("meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resident: varchar("resident").notNull(),
  meetingType: varchar("meeting_type", { length: 30 }).notNull(),
  dateAttended: varchar("date_attended").notNull(),
  duration: integer("duration"),
  location: varchar("location", { length: 200 }),
  notes: text("notes"),
  created: timestamp("created").defaultNow().notNull(),
  updated: timestamp("updated").defaultNow().notNull(),
});

export const programFees = pgTable("program_fees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resident: varchar("resident").notNull(),
  feeType: varchar("fee_type", { length: 20 }).notNull(),
  amount: integer("amount").notNull(),
  dueDate: varchar("due_date").notNull(),
  paidDate: varchar("paid_date"),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  notes: text("notes"),
  created: timestamp("created").defaultNow().notNull(),
  updated: timestamp("updated").defaultNow().notNull(),
});
