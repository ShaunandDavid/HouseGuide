import React, { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Award, Calendar } from "lucide-react";
import { MicInput } from "@/components/MicInput";
import { getResident, getAccomplishmentsByResident, createAccomplishment, updateAccomplishment, deleteAccomplishment, getCurrentUser } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { Resident, Accomplishment } from "@shared/schema";

export default function AccomplishmentTracker() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [resident, setResident] = useState<Resident | null>(null);
  const [accomplishments, setAccomplishments] = useState<Accomplishment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAccomplishmentDialog, setShowAccomplishmentDialog] = useState(false);
  const [editingAccomplishment, setEditingAccomplishment] = useState<Accomplishment | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'personal' as 'personal' | 'work' | 'education' | 'recovery' | 'social' | 'other',
    dateAchieved: ''
  });
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);

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
      // Load accomplishments from API
      try {
        const accomplishmentsData = await getAccomplishmentsByResident(id);
        setAccomplishments(accomplishmentsData);
      } catch (error) {
        // Accomplishments data not available
        setAccomplishments([]);
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
    setLocation(`/resident/${id}/trackers`);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'personal',
      dateAchieved: ''
    });
    setEditingAccomplishment(null);
  };

  const handleAddAccomplishment = () => {
    resetForm();
    setShowAccomplishmentDialog(true);
  };

  const handleEditAccomplishment = (accomplishment: Accomplishment) => {
    setFormData({
      title: accomplishment.title,
      description: accomplishment.description || '',
      category: accomplishment.category,
      dateAchieved: accomplishment.dateAchieved || ''
    });
    setEditingAccomplishment(accomplishment);
    setShowAccomplishmentDialog(true);
  };

  const handleSaveAccomplishment = async () => {
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
      if (editingAccomplishment) {
        // Update existing accomplishment
        const updatedAccomplishment = await updateAccomplishment(editingAccomplishment.id, {
          title: formData.title,
          description: formData.description,
          category: formData.category,
          dateAchieved: formData.dateAchieved
        });
        setAccomplishments(prev => prev.map(accomplishment => accomplishment.id === editingAccomplishment.id ? updatedAccomplishment : accomplishment));
        toast({
          title: "Accomplishment Updated",
          description: "Accomplishment has been updated successfully.",
        });
      } else {
        // Create new accomplishment
        const newAccomplishment = await createAccomplishment({
          residentId: id,
          houseId: currentUser.houseId,
          createdBy: currentUser.id,
          title: formData.title,
          description: formData.description,
          category: formData.category,
          dateAchieved: formData.dateAchieved
        });
        setAccomplishments(prev => [...prev, newAccomplishment]);
        toast({
          title: "Accomplishment Created",
          description: "New accomplishment has been created successfully.",
        });
      }
      setShowAccomplishmentDialog(false);
      resetForm();
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save the accomplishment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccomplishment = async (accomplishmentId: string) => {
    try {
      await deleteAccomplishment(accomplishmentId);
      setAccomplishments(prev => prev.filter(accomplishment => accomplishment.id !== accomplishmentId));
      toast({
        title: "Accomplishment Deleted",
        description: "Accomplishment has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to delete the accomplishment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'personal': return 'bg-blue-100 text-blue-800';
      case 'work': return 'bg-green-100 text-green-800';
      case 'education': return 'bg-purple-100 text-purple-800';
      case 'recovery': return 'bg-orange-100 text-orange-800';
      case 'social': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="accomplishment-tracker-loading">
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
            <Button onClick={handleGoBack} className="mt-4">Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-50" data-testid="accomplishment-tracker">
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={handleGoBack} data-testid="back-button">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
              <Award className="text-yellow-600 w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Accomplishment Tracker</h2>
              <p className="text-sm text-gray-600">{resident.firstName} {resident.lastInitial}.</p>
            </div>
          </div>
          <Button onClick={handleAddAccomplishment} data-testid="add-accomplishment-button">
            <Plus className="w-4 h-4 mr-2" />
            Add Accomplishment
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4">
        {accomplishments.length === 0 ? (
          <Card data-testid="no-accomplishments">
            <CardContent className="pt-6 text-center">
              <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Accomplishments Recorded</h4>
              <p className="text-gray-600 mb-4">Celebrate achievements and milestones along the recovery journey.</p>
              <Button onClick={handleAddAccomplishment} data-testid="add-first-accomplishment">
                <Plus className="w-4 h-4 mr-2" />
                Add First Accomplishment
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4" data-testid="accomplishments-list">
            {accomplishments.map((accomplishment) => (
              <Card key={accomplishment.id} className="hover:shadow-md transition-shadow" data-testid={`accomplishment-card-${accomplishment.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-1" data-testid="accomplishment-title">
                        {accomplishment.title}
                      </h4>
                      {accomplishment.description && (
                        <p className="text-sm text-gray-600 mb-2" data-testid="accomplishment-description">
                          {accomplishment.description}
                        </p>
                      )}
                    </div>
                    <Badge className={getCategoryColor(accomplishment.category)} data-testid="accomplishment-category">
                      {accomplishment.category}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="w-4 h-4 mr-1" />
                      <span data-testid="accomplishment-date">Achieved: {formatDate(accomplishment.dateAchieved)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEditAccomplishment(accomplishment)}
                        data-testid={`edit-accomplishment-${accomplishment.id}`}
                      >
                        Edit
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteAccomplishment(accomplishment.id)}
                        data-testid={`delete-accomplishment-${accomplishment.id}`}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Accomplishment Dialog */}
      <Dialog open={showAccomplishmentDialog} onOpenChange={setShowAccomplishmentDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingAccomplishment ? 'Edit Accomplishment' : 'Add New Accomplishment'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter accomplishment title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <div className="relative">
                <Textarea
                  ref={descriptionTextareaRef}
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter accomplishment description"
                  rows={3}
                  className="pr-12"
                />
                <div className="absolute top-2 right-2">
                  <MicInput
                    targetRef={descriptionTextareaRef}
                    onInsertText={(text, cursorPosition) => {
                      if (descriptionTextareaRef.current) {
                        const textarea = descriptionTextareaRef.current;
                        const currentValue = textarea.value;
                        const insertPosition = cursorPosition ?? textarea.selectionStart ?? currentValue.length;
                        
                        const newValue = 
                          currentValue.slice(0, insertPosition) + 
                          (insertPosition > 0 && !currentValue[insertPosition - 1]?.match(/\s/) ? ' ' : '') +
                          text + 
                          (insertPosition < currentValue.length && !currentValue[insertPosition]?.match(/\s/) ? ' ' : '') +
                          currentValue.slice(insertPosition);
                        
                        setFormData(prev => ({ ...prev, description: newValue }));
                      }
                    }}
                    size="sm"
                    variant="ghost"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(value: 'personal' | 'work' | 'education' | 'recovery' | 'social' | 'other') => setFormData(prev => ({ ...prev, category: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="work">Work</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="recovery">Recovery</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dateAchieved">Date Achieved</Label>
                <Input
                  id="dateAchieved"
                  type="date"
                  value={formData.dateAchieved}
                  onChange={(e) => setFormData(prev => ({ ...prev, dateAchieved: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAccomplishmentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAccomplishment} disabled={isSaving || !formData.title}>
              {isSaving ? 'Saving...' : editingAccomplishment ? 'Update Accomplishment' : 'Create Accomplishment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}