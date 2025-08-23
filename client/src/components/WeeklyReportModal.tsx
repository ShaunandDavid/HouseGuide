import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { X, Copy, Check, Users, Briefcase, ListChecks, Users as UsersIcon, Stethoscope } from "lucide-react";
import { generateWeeklyReport, getWeekStartDate, type ReportSections } from "@/lib/report";
import { createOrUpdateReport, getReport } from "@/lib/pocketbase";
import { useToast } from "@/hooks/use-toast";
import type { Resident } from "@shared/schema";

interface WeeklyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  resident: Resident | null;
}

export function WeeklyReportModal({ isOpen, onClose, resident }: WeeklyReportModalProps) {
  const [weekStart, setWeekStart] = useState(getWeekStartDate());
  const [sections, setSections] = useState<ReportSections>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();

  // Load existing report when modal opens or week changes
  useEffect(() => {
    if (isOpen && resident) {
      loadExistingReport();
    }
  }, [isOpen, resident, weekStart]);

  const loadExistingReport = async () => {
    if (!resident) return;
    
    setIsLoading(true);
    try {
      const existingReport = await getReport(resident.id, weekStart);
      if (existingReport) {
        setSections({
          s1_sponsor: existingReport.s1_sponsor || '',
          s2_work: existingReport.s2_work || '',
          s3_chores: existingReport.s3_chores || '',
          s4_demeanor: existingReport.s4_demeanor || '',
          s5_professional: existingReport.s5_professional || ''
        });
      } else {
        setSections({});
      }
    } catch (error) {
      console.error('Failed to load existing report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSectionChange = (section: keyof ReportSections, value: string) => {
    setSections(prev => ({ ...prev, [section]: value }));
  };

  const handleSaveDraft = async () => {
    if (!resident) return;

    setIsLoading(true);
    try {
      await createOrUpdateReport({
        resident: resident.id,
        weekStart,
        ...sections
      });
      
      toast({
        title: "Draft Saved",
        description: "Report draft has been saved successfully.",
      });
    } catch (error) {
      console.error('Failed to save draft:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save the draft. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyReport = async () => {
    if (!resident) return;

    const reportText = generateWeeklyReport(resident, weekStart, sections);
    
    try {
      await navigator.clipboard.writeText(reportText);
      setIsCopied(true);
      
      toast({
        title: "Report Copied",
        description: "Weekly report has been copied to clipboard.",
      });

      // Reset copy state after 2 seconds
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy report:', error);
      toast({
        title: "Copy Failed",
        description: "Failed to copy report to clipboard.",
        variant: "destructive"
      });
    }
  };

  const handleGenerateFinalReport = async () => {
    await handleSaveDraft();
    await handleCopyReport();
  };

  const handleClose = () => {
    setSections({});
    setIsCopied(false);
    onClose();
  };

  const formatWeekRange = (weekStartStr: string) => {
    const start = new Date(weekStartStr);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    
    return `Week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  if (!resident) return null;

  const formattedReport = generateWeeklyReport(resident, weekStart, sections);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="weekly-report-modal">
        <DialogHeader className="sticky top-0 bg-white pb-4 border-b">
          <DialogTitle className="flex items-center justify-between">
            Weekly Report
            <Button variant="ghost" size="sm" onClick={handleClose} data-testid="close-report-modal">
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Report Header */}
          <div className="p-4 bg-surface-50 rounded-lg" data-testid="report-header">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Report Details</h4>
              <span className="text-sm text-gray-600">{formatWeekRange(weekStart)}</span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Resident: <span className="font-medium">{resident.firstName} {resident.lastInitial}.</span>
              </p>
              <div>
                <Label htmlFor="week-start" className="text-xs text-gray-500">Week Start (Monday)</Label>
                <Input
                  id="week-start"
                  type="date"
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                  className="w-40 h-8 text-xs"
                  data-testid="week-start-input"
                />
              </div>
            </div>
          </div>

          {/* Report Sections */}
          <div className="space-y-6">
            {/* Section 1: Sponsor/Mentor */}
            <div>
              <Label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <Users className="w-4 h-4 text-blue-500 mr-2" />
                Sponsor/Mentor
              </Label>
              <Textarea
                value={sections.s1_sponsor || ''}
                onChange={(e) => handleSectionChange('s1_sponsor', e.target.value)}
                placeholder="Activities with sponsor, mentoring progress, step work..."
                className="h-20"
                data-testid="input-sponsor"
              />
            </div>

            {/* Section 2: Work/School */}
            <div>
              <Label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <Briefcase className="w-4 h-4 text-green-500 mr-2" />
                Work/School
              </Label>
              <Textarea
                value={sections.s2_work || ''}
                onChange={(e) => handleSectionChange('s2_work', e.target.value)}
                placeholder="Employment activities, job search progress, education..."
                className="h-20"
                data-testid="input-work"
              />
            </div>

            {/* Section 3: Chores/Compliance */}
            <div>
              <Label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <ListChecks className="w-4 h-4 text-purple-500 mr-2" />
                Chores/Compliance
              </Label>
              <Textarea
                value={sections.s3_chores || ''}
                onChange={(e) => handleSectionChange('s3_chores', e.target.value)}
                placeholder="House chores, rule compliance, responsibilities..."
                className="h-20"
                data-testid="input-chores"
              />
            </div>

            {/* Section 4: Demeanor/Participation */}
            <div>
              <Label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <UsersIcon className="w-4 h-4 text-orange-500 mr-2" />
                Demeanor / Participation
              </Label>
              <Textarea
                value={sections.s4_demeanor || ''}
                onChange={(e) => handleSectionChange('s4_demeanor', e.target.value)}
                placeholder="Attitude, group participation, social interactions..."
                className="h-20"
                data-testid="input-demeanor"
              />
            </div>

            {/* Section 5: Professional Help */}
            <div>
              <Label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <Stethoscope className="w-4 h-4 text-red-500 mr-2" />
                Professional Help / Appointments
              </Label>
              <Textarea
                value={sections.s5_professional || ''}
                onChange={(e) => handleSectionChange('s5_professional', e.target.value)}
                placeholder="Medical appointments, therapy sessions, counseling..."
                className="h-20"
                data-testid="input-professional"
              />
            </div>
          </div>

          {/* Report Preview */}
          <div className="p-4 bg-surface-50 rounded-lg" data-testid="report-preview">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900">Report Preview</h4>
              <Button 
                onClick={handleCopyReport}
                disabled={isLoading}
                className={`transition-colors ${isCopied ? 'bg-green-500 hover:bg-green-600' : ''}`}
                data-testid="copy-report-button"
              >
                {isCopied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Report
                  </>
                )}
              </Button>
            </div>
            <div 
              className="text-sm font-mono text-gray-700 whitespace-pre-line bg-white p-3 rounded border max-h-48 overflow-y-auto"
              data-testid="formatted-report"
            >
              {formattedReport}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button 
              variant="outline" 
              className="flex-1" 
              onClick={handleSaveDraft}
              disabled={isLoading}
              data-testid="save-draft-button"
            >
              Save Draft
            </Button>
            <Button 
              className="flex-1" 
              onClick={handleGenerateFinalReport}
              disabled={isLoading}
              data-testid="generate-final-report-button"
            >
              Generate Final Report
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
