import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target, CheckSquare, Home, Award, AlertTriangle, Users, DollarSign } from "lucide-react";

interface TrackerDashboardProps {
  embedded?: boolean;
}

export default function TrackerDashboard({ embedded = false }: TrackerDashboardProps) {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const handleGoBack = () => {
    setLocation(`/resident/${id}`);
  };

  const trackerCards = [
    {
      title: "Goal Tracker",
      description: "Set and track personal goals",
      icon: Target,
      color: "blue",
      path: `/resident/${id}/goals`,
      testId: "goal-tracker"
    },
    {
      title: "Client Checklist",
      description: "Phase, home group, step work, professional help, job",
      icon: CheckSquare,
      color: "green", 
      path: `/resident/${id}/checklist`,
      testId: "checklist-tracker"
    },
    {
      title: "Chore Tracker",
      description: "Track assigned chores and completion",
      icon: Home,
      color: "purple",
      path: `/resident/${id}/chores`,
      testId: "chore-tracker"
    },
    {
      title: "Accomplishment Tracker", 
      description: "Record achievements and milestones",
      icon: Award,
      color: "yellow",
      path: `/resident/${id}/accomplishments`,
      testId: "accomplishment-tracker"
    },
    {
      title: "Incident Tracker",
      description: "Document incidents and follow-ups",
      icon: AlertTriangle,
      color: "red",
      path: `/resident/${id}/incidents`,
      testId: "incident-tracker"
    },
    {
      title: "Meeting Tracker",
      description: "Track meeting attendance",
      icon: Users,
      color: "indigo",
      path: `/resident/${id}/meetings`,
      testId: "meeting-tracker"
    },
    {
      title: "Program Fees Tracker",
      description: "Manage fees and payments",
      icon: DollarSign,
      color: "emerald",
      path: `/resident/${id}/fees`,
      testId: "fees-tracker"
    }
  ];

  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: "bg-blue-100 text-blue-600 border-blue-200",
      green: "bg-green-100 text-green-600 border-green-200", 
      purple: "bg-purple-100 text-purple-600 border-purple-200",
      yellow: "bg-yellow-100 text-yellow-600 border-yellow-200",
      red: "bg-red-100 text-red-600 border-red-200",
      indigo: "bg-indigo-100 text-indigo-600 border-indigo-200",
      emerald: "bg-emerald-100 text-emerald-600 border-emerald-200"
    };
    return colorMap[color as keyof typeof colorMap] || "bg-gray-100 text-gray-600 border-gray-200";
  };

  return (
    <div
      className={embedded ? "flex flex-col bg-surface-50" : "min-h-screen flex flex-col bg-surface-50"}
      data-testid="tracker-dashboard"
    >
      {!embedded && (
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
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Tracking Dashboard</h2>
                <p className="text-sm text-gray-600">Resident progress and activity trackers</p>
              </div>
            </div>
          </div>
        </header>
      )}

      <main className={embedded ? "p-4" : "flex-1 p-4"}>
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Available Trackers</h3>
          <p className="text-gray-600">Select a tracker to view and manage resident progress</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trackerCards.map((tracker) => {
            const Icon = tracker.icon;
            return (
              <Card 
                key={tracker.title}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setLocation(tracker.path)}
                data-testid={tracker.testId}
              >
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getColorClasses(tracker.color)}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-1">{tracker.title}</h4>
                      <p className="text-sm text-gray-600">{tracker.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
