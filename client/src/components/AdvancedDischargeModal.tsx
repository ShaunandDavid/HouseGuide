import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Shield, FileText, User, Clock, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Resident } from "@shared/schema";

interface AdvancedDischargeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resident: Resident;
  onUpdate: () => void;
  dataFootprint: {
    files: number;
    notes: number;
    reports: number;
    goals: number;
    chores: number;
    incidents: number;
    meetings: number;
    accomplishments: number;
  };
}

type DischargeLevel = "graduation" | "transfer" | "pii_redaction" | "complete_removal";

export function AdvancedDischargeModal({ 
  open, 
  onOpenChange, 
  resident, 
  onUpdate,
  dataFootprint 
}: AdvancedDischargeModalProps) {
  const [dischargeLevel, setDischargeLevel] = useState<DischargeLevel>("graduation");
  const [reason, setReason] = useState("");
  const [managerApproval, setManagerApproval] = useState(false);
  const [dataExport, setDataExport] = useState(false);
  const [confirmUnderstanding, setConfirmUnderstanding] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const dischargeOptions = {
    graduation: {
      title: "🎓 Program Graduation",
      description: "Resident completed program successfully",
      dataAction: "All data retained for compliance and reporting",
      reversible: true,
      severity: "safe",
      requiresApproval: false
    },
    transfer: {
      title: "📤 Transfer/Inactive", 
      description: "Resident transferred to another facility",
      dataAction: "All data archived, accessible for 2 years",
      reversible: true,
      severity: "safe",
      requiresApproval: false
    },
    pii_redaction: {
      title: "🔒 PII Redaction",
      description: "Remove personal identifiers, keep anonymous data",
      dataAction: "Name/identifiers anonymized, behavioral data retained",
      reversible: false,
      severity: "moderate",
      requiresApproval: true
    },
    complete_removal: {
      title: "🗑️ Complete Removal",
      description: "Full deletion of all resident records",
      dataAction: "ALL data permanently deleted (audit trail preserved)",
      reversible: false,
      severity: "critical",
      requiresApproval: true
    }
  };

  const option = dischargeOptions[dischargeLevel];
  const totalRecords = Object.values(dataFootprint).reduce((sum, count) => sum + count, 0);

  const handleDischarge = async () => {
    if (!reason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for discharge.",
        variant: "destructive"
      });
      return;
    }

    if (option.requiresApproval && !managerApproval) {
      toast({
        title: "Manager Approval Required",
        description: `${option.title} requires manager approval confirmation.`,
        variant: "destructive"
      });
      return;
    }

    if (!confirmUnderstanding) {
      toast({
        title: "Confirmation Required",
        description: "Please confirm you understand the consequences of this action.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Call discharge API with level and options
      const response = await fetch(`/api/residents/${resident.id}/discharge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          dischargeLevel,
          reason: reason.trim(),
          managerApproval,
          dataExport,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Discharge failed');
      }

      toast({
        title: "Discharge Processed",
        description: `${resident.firstName} ${resident.lastInitial}. has been ${dischargeLevel === 'graduation' ? 'graduated' : 'discharged'}.`,
      });

      onUpdate();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Discharge Failed",
        description: "Failed to process discharge. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="advanced-discharge-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Safe Discharge - {resident.firstName} {resident.lastInitial}.
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Data Footprint Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Current Data Footprint
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <Badge variant="outline">{dataFootprint.files} Files</Badge>
                <Badge variant="outline">{dataFootprint.notes} Notes</Badge>
                <Badge variant="outline">{dataFootprint.reports} Reports</Badge>
                <Badge variant="outline">{dataFootprint.goals} Goals</Badge>
                <Badge variant="outline">{dataFootprint.chores} Chores</Badge>
                <Badge variant="outline">{dataFootprint.incidents} Incidents</Badge>
                <Badge variant="outline">{dataFootprint.meetings} Meetings</Badge>
                <Badge variant="outline">{dataFootprint.accomplishments} Achievements</Badge>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Total: <strong>{totalRecords} records</strong> across 8 data categories
              </p>
            </CardContent>
          </Card>

          {/* Discharge Level Selection */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Select Discharge Method</Label>
            <RadioGroup value={dischargeLevel} onValueChange={(value) => setDischargeLevel(value as DischargeLevel)}>
              {Object.entries(dischargeOptions).map(([key, opt]) => (
                <Card key={key} className={`cursor-pointer transition-colors ${
                  dischargeLevel === key ? 'ring-2 ring-primary' : 'hover:bg-gray-50'
                }`} onClick={() => setDischargeLevel(key as DischargeLevel)}>
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem value={key} id={key} className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor={key} className="cursor-pointer">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{opt.title}</span>
                            <Badge variant={
                              opt.severity === 'safe' ? 'default' :
                              opt.severity === 'moderate' ? 'secondary' : 'destructive'
                            } className="text-xs">
                              {opt.severity.toUpperCase()}
                            </Badge>
                            {!opt.reversible && <AlertTriangle className="w-3 h-3 text-red-500" />}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{opt.description}</p>
                          <p className="text-xs text-gray-500">
                            <strong>Data Action:</strong> {opt.dataAction}
                          </p>
                          {opt.requiresApproval && (
                            <p className="text-xs text-red-600 mt-1">⚠️ Requires manager approval</p>
                          )}
                        </Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </RadioGroup>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Discharge Reason *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide detailed reason for discharge..."
              rows={3}
              data-testid="discharge-reason"
            />
          </div>

          {/* Additional Options */}
          <div className="space-y-3">
            {dataExport && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="data-export"
                  checked={dataExport}
                  onCheckedChange={(checked) => setDataExport(checked as boolean)}
                />
                <Label htmlFor="data-export" className="text-sm flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Export resident data before processing
                </Label>
              </div>
            )}

            {option.requiresApproval && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="manager-approval"
                  checked={managerApproval}
                  onCheckedChange={(checked) => setManagerApproval(checked as boolean)}
                />
                <Label htmlFor="manager-approval" className="text-sm">
                  I have manager approval for this {option.severity} discharge action
                </Label>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="understand"
                checked={confirmUnderstanding}
                onCheckedChange={(checked) => setConfirmUnderstanding(checked as boolean)}
              />
              <Label htmlFor="understand" className="text-sm">
                I understand this action is {option.reversible ? 'reversible' : 'PERMANENT and irreversible'}
              </Label>
            </div>
          </div>

          {/* Warning for Critical Actions */}
          {option.severity === 'critical' && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Critical Action Warning</p>
                    <p className="text-xs text-red-700 mt-1">
                      This will permanently delete {totalRecords} records including files, notes, 
                      reports, and all resident history. Only audit logs will be preserved.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="space-x-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDischarge}
            disabled={isProcessing || !reason.trim() || !confirmUnderstanding}
            variant={option.severity === 'critical' ? 'destructive' : 'default'}
            data-testid="process-discharge"
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 animate-spin" />
                Processing...
              </div>
            ) : (
              `Process ${option.title}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}