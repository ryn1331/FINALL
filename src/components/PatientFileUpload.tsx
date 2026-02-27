import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Upload, FileText, Image, Film, X, Eye, Trash2, Loader2,
  FolderOpen, Download, FileSpreadsheet, FileCheck, Camera, Scan,
  Radio, HeartPulse, Microscope, ShieldCheck, ClipboardList,
} from 'lucide-react';

interface PatientFile {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  mime_type: string | null;
  notes: string | null;
  created_at: string;
}

const DOCUMENT_TYPES = [
  { value: 'irm', label: 'IRM', icon: Scan, color: 'text-purple-500 bg-purple-500/10', desc: 'Imagerie par résonance magnétique' },
  { value: 'scanner', label: 'Scanner / TDM', icon: Film, color: 'text-indigo-500 bg-indigo-500/10', desc: 'Tomodensitométrie' },
  { value: 'pet_scan', label: 'PET Scan / TEP', icon: HeartPulse, color: 'text-pink-500 bg-pink-500/10', desc: 'Tomographie par émission de positons' },
  { value: 'radio', label: 'Radiographie', icon: Radio, color: 'text-sky-500 bg-sky-500/10', desc: 'Radiographie standard' },
  { value: 'echographie', label: 'Échographie', icon: Scan, color: 'text-cyan-500 bg-cyan-500/10', desc: 'Ultrasonographie' },
  { value: 'mammographie', label: 'Mammographie', icon: Image, color: 'text-rose-400 bg-rose-400/10', desc: 'Dépistage mammaire' },
  { value: 'scintigraphie', label: 'Scintigraphie', icon: HeartPulse, color: 'text-amber-500 bg-amber-500/10', desc: 'Scintigraphie osseuse / thyroïdienne' },
  { value: 'biopsie', label: 'Biopsie / Lames', icon: Microscope, color: 'text-blue-500 bg-blue-500/10', desc: 'Prélèvement histologique' },
  { value: 'anapath', label: 'Rapport Anapath', icon: FileCheck, color: 'text-emerald-500 bg-emerald-500/10', desc: 'Compte-rendu anatomopathologique' },
  { value: 'biologie', label: 'Bilan Sanguin', icon: FileSpreadsheet, color: 'text-orange-500 bg-orange-500/10', desc: 'FNS, biochimie, marqueurs tumoraux' },
  { value: 'compte_rendu', label: 'Compte-rendu', icon: ClipboardList, color: 'text-teal-500 bg-teal-500/10', desc: 'CR opératoire, consultation, RCP' },
  { value: 'consentement', label: 'Consentement', icon: ShieldCheck, color: 'text-rose-500 bg-rose-500/10', desc: 'Formulaire de consentement' },
  { value: 'ordonnance', label: 'Ordonnance', icon: FileText, color: 'text-violet-500 bg-violet-500/10', desc: 'Prescriptions médicales' },
  { value: 'photo', label: 'Photo clinique', icon: Camera, color: 'text-lime-600 bg-lime-600/10', desc: 'Photo lésion, plaie, cicatrice' },
  { value: 'autre', label: 'Autre document', icon: FileText, color: 'text-muted-foreground bg-muted', desc: 'Tout autre document' },
];

const TYPE_MAP = Object.fromEntries(DOCUMENT_TYPES.map(t => [t.value, t]));

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  patientId: string;
  caseId?: string;
  compact?: boolean;
}

export default function PatientFileUpload({ patientId, caseId, compact }: Props) {
  const { user, role } = useAuth();
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showTypeDialog, setShowTypeDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUpload = role === 'medecin' || role === 'admin' || role === 'assistante' || role === 'anapath';
  const canDelete = role === 'admin';

  useEffect(() => { fetchFiles(); }, [patientId]);

  const fetchFiles = async () => {
    const { data } = await supabase.from('patient_files').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
    setFiles((data as PatientFile[]) || []);
    setLoading(false);
  };

  const handleFilesSelected = (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setPendingFiles(arr);
    setSelectedType('');
    setShowTypeDialog(true);
  };

  const confirmUpload = async () => {
    if (!user || !selectedType) return;
    setShowTypeDialog(false);
    setUploading(true);
    let successCount = 0;

    for (const file of pendingFiles) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} dépasse 20 MB`);
        continue;
      }

      const storagePath = `${patientId}/${selectedType}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from('patient-files').upload(storagePath, file);
      if (uploadErr) { toast.error(`Erreur upload ${file.name}`); continue; }

      const { error: dbErr } = await supabase.from('patient_files').insert({
        patient_id: patientId,
        case_id: caseId || null,
        file_name: file.name,
        file_path: storagePath,
        file_type: selectedType,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user.id,
      });
      if (dbErr) toast.error(`Erreur enregistrement ${file.name}`);
      else successCount++;
    }

    if (successCount > 0) {
      toast.success(`${successCount} fichier(s) uploadé(s)`);
      fetchFiles();
    }
    setPendingFiles([]);
    setUploading(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFilesSelected(e.dataTransfer.files);
  }, [patientId, caseId, user]);

  const handlePreview = async (file: PatientFile) => {
    const { data } = await supabase.storage.from('patient-files').createSignedUrl(file.file_path, 300);
    if (data?.signedUrl) {
      if (file.mime_type?.startsWith('image/') || file.mime_type === 'application/pdf') {
        setPreviewUrl(data.signedUrl);
        setPreviewName(file.file_name);
      } else {
        window.open(data.signedUrl, '_blank');
      }
    }
  };

  const handleDownload = async (file: PatientFile) => {
    const { data } = await supabase.storage.from('patient-files').createSignedUrl(file.file_path, 60);
    if (data?.signedUrl) {
      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = file.file_name;
      a.click();
    }
  };

  const handleDelete = async (file: PatientFile) => {
    if (!confirm(`Supprimer ${file.file_name} ?`)) return;
    await supabase.storage.from('patient-files').remove([file.file_path]);
    await supabase.from('patient_files').delete().eq('id', file.id);
    toast.success('Fichier supprimé');
    fetchFiles();
  };

  const grouped = files.reduce<Record<string, PatientFile[]>>((acc, f) => {
    const key = f.file_type || 'autre';
    (acc[key] = acc[key] || []).push(f);
    return acc;
  }, {});

  // Compact view for sidebar
  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-sm flex items-center gap-2">
            <FolderOpen size={16} className="text-primary" />
            Fichiers ({files.length})
          </h3>
          {canUpload && (
            <>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => e.target.files && handleFilesSelected(e.target.files)} />
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                <span className="ml-1.5">Upload</span>
              </Button>
            </>
          )}
        </div>
        {files.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun fichier</p>
        ) : (
          <div className="space-y-1">
            {files.slice(0, 5).map(f => {
              const cat = TYPE_MAP[f.file_type] || TYPE_MAP.autre;
              return (
                <div key={f.id} className="flex items-center gap-2 text-xs p-1.5 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => handlePreview(f)}>
                  <cat.icon size={14} className={cat.color.split(' ')[0]} />
                  <span className="flex-1 truncate">{f.file_name}</span>
                  <span className="text-muted-foreground">{formatSize(f.file_size)}</span>
                </div>
              );
            })}
            {files.length > 5 && <p className="text-[10px] text-muted-foreground text-center">+{files.length - 5} autres fichiers</p>}
          </div>
        )}
        <TypeSelectDialog
          open={showTypeDialog}
          onOpenChange={setShowTypeDialog}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          pendingFiles={pendingFiles}
          onConfirm={confirmUpload}
          uploading={uploading}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Upload zone */}
      {canUpload && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-2xl p-6 md:p-8 text-center transition-all duration-200 cursor-pointer',
            dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border/60 hover:border-primary/40 hover:bg-muted/30',
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" multiple className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.dcm,.dicom,.xls,.xlsx,.doc,.docx,.bmp,.tif,.tiff"
            onChange={e => e.target.files && handleFilesSelected(e.target.files)} />
          {uploading ? (
            <Loader2 size={36} className="mx-auto mb-3 animate-spin text-primary" />
          ) : (
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <Upload size={24} className="text-primary" />
            </div>
          )}
          <p className="font-semibold text-sm md:text-base">{uploading ? 'Upload en cours...' : 'Glissez-déposez vos fichiers ici'}</p>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto">
            IRM · Scanner · Radio · PET · Biopsie · Anapath · Bilans · Ordonnances · Photos cliniques — PDF, JPEG, PNG, DICOM — Max 20 MB
          </p>
        </div>
      )}

      {/* Quick type upload buttons */}
      {canUpload && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {DOCUMENT_TYPES.slice(0, 5).map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setSelectedType(t.value);
                fileInputRef.current?.click();
              }}
              className={cn(
                'flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border/40 transition-all',
                'hover:border-primary/30 hover:bg-primary/5 active:scale-95 text-center'
              )}
            >
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', t.color)}>
                <t.icon size={16} />
              </div>
              <span className="text-[11px] font-medium leading-tight">{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Files grouped by type */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : files.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <FolderOpen size={48} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">Aucun document dans ce dossier</p>
          <p className="text-xs mt-1">Uploadez des IRM, radios, biopsies, bilans...</p>
        </div>
      ) : (
        Object.entries(grouped).map(([type, typeFiles]) => {
          const cat = TYPE_MAP[type] || TYPE_MAP.autre;
          return (
            <div key={type} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', cat.color)}>
                  <cat.icon size={15} />
                </div>
                <h4 className="font-semibold text-sm">{cat.label}</h4>
                <Badge variant="secondary" className="text-[10px] h-5">{typeFiles.length}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {typeFiles.map(f => (
                  <div key={f.id} className="stat-card !p-3 flex items-center gap-3 group">
                    {f.mime_type?.startsWith('image/') ? (
                      <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0 cursor-pointer" onClick={() => handlePreview(f)}>
                        <FilePreviewThumb file={f} />
                      </div>
                    ) : (
                      <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center shrink-0', cat.color)}>
                        <cat.icon size={20} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.file_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatSize(f.file_size)} · {new Date(f.created_at).toLocaleDateString('fr-DZ')}
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePreview(f)} title="Prévisualiser">
                        <Eye size={13} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(f)} title="Télécharger">
                        <Download size={13} />
                      </Button>
                      {canDelete && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(f)} title="Supprimer">
                          <Trash2 size={13} />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* Type Select Dialog */}
      <TypeSelectDialog
        open={showTypeDialog}
        onOpenChange={setShowTypeDialog}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        pendingFiles={pendingFiles}
        onConfirm={confirmUpload}
        uploading={uploading}
      />

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={open => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye size={18} className="text-primary" />
              {previewName}
            </DialogTitle>
          </DialogHeader>
          {previewUrl && (
            previewUrl.includes('.pdf') || previewName.endsWith('.pdf') ? (
              <iframe src={previewUrl} className="w-full h-[70vh] rounded-lg" />
            ) : (
              <img src={previewUrl} alt={previewName} className="w-full max-h-[70vh] object-contain rounded-lg" />
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* Type selection dialog */
function TypeSelectDialog({
  open, onOpenChange, selectedType, onTypeChange, pendingFiles, onConfirm, uploading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedType: string;
  onTypeChange: (v: string) => void;
  pendingFiles: File[];
  onConfirm: () => void;
  uploading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen size={18} className="text-primary" />
            Type de document
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          {pendingFiles.length} fichier(s) sélectionné(s) — Choisissez la catégorie :
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
          {DOCUMENT_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => onTypeChange(t.value)}
              className={cn(
                'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center',
                selectedType === t.value
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border/40 hover:border-primary/30'
              )}
            >
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', t.color)}>
                <t.icon size={18} />
              </div>
              <span className="text-xs font-semibold leading-tight">{t.label}</span>
              <span className="text-[10px] text-muted-foreground leading-tight hidden sm:block">{t.desc}</span>
            </button>
          ))}
        </div>
        <Button onClick={onConfirm} disabled={!selectedType || uploading} className="w-full mt-3 h-11">
          {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Uploader {pendingFiles.length > 1 ? `${pendingFiles.length} fichiers` : pendingFiles[0]?.name}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/* Thumbnail preview for images */
function FilePreviewThumb({ file }: { file: PatientFile }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage.from('patient-files').createSignedUrl(file.file_path, 300).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl);
    });
  }, [file.file_path]);
  if (!url) return <div className="w-full h-full bg-muted animate-pulse" />;
  return <img src={url} alt="" className="w-full h-full object-cover" />;
}
