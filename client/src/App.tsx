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
import Gantt from "./pages/Gantt";
import Sprints from "./pages/Sprints";
import CalendarPage from "./pages/CalendarPage";
import TeamChat from "./pages/TeamChat";
import Whiteboard from "./pages/Whiteboard";
import Scheduling from "./pages/Scheduling";
import Reports from "./pages/Reports";
import JoinProject from "./pages/JoinProject";
import Plans from "./pages/Plans";

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
      <Route path="/gantt" component={Gantt} />
      <Route path="/sprints" component={Sprints} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/team-chat" component={TeamChat} />
      <Route path="/whiteboard" component={Whiteboard} />
      <Route path="/scheduling" component={Scheduling} />
      <Route path="/relatorios" component={Reports} />
      <Route path="/join" component={JoinProject} />
      <Route path="/planos" component={Plans} />
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
