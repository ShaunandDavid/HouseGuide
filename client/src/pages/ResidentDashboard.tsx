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
    <div className="min-h-screen flex bg-gray-50 relative" data-testid="resident-dashboard">
      {/* Mobile overlay for sidebar */}
      {!sidebarCollapsed && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}
      
      {/* Sidebar - Mobile First */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-40 lg:z-auto
        transform transition-transform duration-300 ease-in-out lg:transform-none
        ${sidebarCollapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'}
      `}>
        <ResidentSidebar 
          isCollapsed={false}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Main Content - Mobile First */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - Mobile First */}
        <header className="bg-white shadow-sm border-b sticky top-0 z-20">
          <div className="px-3 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                {/* Mobile hamburger menu */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="lg:hidden mr-1"
                  data-testid="mobile-menu-button"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleGoBack}
                  data-testid="back-button"
                  className="flex-shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="text-primary w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                    <h1 className="text-base sm:text-xl font-semibold text-gray-900 truncate" data-testid="resident-name">
                      {resident.firstName} {resident.lastInitial}.
                    </h1>
                    <Badge 
                      variant={resident.status === 'active' ? 'default' : resident.status === 'graduated' ? 'secondary' : 'outline'}
                      data-testid="resident-status"
                      className="self-start sm:self-auto text-xs"
                    >
                      {resident.status || 'active'}
                    </Badge>
                  </div>
                  {resident.dischargeDate && (
                    <p className="text-xs sm:text-sm text-gray-500 truncate" data-testid="discharge-info">
                      <span className="hidden sm:inline">Discharged: </span>
                      {new Date(resident.dischargeDate).toLocaleDateString()}
                      {resident.dischargeReason && (
                        <span className="hidden sm:inline"> - {resident.dischargeReason}</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area - Mobile First */}
        <main className="flex-1 p-3 sm:p-6 overflow-x-hidden">
          <Switch>
            {/* Tracker Routes */}
            <Route path="/resident/:id/goals" component={GoalTracker} />
            <Route path="/resident/:id/checklist" component={ChecklistTracker} />
            <Route path="/resident/:id/chores" component={ChoreTracker} />
            <Route path="/resident/:id/accomplishments" component={AccomplishmentTracker} />
            <Route path="/resident/:id/incidents" component={IncidentTracker} />
            <Route path="/resident/:id/meetings" component={MeetingTracker} />
            <Route path="/resident/:id/fees" component={ProgramFeesTracker} />
            
            {/* Placeholder routes for new features - Mobile First */}
            <Route path="/resident/:id/reports">
              <div className="bg-white p-4 sm:p-6 rounded-lg border">
                <h2 className="text-lg font-semibold mb-4">Weekly Reports</h2>
                <p className="text-sm sm:text-base text-gray-600">AI-generated weekly reports will appear here.</p>
              </div>
            </Route>
            
            <Route path="/resident/:id/pictures">
              <div className="bg-white p-4 sm:p-6 rounded-lg border">
                <h2 className="text-lg font-semibold mb-4">Pictures</h2>
                <p className="text-sm sm:text-base text-gray-600">Uploaded pictures and scanned documents will appear here.</p>
              </div>
            </Route>
            
            <Route path="/resident/:id/notes">
              <div className="bg-white p-4 sm:p-6 rounded-lg border">
                <NotesManagement 
                  residentId={resident.id} 
                  houseId={resident.house}
                />
              </div>
            </Route>
            
            {/* Default route shows overview - Mobile First */}
            <Route>
              <div className="space-y-4 sm:space-y-6">
                <div className="bg-white p-4 sm:p-6 rounded-lg border">
                  <h2 className="text-lg font-semibold mb-4">Welcome to {resident.firstName}'s Dashboard</h2>
                  <p className="text-sm sm:text-base text-gray-600 mb-4">
                    <span className="hidden sm:inline">Use the sidebar to navigate between different sections:</span>
                    <span className="sm:hidden">Tap the menu button (☰) to navigate:</span>
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