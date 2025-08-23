import { z } from "zod";

// Guide (Auth User) Schema
export const insertGuideSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(120),
});

export type InsertGuide = z.infer<typeof insertGuideSchema>;

export interface Guide {
  id: string;
  email: string;
  name: string;
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
  image: z.any(), // File upload
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
