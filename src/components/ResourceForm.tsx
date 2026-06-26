import React, { useState, useRef, useEffect } from 'react';
import { UPSCCategories, ResourceType, Folder } from '../types';
import { 
  PlusCircle, 
  X, 
  ShieldAlert, 
  CheckCircle, 
  Upload, 
  Image as ImageIcon, 
  FileText, 
  ExternalLink, 
  Sparkles, 
  FolderPlus,
  StickyNote,
  Video,
  BookOpen
} from 'lucide-react';

interface ResourceFormProps {
  onClose: () => void;
  onSavePersonal: (item: { title: string; description: string; type: ResourceType; url: string; category: string; folderId?: string }) => Promise<void>;
  onSaveHub: (item: { title: string; description: string; type: ResourceType; url: string; category: string; folderId?: string }) => Promise<void>;
  isAdmin: boolean;
  currentUserDisplayName: string;
  folders: Folder[];
  initialItem?: any; // If supplied, we are editing!
}

export default function ResourceForm({
  onClose,
  onSavePersonal,
  onSaveHub,
  isAdmin,
  currentUserDisplayName,
  folders,
  initialItem
}: ResourceFormProps) {
  const isEditMode = !!initialItem;
  
  // States
  const [title, setTitle] = useState(initialItem?.title || '');
  const [description, setDescription] = useState(initialItem?.description || '');
  const [type, setType] = useState<ResourceType>(initialItem?.type || 'link');
  const [url, setUrl] = useState(initialItem?.url || '');
  const [category, setCategory] = useState(initialItem?.category || 'GS1');
  const [folderId, setFolderId] = useState(initialItem?.folderId || '');
  const [targetVault, setTargetVault] = useState<'personal' | 'hub'>(initialItem?.createdByName ? 'hub' : 'personal');
  
  // Decide initial feeding method: if URL has binary data, it's a local file upload
  const [uploadMethod, setUploadMethod] = useState<'url' | 'file'>(
    initialItem?.url?.startsWith('data:') 
      ? 'file' 
      : (initialItem?.type === 'photo' ? 'file' : 'url')
  );
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevTypeRef = useRef<ResourceType>(type);

  // If changing type, we clear or reset URL unless editing
  useEffect(() => {
    // Only run if the user manually changed the format type in the UI, not on initial render
    if (prevTypeRef.current !== type) {
      if (type === 'note') {
        setUrl('NOTE: ');
      } else if (type === 'photo') {
        setUploadMethod('file');
        setUrl('');
      } else {
        // Keep selected method or defaults, clear URL to invite fresh insert
        setUrl('');
      }
      prevTypeRef.current = type;
    }
  }, [type]);

  // Handle standard upload file reading
  const handleLocalFile = (file: File) => {
    if (!file) return;

    // Type checking
    if (type === 'photo' && !file.type.startsWith('image/')) {
      setError("Please supply a valid image file (PNG/JPG/WEBP).");
      return;
    }
    if (type === 'pdf' && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError("Please select a valid PDF file.");
      return;
    }
    if (type === 'video' && !file.type.startsWith('video/')) {
      setError("Please select a valid video lecture file (e.g. MP4/WEBM/MOV).");
      return;
    }

    // Size limit
    const maxSize = 525 * 1024 * 1024; // 525MB (increased 15x from 35MB)
    if (file.size > maxSize) {
      setError(`Your file (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds 525MB. UPSC SafeVault files are restricted to max 525MB. For larger files, prefer Google Drive pointers using 'Web Address Link' mode.`);
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setUrl(e.target.result as string);
        
        // Auto-populate title with file name if dry
        if (!title.trim() && file.name) {
          const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
          setTitle(cleanName);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleLocalFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleLocalFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Form Validation rules
    if (!title.trim()) {
      setError("Please supply a descriptive title for this UPSC topic.");
      return;
    }
    if (!url.trim()) {
      if (type === 'note') {
        setError("Please compose some study notes or paste your synced contents.");
      } else if (uploadMethod === 'file') {
        setError(`Please upload a valid ${type.toUpperCase()} file from your workspace.`);
      } else {
        setError("Please provide a resource URL or study PDF pointer.");
      }
      return;
    }

    if (type !== 'note') {
      if (uploadMethod === 'file') {
        if (!url.startsWith('data:')) {
          setError("File state is inconsistent. Please re-upload your local file.");
          return;
        }
      } else {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          setError("Resource URLs must begin with http:// or https://");
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        type,
        url: url.trim(),
        category,
        folderId: folderId || ""
      };

      if (targetVault === 'hub') {
        if (!isAdmin) {
          throw new Error("Resource Hub uploads are strictly restricted to verified UPSC mentors and administrators.");
        }
        await onSaveHub(payload);
      } else {
        await onSavePersonal(payload);
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto" id="resource_form_overlay">
      <div className="bg-white border border-[#E5E7EB] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative text-[#1A1A1A] my-8" id="resource_form_container">
        
        {/* Header decoration bar */}
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8FAFC]">
          <h3 className="text-sm font-display font-bold text-olive-900 flex items-center gap-1.5 uppercase tracking-wide">
            <PlusCircle className="w-5 h-5 text-olive-600" />
            {isEditMode ? "Modify Indexed UPSC Material" : "Index UPSC Study Material"}
          </h3>
          <button 
            onClick={onClose} 
            className="p-1.5 text-[#94A3B8] hover:text-olive-900 hover:bg-olive-50 rounded-lg transition-all"
            type="button"
            lg-id="close-form-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          
          {/* Target Vault Selection (Disabled when editing) */}
          {!isEditMode && (
            <div className="space-y-1.5 font-sans">
              <label className="text-[10px] font-bold text-[#94A3B8] block uppercase tracking-widest font-sans">Destination Space</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTargetVault('personal')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    targetVault === 'personal'
                      ? 'bg-olive-50 border-olive-600 text-olive-900 font-bold'
                      : 'bg-white border-[#E5E7EB] text-[#64748B] hover:border-olive-200 hover:text-olive-900'
                  }`}
                  lg-id="select-personal-dest"
                >
                  <span className="text-xs font-bold font-sans">Personal Vault</span>
                  <span className="text-[9px] font-mono mt-1 opacity-80">Private Isolated Space</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (isAdmin) {
                      setTargetVault('hub');
                    }
                  }}
                  disabled={!isAdmin}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all relative ${
                    !isAdmin 
                      ? 'opacity-40 bg-[#F8FAFC] border-[#E5E7EB] text-slate-400 cursor-not-allowed'
                      : targetVault === 'hub'
                        ? 'bg-olive-50/70 border-olive-600 text-olive-900 font-bold'
                        : 'bg-white border-[#E5E7EB] text-[#64748B] hover:border-olive-200 hover:text-olive-900'
                  }`}
                  title={!isAdmin ? "Resource Hub uploads are restricted to experts/admins" : "Upload to Public Library"}
                  lg-id="select-hub-dest"
                >
                  <span className="text-xs font-bold font-sans flex items-center gap-1">
                    Resource Hub
                  </span>
                  <span className="text-[9px] font-mono mt-1 opacity-80">Shared Community Curation</span>
                  {!isAdmin && (
                    <span className="absolute top-1 right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-olive-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-olive-500"></span>
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {targetVault === 'hub' && isAdmin && (
            <div className="flex items-center gap-2 text-[11px] font-sans text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
              <CheckCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
              <span>Expert Privilege Active: Saving to Hub as <strong>{currentUserDisplayName}</strong>.</span>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#64748B] block uppercase tracking-widest font-sans">Document / Material Title*</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Laxmikanth Chapter 5: Fundamental Rights Mindmap"
              className="w-full bg-[#F8F9FA] border border-[#E5E7EB] focus:bg-white focus:border-olive-600 rounded-xl px-4 py-2.5 text-xs text-[#1A1A1A] placeholder-[#94A3B8] outline-none transition-colors font-sans"
              required
              id="field_title"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Format Mode */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#64748B] block uppercase tracking-widest font-sans">Format Mode</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ResourceType)}
                className="w-full bg-[#F8F9FA] border border-[#E5E7EB] focus:bg-white focus:border-olive-600 rounded-xl px-3 py-2.5 text-xs text-[#1A1A1A] outline-none transition-colors cursor-pointer font-sans"
                id="field_type"
              >
                <option value="link">🌐 Web Link</option>
                <option value="pdf">📄 PDF Study Note</option>
                <option value="video">🎥 Lecture Video</option>
                <option value="photo">📸 Photo Post / File</option>
                <option value="note">✍️ Synced Custom Note</option>
                <option value="other">📚 General Material</option>
              </select>
            </div>

            {/* Syllabus Binder */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#64748B] block uppercase tracking-widest font-sans">Syllabus Binder</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#F8F9FA] border border-[#E5E7EB] focus:bg-white focus:border-olive-600 rounded-xl px-3 py-2.5 text-xs text-[#1A1A1A] outline-none transition-colors cursor-pointer font-sans"
                id="field_category"
              >
                {UPSCCategories.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.value} ({cat.label.split(':')[0]})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Folder Assignment Selection */}
          <div className="grid grid-cols-1 gap-1">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#64748B] block uppercase tracking-widest font-sans">Assign to Study Folder</label>
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full bg-[#F8F9FA] border border-[#E5E7EB] focus:bg-white focus:border-olive-600 rounded-xl px-3 py-2.5 text-xs text-[#1A1A1A] outline-none transition-colors cursor-pointer font-sans"
                id="field_folder"
              >
                <option value="">📂 No Custom Folder (Loose Vault File)</option>
                {folders.map(fold => (
                  <option key={fold.id} value={fold.id}>
                    📁 {fold.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Content Feeding Method Toggle (Not shown for note format) */}
          {type !== 'note' && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#64748B] block uppercase tracking-widest font-sans">Content Feeding Mode</label>
              <div className="grid grid-cols-2 gap-2 bg-[#F1F5F9] p-1 rounded-xl border border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => {
                    setUploadMethod('url');
                    // Wipe only if was a safe client-local file URL
                    if (url.startsWith('data:')) {
                      setUrl('');
                    }
                  }}
                  className={`py-1.5 rounded-lg text-xs font-semibold font-sans transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    uploadMethod === 'url'
                      ? 'bg-white text-olive-900 border border-olive-200 font-bold shadow-xs'
                      : 'text-[#64748B] hover:text-olive-900'
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5 text-olive-600" />
                  <span>🌍 Web URL Link</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUploadMethod('file');
                    // Wipe only if was not file URL
                    if (!url.startsWith('data:')) {
                      setUrl('');
                    }
                  }}
                  className={`py-1.5 rounded-lg text-xs font-semibold font-sans transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    uploadMethod === 'file'
                      ? 'bg-white text-olive-900 border border-olive-200 font-bold shadow-xs'
                      : 'text-[#64748B] hover:text-olive-900'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5 text-olive-600" />
                  <span>📁 Local File Upload</span>
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Inputs based on type Selection */}
          {type === 'note' ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-[#64748B] block uppercase tracking-widest font-sans">Synced Custom Study Note*</label>
                <span className="text-[9px] text-olive-800 bg-olive-50 px-1.5 py-0.2 rounded border border-olive-200 font-sans font-bold flex items-center gap-1">
                  <StickyNote className="w-3.5 h-3.5 text-olive-650" />
                  Synced Direct Notes
                </span>
              </div>
              <textarea
                value={url.startsWith('NOTE:') ? url.substring(5) : url}
                onChange={(e) => setUrl('NOTE:' + e.target.value)}
                placeholder="Compose study pointers or paste notes from another note website directly...&#13;Format: Mindmaps, Quotes, and Key points you need to backup and structure within UPSC Categories."
                rows={8}
                className="w-full bg-[#F8F9FA] border border-[#E5E7EB] focus:bg-white focus:border-olive-600 rounded-xl px-4 py-2.5 text-xs text-[#1A1A1A] placeholder-[#94A3B8] outline-none transition-colors font-mono resize-y min-h-[160px]"
                required
                id="field_custom_note"
              />
              <p className="text-[10px] text-[#94A3B8] font-mono">
                💡 Paste content from Imperial Notes or any external note workspace to sync them seamlessly within your secure SafeVault.
              </p>
            </div>
          ) : uploadMethod === 'file' ? (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#64748B] block uppercase tracking-widest font-sans">
                Upload {type.toUpperCase()} from My Files*
              </label>
              
              <div 
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                  dragActive 
                    ? "border-olive-600 bg-olive-50/50" 
                    : "border-[#E5E7EB] hover:border-olive-200"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept={
                    type === 'photo' 
                      ? 'image/*' 
                      : type === 'pdf' 
                        ? '.pdf,application/pdf' 
                        : type === 'video' 
                          ? 'video/*' 
                          : '*/*'
                  } 
                  className="hidden" 
                />
                
                {url && url.startsWith('data:') ? (
                  <div className="space-y-3">
                    {/* Visual preview based on type */}
                    {url.startsWith('data:image/') ? (
                      <img 
                        src={url} 
                        alt="UPSC Post upload preview" 
                        className="mx-auto max-h-[160px] rounded-lg border border-[#E5E7EB] object-cover" 
                      />
                    ) : url.startsWith('data:video/') ? (
                      <div className="mx-auto max-w-[200px] p-4 bg-slate-100 rounded-xl border border-slate-200 text-slate-700 flex flex-col items-center gap-1.5">
                        <Video className="w-8 h-8 text-blue-600 animate-pulse" />
                        <span className="text-xs font-bold text-slate-900 truncate max-w-full">
                          {title || "Attached Video"}
                        </span>
                        <span className="text-[10px] text-blue-600 font-mono font-bold uppercase">MP4/MOV Video Secured</span>
                      </div>
                    ) : url.startsWith('data:application/pdf') ? (
                      <div className="mx-auto max-w-[200px] p-4 bg-red-50 rounded-xl border border-red-200 text-red-750 flex flex-col items-center gap-1.5">
                        <FileText className="w-8 h-8 text-red-600" />
                        <span className="text-xs font-bold text-slate-900 truncate max-w-full">
                          {title || "Attached PDF"}
                        </span>
                        <span className="text-[10px] text-red-500 font-mono font-bold uppercase">PDF Document Secured</span>
                      </div>
                    ) : (
                      <div className="mx-auto max-w-[200px] p-4 bg-slate-100 rounded-xl border border-slate-200 text-slate-700 flex flex-col items-center gap-1.5">
                        <BookOpen className="w-8 h-8 text-indigo-600" />
                        <span className="text-xs font-bold text-slate-900 truncate max-w-full">
                          {title || "Attached File"}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">File Securely Locked</span>
                      </div>
                    )}
                    <p className="text-[10px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-150 inline-block font-mono leading-none">
                      ✅ File attached successfully. Click inside or drag again to replace.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="p-3 bg-[#F8FAFC] border border-[#E5E7EB] rounded-2xl text-[#94A3B8]">
                      <Upload className="w-5 h-5 text-slate-500" />
                    </div>
                    <p className="text-xs font-medium text-olive-900 font-sans">
                      Select or Drag-and-drop a {type.toUpperCase()} file from your system
                    </p>
                    <p className="text-[10px] text-[#94A3B8] font-mono">
                      {type === 'photo' 
                        ? 'Supports PNG, JPG, WEBP, GIF' 
                        : type === 'pdf' 
                          ? 'Supports standard PDF documents' 
                          : type === 'video' 
                            ? 'Supports MP4, MOV, WEBM lectures' 
                            : 'All formats supported'} (Max 525MB)
                    </p>
                  </div>
                )}
              </div>
              <p className="text-[9px] text-[#64748B] font-mono leading-relaxed">
                {isAdmin ? "🔒 Your file is scrambled locally inside your web-isolated browser into encrypted binary streams before syncing. Safe from direct administrative inspection." : "🔒 Your file is uploaded securely to your private vault."}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#64748B] block uppercase tracking-widest font-sans">Resource URL link / Drive Pointer*</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={
                  type === 'pdf' 
                    ? "e.g. https://drive.google.com/your-pdf-file-link" 
                    : type === 'video' 
                      ? "e.g. https://www.youtube.com/watch?v=..." 
                      : "e.g. https://drive.google.com/..."
                }
                className="w-full bg-[#F8F9FA] border border-[#E5E7EB] focus:bg-white focus:border-olive-600 rounded-xl px-4 py-2.5 text-xs text-[#1A1A1A] placeholder-[#94A3B8] outline-none transition-colors font-sans"
                required={type !== 'note' && uploadMethod === 'url'}
                id="field_url"
              />
              <p className="text-[10px] text-[#94A3B8] font-mono italic">
                {isAdmin ? "🔐 255-bit client scrambled before pushing cloud-database. Hidden from direct scrapers." : "🔐 Secured link."}
              </p>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#64748B] block uppercase tracking-widest font-sans">Syllabus Context & Summary Notes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Covers Fundamental Rights under GS2. Focus on Landmark cases like Kesavananda Bharati."
              rows={3}
              className="w-full bg-[#F8F9FA] border border-[#E5E7EB] focus:bg-white focus:border-olive-600 rounded-xl px-4 py-2.5 text-xs text-[#1A1A1A] placeholder-[#94A3B8] outline-none transition-colors resize-none font-sans"
              id="field_description"
            />
          </div>

          {/* Error notifications */}
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 p-3 rounded-xl flex items-center gap-2 font-sans">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Success indicators */}
          {success && (
            <div className="text-xs text-olive-800 bg-olive-50 border border-olive-200 p-3 rounded-xl flex items-center gap-2 font-sans">
              <CheckCircle className="w-4 h-4 flex-shrink-0 text-olive-600" />
              <span>Record written and secured! Transitioning workspace...</span>
            </div>
          )}

          {/* Controls Footer */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#E5E7EB]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-olive-900 bg-white border border-[#E5E7EB] hover:bg-olive-50 rounded-xl transition-colors cursor-pointer font-sans"
              lg-id="cancel-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-xs font-bold rounded-xl text-white bg-olive-700 hover:bg-olive-800 hover:shadow transition-all shadow-md select-none cursor-pointer flex items-center gap-1.5 font-sans"
              lg-id="submit-btn"
            >
              {isSubmitting ? "Securing record..." : isEditMode ? "Update Changes" : "Write to Vault"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
