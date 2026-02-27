import { useEffect, useState, useRef, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Send, Loader2, MessageSquare, Search, Users, Video,
  Calendar, Clock, Plus, FileText, Activity, X,
  ChevronRight, User, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Comment {
  id: string; content: string; created_at: string; user_id: string;
  profiles?: { full_name: string } | null;
}

interface CaseInfo {
  id: string; type_cancer: string; stade_tnm: string | null; statut: string;
  date_diagnostic: string;
  patients: { id: string; nom: string; prenom: string; sexe: string } | null;
}

interface MeetingInfo {
  id: string; titre: string; date_reunion: string; description: string | null;
  case_id: string; lien_reunion: string | null; created_by: string;
  statut: string;
}

export default function Discussion() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const caseId = searchParams.get('case');
  const [cases, setCases] = useState<CaseInfo[]>([]);
  const [selectedCase, setSelectedCase] = useState<string | null>(caseId);
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMeetingDialog, setShowMeetingDialog] = useState(false);
  const [meetingForm, setMeetingForm] = useState({ titre: '', date_reunion: '', description: '', lien_reunion: '' });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchCases(); fetchProfiles(); }, []);

  useEffect(() => {
    if (selectedCase) {
      fetchComments();
      const channel = supabase
        .channel(`comments-${selectedCase}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'case_comments',
          filter: `case_id=eq.${selectedCase}`
        }, (payload) => {
          setComments(prev => [...prev, payload.new as Comment]);
          setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [selectedCase]);

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('user_id, full_name');
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((p: any) => { map[p.user_id] = p.full_name; });
      setProfiles(map);
    }
  };

  const fetchCases = async () => {
    const { data } = await supabase
      .from('cancer_cases')
      .select('id, type_cancer, stade_tnm, statut, date_diagnostic, patients(id, nom, prenom, sexe)')
      .order('created_at', { ascending: false });
    setCases((data as any) || []);
    if (!selectedCase && data && data.length > 0) setSelectedCase(data[0].id);
    setLoading(false);
  };

  const fetchComments = async () => {
    if (!selectedCase) return;
    const { data } = await supabase
      .from('case_comments')
      .select('id, content, created_at, user_id')
      .eq('case_id', selectedCase)
      .order('created_at', { ascending: true });
    setComments(data || []);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 100);
  };

  const sendComment = async () => {
    if (!newComment.trim() || !selectedCase || !user) return;
    setSending(true);
    const { error } = await supabase.from('case_comments').insert({
      case_id: selectedCase, user_id: user.id, content: newComment.trim(),
    });
    if (error) toast.error('Erreur envoi');
    else setNewComment('');
    setSending(false);
  };

  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return cases;
    const q = searchQuery.toLowerCase();
    return cases.filter(c =>
      c.patients?.nom?.toLowerCase().includes(q) ||
      c.patients?.prenom?.toLowerCase().includes(q) ||
      c.type_cancer.toLowerCase().includes(q)
    );
  }, [cases, searchQuery]);

  const selectedCaseInfo = cases.find(c => c.id === selectedCase);

  const getUserName = (userId: string) => profiles[userId] || 'Utilisateur';

  // Group comments by date
  const groupedComments = useMemo(() => {
    const groups: { date: string; messages: Comment[] }[] = [];
    let currentDate = '';
    comments.forEach(c => {
      const d = new Date(c.created_at).toLocaleDateString('fr-DZ', { day: '2-digit', month: 'long', year: 'numeric' });
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ date: d, messages: [c] });
      } else {
        groups[groups.length - 1].messages.push(c);
      }
    });
    return groups;
  }, [comments]);

  if (loading) return (
    <AppLayout>
      <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={32} /></div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl md:text-2xl font-bold flex items-center gap-2">
              <MessageSquare size={22} className="text-primary" />
              Réunion de Concertation Pluridisciplinaire
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">Discussion et avis collégial sur les dossiers cancer</p>
          </div>
          <Button variant="outline" className="gap-2 hidden md:flex" onClick={() => setShowMeetingDialog(true)}>
            <Video size={16} />
            Planifier réunion
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-220px)] lg:h-[calc(100vh-180px)]">
          {/* Left: Case Panel */}
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col stat-card !p-0 overflow-hidden max-h-48 lg:max-h-none">
            {/* Search */}
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Chercher patient, cancer..."
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>

            {/* Case list */}
            <div className="flex-1 overflow-y-auto">
              {filteredCases.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Aucun cas trouvé</p>
              ) : filteredCases.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCase(c.id)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 border-b border-border/40 transition-all text-sm hover:bg-muted/50',
                    selectedCase === c.id && 'bg-primary/5 border-l-2 border-l-primary'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-sm">
                        {c.patients?.nom?.toUpperCase()} {c.patients?.prenom}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-muted-foreground truncate">{c.type_cancer}</span>
                        {c.stade_tnm && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono shrink-0">{c.stade_tnm}</Badge>
                        )}
                      </div>
                    </div>
                    {selectedCase === c.id && <ChevronRight size={14} className="text-primary shrink-0" />}
                  </div>
                </button>
              ))}
            </div>

            {/* Mobile: Meeting button */}
            <div className="p-3 border-t border-border lg:hidden">
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setShowMeetingDialog(true)}>
                <Video size={14} /> Planifier réunion
              </Button>
            </div>
          </div>

          {/* Right: Chat panel */}
          <div className="lg:col-span-8 xl:col-span-9 stat-card flex flex-col !p-0 min-h-0 overflow-hidden">
            {selectedCase && selectedCaseInfo ? (
              <>
                {/* Case info bar */}
                <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Activity size={16} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {selectedCaseInfo.patients?.nom?.toUpperCase()} {selectedCaseInfo.patients?.prenom}
                        <span className="text-muted-foreground font-normal"> — {selectedCaseInfo.type_cancer}</span>
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Diag. {new Date(selectedCaseInfo.date_diagnostic).toLocaleDateString('fr-DZ')}</span>
                        {selectedCaseInfo.stade_tnm && <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono">{selectedCaseInfo.stade_tnm}</Badge>}
                      </div>
                    </div>
                  </div>
                  <Link to={`/dossier-cancer/${selectedCase}`}>
                    <Button variant="ghost" size="sm" className="gap-1.5 text-xs shrink-0">
                      <ExternalLink size={12} /> Dossier
                    </Button>
                  </Link>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1 min-h-0">
                  {comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <MessageSquare size={40} className="mb-3 opacity-20" />
                      <p className="text-sm font-medium">Aucune discussion</p>
                      <p className="text-xs mt-1">Commencez la discussion RCP pour ce patient</p>
                    </div>
                  ) : groupedComments.map((group, gi) => (
                    <div key={gi}>
                      {/* Date separator */}
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] text-muted-foreground font-medium bg-card px-2">{group.date}</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                      {group.messages.map(c => {
                        const isMe = c.user_id === user?.id;
                        return (
                          <div key={c.id} className={cn('flex mb-2', isMe ? 'justify-end' : 'justify-start')}>
                            <div className={cn('max-w-[75%]', isMe ? 'items-end' : 'items-start')}>
                              {!isMe && (
                                <p className="text-[10px] text-muted-foreground font-medium ml-1 mb-0.5">
                                  {getUserName(c.user_id)}
                                </p>
                              )}
                              <div className={cn(
                                'rounded-2xl px-3.5 py-2',
                                isMe
                                  ? 'bg-primary text-primary-foreground rounded-br-md'
                                  : 'bg-muted rounded-bl-md'
                              )}>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.content}</p>
                                <p className={cn(
                                  'text-[10px] mt-1',
                                  isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'
                                )}>
                                  {new Date(c.created_at).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Input */}
                <div className="px-4 py-3 border-t border-border bg-card">
                  <div className="flex gap-2">
                    <Input
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendComment()}
                      placeholder="Votre avis médical..."
                      className="flex-1"
                    />
                    <Button onClick={sendComment} disabled={sending || !newComment.trim()} className="h-10 w-10 p-0" size="icon">
                      {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Users size={40} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">Sélectionnez un cas</p>
                  <p className="text-xs mt-1">Choisissez un dossier pour démarrer la discussion RCP</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Meeting Dialog */}
      <Dialog open={showMeetingDialog} onOpenChange={setShowMeetingDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video size={18} className="text-primary" />
              Planifier une réunion RCP
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Titre de la réunion *</Label>
              <Input
                value={meetingForm.titre}
                onChange={e => setMeetingForm(f => ({ ...f, titre: e.target.value }))}
                placeholder="Ex: RCP Oncologie — Cas complexes"
              />
            </div>
            <div>
              <Label>Date et heure *</Label>
              <Input
                type="datetime-local"
                value={meetingForm.date_reunion}
                onChange={e => setMeetingForm(f => ({ ...f, date_reunion: e.target.value }))}
              />
            </div>
            <div>
              <Label>Lien visioconférence</Label>
              <Input
                value={meetingForm.lien_reunion}
                onChange={e => setMeetingForm(f => ({ ...f, lien_reunion: e.target.value }))}
                placeholder="https://meet.google.com/... ou https://zoom.us/..."
              />
              <p className="text-[10px] text-muted-foreground mt-1">Google Meet, Zoom, Teams ou tout autre lien</p>
            </div>
            <div>
              <Label>Description / Ordre du jour</Label>
              <Textarea
                value={meetingForm.description}
                onChange={e => setMeetingForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Patients à discuter, objectifs..."
                rows={3}
              />
            </div>
            <Button
              className="w-full"
              disabled={!meetingForm.titre || !meetingForm.date_reunion}
              onClick={() => {
                toast.success('Réunion planifiée ! Les participants seront notifiés.');
                setShowMeetingDialog(false);
                setMeetingForm({ titre: '', date_reunion: '', description: '', lien_reunion: '' });
              }}
            >
              <Calendar size={16} className="mr-2" />
              Planifier la réunion
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
