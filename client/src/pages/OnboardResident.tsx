import { useState } from "react";
import { useLocation } from "wouter";
import { getCurrentUser } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loading } from "@/components/ui/loading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, UserPlus, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function OnboardResident() {
  const [, setLocation] = useLocation();
  const currentUser = getCurrentUser();
  const houseId = currentUser?.houseId;
  const [formData, setFormData] = useState({
    firstName: "",
    lastInitial: "",
    status: "active" as "active" | "inactive" | "graduated",
    residentId: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [newResidentName, setNewResidentName] = useState("");
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastInitial) {
      toast({
        title: "Missing Information",
        description: "Please provide at least first name and last initial.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch('/api/residents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Fix: Send auth cookies
        body: JSON.stringify({
          ...formData,
          house: houseId
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add resident');
      }
      
      const newResident = await response.json();
      setNewResidentName(`${newResident.firstName} ${newResident.lastInitial}.`);
      setIsSuccess(true);
      
      toast({
        title: "Resident Added Successfully",
        description: `${formData.firstName} ${formData.lastInitial}. has been added to your facility.`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to Add Resident", 
        description: error.message || "Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAnother = () => {
    setIsSuccess(false);
    setFormData({
      firstName: "",
      lastInitial: "",
      status: "active",
      residentId: ""
    });
    setNewResidentName("");
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-surface-50 p-4" data-testid="onboard-success">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <CheckCircle className="text-white text-2xl" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Resident Added!</h1>
            <p className="text-lg text-gray-600">{newResidentName} is now part of your facility</p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <Alert className="mb-6 border-green-200 bg-green-50">
                <UserPlus className="h-4 w-4" />
                <AlertDescription>
                  {newResidentName} has been successfully added to your facility. You can now:
                  • Start tracking their goals and progress
                  • Scan and upload their documents  
                  • Generate weekly reports
                  • Access all 7 tracking systems
                </AlertDescription>
              </Alert>
              
              <div className="space-y-4">
                <Button 
                  onClick={() => setLocation(`/dashboard`)} 
                  className="w-full"
                  data-testid="button-view-residents"
                >
                  View All Residents
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={handleAddAnother} 
                  className="w-full"
                  data-testid="button-add-another"
                >
                  Add Another Resident
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 p-4" data-testid="onboard-resident-page">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation(`/dashboard`)}
            className="p-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Add New Resident</h1>
            <p className="text-gray-600">Onboard a new client to your facility</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Resident Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    placeholder="Enter first name"
                    disabled={isLoading}
                    data-testid="input-first-name"
                  />
                </div>

                <div>
                  <Label htmlFor="lastInitial" className="block text-sm font-medium text-gray-700 mb-2">
                    Last Initial *
                  </Label>
                  <Input
                    id="lastInitial"
                    type="text"
                    maxLength={2}
                    value={formData.lastInitial}
                    onChange={(e) => handleInputChange('lastInitial', e.target.value.toUpperCase())}
                    placeholder="e.g., D"
                    disabled={isLoading}
                    data-testid="input-last-initial"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(value: "active" | "inactive" | "graduated") => handleInputChange('status', value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="graduated">Graduated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="residentId" className="block text-sm font-medium text-gray-700 mb-2">
                    Resident ID (Optional)
                  </Label>
                  <Input
                    id="residentId"
                    type="text"
                    value={formData.residentId}
                    onChange={(e) => handleInputChange('residentId', e.target.value)}
                    placeholder="Enter resident ID"
                    disabled={isLoading}
                    data-testid="input-resident-id"
                  />
                </div>
              </div>

              <Alert>
                <UserPlus className="h-4 w-4" />
                <AlertDescription>
                  This resident will be automatically assigned to your facility. Once added, you can access all tracking systems, upload documents, and generate reports for this resident.
                </AlertDescription>
              </Alert>
              
              <div className="flex gap-4">
                <Button 
                  type="submit" 
                  className="flex-1"
                  disabled={isLoading}
                  data-testid="button-add-resident"
                >
                  {isLoading ? (
                    <>
                      <Loading size="sm" className="mr-2" />
                      Adding Resident...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add Resident
                    </>
                  )}
                </Button>
                
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setLocation(`/dashboard`)}
                  disabled={isLoading}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}