import { eq, asc } from "drizzle-orm";
import { db } from "./db";
import { and } from "drizzle-orm";
import { 
  organizations, guides, houses, residents, files, reports, weeklyReports, goals, 
  checklists, chores, accomplishments, incidents, meetings, 
  programFees, notes, chatThreads, chatMessages, chatAttachments
} from "@shared/schema";
import type { IStorage } from "./storage";
import type { 
  Organization, Guide, House, Resident, FileRecord, Note, Report, WeeklyReport,
  Goal, Checklist, Chore, Accomplishment, Incident, Meeting, ProgramFee,
  ChatThread, ChatMessage, ChatAttachment,
  InsertOrganization, InsertGuide, InsertOrgUser, InsertHouse, InsertResident, InsertFile, InsertNote, UpdateNote, InsertReport, InsertWeeklyReport,
  InsertGoal, InsertChecklist, InsertChore, InsertAccomplishment, InsertIncident, InsertMeeting, InsertProgramFee,
  InsertChatThread, InsertChatMessage, InsertChatAttachment
} from "@shared/schema";
import { randomUUID } from "crypto";

export class DbStorage implements IStorage {
  // Organizations
  async getOrganization(id: string): Promise<Organization | undefined> {
    const result = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const org = result[0];
    return {
      ...org,
      created: org.created.toISOString(),
      updated: org.updated.toISOString(),
    } as Organization;
  }

  async getOrganizationByName(name: string): Promise<Organization | undefined> {
    const result = await db.select().from(organizations).where(eq(organizations.name, name)).limit(1);
    if (result.length === 0) return undefined;
    const org = result[0];
    return {
      ...org,
      created: org.created.toISOString(),
      updated: org.updated.toISOString(),
    } as Organization;
  }

  async createOrganization(insertOrg: InsertOrganization): Promise<Organization> {
    const result = await db.insert(organizations).values({
      name: insertOrg.name,
      defaultRules: insertOrg.defaultRules ?? null,
    }).returning();

    const org = result[0];
    return {
      ...org,
      created: org.created.toISOString(),
      updated: org.updated.toISOString(),
    } as Organization;
  }

  async updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization> {
    const result = await db.update(organizations)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(organizations.id, id))
      .returning();

    if (result.length === 0) throw new Error('Organization not found');
    const org = result[0];
    return {
      ...org,
      created: org.created.toISOString(),
      updated: org.updated.toISOString(),
    } as Organization;
  }

  async getOrganizations(): Promise<Organization[]> {
    const result = await db.select().from(organizations);
    return result.map(org => ({
      ...org,
      created: org.created.toISOString(),
      updated: org.updated.toISOString(),
    })) as Organization[];
  }

  // Guides
  async getGuide(id: string): Promise<Guide | undefined> {
    const result = await db.select().from(guides).where(eq(guides.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const guide = result[0];
    return {
      ...guide,
      created: guide.created.toISOString(),
      updated: guide.updated.toISOString(),
    } as Guide;
  }

  async getGuideByEmail(email: string): Promise<Guide | undefined> {
    const result = await db.select().from(guides).where(eq(guides.email, email.toLowerCase())).limit(1);
    if (result.length === 0) return undefined;
    const guide = result[0];
    return {
      ...guide,
      created: guide.created.toISOString(),
      updated: guide.updated.toISOString(),
    } as Guide;
  }

  async getGuideByVerificationToken(token: string): Promise<Guide | undefined> {
    const result = await db.select().from(guides).where(eq(guides.verificationToken, token)).limit(1);
    if (result.length === 0) return undefined;
    const guide = result[0];
    return {
      ...guide,
      created: guide.created.toISOString(),
      updated: guide.updated.toISOString(),
    } as Guide;
  }

  async createGuide(insertGuide: InsertGuide): Promise<Guide> {
    const verificationToken = randomUUID();

    const org = await this.createOrganization({ name: insertGuide.organizationName });
    const house = await this.createHouse({ name: insertGuide.houseName, orgId: org.id });

    const result = await db.insert(guides).values({
      email: insertGuide.email.toLowerCase(),
      name: insertGuide.name,
      password: insertGuide.password,
      houseName: insertGuide.houseName,
      houseId: house.id,
      orgId: org.id,
      role: "owner",
      isEmailVerified: false,
      verificationToken,
    }).returning();

    const guide = result[0];
    return {
      ...guide,
      created: guide.created.toISOString(),
      updated: guide.updated.toISOString(),
    } as Guide;
  }

  async createOrgUser(insertUser: InsertOrgUser): Promise<Guide> {
    const verificationToken = randomUUID();
    let houseId = insertUser.houseId;
    let houseName = insertUser.houseName;

    if (!houseId && insertUser.houseName) {
      const house = await this.createHouse({ name: insertUser.houseName, orgId: insertUser.orgId });
      houseId = house.id;
      houseName = house.name;
    }

    const result = await db.insert(guides).values({
      email: insertUser.email.toLowerCase(),
      name: insertUser.name,
      password: insertUser.password,
      houseName: houseName || "Unassigned",
      houseId,
      orgId: insertUser.orgId,
      role: insertUser.role,
      isEmailVerified: false,
      verificationToken,
    }).returning();

    const guide = result[0];
    return {
      ...guide,
      created: guide.created.toISOString(),
      updated: guide.updated.toISOString(),
    } as Guide;
  }

  async updateGuide(id: string, updates: Partial<Guide>): Promise<Guide> {
    const { created: _created, updated: _updated, ...safeUpdates } = updates as any;
    const result = await db.update(guides)
      .set({
        ...safeUpdates,
        updated: new Date(),
      })
      .where(eq(guides.id, id))
      .returning();
    
    if (result.length === 0) throw new Error('Guide not found');
    const guide = result[0];
    return {
      ...guide,
      created: guide.created.toISOString(),
      updated: guide.updated.toISOString(),
    } as Guide;
  }

  async getGuidesByOrg(orgId: string): Promise<Guide[]> {
    const result = await db.select().from(guides).where(eq(guides.orgId, orgId));
    return result.map(guide => ({
      ...guide,
      created: guide.created.toISOString(),
      updated: guide.updated.toISOString(),
    })) as Guide[];
  }
  
  // Houses
  async getHouse(id: string): Promise<House | undefined> {
    const result = await db.select().from(houses).where(eq(houses.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const house = result[0];
    return {
      ...house,
      created: house.created.toISOString(),
      updated: house.updated.toISOString(),
    } as House;
  }

  async getHouseByName(name: string): Promise<House | undefined> {
    const result = await db.select().from(houses).where(eq(houses.name, name)).limit(1);
    if (result.length === 0) return undefined;
    const house = result[0];
    return {
      ...house,
      created: house.created.toISOString(),
      updated: house.updated.toISOString(),
    } as House;
  }

  async createHouse(insertHouse: InsertHouse): Promise<House> {
    const result = await db.insert(houses).values({
      name: insertHouse.name,
      orgId: insertHouse.orgId ?? null,
      rules: insertHouse.rules ?? null,
    }).returning();
    
    const house = result[0];
    return {
      ...house,
      created: house.created.toISOString(),
      updated: house.updated.toISOString(),
    } as House;
  }

  async updateHouse(id: string, updates: Partial<InsertHouse>): Promise<House> {
    const result = await db.update(houses)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(houses.id, id))
      .returning();

    if (result.length === 0) throw new Error('House not found');
    const house = result[0];
    return {
      ...house,
      created: house.created.toISOString(),
      updated: house.updated.toISOString(),
    } as House;
  }

  async getAllHouses(): Promise<House[]> {
    const result = await db.select().from(houses);
    return result.map(house => ({
      ...house,
      created: house.created.toISOString(),
      updated: house.updated.toISOString(),
    })) as House[];
  }

  async getHousesByOrg(orgId: string): Promise<House[]> {
    const result = await db.select().from(houses).where(eq(houses.orgId, orgId));
    return result.map(house => ({
      ...house,
      created: house.created.toISOString(),
      updated: house.updated.toISOString(),
    })) as House[];
  }
  
  // Residents
  async getResident(id: string): Promise<Resident | undefined> {
    const result = await db.select().from(residents).where(eq(residents.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const resident = result[0];
    return {
      id: resident.id,
      house: resident.house,
      firstName: (resident as any).first_name || resident.firstName,
      lastInitial: (resident as any).last_initial || resident.lastInitial,
      status: resident.status,

      dischargeDate: (resident as any).discharge_date || resident.dischargeDate,
      dischargeReason: (resident as any).discharge_reason || resident.dischargeReason,
      created: resident.created.toISOString(),
      updated: resident.updated.toISOString(),
    } as Resident;
  }

  async getResidentsByHouse(houseId: string, limit?: number, offset?: number): Promise<Resident[]> {
    let query = db.select().from(residents).where(eq(residents.house, houseId));
    if (limit) query = query.limit(limit) as any;
    if (offset) query = query.offset(offset) as any;
    
    const result = await query;
    return result.map(resident => ({
      id: resident.id,
      house: resident.house,
      firstName: (resident as any).first_name || resident.firstName,
      lastInitial: (resident as any).last_initial || resident.lastInitial,
      status: resident.status,

      dischargeDate: (resident as any).discharge_date || resident.dischargeDate,
      dischargeReason: (resident as any).discharge_reason || resident.dischargeReason,
      created: resident.created.toISOString(),
      updated: resident.updated.toISOString(),
    })) as Resident[];
  }

  async createResident(insertResident: InsertResident): Promise<Resident> {
    const result = await db.insert(residents).values(insertResident).returning();
    const resident = result[0];
    return {
      id: resident.id,
      house: resident.house,
      firstName: (resident as any).first_name || resident.firstName,
      lastInitial: (resident as any).last_initial || resident.lastInitial,
      status: resident.status,

      dischargeDate: (resident as any).discharge_date || resident.dischargeDate,
      dischargeReason: (resident as any).discharge_reason || resident.dischargeReason,
      created: resident.created.toISOString(),
      updated: resident.updated.toISOString(),
    } as Resident;
  }

  async updateResident(id: string, updates: Partial<InsertResident>): Promise<Resident> {
    const result = await db.update(residents)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(residents.id, id))
      .returning();
    
    if (result.length === 0) throw new Error('Resident not found');
    const resident = result[0];
    return {
      id: resident.id,
      house: resident.house,
      firstName: (resident as any).first_name || resident.firstName,
      lastInitial: (resident as any).last_initial || resident.lastInitial,
      status: resident.status,

      dischargeDate: (resident as any).discharge_date || resident.dischargeDate,
      dischargeReason: (resident as any).discharge_reason || resident.dischargeReason,
      created: resident.created.toISOString(),
      updated: resident.updated.toISOString(),
    } as Resident;
  }

  async deleteResident(id: string): Promise<void> {
    await db.delete(residents).where(eq(residents.id, id));
  }
  
  // Files
  async getFile(id: string): Promise<FileRecord | undefined> {
    const result = await db.select().from(files).where(eq(files.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const file = result[0];
    return {
      ...file,
      created: file.created.toISOString(),
      updated: file.updated.toISOString(),
    } as FileRecord;
  }

  async getFilesByResident(residentId: string): Promise<FileRecord[]> {
    const result = await db.select().from(files).where(eq(files.residentId, residentId));
    return result.map(file => ({
      ...file,
      created: file.created.toISOString(),
      updated: file.updated.toISOString(),
    })) as FileRecord[];
  }

  async createFile(insertFile: InsertFile): Promise<FileRecord> {
    const result = await db.insert(files).values(insertFile).returning();
    const file = result[0];
    return {
      ...file,
      created: file.created.toISOString(),
      updated: file.updated.toISOString(),
    } as FileRecord;
  }

  async deleteFile(id: string): Promise<void> {
    await db.delete(files).where(eq(files.id, id));
  }
  
  // Reports
  async getReport(id: string): Promise<Report | undefined> {
    const result = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const report = result[0];
    return {
      ...report,
      created: report.created.toISOString(),
      updated: report.updated.toISOString(),
    } as Report;
  }

  async getReportByResidentAndWeek(residentId: string, weekStart: string): Promise<Report | undefined> {
    const result = await db.select().from(reports)
      .where(and(eq(reports.resident, residentId), eq(reports.weekStart, weekStart)))
      .limit(1);
    if (result.length === 0) return undefined;
    const report = result[0];
    return {
      ...report,
      created: report.created.toISOString(),
      updated: report.updated.toISOString(),
    } as Report;
  }

  async createReport(insertReport: InsertReport): Promise<Report> {
    const result = await db.insert(reports).values(insertReport).returning();
    const report = result[0];
    return {
      ...report,
      created: report.created.toISOString(),
      updated: report.updated.toISOString(),
    } as Report;
  }

  async updateReport(id: string, updates: Partial<InsertReport>): Promise<Report> {
    const result = await db.update(reports)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(reports.id, id))
      .returning();
    
    if (result.length === 0) throw new Error('Report not found');
    const report = result[0];
    return {
      ...report,
      created: report.created.toISOString(),
      updated: report.updated.toISOString(),
    } as Report;
  }
  
  // Goals
  async getGoal(id: string): Promise<Goal | undefined> {
    const result = await db.select().from(goals).where(eq(goals.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const goal = result[0];
    return {
      ...goal,
      created: goal.created.toISOString(),
      updated: goal.updated.toISOString(),
    } as Goal;
  }

  async getGoalsByResident(residentId: string): Promise<Goal[]> {
    const result = await db.select().from(goals).where(eq(goals.residentId, residentId));
    return result.map(goal => ({
      ...goal,
      created: goal.created.toISOString(),
      updated: goal.updated.toISOString(),
    })) as Goal[];
  }

  async createGoal(insertGoal: InsertGoal): Promise<Goal> {
    const result = await db.insert(goals).values(insertGoal).returning();
    const goal = result[0];
    return {
      ...goal,
      created: goal.created.toISOString(),
      updated: goal.updated.toISOString(),
    } as Goal;
  }

  async updateGoal(id: string, updates: Partial<InsertGoal>): Promise<Goal> {
    const result = await db.update(goals)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(goals.id, id))
      .returning();
    
    if (result.length === 0) throw new Error('Goal not found');
    const goal = result[0];
    return {
      ...goal,
      created: goal.created.toISOString(),
      updated: goal.updated.toISOString(),
    } as Goal;
  }

  async deleteGoal(id: string): Promise<void> {
    await db.delete(goals).where(eq(goals.id, id));
  }
  
  // Checklists
  async getChecklist(id: string): Promise<Checklist | undefined> {
    const result = await db.select().from(checklists).where(eq(checklists.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const checklist = result[0];
    return {
      ...checklist,
      created: checklist.created.toISOString(),
      updated: checklist.updated.toISOString(),
    } as Checklist;
  }

  async getChecklistByResident(residentId: string): Promise<Checklist | undefined> {
    const result = await db.select().from(checklists).where(eq(checklists.residentId, residentId)).limit(1);
    if (result.length === 0) return undefined;
    const checklist = result[0];
    return {
      ...checklist,
      created: checklist.created.toISOString(),
      updated: checklist.updated.toISOString(),
    } as Checklist;
  }

  async createChecklist(insertChecklist: InsertChecklist): Promise<Checklist> {
    const result = await db.insert(checklists).values(insertChecklist).returning();
    const checklist = result[0];
    return {
      ...checklist,
      created: checklist.created.toISOString(),
      updated: checklist.updated.toISOString(),
    } as Checklist;
  }

  async updateChecklist(id: string, updates: Partial<InsertChecklist>): Promise<Checklist> {
    const result = await db.update(checklists)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(checklists.id, id))
      .returning();
    
    if (result.length === 0) throw new Error('Checklist not found');
    const checklist = result[0];
    return {
      ...checklist,
      created: checklist.created.toISOString(),
      updated: checklist.updated.toISOString(),
    } as Checklist;
  }
  
  // Chores
  async getChore(id: string): Promise<Chore | undefined> {
    const result = await db.select().from(chores).where(eq(chores.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const chore = result[0];
    return {
      ...chore,
      created: chore.created.toISOString(),
      updated: chore.updated.toISOString(),
    } as Chore;
  }

  async getChoresByResident(residentId: string): Promise<Chore[]> {
    const result = await db.select().from(chores).where(eq(chores.residentId, residentId));
    return result.map(chore => ({
      ...chore,
      created: chore.created.toISOString(),
      updated: chore.updated.toISOString(),
    })) as Chore[];
  }

  async createChore(insertChore: InsertChore): Promise<Chore> {
    const result = await db.insert(chores).values(insertChore).returning();
    const chore = result[0];
    return {
      ...chore,
      created: chore.created.toISOString(),
      updated: chore.updated.toISOString(),
    } as Chore;
  }

  async updateChore(id: string, updates: Partial<InsertChore>): Promise<Chore> {
    const result = await db.update(chores)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(chores.id, id))
      .returning();
    
    if (result.length === 0) throw new Error('Chore not found');
    const chore = result[0];
    return {
      ...chore,
      created: chore.created.toISOString(),
      updated: chore.updated.toISOString(),
    } as Chore;
  }

  async deleteChore(id: string): Promise<void> {
    await db.delete(chores).where(eq(chores.id, id));
  }
  
  // Accomplishments
  async getAccomplishment(id: string): Promise<Accomplishment | undefined> {
    const result = await db.select().from(accomplishments).where(eq(accomplishments.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const accomplishment = result[0];
    return {
      ...accomplishment,
      created: accomplishment.created.toISOString(),
      updated: accomplishment.updated.toISOString(),
    } as Accomplishment;
  }

  async getAccomplishmentsByResident(residentId: string): Promise<Accomplishment[]> {
    const result = await db.select().from(accomplishments).where(eq(accomplishments.residentId, residentId));
    return result.map(accomplishment => ({
      ...accomplishment,
      created: accomplishment.created.toISOString(),
      updated: accomplishment.updated.toISOString(),
    })) as Accomplishment[];
  }

  async createAccomplishment(insertAccomplishment: InsertAccomplishment): Promise<Accomplishment> {
    const result = await db.insert(accomplishments).values(insertAccomplishment).returning();
    const accomplishment = result[0];
    return {
      ...accomplishment,
      created: accomplishment.created.toISOString(),
      updated: accomplishment.updated.toISOString(),
    } as Accomplishment;
  }

  async updateAccomplishment(id: string, updates: Partial<InsertAccomplishment>): Promise<Accomplishment> {
    const result = await db.update(accomplishments)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(accomplishments.id, id))
      .returning();
    
    if (result.length === 0) throw new Error('Accomplishment not found');
    const accomplishment = result[0];
    return {
      ...accomplishment,
      created: accomplishment.created.toISOString(),
      updated: accomplishment.updated.toISOString(),
    } as Accomplishment;
  }

  async deleteAccomplishment(id: string): Promise<void> {
    await db.delete(accomplishments).where(eq(accomplishments.id, id));
  }
  
  // Incidents
  async getIncident(id: string): Promise<Incident | undefined> {
    const result = await db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const incident = result[0];
    return {
      ...incident,
      created: incident.created.toISOString(),
      updated: incident.updated.toISOString(),
    } as Incident;
  }

  async getIncidentsByResident(residentId: string): Promise<Incident[]> {
    const result = await db.select().from(incidents).where(eq(incidents.residentId, residentId));
    return result.map(incident => ({
      ...incident,
      created: incident.created.toISOString(),
      updated: incident.updated.toISOString(),
    })) as Incident[];
  }

  async createIncident(insertIncident: InsertIncident): Promise<Incident> {
    const result = await db.insert(incidents).values(insertIncident).returning();
    const incident = result[0];
    return {
      ...incident,
      created: incident.created.toISOString(),
      updated: incident.updated.toISOString(),
    } as Incident;
  }

  async updateIncident(id: string, updates: Partial<InsertIncident>): Promise<Incident> {
    const result = await db.update(incidents)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(incidents.id, id))
      .returning();
    
    if (result.length === 0) throw new Error('Incident not found');
    const incident = result[0];
    return {
      ...incident,
      created: incident.created.toISOString(),
      updated: incident.updated.toISOString(),
    } as Incident;
  }

  async deleteIncident(id: string): Promise<void> {
    await db.delete(incidents).where(eq(incidents.id, id));
  }
  
  // Meetings
  async getMeeting(id: string): Promise<Meeting | undefined> {
    const result = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const meeting = result[0];
    return {
      ...meeting,
      created: meeting.created.toISOString(),
      updated: meeting.updated.toISOString(),
    } as Meeting;
  }

  async getMeetingsByResident(residentId: string): Promise<Meeting[]> {
    const result = await db.select().from(meetings).where(eq(meetings.residentId, residentId));
    return result.map(meeting => ({
      ...meeting,
      created: meeting.created.toISOString(),
      updated: meeting.updated.toISOString(),
    })) as Meeting[];
  }

  async createMeeting(insertMeeting: InsertMeeting): Promise<Meeting> {
    const result = await db.insert(meetings).values(insertMeeting).returning();
    const meeting = result[0];
    return {
      ...meeting,
      created: meeting.created.toISOString(),
      updated: meeting.updated.toISOString(),
    } as Meeting;
  }

  async updateMeeting(id: string, updates: Partial<InsertMeeting>): Promise<Meeting> {
    const result = await db.update(meetings)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(meetings.id, id))
      .returning();
    
    if (result.length === 0) throw new Error('Meeting not found');
    const meeting = result[0];
    return {
      ...meeting,
      created: meeting.created.toISOString(),
      updated: meeting.updated.toISOString(),
    } as Meeting;
  }

  async deleteMeeting(id: string): Promise<void> {
    await db.delete(meetings).where(eq(meetings.id, id));
  }
  
  // Program Fees
  async getProgramFee(id: string): Promise<ProgramFee | undefined> {
    const result = await db.select().from(programFees).where(eq(programFees.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const fee = result[0];
    return {
      ...fee,
      created: fee.created.toISOString(),
      updated: fee.updated.toISOString(),
    } as ProgramFee;
  }

  async getProgramFeesByResident(residentId: string): Promise<ProgramFee[]> {
    const result = await db.select().from(programFees).where(eq(programFees.residentId, residentId));
    return result.map(fee => ({
      ...fee,
      created: fee.created.toISOString(),
      updated: fee.updated.toISOString(),
    })) as ProgramFee[];
  }

  async createProgramFee(insertFee: InsertProgramFee): Promise<ProgramFee> {
    const result = await db.insert(programFees).values(insertFee).returning();
    const fee = result[0];
    return {
      ...fee,
      created: fee.created.toISOString(),
      updated: fee.updated.toISOString(),
    } as ProgramFee;
  }

  async updateProgramFee(id: string, updates: Partial<InsertProgramFee>): Promise<ProgramFee> {
    const result = await db.update(programFees)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(programFees.id, id))
      .returning();
    
    if (result.length === 0) throw new Error('Program fee not found');
    const fee = result[0];
    return {
      ...fee,
      created: fee.created.toISOString(),
      updated: fee.updated.toISOString(),
    } as ProgramFee;
  }

  async deleteProgramFee(id: string): Promise<void> {
    await db.delete(programFees).where(eq(programFees.id, id));
  }
  
  // Notes
  async getNote(id: string): Promise<Note | undefined> {
    const result = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const note = result[0];
    return {
      ...note,
      created: note.created.toISOString(),
      updated: note.updated.toISOString(),
    } as Note;
  }

  async getNotesByResident(residentId: string): Promise<Note[]> {
    const result = await db.select().from(notes).where(eq(notes.residentId, residentId));
    return result.map(note => ({
      ...note,
      created: note.created.toISOString(),
      updated: note.updated.toISOString(),
    })) as Note[];
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    const result = await db.insert(notes).values(insertNote).returning();
    const note = result[0];
    return {
      ...note,
      created: note.created.toISOString(),
      updated: note.updated.toISOString(),
    } as Note;
  }

  async updateNote(id: string, updates: UpdateNote): Promise<Note> {
    const result = await db.update(notes)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(notes.id, id))
      .returning();

    if (result.length === 0) throw new Error('Note not found');
    const note = result[0];
    return {
      ...note,
      created: note.created.toISOString(),
      updated: note.updated.toISOString(),
    } as Note;
  }

  // Weekly Reports (AI Generated) - DbStorage implementation
  async getWeeklyReport(id: string): Promise<WeeklyReport | undefined> {
    const result = await db.select().from(weeklyReports).where(eq(weeklyReports.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const report = result[0];
    return {
      ...report,
      created: report.created.toISOString(),
      updated: report.updated.toISOString(),
    } as WeeklyReport;
  }

  async getWeeklyReportsByResident(residentId: string, from?: string, to?: string): Promise<WeeklyReport[]> {
    let query = db.select().from(weeklyReports).where(eq(weeklyReports.residentId, residentId));
    
    // TODO: Add date filtering when needed
    // if (from) query = query.where(gte(weeklyReports.weekStart, from));
    // if (to) query = query.where(lte(weeklyReports.weekEnd, to));
    
    const result = await query;
    return result.map(report => ({
      ...report,
      created: report.created.toISOString(),
      updated: report.updated.toISOString(),
    })) as WeeklyReport[];
  }

  async createWeeklyReport(insertReport: InsertWeeklyReport): Promise<WeeklyReport> {
    const result = await db.insert(weeklyReports).values(insertReport).returning();
    const report = result[0];
    return {
      ...report,
      created: report.created.toISOString(),
      updated: report.updated.toISOString(),
    } as WeeklyReport;
  }

  async updateWeeklyReport(id: string, updates: Partial<InsertWeeklyReport>): Promise<WeeklyReport> {
    const result = await db.update(weeklyReports)
      .set({
        ...updates,
        updated: new Date(),
      })
      .where(eq(weeklyReports.id, id))
      .returning();
    
    if (result.length === 0) throw new Error('Weekly report not found');
    const report = result[0];
    return {
      ...report,
      created: report.created.toISOString(),
      updated: report.updated.toISOString(),
    } as WeeklyReport;
  }

  async deleteWeeklyReport(id: string): Promise<void> {
    await db.delete(weeklyReports).where(eq(weeklyReports.id, id));
  }

  // Chat
  async getChatThread(id: string): Promise<ChatThread | undefined> {
    const result = await db.select().from(chatThreads).where(eq(chatThreads.id, id)).limit(1);
    if (result.length === 0) return undefined;
    const thread = result[0];
    return {
      ...thread,
      created: thread.created.toISOString(),
      updated: thread.updated.toISOString(),
    } as ChatThread;
  }

  async getChatThreadsByOrg(orgId: string): Promise<ChatThread[]> {
    const result = await db.select().from(chatThreads).where(eq(chatThreads.orgId, orgId));
    return result.map(thread => ({
      ...thread,
      created: thread.created.toISOString(),
      updated: thread.updated.toISOString(),
    })) as ChatThread[];
  }

  async getChatThreadByHouse(orgId: string, houseId: string): Promise<ChatThread | undefined> {
    const result = await db.select().from(chatThreads)
      .where(and(eq(chatThreads.orgId, orgId), eq(chatThreads.houseId, houseId)))
      .limit(1);
    if (result.length === 0) return undefined;
    const thread = result[0];
    return {
      ...thread,
      created: thread.created.toISOString(),
      updated: thread.updated.toISOString(),
    } as ChatThread;
  }

  async createChatThread(thread: InsertChatThread): Promise<ChatThread> {
    const result = await db.insert(chatThreads).values({
      orgId: thread.orgId,
      houseId: thread.houseId ?? null,
      type: thread.type,
      name: thread.name,
      createdBy: thread.createdBy ?? null,
    }).returning();

    const record = result[0];
    return {
      ...record,
      created: record.created.toISOString(),
      updated: record.updated.toISOString(),
    } as ChatThread;
  }

  async getChatMessagesByThread(threadId: string, limit = 100, offset = 0): Promise<ChatMessage[]> {
    const result = await db.select().from(chatMessages)
      .where(eq(chatMessages.threadId, threadId))
      .orderBy(asc(chatMessages.created))
      .limit(limit)
      .offset(offset);
    return result.map(message => ({
      ...message,
      created: message.created.toISOString(),
      updated: message.updated.toISOString(),
    })) as ChatMessage[];
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const result = await db.insert(chatMessages).values({
      threadId: message.threadId,
      orgId: message.orgId,
      houseId: message.houseId ?? null,
      residentId: message.residentId ?? null,
      senderId: message.senderId,
      body: message.body,
      messageType: message.messageType,
    }).returning();

    const record = result[0];
    return {
      ...record,
      created: record.created.toISOString(),
      updated: record.updated.toISOString(),
    } as ChatMessage;
  }

  async createChatAttachment(attachment: InsertChatAttachment): Promise<ChatAttachment> {
    const result = await db.insert(chatAttachments).values({
      messageId: attachment.messageId,
      url: attachment.url,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size,
    }).returning();

    const record = result[0];
    return {
      ...record,
      created: record.created.toISOString(),
      updated: record.updated.toISOString(),
    } as ChatAttachment;
  }

  async getChatAttachmentsByMessage(messageId: string): Promise<ChatAttachment[]> {
    const result = await db.select().from(chatAttachments).where(eq(chatAttachments.messageId, messageId));
    return result.map(att => ({
      ...att,
      created: att.created.toISOString(),
      updated: att.updated.toISOString(),
    })) as ChatAttachment[];
  }
}
