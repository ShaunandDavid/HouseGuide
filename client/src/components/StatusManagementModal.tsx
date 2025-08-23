import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { updateResident } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { Resident } from "@shared/schema";

interface StatusManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resident: Resident;
  onUpdate: () => void;
}

export function StatusManagementModal({ open, onOpenChange, resident, onUpdate }: StatusManagementModalProps) {
  const [status, setStatus] = useState<"active" | "inactive" | "graduated">(
    (resident.status as "active" | "inactive" | "graduated") || "active"
  );
  const [dischargeDate, setDischargeDate] = useState<Date | undefined>(
    resident.dischargeDate ? new Date(resident.dischargeDate) : undefined
  );
  const [dischargeReason, setDischargeReason] = useState(resident.dischargeReason || "");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const updateData: Partial<any> = {
        status,
      };

      // If status is not active, require discharge date
      if (status !== "active") {
        if (!dischargeDate) {
          toast({
            title: "Discharge Date Required",
            description: "Please select a discharge date for inactive or graduated residents.",
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }
        updateData.dischargeDate = dischargeDate.toISOString();
        updateData.dischargeReason = dischargeReason;
      } else {
        // Clear discharge data if setting back to active
        updateData.dischargeDate = null;
        updateData.dischargeReason = null;
      }

      await updateResident(resident.id, updateData);
      
      toast({
        title: "Status Updated",
        description: `Resident status changed to ${status}.`,
      });
      
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update resident status. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isDischarge = status !== "active";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="status-management-modal">
        <DialogHeader>
          <DialogTitle>Manage Resident Status</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(value: "active" | "inactive" | "graduated") => setStatus(value)}>
              <SelectTrigger data-testid="status-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="graduated">Graduated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isDischarge && (
            <>
              <div>
                <Label>Discharge Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dischargeDate && "text-muted-foreground"
                      )}
                      data-testid="discharge-date-picker"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dischargeDate ? format(dischargeDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dischargeDate}
                      onSelect={setDischargeDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label htmlFor="discharge-reason">Discharge Reason (Optional)</Label>
                <Textarea
                  id="discharge-reason"
                  placeholder="Enter reason for discharge..."
                  value={dischargeReason}
                  onChange={(e) => setDischargeReason(e.target.value)}
                  className="mt-1"
                  maxLength={500}
                  data-testid="discharge-reason-input"
                />
                <p className="text-sm text-gray-500 mt-1">
                  {dischargeReason.length}/500 characters
                </p>
              </div>

              <div className="flex items-start space-x-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Important</p>
                  <p className="text-sm text-amber-700">
                    Changing status to {status} will mark this resident as no longer active in the facility.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            data-testid="cancel-status-change"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isLoading}
            data-testid="save-status-change"
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}