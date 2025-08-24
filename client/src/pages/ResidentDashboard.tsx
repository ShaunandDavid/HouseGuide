import { useState, useEffect } from "react";
import { useParams, useLocation, Route, Switch } from "wouter";
import { ArrowLeft, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import ResidentSidebar from "@/components/ResidentSidebar";
import { getResident } from "@/lib/api";
import type { Resident } from "@shared/schema";

// Import existing tracker components
import GoalTracker from "./GoalTracker";
import ChecklistTracker from "./ChecklistTracker";
import ChoreTracker from "./ChoreTracker";
import AccomplishmentTracker from "./AccomplishmentTracker";
import IncidentTracker from "./IncidentTracker";
import MeetingTracker from "./MeetingTracker";
import ProgramFeesTracker from "./ProgramFeesTracker";
import { NotesManagement } from "@/components/NotesManagement";

export default function ResidentDashboard() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [resident, setResident] = useState<Resident | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { toast } = useToast();

  const loadResidentData = async () => {
    if (!id) return;
    
    setIsLoading(true);
    try {
      const residentData = await getResident(id);
      setResident(residentData);
    } catch (error) {
      console.error('Failed to load resident:', error);
      toast({
        title: "Error",
        description: "Failed to load resident data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadResidentData();
  }, [id]);

  const handleGoBack = () => {
    setLocation('/dashboard');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading resident...</p>
        </div>
      </div>
    );
  }

  if (!resident) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Resident not found</h2>
          <p className="text-gray-600 mb-4">The requested resident could not be loaded.</p>
          <Button onClick={handleGoBack}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50" data-testid="resident-dashboard">
      {/* Sidebar */}
      <ResidentSidebar 
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleGoBack}
                data-testid="back-button"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <User className="text-primary w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl font-semibold text-gray-900" data-testid="resident-name">
                    {resident.firstName} {resident.lastInitial}.
                  </h1>
                  <Badge 
                    variant={resident.status === 'active' ? 'default' : resident.status === 'graduated' ? 'secondary' : 'outline'}
                    data-testid="resident-status"
                  >
                    {resident.status || 'active'}
                  </Badge>
                </div>
                {resident.dischargeDate && (
                  <p className="text-sm text-gray-500" data-testid="discharge-info">
                    Discharged: {new Date(resident.dischargeDate).toLocaleDateString()}
                    {resident.dischargeReason && ` - ${resident.dischargeReason}`}
                  </p>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-6">
          <Switch>
            {/* Tracker Routes */}
            <Route path="/resident/:id/goals" component={GoalTracker} />
            <Route path="/resident/:id/checklist" component={ChecklistTracker} />
            <Route path="/resident/:id/chores" component={ChoreTracker} />
            <Route path="/resident/:id/accomplishments" component={AccomplishmentTracker} />
            <Route path="/resident/:id/incidents" component={IncidentTracker} />
            <Route path="/resident/:id/meetings" component={MeetingTracker} />
            <Route path="/resident/:id/fees" component={ProgramFeesTracker} />
            
            {/* Placeholder routes for new features */}
            <Route path="/resident/:id/reports">
              <div className="bg-white p-6 rounded-lg border">
                <h2 className="text-lg font-semibold mb-4">Weekly Reports</h2>
                <p className="text-gray-600">AI-generated weekly reports will appear here.</p>
              </div>
            </Route>
            
            <Route path="/resident/:id/pictures">
              <div className="bg-white p-6 rounded-lg border">
                <h2 className="text-lg font-semibold mb-4">Pictures</h2>
                <p className="text-gray-600">Uploaded pictures and scanned documents will appear here.</p>
              </div>
            </Route>
            
            <Route path="/resident/:id/notes">
              <div className="bg-white p-6 rounded-lg border">
                <NotesManagement 
                  residentId={resident.id} 
                  houseId={resident.house}
                />
              </div>
            </Route>
            
            {/* Default route shows overview */}
            <Route>
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg border">
                  <h2 className="text-lg font-semibold mb-4">Welcome to {resident.firstName}'s Dashboard</h2>
                  <p className="text-gray-600 mb-4">
                    Use the sidebar to navigate between different sections:
                  </p>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>• <strong>Weekly Reports:</strong> AI-generated summaries and reports</li>
                    <li>• <strong>Pictures:</strong> Uploaded documents and photos</li>
                    <li>• <strong>Notes:</strong> Manual entries and OCR text</li>
                    <li>• <strong>Trackers:</strong> Goals, chores, incidents, and more</li>
                  </ul>
                </div>
              </div>
            </Route>
          </Switch>
        </main>
      </div>
    </div>
  );
}