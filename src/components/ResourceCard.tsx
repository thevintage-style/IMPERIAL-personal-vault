import React, { useState } from 'react';
import { PersonalResource, ResourceHubItem, Folder, UPSCCategories } from '../types';
import { 
  FileText, 
  Video, 
  Link as LinkIcon, 
  BookOpen, 
  Trash2, 
  Download, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  BookmarkPlus,
  ShieldCheck,
  User,
  Check,
  Camera,
  FileEdit,
  FolderSync,
  StickyNote
} from 'lucide-react';

interface ResourceCardProps {
  key?: string;
  item: PersonalResource | ResourceHubItem;
  origin: 'personal' | 'hub';
  onDelete?: (id: string) => void;
  onImport?: (item: ResourceHubItem) => void;
  isAdmin: boolean;
  folders: Folder[];
  onEdit?: (item: any) => void;
  onMoveFolder?: (itemId: string, folderId: string) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string, checked: boolean) => void;
}

export default function ResourceCard({
  item,
  origin,
  onDelete,
  onImport,
  isAdmin,
  folders,
  onEdit,
  onMoveFolder,
  isSelected = false,
  onToggleSelect
}: ResourceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Find assigned folder details
  const assignedFolder = folders.find(f => f.id === item.folderId);

  // Parse category readable labels
  const categoryLabel = UPSCCategories.find(c => c.value === item.category)?.label || item.category;

  // Type helper icon & styles
  const getIconAndBg = () => {
    switch (item.type) {
      case 'pdf': return {
        icon: <FileText className="w-5 h-5 text-red-650" lg-id="pdf-icon" />,
        bg: 'bg-red-50/70 border border-red-100'
      };
      case 'video': return {
        icon: <Video className="w-5 h-5 text-blue-600" lg-id="video-icon" />,
        bg: 'bg-blue-50/70 border border-blue-100'
      };
      case 'link': return {
        icon: <LinkIcon className="w-5 h-5 text-emerald-600" lg-id="link-icon" />,
        bg: 'bg-emerald-50/70 border border-emerald-100'
      };
      case 'photo': return {
        icon: <Camera className="w-5 h-5 text-purple-600" lg-id="photo-icon" />,
        bg: 'bg-purple-50/70 border border-purple-100'
      };
      case 'note': return {
        icon: <StickyNote className="w-5 h-5 text-amber-600" lg-id="note-icon" />,
        bg: 'bg-amber-50/70 border border-amber-100'
      };
      default: return {
        icon: <BookOpen className="w-5 h-5 text-amber-600" lg-id="other-icon" />,
        bg: 'bg-amber-50/70 border border-amber-100'
      };
    }
  };

  const { icon, bg: iconBg } = getIconAndBg();

  // Extract YouTube ID for inline video lectures
  const getYouTubeId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const ytId = item.type === 'video' ? getYouTubeId(item.url) : null;

  const handleImportClick = async () => {
    if (origin === 'hub' && onImport) {
      setIsCopied(true);
      await onImport(item as ResourceHubItem);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleMoveChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onMoveFolder) {
      onMoveFolder(item.id, e.target.value);
    }
  };

  return (
    <div 
      className={`bg-white border text-[#1A1A1A] transition-all duration-300 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-[#CBD5E1] flex flex-col justify-between ${
        origin === 'hub' ? 'border-[#E5E7EB] border-l-4 border-l-amber-400 relative' : 'border-[#E5E7EB]'
      }`}
      id={`resource_card_${item.id}`}
    >
      {/* Shared tag flag in hub mode */}
      {origin === 'hub' && (
        <div className="absolute top-4 right-4 bg-amber-50 text-amber-700 text-[9px] font-bold px-2 py-0.5 rounded border border-amber-100 uppercase tracking-wider">
          Expert Hub
        </div>
      )}

      {/* Top Resource Block */}
      <div className="p-6">
        
        {/* Photo type header post visual preview (added like post from files) */}
        {item.type === 'photo' && item.url && item.url.startsWith('data:image') && (
          <div className="mb-4 -mt-2 aspect-video w-full rounded-xl overflow-hidden border border-[#E5E7EB] bg-slate-50 relative group">
            <img 
              src={item.url} 
              alt={item.title} 
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
            />
            <span className="absolute bottom-2 right-2 bg-slate-900/80 text-white text-[9.5px] font-mono px-2 py-0.5 rounded-md flex items-center gap-1 backdrop-blur-xs">
              <Camera className="w-3 h-3 text-purple-300" /> Image Post
            </span>
          </div>
        )}

        <div className="flex items-start justify-between gap-3 mb-4">
          {/* Category Badge & Encryption Indicator */}
          <div className="flex flex-wrap items-center gap-2">
            {onToggleSelect && (
              <div className="flex items-center mr-1">
                <input 
                  type="checkbox" 
                  checked={isSelected}
                  onChange={(e) => onToggleSelect(item.id, e.target.checked)}
                  id={`checkbox_${item.id}`}
                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 cursor-pointer transition-all accent-slate-950"
                  aria-label={`Select ${item.title}`}
                />
              </div>
            )}
            <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full border tracking-wide uppercase ${
              origin === 'hub' 
                ? 'bg-[#F8FAFC] text-slate-700 border-[#E5E7EB]' 
                : 'bg-[#F1F5F9] text-indigo-700 border-[#E5E7EB]'
            }`}>
              {item.category}
            </span>
            {isAdmin && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-700 bg-emerald-50/65 px-2 py-0.5 rounded border border-emerald-100" title="Decrypted inside client sandbox browser safely.">
                <ShieldCheck className="w-3 h-3" />
                AES Secured
              </span>
            )}
            {assignedFolder && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-150 font-bold max-w-[120px] truncate" title={`Assigned to: ${assignedFolder.name}`}>
                📂 {assignedFolder.name}
              </span>
            )}
          </div>

          {/* Type Icon Badge */}
          <div className={`p-2.5 rounded-xl ${iconBg}`}>
            {icon}
          </div>
        </div>

        {/* Title */}
        <h4 className="text-sm font-display font-bold text-[#0F172A] tracking-tight leading-snug line-clamp-2 hover:line-clamp-none mb-1.5 font-sans">
          {item.title}
        </h4>

        {/* Category Label subtitle */}
        <p className="text-[11px] text-[#64748B] mb-2 truncate font-sans">
          📋 {categoryLabel}
        </p>

        {/* Curation Admin Signature */}
        {origin === 'hub' && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#64748B] bg-[#F8FAFC] p-2 rounded-xl border border-[#E5E7EB] mb-3">
            <User className="w-3.5 h-3.5 text-amber-600" />
            <span className="truncate">Curator: <strong className="text-[#0F172A] font-sans font-medium">{(item as ResourceHubItem).createdByName}</strong></span>
          </div>
        )}

        {/* Custom Note direct previewpad */}
        {item.type === 'note' && item.url && item.url.startsWith('NOTE:') && (
          <div className="bg-[#FFFDF5] border border-[#F6E3B4] rounded-xl p-4 shadow-inner mb-4 max-h-[140px] overflow-y-auto regular-lines-decor">
            <p className="text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed">
              {item.url.substring(5)}
            </p>
          </div>
        )}

        {/* Brief Description */}
        <p className="text-xs text-[#64748B] leading-relaxed font-sans line-clamp-3 mb-4">
          {item.description || "No accompanying study notes. Add some summaries using the edit tool."}
        </p>

        {/* Expandable video frame */}
        {ytId && (
          <div className="mb-4 aspect-video w-full rounded-xl overflow-hidden border border-[#E5E7EB] bg-slate-950 shadow-sm relative font-sans">
            <iframe
              src={`https://www.youtube.com/embed/${ytId}`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="no-referrer"
              className="w-full h-full"
            ></iframe>
          </div>
        )}

        {/* Local Video playback */}
        {item.type === 'video' && item.url && item.url.startsWith('data:video') && (
          <div className="mb-4 aspect-video w-full rounded-xl overflow-hidden border border-[#E5E7EB] bg-slate-950 shadow-sm relative font-sans">
            <video
              src={item.url}
              controls
              className="w-full h-full object-contain"
            />
          </div>
        )}

        {/* Local PDF download/view action bar */}
        {item.type === 'pdf' && item.url && item.url.startsWith('data:application/pdf') && (
          <div className="mb-4 p-3 bg-red-50/50 border border-red-100 rounded-xl flex items-center justify-between gap-3 shadow-xs font-sans text-left">
            <div className="flex items-center gap-2.5 truncate">
              <div className="p-2 bg-red-100 rounded-lg text-red-700 flex-shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="text-left select-none truncate">
                <span className="text-xs font-bold block truncate text-slate-850">{item.title}.pdf</span>
                {isAdmin && (
                  <span className="text-[9px] font-mono text-red-600 font-bold uppercase block mt-0.5 leading-none">SECURE LOCAL ATTACHMENT</span>
                )}
              </div>
            </div>
            <a
              href={item.url}
              download={`${item.title}.pdf`}
              className="px-2.5 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-lg text-[9.5px] font-bold tracking-wide transition-all shadow-xs shrink-0 uppercase inline-flex items-center gap-1 cursor-pointer select-none"
            >
              <Download className="w-3.5 h-3.5" />
              Get PDF
            </a>
          </div>
        )}

        {/* Local General files download/view action bar */}
        {item.url && item.url.startsWith('data:') && !item.url.startsWith('data:image') && !item.url.startsWith('data:application/pdf') && !item.url.startsWith('data:video') && (
          <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-xs font-sans text-left">
            <div className="flex items-center gap-2.5 truncate">
              <div className="p-2 bg-slate-100 rounded-lg text-slate-700 flex-shrink-0">
                <BookOpen className="w-4 h-4 text-indigo-650" />
              </div>
              <div className="text-left select-none truncate">
                <span className="text-xs font-bold block truncate text-slate-850">{item.title}</span>
                {isAdmin && (
                  <span className="text-[9px] font-mono text-slate-500 font-bold uppercase block mt-0.5 leading-none">Scrambled Binary File</span>
                )}
              </div>
            </div>
            <a
              href={item.url}
              download={item.title}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[9.5px] font-bold tracking-wide transition-all shadow-xs shrink-0 uppercase inline-flex items-center gap-1 cursor-pointer select-none"
            >
              <Download className="w-3.5 h-3.5" />
              Get File
            </a>
          </div>
        )}

        {/* Action Description Details and URL Display */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-[#E5E7EB] space-y-3 text-xs font-sans text-[#64748B]">
            {item.type !== 'photo' && item.type !== 'note' && (
              <div className="bg-[#F8FAFC] p-2.5 rounded-xl border border-[#E5E7EB] overflow-x-auto text-left">
                <span className="font-mono text-[10px] text-[#94A3B8] block mb-1">{isAdmin ? "Decrypted Target Location:" : "Resource Link:"}</span>
                {item.url.startsWith('data:') ? (
                  <span className="text-emerald-700 font-mono text-xs font-bold block select-all">
                    📁 {isAdmin ? `Scrambled Client-side Encrypted Binary Asset (${((item.url.length * 0.75) / 1024).toFixed(1)} KB)` : "Local Attachment"}
                  </span>
                ) : (
                  <a 
                    href={item.url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-indigo-600 hover:underline font-mono break-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {item.url}
                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                  </a>
                )}
              </div>
            )}
            {item.description && (
              <div className="bg-[#F8FAFC] p-2.5 rounded-xl border border-[#E5E7EB] text-left">
                <span className="font-mono text-[10px] text-[#0F172A] block mb-1 font-bold">Notes & Syllabus Context:</span>
                <p className="whitespace-pre-line leading-relaxed text-[#1A1A1A]">{item.description}</p>
              </div>
            )}
            <div className="text-[10px] text-[#94A3B8] font-mono text-right capitalize">
              Updated: {item.createdAt.toLocaleDateString()}
            </div>
          </div>
        )}
      </div>

      {/* Card Action Controls Footer */}
      <div className="px-6 py-4 bg-[#F8FAFC] border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3 mt-auto">
        
        {/* Toggle Details Expander / Move dropdown widget (Personal Vault only) */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-mono text-[#64748B] hover:text-[#0F172A] flex items-center gap-1 transition-colors cursor-pointer mr-1"
            lg-id={`expand_btn_${item.id}`}
            type="button"
          >
            {isExpanded ? (
              <>
                Collapse
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                Details
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>

          {/* Inline Folder Relocation select control ("move file / notes") */}
          {origin === 'personal' && onMoveFolder && (
            <div className="flex items-center gap-1 bg-white border border-[#E5E7EB] rounded-lg px-2 py-1 shadow-xs text-[#64748B] hover:text-[#0F172A] transition-colors relative">
              <FolderSync className="w-3 h-3 text-slate-500 mr-0.5 flex-shrink-0" />
              <select
                value={item.folderId || ''}
                onChange={handleMoveChange}
                className="text-[10px] font-mono outline-none border-none bg-transparent cursor-pointer font-bold leading-none pr-1 max-w-[85px] truncate"
                title="Move file to another folder"
              >
                <option value="">Move folder ...</option>
                {folders.map(fold => (
                  <option key={fold.id} value={fold.id}>
                    📁 {fold.name}
                  </option>
                ))}
                <option value="unassigned">📂 Remove Folder</option>
              </select>
            </div>
          )}
        </div>

        {/* Standard Actions buttons */}
        <div className="flex items-center gap-1.5">
          {/* Edit trigger button (Personal only or Admin on Hub) */}
          {onEdit && (origin === 'personal' || (origin === 'hub' && isAdmin)) && (
            <button
              onClick={() => onEdit(item)}
              className="p-1.5 text-[#64748B] hover:text-indigo-600 bg-white hover:bg-indigo-50 border border-[#E5E7EB] hover:border-indigo-200 rounded-lg transition-colors outline-none cursor-pointer shadow-sm"
              title="Edit file / notes"
            >
              <FileEdit className="w-3.5 h-3.5" />
            </button>
          )}

          {/* "Copy to Personal Vault" trigger (For general users reading resource hub) */}
          {origin === 'hub' && onImport && (
            <button
              onClick={handleImportClick}
              disabled={isCopied}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-all outline-none cursor-pointer ${
                isCopied 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                  : 'bg-[#0F172A] hover:bg-[#1E293B] hover:shadow text-white'
              }`}
              title="Copy this curated study material to your Personal Vault!"
              lg-id={`import_btn_${item.id}`}
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 animate-bounce" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  <span>Save</span>
                </>
              )}
            </button>
          )}

          {/* Delete standard handles */}
          {((origin === 'personal' && onDelete) || (origin === 'hub' && isAdmin && onDelete)) && (
            <button
              onClick={() => onDelete?.(item.id)}
              className="p-1.5 text-[#64748B] hover:text-red-600 bg-white hover:bg-red-50 border border-[#E5E7EB] hover:border-red-200 rounded-lg transition-colors outline-none cursor-pointer shadow-sm"
              title="Delete from space"
              lg-id={`delete_btn_${item.id}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Source Launch Button (Hide for direct photos/notes which are saved locally as data) */}
          {item.type !== 'photo' && item.type !== 'note' && item.url && (
            item.url.startsWith('data:') ? (
              <a
                href={item.url}
                download={item.title + (item.type === 'pdf' ? '.pdf' : item.type === 'video' ? '.mp4' : '')}
                className="p-1.5 text-indigo-700 hover:text-[#0F172A] bg-indigo-50 hover:bg-[#F1F5F9] border border-indigo-150 rounded-lg transition-colors outline-none shadow-sm flex items-center justify-center cursor-pointer"
                title="Download secure local attachment"
                lg-id={`download_btn_${item.id}`}
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            ) : (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 text-[#64748B] hover:text-[#0F172A] bg-white hover:bg-[#F1F5F9] border border-[#E5E7EB] rounded-lg transition-colors outline-none shadow-sm flex items-center justify-center cursor-pointer"
                title="Launch resource study page"
                lg-id={`launch_btn_${item.id}`}
              >
                {item.type === 'pdf' ? (
                  <Download className="w-3.5 h-3.5" />
                ) : (
                  <ExternalLink className="w-3.5 h-3.5" />
                )}
              </a>
            )
          )}
        </div>
      </div>
    </div>
  );
}
