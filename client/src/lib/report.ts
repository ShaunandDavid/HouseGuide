import type { Resident, Report } from '@shared/schema';

export interface ReportSections {
  s1_sponsor?: string;
  s2_work?: string;
  s3_chores?: string;
  s4_demeanor?: string;
  s5_professional?: string;
}

export function generateWeeklyReport(
  resident: Resident,
  weekStart: string,
  sections: ReportSections
): string {
  const formatSection = (content?: string) => content?.trim() || 'N/A';
  
  const weekDate = new Date(weekStart);
  const weekStr = isNaN(weekDate.getTime()) 
    ? weekStart 
    : weekDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
  
  return `Resident: ${resident.firstName} ${resident.lastInitial}.  Week of: ${weekStr}

__Sponsor/Mentor:__ ${formatSection(sections.s1_sponsor)}

__Work/School:__ ${formatSection(sections.s2_work)}

__Chores/Compliance:__ ${formatSection(sections.s3_chores)}

__Demeanor / Participation:__ ${formatSection(sections.s4_demeanor)}

__Professional Help / Appointments:__ ${formatSection(sections.s5_professional)}`;
}

export function getWeekStartDate(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}
