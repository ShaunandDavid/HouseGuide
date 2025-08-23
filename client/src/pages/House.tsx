import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { Home, User, ChevronRight, Settings } from "lucide-react";
import { getHouseByName, getResidentsByHouse, getFilesByResident } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { House, Resident, FileRecord } from "@shared/schema";

interface ResidentWithCounts extends Resident {
  commitmentCount: number;
  writeupCount: number;
}

export default function House() {
  const { houseId } = useParams<{ houseId: string }>();
  const [house, setHouse] = useState<House | null>(null);
  const [residents, setResidents] = useState<ResidentWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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

  const loadHouseData = async (signal?: AbortSignal) => {
    if (!houseId) return;
    
    setIsLoading(true);
    try {
      // Load house data
      const houseData = await getHouseByName(houseId);
      setHouse(houseData);

      // Load residents
      const residentsData = await getResidentsByHouse(houseData.id);
      
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
    } catch (error) {
      // Failed to load house data - handled in UI
      toast({
        title: "Error Loading Data",
        description: "Failed to load house and resident information.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="house-loading">
        <Loading size="lg" />
      </div>
    );
  }

  if (!house) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <h1 className="text-xl font-bold text-gray-900 mb-2">House Not Found</h1>
            <p className="text-gray-600">The requested house could not be found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
                {house.name} House
              </h2>
              <p className="text-sm text-gray-600">Residential Care Facility</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" data-testid="settings-button">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Residents</h3>
          <p className="text-gray-600">Manage resident files and weekly reports</p>
        </div>

        {residents.length === 0 ? (
          <Card data-testid="no-residents">
            <CardContent className="pt-6 text-center">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Residents</h4>
              <p className="text-gray-600">No residents have been added to this house yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {residents.map((resident) => (
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
