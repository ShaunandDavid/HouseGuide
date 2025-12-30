import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { getCurrentUser, logout, clearCurrentUser, getPinStatus, setPin, apiRequest } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { Home, User, ChevronRight, Settings, UserPlus, Filter, FileText, X, MessageSquare } from "lucide-react";
import { getHouseByName, getResidentsByHouse, getFilesByResident } from "@/lib/api";
import { ComprehensiveReportModal } from "@/components/ComprehensiveReportModal";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { House, Resident, FileRecord } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

interface ResidentWithCounts extends Resident {
  commitmentCount: number;
  writeupCount: number;
}

export default function House() {
  const [, setLocation] = useLocation();
  const currentUser = getCurrentUser();
  const houseId = currentUser?.houseId;
  const [house, setHouse] = useState<House | null>(null);
  const [residents, setResidents] = useState<ResidentWithCounts[]>([]);
  const [filteredResidents, setFilteredResidents] = useState<ResidentWithCounts[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'graduated'>('all');
  const [isLoadingPage, setIsLoadingPage] = useState(true); // Renamed to avoid conflict with useQuery's isLoading
  const [showComprehensiveReport, setShowComprehensiveReport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRenameFacility, setShowRenameFacility] = useState(false);
  const [newFacilityName, setNewFacilityName] = useState('');
  const [facilityRules, setFacilityRules] = useState('');
  const [isSavingRules, setIsSavingRules] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinEnabled, setPinEnabled] = useState(false);
  const [isSavingPin, setIsSavingPin] = useState(false);
  const { toast } = useToast();

  const { isLoading, error } = useQuery({
    queryKey: [`/api/houses`, houseId],
    enabled: !!houseId,
    retry: (failureCount, error) => {
      // Don't retry if house not found
      if (error?.message?.includes('404')) return false;
      return failureCount < 3;
    }
  });

  useEffect(() => {
    if (houseId) {
      const controller = new AbortController();
      loadHouseData(controller.signal);

      // Cleanup function to abort requests on unmount
      return () => {
        controller.abort();
      };
    }
    setIsLoadingPage(false);
  }, [houseId]);

  useEffect(() => {
    if (!currentUser) return;
    getPinStatus()
      .then((data) => setPinEnabled(!!data?.enabled))
      .catch(() => setPinEnabled(false));
  }, [currentUser]);

  useEffect(() => {
    // Filter residents based on status filter
    if (statusFilter === 'all') {
      setFilteredResidents(residents);
    } else {
      setFilteredResidents(residents.filter(resident => (resident.status || 'active') === statusFilter));
    }
  }, [residents, statusFilter]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('LOGOUT: ERROR -', error);
    } finally {
      clearCurrentUser();
      setShowSettings(false);
      setLocation("/login");
    }
  };

  const loadHouseData = async (signal?: AbortSignal) => {
    if (!houseId) return;

    setIsLoadingPage(true);
    try {
      // Load house data - houseId is actually the house ID from the URL
      const houseData = await getHouseByName(houseId);
      setHouse(houseData);
      setFacilityRules(houseData?.rules || '');

      // Load residents
      const residentsData = await getResidentsByHouse(houseId);

      // Load file counts for each resident
      const residentsWithCounts = await Promise.all(
        residentsData.map(async (resident) => {
          try {
            const files = await getFilesByResident(resident.id);
            const commitmentCount = files.filter(f => f.type === 'commitment').length;
            const writeupCount = files.filter(f => f.type === 'writeup').length;

            return {
              ...resident,
              commitmentCount,
              writeupCount
            };
          } catch (error) {
            // Failed to load files for resident - handled gracefully
            return {
              ...resident,
              commitmentCount: 0,
              writeupCount: 0
            };
          }
        })
      );

      setResidents(residentsWithCounts);
      setFilteredResidents(residentsWithCounts);
    } catch (error) {
      // Failed to load house data - handled in UI
      toast({
        title: "Error Loading Data",
        description: "Failed to load house and resident information.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingPage(false);
    }
  };

  const handleRenameFacility = async () => {
    if (!newFacilityName.trim() || !house?.id) return;
    
    try {
      await apiRequest(`/houses/${house.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: newFacilityName.trim() }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Update local state
      setHouse(prev => prev ? { ...prev, name: newFacilityName.trim() } : null);
      setShowRenameFacility(false);
      
      toast({
        title: "Facility Renamed",
        description: "Your facility name has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to rename facility. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleSaveFacilityRules = async () => {
    if (!house?.id) return;

    setIsSavingRules(true);
    try {
      await apiRequest(`/houses/${house.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ rules: facilityRules.trim() }),
        headers: { 'Content-Type': 'application/json' }
      });

      setHouse(prev => prev ? { ...prev, rules: facilityRules.trim() } : prev);
      toast({
        title: "Facility Rules Saved",
        description: "Rules and regulations have been saved for AI reference.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save facility rules. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSavingRules(false);
    }
  };

  const handleSavePin = async () => {
    if (!pinValue.trim()) return;
    setIsSavingPin(true);
    try {
      await setPin(pinValue.trim());
      setPinEnabled(true);
      setPinValue('');
      toast({
        title: "PIN Set",
        description: "Your session PIN is now active.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to set PIN. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSavingPin(false);
    }
  };

  if (isLoadingPage) { // Use the renamed isLoadingPage state
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="house-loading">
        <Loading size="lg" />
      </div>
    );
  }

  if (!houseId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">No House Assigned</h1>
            <p className="text-gray-600 mb-4">Contact an admin to assign you to a house, or head to chat.</p>
            <Button onClick={() => setLocation("/chat")} className="w-full">
              Open Chat
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">House Not Found</h1>
            <p className="text-gray-600 mb-4">The requested house could not be found.</p>
            <div className="space-y-2">
              <p className="text-sm text-gray-500">House ID: {houseId}</p>
              <p className="text-sm text-gray-500">Error: {error?.message || 'Unknown error'}</p>
            </div>
            <div className="mt-4 space-y-2">
              <Button onClick={() => setLocation("/")} className="w-full">Back to Login</Button>
              <Button variant="outline" onClick={() => window.location.reload()} className="w-full">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rulesChanged = facilityRules.trim() !== (house?.rules || '').trim();

  // This part is now conditionally rendered only if there's no error and not loading page.
  // The previous check for !house is implicitly handled by the error display if the house isn't found.
  // If house is null but no error, it means it's still loading or some other state, but the primary error handling is above.

  return (
    <div className="min-h-screen flex flex-col bg-surface-50" data-testid="house-page">
      {/* Navigation Header - Mobile First */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <Home className="text-white text-sm sm:text-base" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate" data-testid="house-name">
                {house?.name?.includes('Dashboard') ? house.name.replace('Dashboard', 'Facility') : (house?.name ?? 'Loading...')}
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">Residential Care Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              onClick={() => setLocation("/chat")}
              data-testid="chat-button"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Chat</span>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="flex-shrink-0" 
              onClick={() => setShowSettings(true)}
              data-testid="settings-button"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Setup Section - Mobile First */}
      {house?.name?.includes('Dashboard') && (
        <div className="bg-blue-50 border-b border-blue-200 p-3 sm:p-4">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex flex-col sm:flex-row items-start space-y-3 sm:space-y-0 sm:space-x-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Home className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 w-full">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Complete Your Setup</h3>
                  <p className="text-sm sm:text-base text-gray-600 mb-4">Give your facility a name and start onboarding residents.</p>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full sm:w-auto"
                      onClick={() => {
                        setNewFacilityName(house?.name?.replace('Dashboard', '') || '');
                        setShowRenameFacility(true);
                      }}
                      data-testid="rename-facility-button"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">Rename Facility</span>
                      <span className="sm:hidden">Rename</span>
                    </Button>
                    <Link href={`/dashboard/onboard`} className="w-full sm:w-auto">
                      <Button size="sm" className="w-full sm:w-auto">
                        <UserPlus className="w-4 h-4 mr-2" />
                        <span className="hidden sm:inline">Add First Resident</span>
                        <span className="sm:hidden">Add Resident</span>
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content - Mobile First */}
      <main className="flex-1 p-3 sm:p-4">
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1 sm:mb-2">Residents</h3>
              <p className="text-sm sm:text-base text-gray-600">Manage resident files and weekly reports</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
              <Button
                onClick={() => setShowComprehensiveReport(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white h-10 sm:h-9"
                data-testid="button-comprehensive-report"
              >
                <FileText className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Director Report</span>
                <span className="sm:hidden">Report</span>
              </Button>
              <Link href={`/dashboard/onboard`} className="w-full sm:w-auto">
                <Button className="bg-primary hover:bg-primary/90 w-full sm:w-auto h-10 sm:h-9" data-testid="button-add-resident">
                  <UserPlus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Add New Resident</span>
                  <span className="sm:hidden">Add Resident</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Status Filter - Mobile First */}
        <div className="mb-4 space-y-2 sm:space-y-0">
          <div className="flex items-center space-x-2 mb-2 sm:mb-0">
            <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="text-xs sm:text-sm font-medium text-gray-700">Filter by status:</span>
          </div>
          <div className="grid grid-cols-2 sm:flex gap-2 sm:space-x-2">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
              className="text-xs sm:text-sm h-8 sm:h-auto"
              data-testid="filter-all-residents"
            >
              <span className="sm:hidden">All</span>
              <span className="hidden sm:inline">All ({residents.length})</span>
            </Button>
            <Button
              variant={statusFilter === 'active' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('active')}
              className={`text-xs sm:text-sm h-8 sm:h-auto ${statusFilter === 'active' ? 'bg-green-600 hover:bg-green-700' : 'text-green-700 border-green-300 hover:bg-green-50'}`}
              data-testid="filter-active-residents"
            >
              <span className="sm:hidden">Active</span>
              <span className="hidden sm:inline">Active ({residents.filter(r => (r.status || 'active') === 'active').length})</span>
            </Button>
            <Button
              variant={statusFilter === 'inactive' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('inactive')}
              className={`text-xs sm:text-sm h-8 sm:h-auto ${statusFilter === 'inactive' ? 'bg-gray-600 hover:bg-gray-700' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
              data-testid="filter-inactive-residents"
            >
              <span className="sm:hidden">Inactive</span>
              <span className="hidden sm:inline">Inactive ({residents.filter(r => r.status === 'inactive').length})</span>
            </Button>
            <Button
              variant={statusFilter === 'graduated' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('graduated')}
              className={`text-xs sm:text-sm h-8 sm:h-auto ${statusFilter === 'graduated' ? 'bg-blue-600 hover:bg-blue-700' : 'text-blue-700 border-blue-300 hover:bg-blue-50'}`}
              data-testid="filter-graduated-residents"
            >
              <span className="sm:hidden">Graduated</span>
              <span className="hidden sm:inline">Graduated ({residents.filter(r => r.status === 'graduated').length})</span>
            </Button>
          </div>
        </div>

        {filteredResidents.length === 0 && residents.length > 0 ? (
          <Card data-testid="no-filtered-residents">
            <CardContent className="pt-6 text-center">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                No {statusFilter} residents
              </h4>
              <p className="text-gray-600">
                No residents with status "{statusFilter}" found.
              </p>
            </CardContent>
          </Card>
        ) : residents.length === 0 ? (
          <Card data-testid="no-residents">
            <CardContent className="pt-6 text-center">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Residents Added Yet</h4>
              <p className="text-gray-600 mb-4">Start by adding your first resident to the facility.</p>
              <Link href={`/dashboard/onboard`}>
                <Button className="bg-primary hover:bg-primary/90" data-testid="button-add-first-resident">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Your First Resident
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredResidents.map((resident) => (
              <Link
                key={resident.id}
                href={`/resident/${resident.id}`}
                data-testid={`resident-card-${resident.id}`}
              >
                <Card className="hover:shadow-md transition-shadow cursor-pointer touch-manipulation">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="text-primary w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-gray-900 text-sm sm:text-base truncate" data-testid="resident-name">
                            {resident.firstName} {resident.lastInitial}.
                          </h4>
                          <p className="text-xs sm:text-sm text-gray-600" data-testid="resident-status">
                            {resident.status || 'Active'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                        <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-2">
                          <Badge
                            variant="secondary"
                            className="bg-green-100 text-green-800 text-xs px-1 sm:px-2"
                            data-testid="commitment-count"
                          >
                            <span className="sm:hidden">{resident.commitmentCount}C</span>
                            <span className="hidden sm:inline">{resident.commitmentCount} Commitments</span>
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="bg-amber-100 text-amber-800 text-xs px-1 sm:px-2"
                            data-testid="writeup-count"
                          >
                            <span className="sm:hidden">{resident.writeupCount}W</span>
                            <span className="hidden sm:inline">{resident.writeupCount} Write-ups</span>
                          </Badge>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 ml-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Comprehensive Report Modal */}
      <ComprehensiveReportModal
        isOpen={showComprehensiveReport}
        onClose={() => setShowComprehensiveReport(false)}
      />

      {/* Settings Modal */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Facility Information</Label>
                <p className="text-sm text-gray-600">Current facility: {house?.name}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">User Account</Label>
                <p className="text-sm text-gray-600">Logged in as: {currentUser?.email}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Application Version</Label>
                <p className="text-sm text-gray-600">HouseGuide v1.0.0</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Facility Rules & Regulations (AI Reference)</Label>
                <Textarea
                  value={facilityRules}
                  onChange={(e) => setFacilityRules(e.target.value)}
                  placeholder="List the house rules and regulations here. These are used to guide AI summaries and reports."
                  rows={6}
                />
                <p className="text-xs text-gray-500">
                  Keep this updated so reports reflect your current rules.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Session PIN</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  value={pinValue}
                  onChange={(e) => setPinValue(e.target.value)}
                  placeholder={pinEnabled ? "PIN is set (enter new to change)" : "Set a 4-8 digit PIN"}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pinValue.trim() || isSavingPin}
                  onClick={handleSavePin}
                >
                  {isSavingPin ? "Saving..." : "Save PIN"}
                </Button>
                <p className="text-xs text-gray-500">
                  After 15 minutes of inactivity, HouseGuide will lock and require this PIN.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSaveFacilityRules}
              disabled={!rulesChanged || isSavingRules}
            >
              {isSavingRules ? "Saving..." : "Save Rules"}
            </Button>
            <Button
              variant="outline"
              onClick={handleLogout}
              data-testid="logout-button"
            >
              Log Out
            </Button>
            <Button onClick={() => setShowSettings(false)} data-testid="close-settings">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Facility Modal */}
      <Dialog open={showRenameFacility} onOpenChange={setShowRenameFacility}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Facility</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="facility-name">Facility Name</Label>
              <Input
                id="facility-name"
                value={newFacilityName}
                onChange={(e) => setNewFacilityName(e.target.value)}
                placeholder="Enter facility name"
                data-testid="input-facility-name"
              />
            </div>
          </div>
          <DialogFooter className="space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setShowRenameFacility(false)}
              data-testid="cancel-rename"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleRenameFacility}
              disabled={!newFacilityName.trim()}
              data-testid="save-facility-name"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
