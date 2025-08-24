import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { ArrowLeft, Plus, Award, Calendar } from "lucide-react";
import { getResident, getAccomplishmentsByResident } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { Resident, Accomplishment } from "@shared/schema";

export default function AccomplishmentTracker() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [resident, setResident] = useState<Resident | null>(null);
  const [accomplishments, setAccomplishments] = useState<Accomplishment[]>([]);
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
      // Load accomplishments from API
      try {
        const accomplishmentsData = await getAccomplishmentsByResident(id);
        setAccomplishments(accomplishmentsData);
      } catch (error) {
        // Accomplishments data not available
        setAccomplishments([]);
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

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'personal': return 'bg-blue-100 text-blue-800';
      case 'work': return 'bg-green-100 text-green-800';
      case 'education': return 'bg-purple-100 text-purple-800';
      case 'recovery': return 'bg-orange-100 text-orange-800';
      case 'social': return 'bg-pink-100 text-pink-800';
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
      <div className="min-h-screen flex items-center justify-center" data-testid="accomplishment-tracker-loading">
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
    <div className="min-h-screen flex flex-col bg-surface-50" data-testid="accomplishment-tracker">
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={handleGoBack} data-testid="back-button">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
              <Award className="text-yellow-600 w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Accomplishment Tracker</h2>
              <p className="text-sm text-gray-600">{resident.firstName} {resident.lastInitial}.</p>
            </div>
          </div>
          <Button data-testid="add-accomplishment-button">
            <Plus className="w-4 h-4 mr-2" />
            Add Accomplishment
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4">
        {accomplishments.length === 0 ? (
          <Card data-testid="no-accomplishments">
            <CardContent className="pt-6 text-center">
              <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Accomplishments Recorded</h4>
              <p className="text-gray-600 mb-4">Celebrate achievements and milestones along the recovery journey.</p>
              <Button data-testid="add-first-accomplishment">
                <Plus className="w-4 h-4 mr-2" />
                Add First Accomplishment
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4" data-testid="accomplishments-list">
            {accomplishments.map((accomplishment) => (
              <Card key={accomplishment.id} className="hover:shadow-md transition-shadow" data-testid={`accomplishment-card-${accomplishment.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-1" data-testid="accomplishment-title">
                        {accomplishment.title}
                      </h4>
                      {accomplishment.description && (
                        <p className="text-sm text-gray-600 mb-2" data-testid="accomplishment-description">
                          {accomplishment.description}
                        </p>
                      )}
                    </div>
                    <Badge className={getCategoryColor(accomplishment.category)} data-testid="accomplishment-category">
                      {accomplishment.category}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-500">
                    <Calendar className="w-4 h-4 mr-1" />
                    <span data-testid="accomplishment-date">Achieved: {formatDate(accomplishment.dateAchieved)}</span>
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