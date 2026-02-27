import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Shield } from 'lucide-react';
import { SERVICES_MEDICAUX } from '@/lib/wilayas';

type AppRole = 'admin' | 'medecin' | 'epidemiologiste' | 'anapath' | 'assistante';

export default function Auth() {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AppRole>('medecin');
  const [service, setService] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        toast.success('Connexion réussie');
      } else {
        await signUp(email, password, fullName, role);
        toast.success('Inscription réussie ! Vérifiez votre email pour confirmer votre compte.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl medical-gradient flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Shield className="text-primary-foreground" size={28} />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Registre National du Cancer</h1>
          <p className="text-muted-foreground mt-1">République Algérienne — MSPRH</p>
        </div>

        <div className="glass-card rounded-2xl p-6 md:p-8">
          <div className="flex gap-2 mb-6">
            <Button
              variant={isLogin ? 'default' : 'secondary'}
              className="flex-1"
              onClick={() => setIsLogin(true)}
            >
              Connexion
            </Button>
            <Button
              variant={!isLogin ? 'default' : 'secondary'}
              className="flex-1"
              onClick={() => setIsLogin(false)}
            >
              Inscription
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <Label htmlFor="fullName">Nom complet</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dr. Ahmed Benali" required className="mt-1" />
              </div>
            )}

            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="medecin@chu-tlemcen.dz" required className="mt-1" />
            </div>

            <div>
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="mt-1" />
            </div>

            {!isLogin && (
              <div>
                <Label htmlFor="role">Rôle</Label>
                <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medecin">Médecin (Clinicien)</SelectItem>
                    <SelectItem value="epidemiologiste">Épidémiologiste</SelectItem>
                    <SelectItem value="anapath">Anatomopathologiste</SelectItem>
                    <SelectItem value="assistante">Assistante Médicale</SelectItem>
                    <SelectItem value="admin">Administrateur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {!isLogin && (
              <div>
                <Label htmlFor="service">Service / Département</Label>
                <Select value={service} onValueChange={setService}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sélectionner (optionnel)" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICES_MEDICAUX.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!isLogin && (
              <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" required className="mt-0.5 accent-primary" />
                <span>J'accepte le traitement de mes données conformément à la <strong>Loi 18-07</strong> relative à la protection des données personnelles (ANPDP).</span>
              </label>
            )}

            <Button type="submit" className="w-full h-12" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? 'Se connecter' : "S'inscrire"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Registre National du Cancer — MSPRH · Algérie<br />
          Conforme Loi 18-07 & 25-11 ANPDP — Hébergement DZ
        </p>
      </div>
    </div>
  );
}
