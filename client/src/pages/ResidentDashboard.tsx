import { useState, useEffect } from "react";
import { useParams, useLocation, Route, Switch } from "wouter";
import { ArrowLeft, LayoutDashboard, User, Camera, FileText, Mic, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import ResidentSidebar from "@/components/ResidentSidebar";
import { getResident, getFilesByResident } from "@/lib/api";
import type { Resident } from "@shared/schema";
import type { FileRecord } from "@shared/schema";
import { FileCard } from "@/components/ui/file-card";
import { DocumentScanModal } from "@/components/DocumentScanModal";
import { QuickNoteModal } from "@/components/QuickNoteModal";
import { ComprehensiveVoiceNote } from "@/components/ComprehensiveVoiceNote";
import { WeeklyReportEditor } from "@/components/WeeklyReportEditor";
import { StatusManagementModal } from "@/components/StatusManagementModal";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { WeeklyReportsArchive } from "@/components/WeeklyReportsArchive";

// Import existing tracker components
import TrackerDashboard from "./TrackerDashboard";
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
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FileRecord[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'commitment' | 'writeup' | 'incident'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showQuickNoteModal, setShowQuickNoteModal] = useState(false);
  const [showVoiceNoteModal, setShowVoiceNoteModal] = useState(false);
  const [showReportEditor, setShowReportEditor] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showWelcomeTip, setShowWelcomeTip] = useState(true);
  const { toast } = useToast();

  const loadResidentData = async () => {
    if (!id) return;
    
    setIsLoading(true);
    try {
      const [residentData, filesData] = await Promise.all([
        getResident(id),
        getFilesByResident(id)
      ]);
      setResident(residentData);
      setFiles(filesData);
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

  useEffect(() => {
    if (activeFilter === 'all') {
      setFilteredFiles(files);
    } else {
      setFilteredFiles(files.filter(file => file.type === activeFilter));
    }
  }, [files, activeFilter]);

  useEffect(() => {
    const stored = localStorage.getItem('resident-dashboard-tip');
    if (stored === 'dismissed') {
      setShowWelcomeTip(false);
    }
  }, []);

  const handleGoBack = () => {
    setLocation('/dashboard');
  };

  const handleDocumentSaved = () => {
    loadResidentData();
  };

  const handleViewFile = (file: FileRecord) => {
    setPreviewFile(file);
    setIsPreviewOpen(true);
  };

  const handleDismissTip = () => {
    setShowWelcomeTip(false);
    localStorage.setItem('resident-dashboard-tip', 'dismissed');
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
    <div className="min-h-screen flex bg-gray-50 relative overflow-x-hidden" data-testid="resident-dashboard">
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

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation(`/resident/${resident.id}`)}
                  aria-label="Resident dashboard"
                  className="flex-shrink-0"
                >
                  <LayoutDashboard className="w-4 h-4" />
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
          <div className="border-t bg-white px-3 sm:px-6 py-2">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowStatusModal(true)}
              >
                Status
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLocation(`/resident/${resident.id}/trackers`)}
              >
                Trackers
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLocation(`/resident/${resident.id}/notes`)}
              >
                Notes
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLocation(`/resident/${resident.id}/pictures`)}
              >
                Files
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLocation("/chat")}
              >
                <MessageSquare className="w-4 h-4 mr-1" />
                Chat
              </Button>
              <Button
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={() => setShowReportEditor(true)}
              >
                Report
              </Button>
            </div>
          </div>
        </header>

        {/* Content Area - Mobile First */}
        <main className="flex-1 p-3 sm:p-6 overflow-x-hidden">
          <Switch>
            {/* Tracker Routes */}
            <Route path="/resident/:id/trackers">
              <TrackerDashboard embedded />
            </Route>
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
                <WeeklyReportsArchive
                  residentId={resident.id}
                  residentName={`${resident.firstName} ${resident.lastInitial}.`}
                  onGenerate={() => setShowReportEditor(true)}
                />
              </div>
            </Route>
            
            <Route path="/resident/:id/pictures">
              <div className="bg-white p-4 sm:p-6 rounded-lg border space-y-4">
                <h2 className="text-lg font-semibold">Pictures</h2>
                {filteredFiles.length === 0 ? (
                  <div className="text-sm text-gray-600">
                    No documents have been uploaded for this resident yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredFiles.map((file) => (
                      <FileCard
                        key={file.id}
                        file={file}
                        onViewFile={handleViewFile}
                      />
                    ))}
                  </div>
                )}
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
              <div className="space-y-6">
                {showWelcomeTip && (
                  <div className="relative rounded-2xl border border-white/50 bg-white/70 backdrop-blur-xl p-4 shadow-lg">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDismissTip}
                      className="absolute top-2 right-2"
                      aria-label="Dismiss help"
                    >
                      Dismiss
                    </Button>
                    <h2 className="text-lg font-semibold mb-2">Welcome to {resident.firstName}'s Dashboard</h2>
                    <p className="text-sm text-gray-600">
                      Use the menu to jump between trackers, notes, pictures, and reports. Everything
                      lives on this page now.
                    </p>
                  </div>
                )}

                <section>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Card
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setShowScanModal(true)}
                    >
                      <CardContent className="p-4">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                          <Camera className="w-4 h-4 text-blue-600" />
                        </div>
                        <h4 className="font-medium text-gray-900 mb-1">Scan Document</h4>
                        <p className="text-sm text-gray-600">Capture photo with OCR</p>
                      </CardContent>
                    </Card>

                    <Card
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setShowQuickNoteModal(true)}
                    >
                      <CardContent className="p-4">
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mb-2">
                          <FileText className="w-4 h-4 text-green-600" />
                        </div>
                        <h4 className="font-medium text-gray-900 mb-1">Add Note</h4>
                        <p className="text-sm text-gray-600">Quick text note</p>
                      </CardContent>
                    </Card>

                    <Card
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setShowVoiceNoteModal(true)}
                    >
                      <CardContent className="p-4">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
                          <Mic className="w-4 h-4 text-purple-600" />
                        </div>
                        <h4 className="font-medium text-gray-900 mb-1">Voice Note</h4>
                        <p className="text-sm text-gray-600">AI categorized recording</p>
                      </CardContent>
                    </Card>
                  </div>
                </section>

                <section>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Files</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={activeFilter === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveFilter("all")}
                      >
                        All ({files.length})
                      </Button>
                      <Button
                        variant={activeFilter === "commitment" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveFilter("commitment")}
                        className={activeFilter === "commitment" ? "bg-green-600 hover:bg-green-700" : "text-green-700 border-green-300 hover:bg-green-50"}
                      >
                        Commitments ({files.filter(f => f.type === "commitment").length})
                      </Button>
                      <Button
                        variant={activeFilter === "writeup" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveFilter("writeup")}
                        className={activeFilter === "writeup" ? "bg-amber-600 hover:bg-amber-700" : "text-amber-700 border-amber-300 hover:bg-amber-50"}
                      >
                        Write-ups ({files.filter(f => f.type === "writeup").length})
                      </Button>
                      <Button
                        variant={activeFilter === "incident" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveFilter("incident")}
                        className={activeFilter === "incident" ? "bg-red-600 hover:bg-red-700" : "text-red-700 border-red-300 hover:bg-red-50"}
                      >
                        Incidents ({files.filter(f => f.type === "incident").length})
                      </Button>
                    </div>
                  </div>

                  {filteredFiles.length === 0 ? (
                    <Card>
                      <CardContent className="pt-6 text-center">
                        <p className="text-gray-600">
                          {activeFilter === "all"
                            ? "No documents have been uploaded for this resident yet."
                            : `No ${activeFilter}s have been uploaded for this resident yet.`}
                        </p>
                        <Button
                          onClick={() => setShowScanModal(true)}
                          className="mt-4"
                        >
                          Scan First Document
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {filteredFiles.map((file) => (
                        <FileCard
                          key={file.id}
                          file={file}
                          onViewFile={handleViewFile}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </Route>
          </Switch>
        </main>
      </div>

      <DocumentScanModal
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
        residentId={resident.id}
        houseId={resident.house}
        onDocumentSaved={handleDocumentSaved}
      />

      <QuickNoteModal
        isOpen={showQuickNoteModal}
        onClose={() => setShowQuickNoteModal(false)}
        residentId={resident.id}
      />

      <ComprehensiveVoiceNote
        isOpen={showVoiceNoteModal}
        onClose={() => setShowVoiceNoteModal(false)}
        residentId={resident.id}
      />

      {showReportEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">AI Weekly Report Generator</h2>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <WeeklyReportEditor
                resident={resident}
                onClose={() => setShowReportEditor(false)}
              />
            </div>
          </div>
        </div>
      )}

      <StatusManagementModal
        open={showStatusModal}
        onOpenChange={setShowStatusModal}
        resident={resident}
        onUpdate={loadResidentData}
      />

      <FilePreviewModal
        file={previewFile}
        open={isPreviewOpen}
        onOpenChange={(open) => {
          setIsPreviewOpen(open);
          if (!open) {
            setPreviewFile(null);
          }
        }}
      />
    </div>
  );
}
