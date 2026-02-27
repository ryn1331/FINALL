import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard, FilePlus, List, BarChart3, MessageSquare, LogOut, Sun, Moon, Shield, Calendar, Activity,
  Microscope, UserCheck, ClipboardList, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import medicalBg from '@/assets/medical-bg.jpg';

type NavItem = { to: string; icon: React.ElementType; label: string };

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  admin: [
    { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
    { to: '/nouveau-cas', icon: FilePlus, label: 'Nouveau Cas' },
    { to: '/cas', icon: List, label: 'Liste des Cas' },
    { to: '/agenda', icon: Calendar, label: 'Agenda' },
    { to: '/statistiques', icon: BarChart3, label: 'Statistiques' },
    { to: '/anapath', icon: Microscope, label: 'Anatomopath.' },
    { to: '/discussion', icon: MessageSquare, label: 'Discussion RCP' },
    { to: '/admin', icon: Shield, label: 'Administration' },
  ],
  medecin: [
    { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
    { to: '/nouveau-cas', icon: FilePlus, label: 'Nouveau Cas' },
    { to: '/cas', icon: List, label: 'Liste des Cas' },
    { to: '/agenda', icon: Calendar, label: 'Agenda' },
    { to: '/statistiques', icon: BarChart3, label: 'Statistiques' },
    { to: '/discussion', icon: MessageSquare, label: 'Discussion RCP' },
  ],
  epidemiologiste: [
    { to: '/epidemiologiste', icon: BarChart3, label: 'Registre' },
    { to: '/cas', icon: List, label: 'Liste des Cas' },
    { to: '/statistiques', icon: BarChart3, label: 'Statistiques' },
    { to: '/discussion', icon: MessageSquare, label: 'Discussion RCP' },
  ],
  anapath: [
    { to: '/anapath', icon: Microscope, label: 'Anatomopath.' },
    { to: '/cas', icon: List, label: 'Liste des Cas' },
    { to: '/discussion', icon: MessageSquare, label: 'Discussion RCP' },
  ],
  assistante: [
    { to: '/assistante', icon: ClipboardList, label: 'Accueil' },
    { to: '/nouveau-cas', icon: FilePlus, label: 'Nouveau Patient' },
    { to: '/cas', icon: List, label: 'Liste des Cas' },
    { to: '/agenda', icon: Calendar, label: 'Agenda' },
  ],
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  medecin: 'Médecin',
  epidemiologiste: 'Épidémiologiste',
  anapath: 'Anatomopathologiste',
  assistante: 'Assistante',
};

export default function AppLayout({ children }: { children: ReactNode }) {
  const { fullName, role, signOut } = useAuth();
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(false);

  const toggleDark = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const roleLabel = ROLE_LABELS[role || 'medecin'] || 'Utilisateur';
  const navItems = NAV_BY_ROLE[role || 'medecin'] || NAV_BY_ROLE.medecin;

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-[260px] z-40 overflow-hidden">
        <div className="absolute inset-0">
          <img src={medicalBg} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[hsl(215,32%,10%)]/95 via-[hsl(215,32%,10%)]/90 to-[hsl(215,32%,8%)]/95" />
        </div>

        <div className="relative z-10 flex flex-col h-full">
          {/* Brand */}
          <div className="px-6 py-5 border-b border-white/8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl medical-gradient flex items-center justify-center shadow-lg">
                <Activity className="text-white" size={20} />
              </div>
              <div>
                <h1 className="font-display font-bold text-sm text-white tracking-tight">Registre Cancer</h1>
                <p className="text-[11px] text-white/50 font-medium">Registre National · DZ</p>
              </div>
            </div>
          </div>

          {/* Role badge */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/8">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[11px] text-white/70 font-medium">{roleLabel}</span>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-white/12 text-white shadow-sm backdrop-blur-sm'
                      : 'text-white/55 hover:bg-white/8 hover:text-white/90'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200',
                    isActive
                      ? 'medical-gradient shadow-md'
                      : 'bg-white/6 group-hover:bg-white/10'
                  )}>
                    <item.icon size={16} className={isActive ? 'text-white' : ''} />
                  </div>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User */}
          <div className="p-4 border-t border-white/8">
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="w-9 h-9 rounded-full medical-gradient flex items-center justify-center text-white text-xs font-bold shadow-md">
                {fullName?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-white/90">{fullName || 'Utilisateur'}</p>
                <p className="text-[11px] text-white/40">{roleLabel}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={toggleDark} className="text-white/40 hover:text-white hover:bg-white/8 flex-1 h-8">
                {darkMode ? <Sun size={14} /> : <Moon size={14} />}
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut} className="text-white/40 hover:text-white hover:bg-white/8 flex-1 h-8">
                <LogOut size={14} />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 bg-card/95 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg medical-gradient flex items-center justify-center shadow-sm">
              <Activity className="text-white" size={16} />
            </div>
            <div>
              <span className="font-display font-bold text-sm">Registre Cancer</span>
              <span className="text-[10px] text-muted-foreground ml-1.5">{roleLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggleDark} className="h-8 w-8">
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8">
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Nav */}
      <nav className="bottom-nav lg:hidden">
        <div className="flex items-center justify-around px-2 py-1">
          {navItems.slice(0, 5).map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl text-xs transition-all min-w-[48px]',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                  isActive && 'bg-primary/10'
                )}>
                  <item.icon size={18} />
                </div>
                <span className="truncate max-w-[56px] font-medium">{item.label.split(' ')[0]}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="lg:pl-[260px] pt-14 lg:pt-0 pb-20 lg:pb-0">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="lg:pl-[260px] border-t border-border/50 bg-muted/20">
        <div className="px-4 md:px-6 lg:px-8 py-3 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>Registre National du Cancer — Algérie · Conforme Loi 18-07 & 25-11 ANPDP — Données Santé DZ</span>
          <span>DPO: dpo@chu-tlemcen.dz</span>
        </div>
      </footer>
    </div>
  );
}
