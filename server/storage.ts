import type { 
  Organization, Guide, House, Resident, FileRecord, Note, Report, WeeklyReport,
  Goal, Checklist, Chore, Accomplishment, Incident, Meeting, ProgramFee,
  ChatThread, ChatMessage, ChatAttachment,
  InsertOrganization, InsertGuide, InsertOrgUser, InsertHouse, InsertResident, InsertFile, InsertNote, UpdateNote, InsertReport, InsertWeeklyReport,
  InsertGoal, InsertChecklist, InsertChore, InsertAccomplishment, InsertIncident, InsertMeeting, InsertProgramFee,
  InsertChatThread, InsertChatMessage, InsertChatAttachment
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Organizations
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationByName(name: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization>;
  getOrganizations(): Promise<Organization[]>;

  // Guides
  getGuide(id: string): Promise<Guide | undefined>;
  getGuideByEmail(email: string): Promise<Guide | undefined>;
  getGuideByVerificationToken(token: string): Promise<Guide | undefined>;
  createGuide(guide: InsertGuide): Promise<Guide>;
  createOrgUser(user: InsertOrgUser): Promise<Guide>;
  updateGuide(id: string, updates: Partial<Guide>): Promise<Guide>;
  getGuidesByOrg(orgId: string): Promise<Guide[]>;
  
  // Houses
  getHouse(id: string): Promise<House | undefined>;
  getHouseByName(name: string): Promise<House | undefined>;
  createHouse(house: InsertHouse): Promise<House>;
  updateHouse(id: string, updates: Partial<InsertHouse>): Promise<House>;
  getAllHouses(): Promise<House[]>;
  getHousesByOrg(orgId: string): Promise<House[]>;
  
  // Residents
  getResident(id: string): Promise<Resident | undefined>;
  getResidentsByHouse(houseId: string, limit?: number, offset?: number): Promise<Resident[]>;
  createResident(resident: InsertResident): Promise<Resident>;
  updateResident(id: string, updates: Partial<InsertResident>): Promise<Resident>;
  deleteResident(id: string): Promise<void>;
  
  // Files
  getFile(id: string): Promise<FileRecord | undefined>;
  getFilesByResident(residentId: string): Promise<FileRecord[]>;
  createFile(file: InsertFile): Promise<FileRecord>;
  deleteFile(id: string): Promise<void>;
  
  // Reports
  getReport(id: string): Promise<Report | undefined>;
  getReportByResidentAndWeek(residentId: string, weekStart: string): Promise<Report | undefined>;
  createReport(report: InsertReport): Promise<Report>;
  updateReport(id: string, updates: Partial<InsertReport>): Promise<Report>;
  
  // Goals
  getGoal(id: string): Promise<Goal | undefined>;
  getGoalsByResident(residentId: string): Promise<Goal[]>;
  createGoal(goal: InsertGoal): Promise<Goal>;
  updateGoal(id: string, updates: Partial<InsertGoal>): Promise<Goal>;
  deleteGoal(id: string): Promise<void>;
  
  // Checklists
  getChecklist(id: string): Promise<Checklist | undefined>;
  getChecklistByResident(residentId: string): Promise<Checklist | undefined>;
  createChecklist(checklist: InsertChecklist): Promise<Checklist>;
  updateChecklist(id: string, updates: Partial<InsertChecklist>): Promise<Checklist>;
  
  // Chores
  getChore(id: string): Promise<Chore | undefined>;
  getChoresByResident(residentId: string): Promise<Chore[]>;
  createChore(chore: InsertChore): Promise<Chore>;
  updateChore(id: string, updates: Partial<InsertChore>): Promise<Chore>;
  deleteChore(id: string): Promise<void>;
  
  // Accomplishments
  getAccomplishment(id: string): Promise<Accomplishment | undefined>;
  getAccomplishmentsByResident(residentId: string): Promise<Accomplishment[]>;
  createAccomplishment(accomplishment: InsertAccomplishment): Promise<Accomplishment>;
  updateAccomplishment(id: string, updates: Partial<InsertAccomplishment>): Promise<Accomplishment>;
  deleteAccomplishment(id: string): Promise<void>;
  
  // Incidents
  getIncident(id: string): Promise<Incident | undefined>;
  getIncidentsByResident(residentId: string): Promise<Incident[]>;
  createIncident(incident: InsertIncident): Promise<Incident>;
  updateIncident(id: string, updates: Partial<InsertIncident>): Promise<Incident>;
  deleteIncident(id: string): Promise<void>;
  
  // Meetings
  getMeeting(id: string): Promise<Meeting | undefined>;
  getMeetingsByResident(residentId: string): Promise<Meeting[]>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: string, updates: Partial<InsertMeeting>): Promise<Meeting>;
  deleteMeeting(id: string): Promise<void>;
  
  // Program Fees
  getProgramFee(id: string): Promise<ProgramFee | undefined>;
  getProgramFeesByResident(residentId: string): Promise<ProgramFee[]>;
  createProgramFee(fee: InsertProgramFee): Promise<ProgramFee>;
  updateProgramFee(id: string, updates: Partial<InsertProgramFee>): Promise<ProgramFee>;
  deleteProgramFee(id: string): Promise<void>;
  
  // Notes
  getNote(id: string): Promise<Note | undefined>;
  getNotesByResident(residentId: string): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: string, updates: UpdateNote): Promise<Note>;
  
  // Weekly Reports (AI Generated)
  getWeeklyReport(id: string): Promise<WeeklyReport | undefined>;
  getWeeklyReportsByResident(residentId: string, from?: string, to?: string): Promise<WeeklyReport[]>;
  createWeeklyReport(report: InsertWeeklyReport): Promise<WeeklyReport>;
  updateWeeklyReport(id: string, updates: Partial<InsertWeeklyReport>): Promise<WeeklyReport>;
  deleteWeeklyReport(id: string): Promise<void>;

  // Chat
  getChatThread(id: string): Promise<ChatThread | undefined>;
  getChatThreadsByOrg(orgId: string): Promise<ChatThread[]>;
  getChatThreadByHouse(orgId: string, houseId: string): Promise<ChatThread | undefined>;
  createChatThread(thread: InsertChatThread): Promise<ChatThread>;
  getChatMessagesByThread(threadId: string, limit?: number, offset?: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  createChatAttachment(attachment: InsertChatAttachment): Promise<ChatAttachment>;
  getChatAttachmentsByMessage(messageId: string): Promise<ChatAttachment[]>;
}

export class MemStorage implements IStorage {
  private organizations: Map<string, Organization> = new Map();
  private guides: Map<string, Guide> = new Map();
  private houses: Map<string, House> = new Map();
  private residents: Map<string, Resident> = new Map();
  private files: Map<string, FileRecord> = new Map();
  private reports: Map<string, Report> = new Map();
  private goals: Map<string, Goal> = new Map();
  private checklists: Map<string, Checklist> = new Map();
  private chores: Map<string, Chore> = new Map();
  private accomplishments: Map<string, Accomplishment> = new Map();
  private incidents: Map<string, Incident> = new Map();
  private meetings: Map<string, Meeting> = new Map();
  private programFees: Map<string, ProgramFee> = new Map();
  private notes: Map<string, Note> = new Map();
  private weeklyReports: Map<string, WeeklyReport> = new Map();
  private chatThreads: Map<string, ChatThread> = new Map();
  private chatMessages: Map<string, ChatMessage> = new Map();
  private chatAttachments: Map<string, ChatAttachment> = new Map();

  constructor() {
    // Initialize with default organization and house
    const defaultOrg: Organization = {
      id: "org-main",
      name: "MAIN",
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    this.organizations.set(defaultOrg.id, defaultOrg);

    const defaultHouse: House = {
      id: "house-main",
      name: "MAIN",
      orgId: defaultOrg.id,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    this.houses.set("house-main", defaultHouse);

    const familyThread: ChatThread = {
      id: "thread-family-main",
      orgId: defaultOrg.id,
      type: "family",
      name: "Family Chat",
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    this.chatThreads.set(familyThread.id, familyThread);

    const houseThread: ChatThread = {
      id: "thread-house-main",
      orgId: defaultOrg.id,
      houseId: defaultHouse.id,
      type: "house",
      name: "MAIN House Thread",
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    this.chatThreads.set(houseThread.id, houseThread);
    
    // Initialize with sample resident
    const sampleResident: Resident = {
      id: "resident-1",
      house: "house-main",
      firstName: "John", 
      lastInitial: "D",
      status: "active",
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    this.residents.set("resident-1", sampleResident);
  }

  // Organization methods
  async getOrganization(id: string): Promise<Organization | undefined> {
    return this.organizations.get(id);
  }

  async getOrganizationByName(name: string): Promise<Organization | undefined> {
    return Array.from(this.organizations.values()).find(org => org.name === name);
  }

  async createOrganization(insertOrg: InsertOrganization): Promise<Organization> {
    const id = randomUUID();
    const org: Organization = {
      ...insertOrg,
      id,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    this.organizations.set(id, org);
    return org;
  }

  async updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization> {
    const existing = this.organizations.get(id);
    if (!existing) throw new Error('Organization not found');

    const updated: Organization = {
      ...existing,
      ...updates,
      updated: new Date().toISOString()
    };
    this.organizations.set(id, updated);
    return updated;
  }

  async getOrganizations(): Promise<Organization[]> {
    return Array.from(this.organizations.values());
  }

  // Guide methods
  async getGuide(id: string): Promise<Guide | undefined> {
    return this.guides.get(id);
  }

  async getGuideByEmail(email: string): Promise<Guide | undefined> {
    return Array.from(this.guides.values()).find(guide => guide.email === email);
  }

  async getGuideByVerificationToken(token: string): Promise<Guide | undefined> {
    return Array.from(this.guides.values()).find(guide => guide.verificationToken === token);
  }

  async updateGuide(id: string, updates: Partial<Guide>): Promise<Guide> {
    const existing = this.guides.get(id);
    if (!existing) throw new Error('Guide not found');
    
    const updated: Guide = {
      ...existing,
      ...updates,
      updated: new Date().toISOString()
    };
    this.guides.set(id, updated);
    return updated;
  }

  async createGuide(insertGuide: InsertGuide): Promise<Guide> {
    const id = randomUUID();
    const verificationToken = randomUUID();

    const org = await this.createOrganization({ name: insertGuide.organizationName });
    const house = await this.createHouse({ name: insertGuide.houseName, orgId: org.id });
    
    const guide: Guide = { 
      id,
      email: insertGuide.email.toLowerCase(),
      name: insertGuide.name,
      password: insertGuide.password,
      houseName: insertGuide.houseName,
      houseId: house.id,
      orgId: org.id,
      role: "owner",
      isEmailVerified: false,
      verificationToken,
      created: new Date().toISOString(), 
      updated: new Date().toISOString() 
    };
    this.guides.set(id, guide);
    return guide;
  }

  async createOrgUser(insertUser: InsertOrgUser): Promise<Guide> {
    const id = randomUUID();
    const verificationToken = randomUUID();
    let houseId = insertUser.houseId;
    let houseName = insertUser.houseName;

    if (!houseId && insertUser.houseName) {
      const house = await this.createHouse({ name: insertUser.houseName, orgId: insertUser.orgId });
      houseId = house.id;
      houseName = house.name;
    }

    const guide: Guide = {
      id,
      email: insertUser.email.toLowerCase(),
      name: insertUser.name,
      password: insertUser.password,
      houseName: houseName || "Unassigned",
      houseId,
      orgId: insertUser.orgId,
      role: insertUser.role,
      isEmailVerified: false,
      verificationToken,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };

    this.guides.set(id, guide);
    return guide;
  }

  async getGuidesByOrg(orgId: string): Promise<Guide[]> {
    return Array.from(this.guides.values()).filter(guide => guide.orgId === orgId);
  }

  // House methods
  async getHouse(id: string): Promise<House | undefined> {
    return this.houses.get(id);
  }

  async getHouseByName(name: string): Promise<House | undefined> {
    return Array.from(this.houses.values()).find(house => house.name === name);
  }

  async createHouse(insertHouse: InsertHouse): Promise<House> {
    const id = randomUUID();
    const house: House = {
      ...insertHouse,
      id,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    this.houses.set(id, house);
    return house;
  }

  async updateHouse(id: string, updates: Partial<InsertHouse>): Promise<House> {
    const existing = this.houses.get(id);
    if (!existing) {
      throw new Error('House not found');
    }

    const updated: House = {
      ...existing,
      ...updates,
      updated: new Date().toISOString()
    };

    this.houses.set(id, updated);
    return updated;
  }

  async getAllHouses(): Promise<House[]> {
    return Array.from(this.houses.values());
  }

  async getHousesByOrg(orgId: string): Promise<House[]> {
    return Array.from(this.houses.values()).filter(house => house.orgId === orgId);
  }

  // Resident methods
  async getResident(id: string): Promise<Resident | undefined> {
    return this.residents.get(id);
  }

  async getResidentsByHouse(houseId: string, limit = 100, offset = 0): Promise<Resident[]> {
    return Array.from(this.residents.values())
      .filter(resident => resident.house === houseId)
      .slice(offset, offset + limit);
  }

  async getResidentsByGuideHouse(guideId: string): Promise<Resident[]> {
    const guide = await this.getGuide(guideId);
    if (!guide?.houseId) return [];
    return this.getResidentsByHouse(guide.houseId);
  }

  async createResident(insertResident: InsertResident): Promise<Resident> {
    const id = randomUUID();
    const resident: Resident = {
      ...insertResident,
      id,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    this.residents.set(id, resident);
    return resident;
  }

  async updateResident(id: string, updates: Partial<InsertResident>): Promise<Resident> {
    const existing = this.residents.get(id);
    if (!existing) throw new Error('Resident not found');
    
    const updated: Resident = {
      ...existing,
      ...updates,
      updated: new Date().toISOString()
    };
    this.residents.set(id, updated);
    return updated;
  }

  async deleteResident(id: string): Promise<void> {
    this.residents.delete(id);
  }

  // File methods
  async getFile(id: string): Promise<FileRecord | undefined> {
    return this.files.get(id);
  }

  async getFilesByResident(residentId: string): Promise<FileRecord[]> {
    return Array.from(this.files.values()).filter(file => file.residentId === residentId);
  }

  async createFile(insertFile: InsertFile): Promise<FileRecord> {
    const id = randomUUID();
    const file: FileRecord = {
      ...insertFile,
      id,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    this.files.set(id, file);
    return file;
  }

  async deleteFile(id: string): Promise<void> {
    this.files.delete(id);
  }

  // Report methods
  async getReport(id: string): Promise<Report | undefined> {
    return this.reports.get(id);
  }

  async getReportByResidentAndWeek(residentId: string, weekStart: string): Promise<Report | undefined> {
    return Array.from(this.reports.values()).find(
      report => report.resident === residentId && report.weekStart === weekStart
    );
  }

  async createReport(insertReport: InsertReport): Promise<Report> {
    const id = randomUUID();
    const report: Report = {
      ...insertReport,
      id,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    this.reports.set(id, report);
    return report;
  }

  async updateReport(id: string, updates: Partial<InsertReport>): Promise<Report> {
    const existing = this.reports.get(id);
    if (!existing) throw new Error('Report not found');
    
    const updated: Report = {
      ...existing,
      ...updates,
      updated: new Date().toISOString()
    };
    this.reports.set(id, updated);
    return updated;
  }

  // Goal methods
  async getGoal(id: string): Promise<Goal | undefined> {
    return this.goals.get(id);
  }

  async getGoalsByResident(residentId: string): Promise<Goal[]> {
    return Array.from(this.goals.values()).filter(goal => goal.residentId === residentId);
  }

  async createGoal(insertGoal: InsertGoal): Promise<Goal> {
    const id = randomUUID();
    const goal: Goal = {
      ...insertGoal,
      id,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    this.goals.set(id, goal);
    return goal;
  }

  async updateGoal(id: string, updates: Partial<InsertGoal>): Promise<Goal> {
    const existing = this.goals.get(id);
    if (!existing) throw new Error('Goal not found');
    
    const updated: Goal = {
      ...existing,
      ...updates,
      updated: new Date().toISOString()
    };
    this.goals.set(id, updated);
    return updated;
  }

  async deleteGoal(id: string): Promise<void> {
    this.goals.delete(id);
  }

  // Checklist methods
  async getChecklist(id: string): Promise<Checklist | undefined> {
    return this.checklists.get(id);
  }

  async getChecklistByResident(residentId: string): Promise<Checklist | undefined> {
    return Array.from(this.checklists.values()).find(checklist => checklist.residentId === residentId);
  }

  async createChecklist(insertChecklist: InsertChecklist): Promise<Checklist> {
    const id = randomUUID();
    const checklist: Checklist = {
      ...insertChecklist,
      id,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    this.checklists.set(id, checklist);
    return checklist;
  }

  async updateChecklist(id: string, updates: Partial<InsertChecklist>): Promise<Checklist> {
    const existing = this.checklists.get(id);
    if (!existing) throw new Error('Checklist not found');
    
    const updated: Checklist = {
      ...existing,
      ...updates,
      updated: new Date().toISOString()
    };
    this.checklists.set(id, updated);
    return updated;
  }

  // Chore methods
  async getChore(id: string): Promise<Chore | undefined> {
    return this.chores.get(id);
  }

  async getChoresByResident(residentId: string): Promise<Chore[]> {
    return Array.from(this.chores.values()).filter(chore => chore.residentId === residentId);
  }

  async createChore(insertChore: InsertChore): Promise<Chore> {
    const id = randomUUID();
    const chore: Chore = {
      ...insertChore,
      id,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    this.chores.set(id, chore);
    return chore;
  }

  async updateChore(id: string, updates: Partial<InsertChore>): Promise<Chore> {
    const existing = this.chores.get(id);
    if (!existing) throw new Error('Chore not found');
    
    const updated: Chore = {
      ...existing,
      ...updates,
      updated: new Date().toISOString()
    };
    this.chores.set(id, updated);
    return updated;
  }

  async deleteChore(id: string): Promise<void> {
    this.chores.delete(id);
  }

  // Accomplishment methods
  async getAccomplishment(id: string): Promise<Accomplishment | undefined> {
    return this.accomplishments.get(id);
  }

  async getAccomplishmentsByResident(residentId: string): Promise<Accomplishment[]> {
    return Array.from(this.accomplishments.values()).filter(acc => acc.residentId === residentId);
  }

  async createAccomplishment(insertAccomplishment: InsertAccomplishment): Promise<Accomplishment> {
    const id = randomUUID();
    const accomplishment: Accomplishment = {
      ...insertAccomplishment,
      id,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    this.accomplishments.set(id, accomplishment);
    return accomplishment;
  }

  async updateAccomplishment(id: string, updates: Partial<InsertAccomplishment>): Promise<Accomplishment> {
    const existing = this.accomplishments.get(id);
    if (!existing) throw new Error('Accomplishment not found');
    
    const updated: Accomplishment = {
      ...existing,
      ...updates,
      updated: new Date().toISOString()
    };
    this.accomplishments.set(id, updated);
    return updated;
  }

  async deleteAccomplishment(id: string): Promise<void> {
    this.accomplishments.delete(id);
  }

  // Incident methods
  async getIncident(id: string): Promise<Incident | undefined> {
    return this.incidents.get(id);
  }

  async getIncidentsByResident(residentId: string): Promise<Incident[]> {
    return Array.from(this.incidents.values()).filter(incident => incident.residentId === residentId);
  }

  async createIncident(insertIncident: InsertIncident): Promise<Incident> {
    const id = randomUUID();
    const incident: Incident = {
      ...insertIncident,
      id,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    this.incidents.set(id, incident);
    return incident;
  }

  async updateIncident(id: string, updates: Partial<InsertIncident>): Promise<Incident> {
    const existing = this.incidents.get(id);
    if (!existing) throw new Error('Incident not found');
    
    const updated: Incident = {
      ...existing,
      ...updates,
      updated: new Date().toISOString()
    };
    this.incidents.set(id, updated);
    return updated;
  }

  async deleteIncident(id: string): Promise<void> {
    this.incidents.delete(id);
  }

  // Meeting methods
  async getMeeting(id: string): Promise<Meeting | undefined> {
    return this.meetings.get(id);
  }

  async getMeetingsByResident(residentId: string): Promise<Meeting[]> {
    return Array.from(this.meetings.values()).filter(meeting => meeting.residentId === residentId);
  }

  async createMeeting(insertMeeting: InsertMeeting): Promise<Meeting> {
    const id = randomUUID();
    const meeting: Meeting = {
      ...insertMeeting,
      id,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    this.meetings.set(id, meeting);
    return meeting;
  }

  async updateMeeting(id: string, updates: Partial<InsertMeeting>): Promise<Meeting> {
    const existing = this.meetings.get(id);
    if (!existing) throw new Error('Meeting not found');
    
    const updated: Meeting = {
      ...existing,
      ...updates,
      updated: new Date().toISOString()
    };
    this.meetings.set(id, updated);
    return updated;
  }

  async deleteMeeting(id: string): Promise<void> {
    this.meetings.delete(id);
  }

  // Program Fee methods
  async getProgramFee(id: string): Promise<ProgramFee | undefined> {
    return this.programFees.get(id);
  }

  async getProgramFeesByResident(residentId: string): Promise<ProgramFee[]> {
    return Array.from(this.programFees.values()).filter(fee => fee.residentId === residentId);
  }

  async createProgramFee(insertFee: InsertProgramFee): Promise<ProgramFee> {
    const id = randomUUID();
    const fee: ProgramFee = {
      ...insertFee,
      id,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    this.programFees.set(id, fee);
    return fee;
  }

  async updateProgramFee(id: string, updates: Partial<InsertProgramFee>): Promise<ProgramFee> {
    const existing = this.programFees.get(id);
    if (!existing) throw new Error('Program fee not found');
    
    const updated: ProgramFee = {
      ...existing,
      ...updates,
      updated: new Date().toISOString()
    };
    this.programFees.set(id, updated);
    return updated;
  }

  async deleteProgramFee(id: string): Promise<void> {
    this.programFees.delete(id);
  }

  // Note methods
  async getNote(id: string): Promise<Note | undefined> {
    return this.notes.get(id);
  }

  async getNotesByResident(residentId: string): Promise<Note[]> {
    return Array.from(this.notes.values()).filter(note => note.residentId === residentId);
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    const id = randomUUID();
    const note: Note = {
      ...insertNote,
      id,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    this.notes.set(id, note);
    return note;
  }

  async updateNote(id: string, updates: UpdateNote): Promise<Note> {
    const existing = this.notes.get(id);
    if (!existing) {
      throw new Error("Note not found");
    }

    const updated: Note = {
      ...existing,
      ...updates,
      updated: new Date().toISOString(),
    };

    this.notes.set(id, updated);
    return updated;
  }

  // Weekly Reports (AI Generated) - MemStorage implementation
  async getWeeklyReport(id: string): Promise<WeeklyReport | undefined> {
    return this.weeklyReports.get(id);
  }

  async getWeeklyReportsByResident(residentId: string, from?: string, to?: string): Promise<WeeklyReport[]> {
    let reports = Array.from(this.weeklyReports.values()).filter(r => r.residentId === residentId);
    
    if (from) {
      reports = reports.filter(r => r.weekStart >= from);
    }
    if (to) {
      reports = reports.filter(r => r.weekEnd <= to);
    }
    
    return reports.sort((a, b) => b.weekStart.localeCompare(a.weekStart)); // Most recent first
  }

  async createWeeklyReport(insertReport: InsertWeeklyReport): Promise<WeeklyReport> {
    const id = randomUUID();
    const report: WeeklyReport = {
      ...insertReport,
      id,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    this.weeklyReports.set(id, report);
    return report;
  }

  async updateWeeklyReport(id: string, updates: Partial<InsertWeeklyReport>): Promise<WeeklyReport> {
    const existing = this.weeklyReports.get(id);
    if (!existing) {
      throw new Error(`Weekly report not found: ${id}`);
    }
    
    const updated: WeeklyReport = {
      ...existing,
      ...updates,
      updated: new Date().toISOString()
    };
    this.weeklyReports.set(id, updated);
    return updated;
  }

  async deleteWeeklyReport(id: string): Promise<void> {
    this.weeklyReports.delete(id);
  }

  // Chat methods
  async getChatThread(id: string): Promise<ChatThread | undefined> {
    return this.chatThreads.get(id);
  }

  async getChatThreadsByOrg(orgId: string): Promise<ChatThread[]> {
    return Array.from(this.chatThreads.values()).filter(thread => thread.orgId === orgId);
  }

  async getChatThreadByHouse(orgId: string, houseId: string): Promise<ChatThread | undefined> {
    return Array.from(this.chatThreads.values()).find(
      thread => thread.orgId === orgId && thread.houseId === houseId && thread.type === "house"
    );
  }

  async createChatThread(thread: InsertChatThread): Promise<ChatThread> {
    const id = randomUUID();
    const record: ChatThread = {
      ...thread,
      id,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    this.chatThreads.set(id, record);
    return record;
  }

  async getChatMessagesByThread(threadId: string, limit = 100, offset = 0): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values())
      .filter(message => message.threadId === threadId)
      .slice(offset, offset + limit)
      .sort((a, b) => a.created.localeCompare(b.created));
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const id = randomUUID();
    const record: ChatMessage = {
      ...message,
      id,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    this.chatMessages.set(id, record);
    return record;
  }

  async createChatAttachment(attachment: InsertChatAttachment): Promise<ChatAttachment> {
    const id = randomUUID();
    const record: ChatAttachment = {
      ...attachment,
      id,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    this.chatAttachments.set(id, record);
    return record;
  }

  async getChatAttachmentsByMessage(messageId: string): Promise<ChatAttachment[]> {
    return Array.from(this.chatAttachments.values()).filter(att => att.messageId === messageId);
  }
}

import { DbStorage } from "./dbStorage";

// Use database storage if DATABASE_URL is set, otherwise use memory storage
export const storage = process.env.DATABASE_URL ? new DbStorage() : new MemStorage();
