import React, { useState, useEffect } from "react";
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
import { ArrowLeft, Plus, AlertTriangle, Calendar, AlertCircle } from "lucide-react";
import { getResident, getIncidentsByResident, createIncident, updateIncident, deleteIncident, getCurrentUser } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { Resident, Incident } from "@shared/schema";

export default function IncidentTracker() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [resident, setResident] = useState<Resident | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showIncidentDialog, setShowIncidentDialog] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    incidentType: 'behavioral' as 'behavioral' | 'medical' | 'property' | 'policy_violation' | 'other',
    description: '',
    severity: 'low' as 'low' | 'medium' | 'high' | 'critical',
    dateOccurred: '',
    actionTaken: '',
    followUpRequired: false
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
      // Load incidents from API
      try {
        const incidentsData = await getIncidentsByResident(id);
        setIncidents(incidentsData);
      } catch (error) {
        // Incidents data not available
        setIncidents([]);
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
      incidentType: 'behavioral',
      description: '',
      severity: 'low',
      dateOccurred: '',
      actionTaken: '',
      followUpRequired: false
    });
    setEditingIncident(null);
  };

  const handleAddIncident = () => {
    resetForm();
    setShowIncidentDialog(true);
  };

  const handleEditIncident = (incident: Incident) => {
    setFormData({
      incidentType: incident.incidentType,
      description: incident.description,
      severity: incident.severity,
      dateOccurred: incident.dateOccurred,
      actionTaken: incident.actionTaken || '',
      followUpRequired: incident.followUpRequired
    });
    setEditingIncident(incident);
    setShowIncidentDialog(true);
  };

  const handleSaveIncident = async () => {
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
      if (editingIncident) {
        // Update existing incident
        const updatedIncident = await updateIncident(editingIncident.id, {
          incidentType: formData.incidentType,
          description: formData.description,
          severity: formData.severity,
          dateOccurred: formData.dateOccurred,
          actionTaken: formData.actionTaken || undefined,
          followUpRequired: formData.followUpRequired
        });
        setIncidents(prev => prev.map(incident => incident.id === editingIncident.id ? updatedIncident : incident));
        toast({
          title: "Incident Updated",
          description: "Incident has been updated successfully.",
        });
      } else {
        // Create new incident
        const newIncident = await createIncident({
          residentId: id,
          houseId: currentUser.houseId,
          createdBy: currentUser.id,
          incidentType: formData.incidentType,
          description: formData.description,
          severity: formData.severity,
          dateOccurred: formData.dateOccurred,
          actionTaken: formData.actionTaken || undefined,
          followUpRequired: formData.followUpRequired
        });
        setIncidents(prev => [...prev, newIncident]);
        toast({
          title: "Incident Created",
          description: "New incident has been created successfully.",
        });
      }
      setShowIncidentDialog(false);
      resetForm();
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save the incident. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteIncident = async (incidentId: string) => {
    try {
      await deleteIncident(incidentId);
      setIncidents(prev => prev.filter(incident => incident.id !== incidentId));
      toast({
        title: "Incident Deleted",
        description: "Incident has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to delete the incident. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'behavioral': return 'bg-purple-100 text-purple-800';
      case 'medical': return 'bg-red-100 text-red-800';
      case 'property': return 'bg-orange-100 text-orange-800';
      case 'policy_violation': return 'bg-yellow-100 text-yellow-800';
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
      <div className="min-h-screen flex items-center justify-center" data-testid="incident-tracker-loading">
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
    <div className="min-h-screen flex flex-col bg-surface-50" data-testid="incident-tracker">
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={handleGoBack} data-testid="back-button">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="text-red-600 w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Incident Tracker</h2>
              <p className="text-sm text-gray-600">{resident.firstName} {resident.lastInitial}.</p>
            </div>
          </div>
          <Button onClick={handleAddIncident} data-testid="add-incident-button">
            <Plus className="w-4 h-4 mr-2" />
            Add Incident
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4">
        {incidents.length === 0 ? (
          <Card data-testid="no-incidents">
            <CardContent className="pt-6 text-center">
              <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Incidents Recorded</h4>
              <p className="text-gray-600 mb-4">Track incidents and ensure proper follow-up actions.</p>
              <Button onClick={handleAddIncident} data-testid="add-first-incident">
                <Plus className="w-4 h-4 mr-2" />
                Add First Incident
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4" data-testid="incidents-list">
            {incidents.map((incident) => (
              <Card key={incident.id} className="hover:shadow-md transition-shadow" data-testid={`incident-card-${incident.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 mb-2" data-testid="incident-description">
                        {incident.description}
                      </p>
                      {incident.actionTaken && (
                        <p className="text-sm text-gray-600 mb-2" data-testid="action-taken">
                          <strong>Action Taken:</strong> {incident.actionTaken}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col space-y-2">
                      <Badge className={getSeverityColor(incident.severity)} data-testid="incident-severity">
                        {incident.severity}
                      </Badge>
                      <Badge className={getTypeColor(incident.incidentType)} data-testid="incident-type">
                        {incident.incidentType.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="w-4 h-4 mr-1" />
                      <span data-testid="incident-date">Occurred: {formatDate(incident.dateOccurred)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {incident.followUpRequired && (
                        <div className="flex items-center text-orange-600 text-sm mr-2">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          <span data-testid="follow-up-required">Follow-up Required</span>
                        </div>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEditIncident(incident)}
                        data-testid={`edit-incident-${incident.id}`}
                      >
                        Edit
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteIncident(incident.id)}
                        data-testid={`delete-incident-${incident.id}`}
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

      {/* Incident Dialog */}
      <Dialog open={showIncidentDialog} onOpenChange={setShowIncidentDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingIncident ? 'Edit Incident' : 'Add New Incident'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="incidentType">Incident Type</Label>
              <Select value={formData.incidentType} onValueChange={(value: 'behavioral' | 'medical' | 'property' | 'policy_violation' | 'other') => setFormData(prev => ({ ...prev, incidentType: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="behavioral">Behavioral</SelectItem>
                  <SelectItem value="medical">Medical</SelectItem>
                  <SelectItem value="property">Property</SelectItem>
                  <SelectItem value="policy_violation">Policy Violation</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the incident"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="severity">Severity</Label>
                <Select value={formData.severity} onValueChange={(value: 'low' | 'medium' | 'high' | 'critical') => setFormData(prev => ({ ...prev, severity: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dateOccurred">Date Occurred</Label>
                <Input
                  id="dateOccurred"
                  type="date"
                  value={formData.dateOccurred}
                  onChange={(e) => setFormData(prev => ({ ...prev, dateOccurred: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="actionTaken">Action Taken</Label>
              <Textarea
                id="actionTaken"
                value={formData.actionTaken}
                onChange={(e) => setFormData(prev => ({ ...prev, actionTaken: e.target.value }))}
                placeholder="Describe actions taken (optional)"
                rows={2}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="followUpRequired"
                checked={formData.followUpRequired}
                onChange={(e) => setFormData(prev => ({ ...prev, followUpRequired: e.target.checked }))}
                className="w-4 h-4"
              />
              <Label htmlFor="followUpRequired">Follow-up Required</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIncidentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveIncident} disabled={isSaving || !formData.description}>
              {isSaving ? 'Saving...' : editingIncident ? 'Update Incident' : 'Create Incident'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}