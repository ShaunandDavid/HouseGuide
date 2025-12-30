import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/ui/loading";
import { ArrowLeft, Save, CheckSquare, User, Users, Home, Book, ListChecks, Stethoscope, Briefcase } from "lucide-react";
import { getResident, getChecklistByResident, createOrUpdateChecklist, getCurrentUser } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { Resident, Checklist } from "@shared/schema";
import { useQueryClient } from "@tanstack/react-query";

export default function ChecklistTracker() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [resident, setResident] = useState<Resident | null>(null);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState({
    phase: '',
    homeGroup: '',
    stepWork: '',
    sponsorMentor: '',
    program: '',
    professionalHelp: '',
    job: ''
  });

  useEffect(() => {
    if (id) {
      loadResidentData();
    }
  }, [id]);

  const loadResidentData = async () => {
    if (!id) return;
    
    setIsLoading(true);
    try {
      const residentData = await getResident(id);
      setResident(residentData);
      // Load checklist from API
      try {
        const checklistData = await getChecklistByResident(id);
        if (checklistData) {
          setChecklist(checklistData);
          setFormData({
            phase: checklistData.phase || '',
            homeGroup: checklistData.homeGroup || '',
            stepWork: checklistData.stepWork || '',
            sponsorMentor: checklistData.sponsorMentor || '',
            program: checklistData.program || '',
            professionalHelp: checklistData.professionalHelp || '',
            job: checklistData.job || ''
          });
        } else {
          setChecklist(null);
          setFormData({
            phase: '',
            homeGroup: '',
            stepWork: '',
            sponsorMentor: '',
            program: '',
            professionalHelp: '',
            job: ''
          });
        }
      } catch (error) {
        // Checklist data not available
        setChecklist(null);
        setFormData({
          phase: '',
          homeGroup: '',
          stepWork: '',
          sponsorMentor: '',
          program: '',
          professionalHelp: '',
          job: ''
        });
      }
    } catch (error) {
      // Failed to load resident data - handled in UI
      toast({
        title: "Error Loading Data",
        description: "Failed to load resident information.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    setLocation(`/resident/${id}/dashboard`);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!id) return;
    
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.houseId) {
      toast({
        title: "Authentication Error",
        description: "Unable to identify current user. Please log in again.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSaving(true);
    try {
      const savedChecklist = await createOrUpdateChecklist({
        residentId: id,
        houseId: currentUser.houseId,
        createdBy: currentUser.id,
        ...formData,
        lastUpdated: new Date().toISOString()
      });
      setChecklist(savedChecklist);
      queryClient.invalidateQueries({ queryKey: ['checklist', id] });
      toast({
        title: "Checklist Saved",
        description: "Client checklist has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save the checklist. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="checklist-loading">
        <Loading size="lg" />
      </div>
    );
  }

  if (!resident) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <h1 className="text-xl font-bold text-gray-900 mb-2">Resident Not Found</h1>
            <p className="text-gray-600">The requested resident could not be found.</p>
            <Button onClick={handleGoBack} className="mt-4">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-50" data-testid="checklist-tracker">
      {/* Navigation Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleGoBack}
              data-testid="back-button"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckSquare className="text-green-600 w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Client Checklist</h2>
              <p className="text-sm text-gray-600">{resident.firstName} {resident.lastInitial}.</p>
            </div>
          </div>
          <Button 
            onClick={handleSave}
            disabled={isSaving}
            data-testid="save-checklist-button"
          >
            {isSaving ? (
              <>
                <Loading size="sm" className="mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Phase Section */}
          <Card>
            <CardContent className="p-6">
              <Label className="flex items-center text-sm font-medium text-gray-700 mb-3">
                <User className="w-4 h-4 text-blue-500 mr-2" />
                Current Phase
              </Label>
              <Input
                value={formData.phase}
                onChange={(e) => handleInputChange('phase', e.target.value)}
                placeholder="e.g., Phase 1, Phase 2, Aftercare..."
                data-testid="input-phase"
              />
            </CardContent>
          </Card>

          {/* Home Group Section */}
          <Card>
            <CardContent className="p-6">
              <Label className="flex items-center text-sm font-medium text-gray-700 mb-3">
                <Home className="w-4 h-4 text-green-500 mr-2" />
                Home Group
              </Label>
              <Input
                value={formData.homeGroup}
                onChange={(e) => handleInputChange('homeGroup', e.target.value)}
                placeholder="Home group or meeting location..."
                data-testid="input-home-group"
              />
            </CardContent>
          </Card>

          {/* Sponsor/Mentor Section */}
          <Card>
            <CardContent className="p-6">
              <Label className="flex items-center text-sm font-medium text-gray-700 mb-3">
                <Users className="w-4 h-4 text-blue-500 mr-2" />
                Sponsor / Mentor
              </Label>
              <Input
                value={formData.sponsorMentor}
                onChange={(e) => handleInputChange('sponsorMentor', e.target.value)}
                placeholder="Sponsor name, contact, and check-in status..."
                data-testid="input-sponsor-mentor"
              />
            </CardContent>
          </Card>

          {/* Step Work Section */}
          <Card>
            <CardContent className="p-6">
              <Label className="flex items-center text-sm font-medium text-gray-700 mb-3">
                <Book className="w-4 h-4 text-purple-500 mr-2" />
                Step Work Progress
              </Label>
              <Textarea
                value={formData.stepWork}
                onChange={(e) => handleInputChange('stepWork', e.target.value)}
                placeholder="Current step work progress and recovery notes..."
                className="h-24"
                data-testid="input-step-work"
              />
            </CardContent>
          </Card>

          {/* Program Section */}
          <Card>
            <CardContent className="p-6">
              <Label className="flex items-center text-sm font-medium text-gray-700 mb-3">
                <ListChecks className="w-4 h-4 text-indigo-500 mr-2" />
                Program
              </Label>
              <Input
                value={formData.program}
                onChange={(e) => handleInputChange('program', e.target.value)}
                placeholder="IOP, outpatient, court program, MAT..."
                data-testid="input-program"
              />
            </CardContent>
          </Card>

          {/* Professional Help Section */}
          <Card>
            <CardContent className="p-6">
              <Label className="flex items-center text-sm font-medium text-gray-700 mb-3">
                <Stethoscope className="w-4 h-4 text-red-500 mr-2" />
                Professional Help
              </Label>
              <Textarea
                value={formData.professionalHelp}
                onChange={(e) => handleInputChange('professionalHelp', e.target.value)}
                placeholder="Therapy, counseling, medical appointments, psychiatrist..."
                className="h-24"
                data-testid="input-professional-help"
              />
            </CardContent>
          </Card>

          {/* Job Section */}
          <Card>
            <CardContent className="p-6">
              <Label className="flex items-center text-sm font-medium text-gray-700 mb-3">
                <Briefcase className="w-4 h-4 text-orange-500 mr-2" />
                Employment
              </Label>
              <Input
                value={formData.job}
                onChange={(e) => handleInputChange('job', e.target.value)}
                placeholder="Current job, job search status, work schedule..."
                data-testid="input-job"
              />
            </CardContent>
          </Card>

          {checklist?.lastUpdated && (
            <div className="text-center text-sm text-gray-500">
              Last updated: {new Date(checklist.lastUpdated).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric', 
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
