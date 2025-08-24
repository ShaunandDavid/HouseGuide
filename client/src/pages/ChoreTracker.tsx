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
import { ArrowLeft, Plus, Home, Calendar, Clock } from "lucide-react";
import { getResident, getChoresByResident, createChore, updateChore, deleteChore, getCurrentUser } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { Resident, Chore } from "@shared/schema";

export default function ChoreTracker() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [resident, setResident] = useState<Resident | null>(null);
  const [chores, setChores] = useState<Chore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showChoreDialog, setShowChoreDialog] = useState(false);
  const [editingChore, setEditingChore] = useState<Chore | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    choreName: '',
    notes: '',
    status: 'assigned' as 'assigned' | 'in_progress' | 'completed' | 'missed',
    assignedDate: '',
    dueDate: ''
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
      // Load chores from API
      try {
        const choresData = await getChoresByResident(id);
        setChores(choresData);
      } catch (error) {
        // Chores data not available
        setChores([]);
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
      choreName: '',
      notes: '',
      status: 'assigned',
      assignedDate: '',
      dueDate: ''
    });
    setEditingChore(null);
  };

  const handleAddChore = () => {
    resetForm();
    setShowChoreDialog(true);
  };

  const handleEditChore = (chore: Chore) => {
    setFormData({
      choreName: chore.choreName,
      notes: chore.notes || '',
      status: chore.status,
      assignedDate: chore.assignedDate || '',
      dueDate: chore.dueDate || ''
    });
    setEditingChore(chore);
    setShowChoreDialog(true);
  };

  const handleSaveChore = async () => {
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
      if (editingChore) {
        // Update existing chore
        const updatedChore = await updateChore(editingChore.id, {
          choreName: formData.choreName,
          notes: formData.notes,
          status: formData.status,
          assignedDate: formData.assignedDate || undefined,
          dueDate: formData.dueDate || undefined
        });
        setChores(prev => prev.map(chore => chore.id === editingChore.id ? updatedChore : chore));
        toast({
          title: "Chore Updated",
          description: "Chore has been updated successfully.",
        });
      } else {
        // Create new chore
        const newChore = await createChore({
          residentId: id,
          houseId: currentUser.houseId,
          createdBy: currentUser.id,
          choreName: formData.choreName,
          notes: formData.notes,
          status: formData.status,
          assignedDate: formData.assignedDate || undefined,
          dueDate: formData.dueDate || undefined
        });
        setChores(prev => [...prev, newChore]);
        toast({
          title: "Chore Created",
          description: "New chore has been created successfully.",
        });
      }
      setShowChoreDialog(false);
      resetForm();
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save the chore. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteChore = async (choreId: string) => {
    try {
      await deleteChore(choreId);
      setChores(prev => prev.filter(chore => chore.id !== choreId));
      toast({
        title: "Chore Deleted",
        description: "Chore has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to delete the chore. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'missed': return 'bg-red-100 text-red-800';
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
      <div className="min-h-screen flex items-center justify-center" data-testid="chore-tracker-loading">
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
    <div className="min-h-screen flex flex-col bg-surface-50" data-testid="chore-tracker">
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={handleGoBack} data-testid="back-button">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Home className="text-purple-600 w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Chore Tracker</h2>
              <p className="text-sm text-gray-600">{resident.firstName} {resident.lastInitial}.</p>
            </div>
          </div>
          <Button onClick={handleAddChore} data-testid="add-chore-button">
            <Plus className="w-4 h-4 mr-2" />
            Add Chore
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4">
        {chores.length === 0 ? (
          <Card data-testid="no-chores">
            <CardContent className="pt-6 text-center">
              <Home className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Chores Assigned</h4>
              <p className="text-gray-600 mb-4">Track household responsibilities and completion status.</p>
              <Button onClick={handleAddChore} data-testid="add-first-chore">
                <Plus className="w-4 h-4 mr-2" />
                Add First Chore
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4" data-testid="chores-list">
            {chores.map((chore) => (
              <Card key={chore.id} className="hover:shadow-md transition-shadow" data-testid={`chore-card-${chore.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-1" data-testid="chore-name">
                        {chore.choreName}
                      </h4>
                      {chore.notes && (
                        <p className="text-sm text-gray-600 mb-2" data-testid="chore-notes">
                          {chore.notes}
                        </p>
                      )}
                    </div>
                    <Badge className={getStatusColor(chore.status)} data-testid="chore-status">
                      {chore.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      <span data-testid="assigned-date">Assigned: {formatDate(chore.assignedDate)}</span>
                    </div>
                    {chore.dueDate && (
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        <span data-testid="due-date">Due: {formatDate(chore.dueDate)}</span>
                      </div>
                    )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEditChore(chore)}
                        data-testid={`edit-chore-${chore.id}`}
                      >
                        Edit
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteChore(chore.id)}
                        data-testid={`delete-chore-${chore.id}`}
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

      {/* Chore Dialog */}
      <Dialog open={showChoreDialog} onOpenChange={setShowChoreDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingChore ? 'Edit Chore' : 'Add New Chore'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="choreName">Chore Name</Label>
              <Input
                id="choreName"
                value={formData.choreName}
                onChange={(e) => setFormData(prev => ({ ...prev, choreName: e.target.value }))}
                placeholder="Enter chore name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Enter additional notes"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="assignedDate">Assigned Date</Label>
                <Input
                  id="assignedDate"
                  type="date"
                  value={formData.assignedDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, assignedDate: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value: 'assigned' | 'in_progress' | 'completed' | 'missed') => setFormData(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="missed">Missed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChoreDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveChore} disabled={isSaving || !formData.choreName}>
              {isSaving ? 'Saving...' : editingChore ? 'Update Chore' : 'Create Chore'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}