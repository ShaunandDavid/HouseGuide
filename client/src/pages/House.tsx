import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { Home, User, ChevronRight, Settings, UserPlus, Filter } from "lucide-react";
import { getHouseByName, getResidentsByHouse, getFilesByResident } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { House, Resident, FileRecord } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ResidentWithCounts extends Resident {
  commitmentCount: number;
  writeupCount: number;
}

export default function House() {
  const { houseId } = useParams<{ houseId: string }>();
  const [, setLocation] = useLocation();
  const [house, setHouse] = useState<House | null>(null);
  const [residents, setResidents] = useState<ResidentWithCounts[]>([]);
  const [filteredResidents, setFilteredResidents] = useState<ResidentWithCounts[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'graduated'>('all');
  const [isLoadingPage, setIsLoadingPage] = useState(true); // Renamed to avoid conflict with useQuery's isLoading
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
  }, [houseId]);

  useEffect(() => {
    // Filter residents based on status filter
    if (statusFilter === 'all') {
      setFilteredResidents(residents);
    } else {
      setFilteredResidents(residents.filter(resident => (resident.status || 'active') === statusFilter));
    }
  }, [residents, statusFilter]);

  const loadHouseData = async (signal?: AbortSignal) => {
    if (!houseId) return;

    setIsLoadingPage(true);
    try {
      // Load house data - houseId is actually the house ID from the URL
      const houseData = await getHouseByName(houseId);
      setHouse(houseData);

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

  if (isLoadingPage) { // Use the renamed isLoadingPage state
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="house-loading">
        <Loading size="lg" />
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

  // This part is now conditionally rendered only if there's no error and not loading page.
  // The previous check for !house is implicitly handled by the error display if the house isn't found.
  // If house is null but no error, it means it's still loading or some other state, but the primary error handling is above.

  return (
    <div className="min-h-screen flex flex-col bg-surface-50" data-testid="house-page">
      {/* Navigation Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Home className="text-white text-sm" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900" data-testid="house-name">
                {house?.name?.includes('Dashboard') ? house.name.replace('Dashboard', 'Facility') : (house?.name ?? 'Loading...')}
              </h2>
              <p className="text-sm text-gray-600">Residential Care Management</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" data-testid="settings-button">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Setup Section - Show if house name contains 'Dashboard' */}
      {house?.name?.includes('Dashboard') && (
        <div className="bg-blue-50 border-b border-blue-200 p-4">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Home className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Complete Your Setup</h3>
                  <p className="text-gray-600 mb-4">Give your facility a name and start onboarding residents.</p>
                  <div className="flex items-center space-x-3">
                    <Button size="sm" variant="outline">
                      <Settings className="w-4 h-4 mr-2" />
                      Rename Facility
                    </Button>
                    <Link href={`/house/${houseId}/onboard`}>
                      <Button size="sm">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add First Resident
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Residents</h3>
            <p className="text-gray-600">Manage resident files and weekly reports</p>
          </div>
          <Link href={`/house/${houseId}/onboard`}>
            <Button className="bg-primary hover:bg-primary/90" data-testid="button-add-resident">
              <UserPlus className="w-4 h-4 mr-2" />
              Add New Resident
            </Button>
          </Link>
        </div>

        {/* Status Filter */}
        <div className="mb-4 flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filter by status:</span>
          <div className="flex space-x-2">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
              data-testid="filter-all-residents"
            >
              All ({residents.length})
            </Button>
            <Button
              variant={statusFilter === 'active' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('active')}
              className={statusFilter === 'active' ? 'bg-green-600 hover:bg-green-700' : 'text-green-700 border-green-300 hover:bg-green-50'}
              data-testid="filter-active-residents"
            >
              Active ({residents.filter(r => (r.status || 'active') === 'active').length})
            </Button>
            <Button
              variant={statusFilter === 'inactive' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('inactive')}
              className={statusFilter === 'inactive' ? 'bg-gray-600 hover:bg-gray-700' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}
              data-testid="filter-inactive-residents"
            >
              Inactive ({residents.filter(r => r.status === 'inactive').length})
            </Button>
            <Button
              variant={statusFilter === 'graduated' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('graduated')}
              className={statusFilter === 'graduated' ? 'bg-blue-600 hover:bg-blue-700' : 'text-blue-700 border-blue-300 hover:bg-blue-50'}
              data-testid="filter-graduated-residents"
            >
              Graduated ({residents.filter(r => r.status === 'graduated').length})
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
              <Link href={`/house/${houseId}/onboard`}>
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
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                          <User className="text-primary w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900" data-testid="resident-name">
                            {resident.firstName} {resident.lastInitial}.
                          </h4>
                          <p className="text-sm text-gray-600" data-testid="resident-status">
                            {resident.status || 'Active'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-800"
                          data-testid="commitment-count"
                        >
                          {resident.commitmentCount} Commitments
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="bg-amber-100 text-amber-800"
                          data-testid="writeup-count"
                        >
                          {resident.writeupCount} Write-ups
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}