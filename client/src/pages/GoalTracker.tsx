import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { ArrowLeft, Plus, Target, Calendar, Flag } from "lucide-react";
import { getResident } from "@/lib/pocketbase";
import { useToast } from "@/hooks/use-toast";
import type { Resident, Goal } from "@shared/schema";

export default function GoalTracker() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [resident, setResident] = useState<Resident | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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
      // TODO: Load goals from PocketBase
      setGoals([]);
    } catch (error) {
      console.error("Failed to load resident data:", error);
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
          <Button data-testid="add-goal-button">
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
              <Button data-testid="add-first-goal">
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
                  
                  <div className="flex items-center text-sm text-gray-500">
                    <Calendar className="w-4 h-4 mr-1" />
                    <span data-testid="goal-deadline">{formatDate(goal.targetDate)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}