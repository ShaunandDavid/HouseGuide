import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { ArrowLeft, Plus, AlertTriangle, Calendar, AlertCircle } from "lucide-react";
import { getResident, getIncidentsByResident } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { Resident, Incident } from "@shared/schema";

export default function IncidentTracker() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [resident, setResident] = useState<Resident | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
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
      // Load incidents from API
      try {
        const incidentsData = await getIncidentsByResident(id);
        setIncidents(incidentsData);
      } catch (error) {
        // Incidents data not available
        setIncidents([]);
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'behavioral': return 'bg-purple-100 text-purple-800';
      case 'medical': return 'bg-red-100 text-red-800';
      case 'property': return 'bg-orange-100 text-orange-800';
      case 'policy_violation': return 'bg-yellow-100 text-yellow-800';
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
      <div className="min-h-screen flex items-center justify-center" data-testid="incident-tracker-loading">
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
    <div className="min-h-screen flex flex-col bg-surface-50" data-testid="incident-tracker">
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={handleGoBack} data-testid="back-button">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="text-red-600 w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Incident Tracker</h2>
              <p className="text-sm text-gray-600">{resident.firstName} {resident.lastInitial}.</p>
            </div>
          </div>
          <Button data-testid="add-incident-button">
            <Plus className="w-4 h-4 mr-2" />
            Add Incident
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4">
        {incidents.length === 0 ? (
          <Card data-testid="no-incidents">
            <CardContent className="pt-6 text-center">
              <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Incidents Recorded</h4>
              <p className="text-gray-600 mb-4">Track incidents and ensure proper follow-up actions.</p>
              <Button data-testid="add-first-incident">
                <Plus className="w-4 h-4 mr-2" />
                Add First Incident
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4" data-testid="incidents-list">
            {incidents.map((incident) => (
              <Card key={incident.id} className="hover:shadow-md transition-shadow" data-testid={`incident-card-${incident.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 mb-2" data-testid="incident-description">
                        {incident.description}
                      </p>
                      {incident.actionTaken && (
                        <p className="text-sm text-gray-600 mb-2" data-testid="action-taken">
                          <strong>Action Taken:</strong> {incident.actionTaken}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col space-y-2">
                      <Badge className={getSeverityColor(incident.severity)} data-testid="incident-severity">
                        {incident.severity}
                      </Badge>
                      <Badge className={getTypeColor(incident.incidentType)} data-testid="incident-type">
                        {incident.incidentType.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      <span data-testid="incident-date">Occurred: {formatDate(incident.dateOccurred)}</span>
                    </div>
                    {incident.followUpRequired && (
                      <div className="flex items-center text-orange-600">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        <span data-testid="follow-up-required">Follow-up Required</span>
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