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
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/new" element={<ProjectEditor />} />
              <Route path="/projects/:id" element={<ProjectEditor />} />
              <Route path="/company" element={<RoleRoute allow={["admin"]}><CompanyProfile /></RoleRoute>} />
              <Route path="/exports" element={<Exports />} />
              <Route path="/template" element={<RoleRoute allow={["admin"]}><TemplateDesigner /></RoleRoute>} />
              <Route path="/team" element={<RoleRoute allow={["admin"]}><Team /></RoleRoute>} />
              <Route path="/me" element={<MyProfile />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
