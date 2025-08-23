import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { ArrowLeft, Plus, Home, Calendar, Clock } from "lucide-react";
import { getResident } from "@/lib/pocketbase";
import { useToast } from "@/hooks/use-toast";
import type { Resident, Chore } from "@shared/schema";

export default function ChoreTracker() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [resident, setResident] = useState<Resident | null>(null);
  const [chores, setChores] = useState<Chore[]>([]);
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
      // TODO: Load chores from PocketBase
      setChores([]);
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
          <Button data-testid="add-chore-button">
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
              <Button data-testid="add-first-chore">
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}