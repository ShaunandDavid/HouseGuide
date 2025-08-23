import PocketBase from 'pocketbase';
import type { Guide, House, Resident, FileRecord, Note, Report } from '@shared/schema';

const PB_URL = import.meta.env.VITE_PB_URL || 'http://localhost:8000';

export const pb = new PocketBase(PB_URL);

// Authentication
export async function ensureAuth(email: string, password: string): Promise<Guide> {
  if (pb.authStore.isValid) {
    return pb.authStore.model as Guide;
  }
  
  const authData = await pb.collection('guides').authWithPassword(email, password);
  return authData.record as Guide;
}

export function logout() {
  pb.authStore.clear();
}

export function getCurrentUser(): Guide | null {
  return pb.authStore.model as Guide | null;
}

// Houses
export async function getHouseByName(name: string): Promise<House> {
  return await pb.collection('houses').getFirstListItem(`name = "${name}"`);
}

// Residents
export async function getResidentsByHouse(houseId: string): Promise<Resident[]> {
  return await pb.collection('residents').getFullList({
    filter: `house = "${houseId}"`,
    sort: 'firstName'
  });
}

export async function getResident(id: string): Promise<Resident> {
  return await pb.collection('residents').getOne(id);
}

// Files
export async function createFile(data: FormData): Promise<FileRecord> {
  return await pb.collection('files').create(data);
}

export async function getFilesByResident(residentId: string): Promise<FileRecord[]> {
  return await pb.collection('files').getFullList({
    filter: `resident = "${residentId}"`,
    sort: '-created'
  });
}

export function getFileUrl(file: FileRecord): string {
  return pb.files.getUrl(file, file.image);
}

// Reports
export async function createOrUpdateReport(data: Partial<Report>): Promise<Report> {
  try {
    // Try to find existing report for the week
    const existing = await pb.collection('reports').getFirstListItem(
      `resident = "${data.resident}" && weekStart = "${data.weekStart}"`
    );
    
    // Update existing report
    return await pb.collection('reports').update(existing.id, data);
  } catch {
    // Create new report if none exists
    return await pb.collection('reports').create(data);
  }
}

export async function getReport(residentId: string, weekStart: string): Promise<Report | null> {
  try {
    return await pb.collection('reports').getFirstListItem(
      `resident = "${residentId}" && weekStart = "${weekStart}"`
    );
  } catch {
    return null;
  }
}

// Notes
export async function createNote(data: Partial<Note>): Promise<Note> {
  return await pb.collection('notes').create(data);
}

export async function getNotesByResident(residentId: string): Promise<Note[]> {
  return await pb.collection('notes').getFullList({
    filter: `resident = "${residentId}"`,
    sort: '-created'
  });
}
