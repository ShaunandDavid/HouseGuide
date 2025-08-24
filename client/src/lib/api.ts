import type {
  Guide, House, Resident, FileRecord, Report, Goal, Checklist, Chore, 
  Accomplishment, Incident, Meeting, ProgramFee, Note, WeeklyReport,
  InsertGuide, InsertHouse, InsertResident, InsertFile, InsertReport,
  InsertGoal, InsertChecklist, InsertChore, InsertAccomplishment,
  InsertIncident, InsertMeeting, InsertProgramFee, InsertNote, InsertWeeklyReport
} from "@shared/schema";

// Configuration
const API_BASE = "/api";

// Helper function for making API requests
async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include", // Include cookies for authentication
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Network error" }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  // Handle no-content responses
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// Auth
export async function login(email: string, password: string) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function register(email: string, password: string, name: string, houseName: string) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name, houseName }),
  });
}

export async function logout() {
  return apiRequest("/auth/logout", {
    method: "POST",
  });
}

export async function whoami() {
  return apiRequest("/whoami");
}

export function getCurrentUser() {
  const user = localStorage.getItem('current-user');
  return user ? JSON.parse(user) : null;
}

export function setCurrentUser(user: Guide) {
  localStorage.setItem('current-user', JSON.stringify(user));
}

// Houses
export async function getHouseByName(idOrName: string): Promise<House> {
  return apiRequest(`/houses/${idOrName}`);
}

// Residents
export async function getResidentsByHouse(houseId: string): Promise<Resident[]> {
  return apiRequest(`/residents/by-house/${houseId}`);
}

export async function getResident(id: string): Promise<Resident> {
  return apiRequest(`/residents/${id}`);
}

export async function createResident(data: InsertResident): Promise<Resident> {
  return apiRequest('/residents', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateResident(id: string, data: Partial<InsertResident>): Promise<Resident> {
  return apiRequest(`/residents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// Files
export async function createFile(data: InsertFile): Promise<FileRecord> {
  return apiRequest('/files', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Multipart file upload (preferred method)
export async function uploadFile(file: File, residentId: string, houseId: string, type?: string, ocrText?: string): Promise<{ file: FileRecord; uploadedFile: any }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('residentId', residentId);
  formData.append('houseId', houseId);
  if (type) formData.append('type', type);
  if (ocrText) formData.append('ocrText', ocrText);

  // Use fetch directly for FormData to avoid setting Content-Type header
  const response = await fetch('/api/files/upload', {
    method: 'POST',
    credentials: 'include', // Include cookies for authentication
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to upload file' }));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export async function getFilesByResident(residentId: string): Promise<FileRecord[]> {
  return apiRequest(`/files/by-resident/${residentId}`);
}

// Reports
export async function createOrUpdateReport(data: InsertReport): Promise<Report> {
  return apiRequest('/reports', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getReport(residentId: string, weekStart: string): Promise<Report | null> {
  try {
    return await apiRequest(`/reports/${residentId}/${weekStart}`);
  } catch {
    return null;
  }
}

// Goals
export async function getGoalsByResident(residentId: string): Promise<Goal[]> {
  return apiRequest(`/goals/by-resident/${residentId}`);
}

export async function createGoal(data: InsertGoal): Promise<Goal> {
  return apiRequest('/goals', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateGoal(id: string, data: Partial<InsertGoal>): Promise<Goal> {
  return apiRequest(`/goals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteGoal(id: string): Promise<void> {
  return apiRequest(`/goals/${id}`, {
    method: 'DELETE',
  });
}

// Checklists
export async function getChecklistByResident(residentId: string): Promise<Checklist | null> {
  try {
    return await apiRequest(`/checklists/by-resident/${residentId}`);
  } catch {
    return null;
  }
}

export async function createOrUpdateChecklist(data: InsertChecklist): Promise<Checklist> {
  return apiRequest('/checklists', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Chores
export async function getChoresByResident(residentId: string): Promise<Chore[]> {
  return apiRequest(`/chores/by-resident/${residentId}`);
}

export async function createChore(data: InsertChore): Promise<Chore> {
  return apiRequest('/chores', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateChore(id: string, data: Partial<InsertChore>): Promise<Chore> {
  return apiRequest(`/chores/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteChore(id: string): Promise<void> {
  return apiRequest(`/chores/${id}`, {
    method: 'DELETE',
  });
}

// Accomplishments
export async function getAccomplishmentsByResident(residentId: string): Promise<Accomplishment[]> {
  return apiRequest(`/accomplishments/by-resident/${residentId}`);
}

export async function createAccomplishment(data: InsertAccomplishment): Promise<Accomplishment> {
  return apiRequest('/accomplishments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAccomplishment(id: string, data: Partial<InsertAccomplishment>): Promise<Accomplishment> {
  return apiRequest(`/accomplishments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteAccomplishment(id: string): Promise<void> {
  return apiRequest(`/accomplishments/${id}`, {
    method: 'DELETE',
  });
}

// Incidents
export async function getIncidentsByResident(residentId: string): Promise<Incident[]> {
  return apiRequest(`/incidents/by-resident/${residentId}`);
}

export async function createIncident(data: InsertIncident): Promise<Incident> {
  return apiRequest('/incidents', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateIncident(id: string, data: Partial<InsertIncident>): Promise<Incident> {
  return apiRequest(`/incidents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteIncident(id: string): Promise<void> {
  return apiRequest(`/incidents/${id}`, {
    method: 'DELETE',
  });
}

// Meetings
export async function getMeetingsByResident(residentId: string): Promise<Meeting[]> {
  return apiRequest(`/meetings/by-resident/${residentId}`);
}

export async function createMeeting(data: InsertMeeting): Promise<Meeting> {
  return apiRequest('/meetings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateMeeting(id: string, data: Partial<InsertMeeting>): Promise<Meeting> {
  return apiRequest(`/meetings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteMeeting(id: string): Promise<void> {
  return apiRequest(`/meetings/${id}`, {
    method: 'DELETE',
  });
}

// Program Fees
export async function getFeesByResident(residentId: string): Promise<ProgramFee[]> {
  return apiRequest(`/fees/by-resident/${residentId}`);
}

export async function createFee(data: InsertProgramFee): Promise<ProgramFee> {
  return apiRequest('/fees', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateFee(id: string, data: Partial<InsertProgramFee>): Promise<ProgramFee> {
  return apiRequest(`/fees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteFee(id: string): Promise<void> {
  return apiRequest(`/fees/${id}`, {
    method: 'DELETE',
  });
}

// Notes
export async function createNote(data: InsertNote): Promise<Note> {
  return apiRequest('/notes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getNotesByResident(residentId: string): Promise<Note[]> {
  return apiRequest(`/notes/by-resident/${residentId}`);
}

// Weekly Reports with AI
export async function generateWeeklyReport(residentId: string, weekStart: string, weekEnd: string): Promise<{ draft: string; weekData: any }> {
  return apiRequest('/reports/weekly/generate', {
    method: 'POST',
    body: JSON.stringify({ residentId, weekStart, weekEnd }),
  });
}

export async function createWeeklyReport(data: InsertWeeklyReport): Promise<WeeklyReport> {
  return apiRequest('/reports/weekly', {
    method: 'POST', 
    body: JSON.stringify(data),
  });
}

export async function getWeeklyReportsByResident(residentId: string, from?: string, to?: string): Promise<WeeklyReport[]> {
  const params = new URLSearchParams();
  if (from) params.append('from', from);
  if (to) params.append('to', to);
  
  return apiRequest(`/reports/weekly/by-resident/${residentId}?${params.toString()}`);
}

export async function getAIStatus(): Promise<{ available: boolean; provider: string }> {
  return apiRequest('/ai/status');
}

// House comprehensive report
export async function generateComprehensiveHouseReport(weekStart: string, weekEnd: string): Promise<{
  comprehensiveReport: string;
  house: House;
  totalResidents: number;
  residentReports: Array<{
    resident: Resident;
    summary: {
      incidents: number;
      meetings: number;
      accomplishments: number;
      outstandingFees: number;
    };
  }>;
}> {
  return apiRequest('/reports/house/comprehensive', {
    method: 'POST',
    body: JSON.stringify({ weekStart, weekEnd }),
  });
}

// Re-export types for convenience
export type {
  Guide, House, Resident, FileRecord, Report, Goal, Checklist, Chore, 
  Accomplishment, Incident, Meeting, ProgramFee, Note, WeeklyReport,
  InsertGuide, InsertHouse, InsertResident, InsertFile, InsertReport,
  InsertGoal, InsertChecklist, InsertChore, InsertAccomplishment,
  InsertIncident, InsertMeeting, InsertProgramFee, InsertNote, InsertWeeklyReport
} from "@shared/schema";