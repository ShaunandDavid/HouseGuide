import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import VerifyEmail from "@/pages/VerifyEmail";
import OnboardResident from "@/pages/OnboardResident";
import House from "@/pages/House";
import Resident from "@/pages/Resident";
import TrackerDashboard from "@/pages/TrackerDashboard";
import ResidentDashboard from "@/pages/ResidentDashboard";
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
    .then(registration => {
      console.log('SW registered: ', registration);
    })
    .catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/dashboard" component={House} />
      <Route path="/dashboard/onboard" component={OnboardResident} />
      <Route path="/resident/:id" component={Resident} />
      <Route path="/resident/:id/trackers" component={TrackerDashboard} />
      {/* New sidebar-based dashboard routes */}
      <Route path="/resident/:id/dashboard" component={ResidentDashboard} />
      <Route path="/resident/:id/goals" component={ResidentDashboard} />
      <Route path="/resident/:id/checklist" component={ResidentDashboard} />
      <Route path="/resident/:id/chores" component={ResidentDashboard} />
      <Route path="/resident/:id/accomplishments" component={ResidentDashboard} />
      <Route path="/resident/:id/incidents" component={ResidentDashboard} />
      <Route path="/resident/:id/meetings" component={ResidentDashboard} />
      <Route path="/resident/:id/fees" component={ResidentDashboard} />
      <Route path="/resident/:id/reports" component={ResidentDashboard} />
      <Route path="/resident/:id/pictures" component={ResidentDashboard} />
      <Route path="/resident/:id/notes" component={ResidentDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Toaster />
        <Router />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
