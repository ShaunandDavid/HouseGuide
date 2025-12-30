import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getWeeklyReportsByResident } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { WeeklyReport } from "@shared/schema";

interface WeeklyReportsArchiveProps {
  residentId: string;
  residentName: string;
  onGenerate: () => void;
}

export function WeeklyReportsArchive({ residentId, residentName, onGenerate }: WeeklyReportsArchiveProps) {
  const [activeReport, setActiveReport] = useState<WeeklyReport | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["/api/reports/weekly/by-resident", residentId],
    queryFn: () => getWeeklyReportsByResident(residentId),
  });

  const sortedReports = useMemo(() => {
    return [...reports].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }, [reports]);

  const formatDate = (value?: string) => {
    if (!value) return "Unknown";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return format(parsed, "MMM dd, yyyy");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Weekly Report Archive</h2>
          <p className="text-sm text-gray-600">
            Saved reports for {residentName}
          </p>
        </div>
        <Button onClick={onGenerate}>Generate New Report</Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-gray-500">
            Loading reports...
          </CardContent>
        </Card>
      ) : sortedReports.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-gray-500">
            No weekly reports saved yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedReports.map((report) => (
            <Card key={report.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex flex-wrap items-center gap-2">
                  {report.title || `Weekly Report (${report.weekStart} - ${report.weekEnd})`}
                  <Badge variant="outline">
                    {formatDate(report.weekStart)} - {formatDate(report.weekEnd)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-600">
                  Saved: {formatDate(report.created)}
                </div>
                <Button variant="outline" onClick={() => setActiveReport(report)}>
                  View Report
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!activeReport} onOpenChange={(open) => !open && setActiveReport(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{activeReport?.title || "Weekly Report"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {formatDate(activeReport?.weekStart)} - {formatDate(activeReport?.weekEnd)}
              </Badge>
              <Badge variant="outline">
                Saved: {formatDate(activeReport?.created)}
              </Badge>
            </div>
            <div className="whitespace-pre-wrap rounded-lg border bg-white p-4 text-sm text-gray-800">
              {activeReport?.body}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
