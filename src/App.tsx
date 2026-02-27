import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NewCase from "./pages/NewCase";
import CaseList from "./pages/CaseList";
import Statistics from "./pages/Statistics";
import Discussion from "./pages/Discussion";
import Admin from "./pages/Admin";
import PatientTimeline from "./pages/PatientTimeline";
import PatientDossier from "./pages/PatientDossier";
import CancerDossier from "./pages/CancerDossier";
import Agenda from "./pages/Agenda";
import Anapath from "./pages/Anapath";
import AssistanteDashboard from "./pages/AssistanteDashboard";
import EpidemiologisteDashboard from "./pages/EpidemiologisteDashboard";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  );
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
}

/** Redirect "/" to the right dashboard based on role */
function RoleBasedHome() {
  const { role, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  );
  if (role === 'epidemiologiste') return <EpidemiologisteDashboard />;
  if (role === 'anapath') return <Anapath />;
  if (role === 'assistante') return <AssistanteDashboard />;
  if (role === 'admin') return <Admin />;
  return <Dashboard />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/" element={<ProtectedRoute><RoleBasedHome /></ProtectedRoute>} />
            <Route path="/nouveau-cas" element={<ProtectedRoute><NewCase /></ProtectedRoute>} />
            <Route path="/cas" element={<ProtectedRoute><CaseList /></ProtectedRoute>} />
            <Route path="/statistiques" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
            <Route path="/discussion" element={<ProtectedRoute><Discussion /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/patient" element={<ProtectedRoute><PatientTimeline /></ProtectedRoute>} />
            <Route path="/dossier-patient/:id" element={<ProtectedRoute><PatientDossier /></ProtectedRoute>} />
            <Route path="/dossier-cancer/:id" element={<ProtectedRoute><CancerDossier /></ProtectedRoute>} />
            <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
            <Route path="/anapath" element={<ProtectedRoute><Anapath /></ProtectedRoute>} />
            <Route path="/assistante" element={<ProtectedRoute><AssistanteDashboard /></ProtectedRoute>} />
            <Route path="/epidemiologiste" element={<ProtectedRoute><EpidemiologisteDashboard /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
