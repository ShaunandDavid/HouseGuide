import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Login from "@/pages/Login";
import House from "@/pages/House";
import Resident from "@/pages/Resident";
import TrackerDashboard from "@/pages/TrackerDashboard";
import GoalTracker from "@/pages/GoalTracker";
import ChecklistTracker from "@/pages/ChecklistTracker";
import ChoreTracker from "@/pages/ChoreTracker";
import AccomplishmentTracker from "@/pages/AccomplishmentTracker";
import IncidentTracker from "@/pages/IncidentTracker";
import MeetingTracker from "@/pages/MeetingTracker";
import ProgramFeesTracker from "@/pages/ProgramFeesTracker";
import NotFound from "@/pages/not-found";

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(() => {
      // Service worker registered successfully
    })
    .catch(() => {
      // Service worker registration failed
    });
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/house/:houseId" component={House} />
      <Route path="/resident/:id" component={Resident} />
      <Route path="/resident/:id/trackers" component={TrackerDashboard} />
      <Route path="/resident/:id/goals" component={GoalTracker} />
      <Route path="/resident/:id/checklist" component={ChecklistTracker} />
      <Route path="/resident/:id/chores" component={ChoreTracker} />
      <Route path="/resident/:id/accomplishments" component={AccomplishmentTracker} />
      <Route path="/resident/:id/incidents" component={IncidentTracker} />
      <Route path="/resident/:id/meetings" component={MeetingTracker} />
      <Route path="/resident/:id/fees" component={ProgramFeesTracker} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
