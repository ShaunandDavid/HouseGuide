import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { FileCard } from "@/components/ui/file-card";
import { DocumentScanModal } from "@/components/DocumentScanModal";
import { WeeklyReportModal } from "@/components/WeeklyReportModal";
import { 
  ArrowLeft, 
  User, 
  Camera, 
  FileText, 
  Users, 
  AlertTriangle 
} from "lucide-react";
import { getResident, getFilesByResident } from "@/lib/pocketbase";
import { useToast } from "@/hooks/use-toast";
import type { Resident, FileRecord } from "@shared/schema";

export default function ResidentPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [resident, setResident] = useState<Resident | null>(null);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FileRecord[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'commitment' | 'writeup'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (id) {
      loadResidentData();
    }
  }, [id]);

  useEffect(() => {
    // Filter files based on active filter
    if (activeFilter === 'all') {
      setFilteredFiles(files);
    } else {
      setFilteredFiles(files.filter(file => file.type === activeFilter));
    }
  }, [files, activeFilter]);

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

  const handleDocumentSaved = () => {
    loadResidentData(); // Reload data after saving a document
  };

  const handleGoBack = () => {
    setLocation('/house/MAIN');
  };

  const handleViewFile = (file: FileRecord) => {
    // Could open a detailed view modal or navigate to a detail page
    // File viewing functionality would be implemented here
  };

  const commitmentCount = files.filter(f => f.type === 'commitment').length;
  const writeupCount = files.filter(f => f.type === 'writeup').length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="resident-loading">
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
    <div className="min-h-screen flex flex-col bg-surface-50" data-testid="resident-page">
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
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <User className="text-primary w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900" data-testid="resident-name">
                {resident.firstName} {resident.lastInitial}.
              </h2>
              <p className="text-sm text-gray-600" data-testid="resident-id">
                {resident.residentId ? `ID: ${resident.residentId}` : 'No ID assigned'}
              </p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="outline"
              onClick={() => setLocation(`/resident/${resident.id}/trackers`)}
              data-testid="view-trackers-button"
            >
              View Trackers
            </Button>
            <Button 
              onClick={() => setShowReportModal(true)}
              data-testid="generate-report-button"
            >
              Generate Report
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-6">
        {/* Quick Actions */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Card 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setShowScanModal(true)}
              data-testid="scan-document-action"
            >
              <CardContent className="p-4">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                  <Camera className="w-4 h-4 text-blue-600" />
                </div>
                <h4 className="font-medium text-gray-900 mb-1">Scan Document</h4>
                <p className="text-sm text-gray-600">Capture photo with OCR</p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow cursor-pointer" data-testid="add-note-action">
              <CardContent className="p-4">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mb-2">
                  <FileText className="w-4 h-4 text-green-600" />
                </div>
                <h4 className="font-medium text-gray-900 mb-1">Add Note</h4>
                <p className="text-sm text-gray-600">Quick text note</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Files Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Files</h3>
            <div className="flex space-x-2">
              <Button
                variant={activeFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('all')}
                data-testid="filter-all"
              >
                All ({files.length})
              </Button>
              <Button
                variant={activeFilter === 'commitment' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('commitment')}
                className={activeFilter === 'commitment' ? 'bg-green-600 hover:bg-green-700' : 'text-green-700 border-green-300 hover:bg-green-50'}
                data-testid="filter-commitments"
              >
                <Users className="w-4 h-4 mr-1" />
                Commitments ({commitmentCount})
              </Button>
              <Button
                variant={activeFilter === 'writeup' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('writeup')}
                className={activeFilter === 'writeup' ? 'bg-amber-600 hover:bg-amber-700' : 'text-amber-700 border-amber-300 hover:bg-amber-50'}
                data-testid="filter-writeups"
              >
                <AlertTriangle className="w-4 h-4 mr-1" />
                Write-ups ({writeupCount})
              </Button>
            </div>
          </div>

          {filteredFiles.length === 0 ? (
            <Card data-testid="no-files">
              <CardContent className="pt-6 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">
                  {activeFilter === 'all' ? 'No Files' : `No ${activeFilter}s`}
                </h4>
                <p className="text-gray-600">
                  {activeFilter === 'all' 
                    ? 'No documents have been uploaded for this resident yet.'
                    : `No ${activeFilter}s have been uploaded for this resident yet.`
                  }
                </p>
                <Button 
                  onClick={() => setShowScanModal(true)}
                  className="mt-4"
                  data-testid="scan-first-document"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Scan First Document
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3" data-testid="files-list">
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
      </main>

      {/* Document Scan Modal */}
      <DocumentScanModal
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
        residentId={resident.id}
        onDocumentSaved={handleDocumentSaved}
      />

      {/* Weekly Report Modal */}
      <WeeklyReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        resident={resident}
      />
    </div>
  );
}
