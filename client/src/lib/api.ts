import type { 
  Guide, House, Resident, FileRecord, Note, Report,
  Goal, Checklist, Chore, Accomplishment, Incident, Meeting, ProgramFee,
  InsertGuide, InsertHouse, InsertResident, InsertFile, InsertNote, InsertReport,
  InsertGoal, InsertChecklist, InsertChore, InsertAccomplishment, InsertIncident, InsertMeeting, InsertProgramFee
} from '@shared/schema';

const API_BASE = '/api';

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include', // Include httpOnly cookies automatically
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Authentication
export async function login(email: string, password: string): Promise<{ user: Guide; success: boolean }> {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<void> {
  // Clear httpOnly auth cookie on server
  await apiRequest('/auth/logout', {
    method: 'POST',
  });
  // Clear any stored user data
  localStorage.removeItem('current-user');
}

export function getCurrentUser(): Guide | null {
  const userStr = localStorage.getItem('current-user');
  try {
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    // Clear corrupted user data and return null
    localStorage.removeItem('current-user');
    return null;
  }
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