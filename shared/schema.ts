import { z } from "zod";

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
});

export type InsertResident = z.infer<typeof insertResidentSchema>;

export interface Resident {
  id: string;
  house: string;
  firstName: string;
  lastInitial: string;
  status?: string;
  residentId?: string;
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
