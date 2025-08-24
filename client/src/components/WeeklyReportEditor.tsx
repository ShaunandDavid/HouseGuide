import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { generateWeeklyReport, createWeeklyReport, getAIStatus, getWeeklyReportsByResident } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wand2, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { MicInput } from '@/components/MicInput';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Resident, WeeklyReport } from '@shared/schema';

interface WeeklyReportEditorProps {
  resident: Resident;
  onClose?: () => void;
}

export function WeeklyReportEditor({ resident, onClose }: WeeklyReportEditorProps) {
  const [weekStart, setWeekStart] = useState('');
  const [weekEnd, setWeekEnd] = useState('');
  const [reportText, setReportText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationData, setGenerationData] = useState<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current week by default
  useEffect(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // End of week (Saturday)
    
    setWeekStart(startOfWeek.toISOString().split('T')[0]);
    setWeekEnd(endOfWeek.toISOString().split('T')[0]);
  }, []);

  // Check AI provider status
  const { data: aiStatus } = useQuery({
    queryKey: ['/api/ai/status'],
    queryFn: getAIStatus,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get existing reports for this resident
  const { data: existingReports } = useQuery({
    queryKey: ['/api/reports/weekly/by-resident', resident.id],
    queryFn: () => getWeeklyReportsByResident(resident.id),
  });

  // Generate AI report mutation
  const generateMutation = useMutation({
    mutationFn: () => generateWeeklyReport(resident.id, weekStart, weekEnd),
    onSuccess: (data) => {
      setReportText(data.draft);
      setGenerationData(data.weekData);
      setIsGenerating(false);
      toast({
        title: 'Report Generated',
        description: 'AI has generated your weekly report draft. Review and edit as needed.',
      });
    },
    onError: (error) => {
      setIsGenerating(false);
      console.error('Generate report error:', error);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate report with AI',
        variant: 'destructive',
      });
    },
  });

  // Save report mutation
  const saveMutation = useMutation({
    mutationFn: (data: { title: string; content: string; weekStart: string; weekEnd: string }) =>
      createWeeklyReport({
        residentId: resident.id,
        title: data.title,
        content: data.content,
        weekStart: data.weekStart,
        weekEnd: data.weekEnd,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reports/weekly/by-resident', resident.id] });
      toast({
        title: 'Report Saved',
        description: 'Weekly report has been saved successfully.',
      });
      if (onClose) onClose();
    },
    onError: (error) => {
      console.error('Save report error:', error);
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Failed to save report',
        variant: 'destructive',
      });
    },
  });

  const handleGenerate = async () => {
    if (!weekStart || !weekEnd) {
      toast({
        title: 'Dates Required',
        description: 'Please select both start and end dates for the report period.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    generateMutation.mutate();
  };

  const handleSave = () => {
    if (!reportText.trim() || !weekStart || !weekEnd) {
      toast({
        title: 'Missing Information',
        description: 'Please ensure all fields are filled before saving.',
        variant: 'destructive',
      });
      return;
    }

    const title = `Weekly Report - ${resident.firstName} ${resident.lastInitial} (${weekStart} to ${weekEnd})`;
    saveMutation.mutate({
      title,
      content: reportText,
      weekStart,
      weekEnd,
    });
  };

  // Check if report exists for this week
  const existingReport = existingReports?.find(
    report => report.weekStart === weekStart && report.weekEnd === weekEnd
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Weekly Report Generator
          </CardTitle>
          <CardDescription>
            Generate AI-powered weekly progress reports for {resident.firstName} {resident.lastInitial}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* AI Status */}
          <Alert>
            {aiStatus?.available ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              AI Provider: <Badge variant={aiStatus?.available ? 'default' : 'secondary'}>
                {aiStatus?.provider || 'None'} {aiStatus?.available ? '(Available)' : '(Unavailable)'}
              </Badge>
              {!aiStatus?.available && ' - Manual report entry only'}
            </AlertDescription>
          </Alert>

          {/* Date Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="week-start">Week Start</Label>
              <Input
                id="week-start"
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                data-testid="input-week-start"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="week-end">Week End</Label>
              <Input
                id="week-end"
                type="date"
                value={weekEnd}
                onChange={(e) => setWeekEnd(e.target.value)}
                data-testid="input-week-end"
              />
            </div>
          </div>

          {/* Existing Report Warning */}
          {existingReport && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                A report already exists for this week period. Saving will create a new report.
              </AlertDescription>
            </Alert>
          )}

          {/* Generation Data Summary */}
          {generationData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Data Used for Generation</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>Goals: {generationData.data.goals.length}</div>
                  <div>Chores: {generationData.data.chores.length}</div>
                  <div>Accomplishments: {generationData.data.accomplishments.length}</div>
                  <div>Incidents: {generationData.data.incidents.length}</div>
                  <div>Meetings: {generationData.data.meetings.length}</div>
                  <div>Notes: {generationData.data.notes.length}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !aiStatus?.available || !weekStart || !weekEnd}
              className="flex-1"
              data-testid="button-generate-report"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate AI Report
                </>
              )}
            </Button>
          </div>

          <Separator />

          {/* Report Editor */}
          <div className="space-y-2">
            <Label htmlFor="report-content">Report Content</Label>
            <div className="relative">
              <Textarea
                ref={textareaRef}
                id="report-content"
                placeholder={aiStatus?.available 
                  ? "Click 'Generate AI Report' to create a draft, or write your report manually..."
                  : "Write your weekly report manually..."
                }
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                rows={20}
                className="font-mono text-sm pr-12"
                data-testid="textarea-report-content"
              />
              <div className="absolute top-2 right-2">
                <MicInput
                  targetRef={textareaRef}
                  onInsertText={(text, cursorPosition) => {
                    if (textareaRef.current) {
                      const textarea = textareaRef.current;
                      const currentValue = textarea.value;
                      const insertPosition = cursorPosition ?? textarea.selectionStart ?? currentValue.length;
                      
                      const newValue = 
                        currentValue.slice(0, insertPosition) + 
                        (insertPosition > 0 && !currentValue[insertPosition - 1]?.match(/\s/) ? ' ' : '') +
                        text + 
                        (insertPosition < currentValue.length && !currentValue[insertPosition]?.match(/\s/) ? ' ' : '') +
                        currentValue.slice(insertPosition);
                      
                      setReportText(newValue);
                    }
                  }}
                  size="sm"
                  variant="ghost"
                />
              </div>
            </div>
          </div>

          {/* Save Actions */}
          <div className="flex gap-2 justify-end">
            {onClose && (
              <Button variant="outline" onClick={onClose} data-testid="button-cancel">
                Cancel
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={!reportText.trim() || saveMutation.isPending}
              data-testid="button-save-report"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Report
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}