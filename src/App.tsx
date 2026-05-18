import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleRoute from "@/components/RoleRoute";
import AppLayout from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectEditor from "./pages/ProjectEditor";
import CompanyProfile from "./pages/CompanyProfile";
import Exports from "./pages/Exports";
import TemplateDesigner from "./pages/TemplateDesigner";
import Team from "./pages/Team";
import MyProfile from "./pages/MyProfile";
import Permissions from "./pages/Permissions";
import IdCards from "./pages/IdCards";
import FitoutDashboard from "./pages/fitout/Dashboard";
import FitoutTracker from "./pages/fitout/Tracker";
import FitoutProjectDetail from "./pages/fitout/ProjectDetail";
import FitoutTeam from "./pages/fitout/Team";
import FitoutProjectManagers from "./pages/fitout/ProjectManagers";
import MarketingScheduler from "./pages/marketing/Scheduler";
import MarketingAnalytics from "./pages/marketing/Analytics";
import MarketingCompetitors from "./pages/marketing/Competitors";
import MarketingConnections from "./pages/marketing/Connections";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<RoleRoute page="projects"><Projects /></RoleRoute>} />
              <Route path="/projects/new" element={<RoleRoute page="projects"><ProjectEditor /></RoleRoute>} />
              <Route path="/projects/:id" element={<RoleRoute page="projects"><ProjectEditor /></RoleRoute>} />
              <Route path="/company" element={<RoleRoute page="company"><CompanyProfile /></RoleRoute>} />
              <Route path="/exports" element={<RoleRoute page="exports"><Exports /></RoleRoute>} />
              <Route path="/template" element={<RoleRoute page="template"><TemplateDesigner /></RoleRoute>} />
              <Route path="/team" element={<RoleRoute page="team"><Team /></RoleRoute>} />
              <Route path="/me" element={<RoleRoute page="me"><MyProfile /></RoleRoute>} />
              <Route path="/id-cards" element={<RoleRoute page="idcards"><IdCards /></RoleRoute>} />
              <Route path="/permissions" element={<RoleRoute page="team"><Permissions /></RoleRoute>} />
              <Route path="/fitout" element={<RoleRoute page="fitout"><FitoutDashboard /></RoleRoute>} />
              <Route path="/fitout/projects" element={<RoleRoute page="fitout"><FitoutTracker /></RoleRoute>} />
              <Route path="/fitout/projects/:id" element={<RoleRoute page="fitout"><FitoutProjectDetail /></RoleRoute>} />
              <Route path="/fitout/team" element={<RoleRoute page="fitout"><FitoutTeam /></RoleRoute>} />
              <Route path="/fitout/managers" element={<RoleRoute page="fitout"><FitoutProjectManagers /></RoleRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
