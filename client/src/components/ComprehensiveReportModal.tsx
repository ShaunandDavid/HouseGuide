import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { generateComprehensiveHouseReport } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Copy, Check, AlertCircle, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ComprehensiveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ComprehensiveReportModal({ isOpen, onClose }: ComprehensiveReportModalProps) {
  const [weekStart, setWeekStart] = useState('');
  const [weekEnd, setWeekEnd] = useState('');
  const [reportData, setReportData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  
  const { toast } = useToast();

  // Get current week by default
  useEffect(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // End of week (Saturday)
    
    setWeekStart(startOfWeek.toISOString().split('T')[0]);
    setWeekEnd(endOfWeek.toISOString().split('T')[0]);
  }, [isOpen]);

  // Generate comprehensive report mutation
  const generateMutation = useMutation({
    mutationFn: () => generateComprehensiveHouseReport(weekStart, weekEnd),
    onSuccess: (data) => {
      setReportData(data);
      toast({
        title: 'Report Generated',
        description: 'Comprehensive house report has been generated successfully.',
      });
    },
    onError: (error) => {
      console.error('Generate comprehensive report error:', error);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate comprehensive report',
        variant: 'destructive',
      });
    },
  });

  const handleGenerate = () => {
    if (!weekStart || !weekEnd) {
      toast({
        title: 'Dates Required',
        description: 'Please select both start and end dates for the report period.',
        variant: 'destructive',
      });
      return;
    }

    generateMutation.mutate();
  };

  const handleCopyReport = async () => {
    if (!reportData?.comprehensiveReport) return;

    try {
      await navigator.clipboard.writeText(reportData.comprehensiveReport);
      setCopied(true);
      toast({
        title: 'Copied to Clipboard',
        description: 'The comprehensive report has been copied and is ready to paste.',
      });
      
      // Reset copy state after 3 seconds
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy report to clipboard. Please select and copy manually.',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = () => {
    if (!reportData?.comprehensiveReport) return;

    const blob = new Blob([reportData.comprehensiveReport], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `House_Report_${weekStart}_to_${weekEnd}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[95vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Comprehensive House Report Generator
              </h2>
              <p className="text-gray-600 mt-1">
                Generate a complete report for all active residents to send to the director
              </p>
            </div>
            <Button variant="outline" onClick={onClose} data-testid="button-close-modal">
              Close
            </Button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[80vh] space-y-6">
          {/* Date Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Report Period</CardTitle>
              <CardDescription>Select the week to generate the comprehensive report for</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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

              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || !weekStart || !weekEnd}
                className="w-full"
                data-testid="button-generate-report"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Report...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Comprehensive Report
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Report Summary */}
          {reportData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Report Summary</CardTitle>
                <CardDescription>
                  {reportData.house.name} • {weekStart} to {weekEnd}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{reportData.totalResidents}</div>
                    <div className="text-sm text-gray-600">Active Residents</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {reportData.residentReports.reduce((sum: number, r: any) => sum + r.summary.incidents, 0)}
                    </div>
                    <div className="text-sm text-gray-600">Total Incidents</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {reportData.residentReports.reduce((sum: number, r: any) => sum + r.summary.meetings, 0)}
                    </div>
                    <div className="text-sm text-gray-600">Meetings Attended</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-600">
                      ${reportData.residentReports.reduce((sum: number, r: any) => sum + r.summary.outstandingFees, 0).toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600">Outstanding Fees</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generated Report */}
          {reportData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  Generated Report
                  <div className="flex gap-2">
                    <Button
                      onClick={handleDownload}
                      variant="outline"
                      size="sm"
                      data-testid="button-download-report"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                    <Button
                      onClick={handleCopyReport}
                      variant="outline"
                      size="sm"
                      className={copied ? 'bg-green-50 border-green-200' : ''}
                      data-testid="button-copy-report"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 mr-2 text-green-600" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Report
                        </>
                      )}
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  Ready to copy and paste into your email or document for the director
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This report includes individual reports for all {reportData.totalResidents} active residents 
                    using your standard template format. Copy the text below to send to your director.
                  </AlertDescription>
                </Alert>
                
                <Textarea
                  value={reportData.comprehensiveReport}
                  readOnly
                  className="min-h-[400px] font-mono text-sm"
                  data-testid="textarea-comprehensive-report"
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}