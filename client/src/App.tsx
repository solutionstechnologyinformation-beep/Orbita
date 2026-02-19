import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Kanban from "./pages/Kanban";
import TaskDetail from "./pages/TaskDetail";
import Notifications from "./pages/Notifications";
import AIChat from "./pages/AIChat";
import Admin from "./pages/Admin";
import Profile from "./pages/Profile";
import Roles from "./pages/Roles";
import NotificationPreferences from "./pages/NotificationPreferences";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/projects" component={Projects} />
      <Route path="/projects/:id" component={ProjectDetail} />
      <Route path="/projects/:id/kanban" component={Kanban} />
      <Route path="/tasks/:id" component={TaskDetail} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/notification-preferences" component={NotificationPreferences} />
      <Route path="/chat" component={AIChat} />
      <Route path="/chat/:projectId" component={AIChat} />
      <Route path="/projects/:projectId/roles" component={Roles} />
      <Route path="/admin" component={Admin} />
      <Route path="/profile" component={Profile} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
