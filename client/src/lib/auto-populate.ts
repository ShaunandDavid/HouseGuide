// Auto-populate trackers from OCR text
import { createGoal, createChore, createIncident, createMeeting, createAccomplishment } from '@/lib/api';

interface TrackerEntry {
  type: 'goal' | 'chore' | 'incident' | 'meeting' | 'accomplishment';
  data: any;
}

// Keywords for different tracker types
const TRACKER_KEYWORDS = {
  goal: ['goal', 'objective', 'target', 'achieve', 'complete', 'finish', 'work on', 'improve'],
  chore: ['chore', 'clean', 'wash', 'sweep', 'mop', 'vacuum', 'take out', 'organize', 'tidy'],
  incident: ['incident', 'violation', 'warning', 'disciplinary', 'behavior', 'fight', 'conflict', 'inappropriate'],
  meeting: ['meeting', 'group', 'therapy', 'session', 'counseling', 'aa', 'na', 'sponsor', 'appointment'],
  accomplishment: ['completed', 'achieved', 'successful', 'finished', 'passed', 'graduated', 'earned']
};

export function parseOCRForTrackers(ocrText: string): TrackerEntry[] {
  const entries: TrackerEntry[] = [];
  const lines = ocrText.toLowerCase().split('\n').filter(line => line.trim().length > 0);
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip very short lines (likely noise)
    if (trimmedLine.length < 10) continue;
    
    // Check for goals
    if (TRACKER_KEYWORDS.goal.some(keyword => trimmedLine.includes(keyword))) {
      entries.push({
        type: 'goal',
        data: {
          title: extractTitle(trimmedLine, TRACKER_KEYWORDS.goal),
          description: trimmedLine,
          priority: 'medium',
          status: 'not_started'
        }
      });
    }
    
    // Check for chores
    else if (TRACKER_KEYWORDS.chore.some(keyword => trimmedLine.includes(keyword))) {
      entries.push({
        type: 'chore',
        data: {
          choreName: extractTitle(trimmedLine, TRACKER_KEYWORDS.chore),
          assignedDate: new Date().toISOString().split('T')[0],
          status: 'assigned',
          notes: trimmedLine
        }
      });
    }
    
    // Check for incidents
    else if (TRACKER_KEYWORDS.incident.some(keyword => trimmedLine.includes(keyword))) {
      entries.push({
        type: 'incident',
        data: {
          incidentType: 'behavioral',
          description: trimmedLine,
          dateOccurred: new Date().toISOString().split('T')[0],
          severity: 'medium'
        }
      });
    }
    
    // Check for meetings
    else if (TRACKER_KEYWORDS.meeting.some(keyword => trimmedLine.includes(keyword))) {
      entries.push({
        type: 'meeting',
        data: {
          meetingType: extractMeetingType(trimmedLine),
          dateAttended: new Date().toISOString().split('T')[0],
          notes: trimmedLine
        }
      });
    }
    
    // Check for accomplishments
    else if (TRACKER_KEYWORDS.accomplishment.some(keyword => trimmedLine.includes(keyword))) {
      entries.push({
        type: 'accomplishment',
        data: {
          title: extractTitle(trimmedLine, TRACKER_KEYWORDS.accomplishment),
          description: trimmedLine,
          dateAchieved: new Date().toISOString().split('T')[0]
        }
      });
    }
  }
  
  return entries;
}

function extractTitle(text: string, keywords: string[]): string {
  // Find the keyword and extract the relevant part as title
  for (const keyword of keywords) {
    const index = text.indexOf(keyword);
    if (index !== -1) {
      // Take text after keyword, limit to 50 chars
      const afterKeyword = text.substring(index + keyword.length).trim();
      return afterKeyword.substring(0, 50).trim() || `${keyword} from document`;
    }
  }
  // Fallback: first 50 chars of the line
  return text.substring(0, 50).trim();
}

function extractMeetingType(text: string): string {
  if (text.includes('aa') || text.includes('alcoholics anonymous')) return 'AA Meeting';
  if (text.includes('na') || text.includes('narcotics anonymous')) return 'NA Meeting';
  if (text.includes('therapy') || text.includes('counseling')) return 'Therapy Session';
  if (text.includes('group')) return 'Group Meeting';
  if (text.includes('sponsor')) return 'Sponsor Meeting';
  return 'General Meeting';
}

export async function autoPopulateTrackers(
  ocrText: string, 
  residentId: string, 
  houseId: string, 
  createdBy: string
): Promise<{ created: number; entries: TrackerEntry[] }> {
  const entries = parseOCRForTrackers(ocrText);
  let created = 0;
  
  try {
    for (const entry of entries) {
      const baseData = {
        residentId,
        houseId,
        createdBy,
        ...entry.data
      };
      
      switch (entry.type) {
        case 'goal':
          await createGoal(baseData);
          created++;
          break;
        case 'chore':
          await createChore(baseData);
          created++;
          break;
        case 'incident':
          await createIncident(baseData);
          created++;
          break;
        case 'meeting':
          await createMeeting(baseData);
          created++;
          break;
        case 'accomplishment':
          await createAccomplishment(baseData);
          created++;
          break;
      }
    }
  } catch (error) {
    console.error('Error auto-populating trackers:', error);
  }
  
  return { created, entries };
}