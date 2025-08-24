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
import { ArrowLeft, Plus, Target, Calendar, Flag } from "lucide-react";
import { getResident, getGoalsByResident, createGoal, updateGoal, deleteGoal, getCurrentUser } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { Resident, Goal } from "@shared/schema";

export default function GoalTracker() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [resident, setResident] = useState<Resident | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'low' as 'low' | 'medium' | 'high',
    status: 'not_started' as 'not_started' | 'in_progress' | 'paused' | 'completed',
    deadline: ''
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
      // Load goals from API
      try {
        const goalsData = await getGoalsByResident(id);
        setGoals(goalsData);
      } catch (error) {
        // Goals data not available, continue with empty array
        setGoals([]);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-orange-100 text-orange-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      priority: 'low',
      status: 'not_started',
      deadline: ''
    });
    setEditingGoal(null);
  };

  const handleAddGoal = () => {
    resetForm();
    setShowGoalDialog(true);
  };

  const handleEditGoal = (goal: Goal) => {
    setFormData({
      title: goal.title,
      description: goal.description || '',
      priority: goal.priority,
      status: goal.status,
      deadline: goal.targetDate || ''
    });
    setEditingGoal(goal);
    setShowGoalDialog(true);
  };

  const handleSaveGoal = async () => {
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
      if (editingGoal) {
        // Update existing goal
        const updatedGoal = await updateGoal(editingGoal.id, {
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          status: formData.status,
          targetDate: formData.deadline || undefined
        });
        setGoals(prev => prev.map(goal => goal.id === editingGoal.id ? updatedGoal : goal));
        toast({
          title: "Goal Updated",
          description: "Goal has been updated successfully.",
        });
      } else {
        // Create new goal
        const newGoal = await createGoal({
          residentId: id,
          houseId: currentUser.houseId,
          createdBy: currentUser.id,
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          status: formData.status,
          targetDate: formData.deadline || undefined
        });
        setGoals(prev => [...prev, newGoal]);
        toast({
          title: "Goal Created",
          description: "New goal has been created successfully.",
        });
      }
      setShowGoalDialog(false);
      resetForm();
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save the goal. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    try {
      await deleteGoal(goalId);
      setGoals(prev => prev.filter(goal => goal.id !== goalId));
      toast({
        title: "Goal Deleted",
        description: "Goal has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to delete the goal. Please try again.",
        variant: "destructive"
      });
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'No deadline';
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="goal-tracker-loading">
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
    <div className="min-h-screen flex flex-col bg-surface-50" data-testid="goal-tracker">
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
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Target className="text-blue-600 w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Goal Tracker</h2>
              <p className="text-sm text-gray-600">{resident.firstName} {resident.lastInitial}.</p>
            </div>
          </div>
          <Button onClick={handleAddGoal} data-testid="add-goal-button">
            <Plus className="w-4 h-4 mr-2" />
            Add Goal
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4">
        {goals.length === 0 ? (
          <Card data-testid="no-goals">
            <CardContent className="pt-6 text-center">
              <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Goals Set</h4>
              <p className="text-gray-600 mb-4">Start tracking progress by setting the first goal.</p>
              <Button onClick={handleAddGoal} data-testid="add-first-goal">
                <Plus className="w-4 h-4 mr-2" />
                Add First Goal
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4" data-testid="goals-list">
            {goals.map((goal) => (
              <Card key={goal.id} className="hover:shadow-md transition-shadow" data-testid={`goal-card-${goal.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-1" data-testid="goal-title">
                        {goal.title}
                      </h4>
                      {goal.description && (
                        <p className="text-sm text-gray-600 mb-2" data-testid="goal-description">
                          {goal.description}
                        </p>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <Badge className={getPriorityColor(goal.priority)} data-testid="goal-priority">
                        <Flag className="w-3 h-3 mr-1" />
                        {goal.priority}
                      </Badge>
                      <Badge className={getStatusColor(goal.status)} data-testid="goal-status">
                        {goal.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="w-4 h-4 mr-1" />
                      <span data-testid="goal-deadline">{formatDate(goal.targetDate)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEditGoal(goal)}
                        data-testid={`edit-goal-${goal.id}`}
                      >
                        Edit
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteGoal(goal.id)}
                        data-testid={`delete-goal-${goal.id}`}
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

      {/* Goal Dialog */}
      <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingGoal ? 'Edit Goal' : 'Add New Goal'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter goal title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter goal description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(value: 'low' | 'medium' | 'high') => setFormData(prev => ({ ...prev, priority: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value: 'not_started' | 'in_progress' | 'paused' | 'completed') => setFormData(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deadline">Target Date</Label>
              <Input
                id="deadline"
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGoalDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveGoal} disabled={isSaving || !formData.title}>
              {isSaving ? 'Saving...' : editingGoal ? 'Update Goal' : 'Create Goal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}