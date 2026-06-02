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
import Gallery from "./pages/Gallery";
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
import MarketingLeads from "./pages/marketing/Leads";
import PublicLeadForm from "./pages/PublicLeadForm";
import PublicBookMeeting from "./pages/public/BookMeeting";
import PublicDropIn from "./pages/public/DropInRequest";
import PublicMeetingNote from "./pages/public/MeetingNoteShare";
import MeetingsScheduler from "./pages/meetings/Scheduler";
import MeetingsDropIn from "./pages/meetings/DropIn";
import MeetingsNotes from "./pages/meetings/Notes";
import MeetingsUpcoming from "./pages/meetings/Upcoming";
import EmailCampaigns from "./pages/marketing/email/Campaigns";
import EmailContacts from "./pages/marketing/email/Contacts";
import EmailLists from "./pages/marketing/email/Lists";
import EmailTemplates from "./pages/marketing/email/Templates";
import EmailAutomations from "./pages/marketing/email/Automations";
import EmailAnalytics from "./pages/marketing/email/Analytics";
import EmailSender from "./pages/marketing/email/Sender";
import WhatsAppSender from "./pages/marketing/whatsapp/Sender";
import WhatsAppContacts from "./pages/marketing/whatsapp/Contacts";
import WhatsAppLists from "./pages/marketing/whatsapp/Lists";
import WhatsAppTemplates from "./pages/marketing/whatsapp/Templates";
import WhatsAppCampaigns from "./pages/marketing/whatsapp/Campaigns";
import WhatsAppAutomations from "./pages/marketing/whatsapp/Automations";
import WhatsAppInbox from "./pages/marketing/whatsapp/Inbox";
import WhatsAppSnippets from "./pages/marketing/whatsapp/Snippets";
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
            <Route path="/leads/new/:token" element={<PublicLeadForm />} />
            <Route path="/book/:token" element={<PublicBookMeeting />} />
            <Route path="/u/:username" element={<PublicBookMeeting />} />
            <Route path="/dropin/:token" element={<PublicDropIn />} />
            <Route path="/notes/:token" element={<PublicMeetingNote />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<RoleRoute page="projects"><Projects /></RoleRoute>} />
              <Route path="/projects/new" element={<RoleRoute page="projects"><ProjectEditor /></RoleRoute>} />
              <Route path="/projects/:id" element={<RoleRoute page="projects"><ProjectEditor /></RoleRoute>} />
              <Route path="/gallery" element={<RoleRoute page="gallery"><Gallery /></RoleRoute>} />
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
              <Route path="/marketing" element={<RoleRoute page="marketing"><MarketingScheduler /></RoleRoute>} />
              <Route path="/marketing/analytics" element={<RoleRoute page="marketing"><MarketingAnalytics /></RoleRoute>} />
              <Route path="/marketing/competitors" element={<RoleRoute page="marketing"><MarketingCompetitors /></RoleRoute>} />
              <Route path="/marketing/connections" element={<RoleRoute page="marketing"><MarketingConnections /></RoleRoute>} />
              <Route path="/marketing/leads" element={<RoleRoute page="leads"><MarketingLeads /></RoleRoute>} />
              <Route path="/meetings/scheduler" element={<RoleRoute page="meetings"><MeetingsScheduler /></RoleRoute>} />
              <Route path="/meetings/dropin" element={<RoleRoute page="meetings"><MeetingsDropIn /></RoleRoute>} />
              <Route path="/meetings/notes" element={<RoleRoute page="meetings"><MeetingsNotes /></RoleRoute>} />
              <Route path="/meetings/upcoming" element={<RoleRoute page="meetings"><MeetingsUpcoming /></RoleRoute>} />
              <Route path="/marketing/email/campaigns" element={<RoleRoute page="email_marketing"><EmailCampaigns /></RoleRoute>} />
              <Route path="/marketing/email/contacts" element={<RoleRoute page="email_marketing"><EmailContacts /></RoleRoute>} />
              <Route path="/marketing/email/lists" element={<RoleRoute page="email_marketing"><EmailLists /></RoleRoute>} />
              <Route path="/marketing/email/templates" element={<RoleRoute page="email_marketing"><EmailTemplates /></RoleRoute>} />
              <Route path="/marketing/email/automations" element={<RoleRoute page="email_marketing"><EmailAutomations /></RoleRoute>} />
              <Route path="/marketing/email/analytics" element={<RoleRoute page="email_marketing"><EmailAnalytics /></RoleRoute>} />
              <Route path="/marketing/email/sender" element={<RoleRoute page="email_marketing"><EmailSender /></RoleRoute>} />
              <Route path="/marketing/whatsapp/sender" element={<RoleRoute page="whatsapp"><WhatsAppSender /></RoleRoute>} />
              <Route path="/marketing/whatsapp/contacts" element={<RoleRoute page="whatsapp"><WhatsAppContacts /></RoleRoute>} />
              <Route path="/marketing/whatsapp/lists" element={<RoleRoute page="whatsapp"><WhatsAppLists /></RoleRoute>} />
              <Route path="/marketing/whatsapp/templates" element={<RoleRoute page="whatsapp"><WhatsAppTemplates /></RoleRoute>} />
              <Route path="/marketing/whatsapp/campaigns" element={<RoleRoute page="whatsapp"><WhatsAppCampaigns /></RoleRoute>} />
              <Route path="/marketing/whatsapp/automations" element={<RoleRoute page="whatsapp"><WhatsAppAutomations /></RoleRoute>} />
              <Route path="/marketing/whatsapp/inbox" element={<RoleRoute page="whatsapp"><WhatsAppInbox /></RoleRoute>} />
              <Route path="/marketing/whatsapp/snippets" element={<RoleRoute page="whatsapp"><WhatsAppSnippets /></RoleRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
