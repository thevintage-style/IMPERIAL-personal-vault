import React, { useState, useEffect, useMemo } from 'react';
import { 
  subscribeToAuth, 
  subscribePersonalResources, 
  subscribeResourceHub, 
  savePersonalResource, 
  deletePersonalResource, 
  saveResourceHubItem, 
  deleteResourceHubItem, 
  importItemToPersonalVault, 
  signInWithGoogle, 
  signOutUser,
  subscribeFolders,
  saveFolder,
  deleteFolder
} from './lib/vaultService';
import { isLocalSandbox } from './lib/firebase';
import { PersonalResource, ResourceHubItem, UPSCCategories, ResourceType, UserProfile, Folder } from './types';
import VaultStats from './components/VaultStats';
import ResourceCard from './components/ResourceCard';
import ResourceForm from './components/ResourceForm';
import { 
  ShieldCheck, 
  BookOpen, 
  Users, 
  Search, 
  Plus, 
  LogOut, 
  Info, 
  Lock, 
  Filter, 
  Grid,
  Sparkles,
  ClipboardList,
  AlertTriangle,
  FolderOpen,
  FolderPlus,
  ExternalLink,
  ChevronRight,
  Trash2,
  StickyNote
} from 'lucide-react';

export default function App() {
  // Authentication & Session States
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'personal' | 'hub'>('personal');

  // Resource Database States
  const [personalResources, setPersonalResources] = useState<PersonalResource[]>([]);
  const [hubResources, setHubResources] = useState<ResourceHubItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  
  // Dashboard Interactive States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(true);

  // Folder Creator Input State
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Multi-select and Batch Operations State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Subscribe to Authentication transitions
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to Private Personal Resources once authenticated
  useEffect(() => {
    if (!currentUser) {
      setPersonalResources([]);
      return;
    }
    const unsubscribe = subscribePersonalResources(currentUser.uid, (items) => {
      setPersonalResources(items);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Subscribe to Public Expert Curated Resource Hub
  useEffect(() => {
    if (!currentUser) {
      setHubResources([]);
      return;
    }
    const unsubscribe = subscribeResourceHub((items) => {
      setHubResources(items);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Subscribe to Folders collection
  useEffect(() => {
    if (!currentUser) {
      setFolders([]);
      return;
    }
    const unsubscribe = subscribeFolders(currentUser.uid, (data) => {
      setFolders(data);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Clear selection on filter and tab updates
  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab, selectedCategory, selectedType, selectedFolderId, searchQuery]);

  // Handle Authentication trigger
  const handleSignIn = async () => {
    try {
      setErrorBanner(null);
      await signInWithGoogle();
    } catch (err: any) {
      setErrorBanner(err?.message || "Google Authenticate error. Verify login popup properties.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (err: any) {
      console.error(err);
    }
  };

  // Helper folder creation
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newFolderName.trim()) return;
    try {
      const payload = {
        id: "fold_" + Math.random().toString(36).substring(2, 11),
        name: newFolderName.trim()
      };
      await saveFolder(currentUser.uid, payload);
      setNewFolderName('');
      setIsCreatingFolder(false);
    } catch (err: any) {
      console.error(err);
      alert("Folder writing failed. Check DB access security rules.");
    }
  };

  // Helper folder delete
  const handleDeleteFolder = async (folderId: string) => {
    if (!currentUser) return;
    if (confirm("Are you sure you want to delete this folder? The items belonging to this folder will remain in your vault, but they will become unassigned.")) {
      try {
        await deleteFolder(currentUser.uid, folderId);
        // Clean matching state if active
        if (selectedFolderId === folderId) {
          setSelectedFolderId('');
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Move items between folders on the fly
  const handleMoveFolder = async (itemId: string, targetFolderId: string) => {
    if (!currentUserZone()) return;
    const item = personalResources.find(x => x.id === itemId);
    if (!item) return;

    try {
      const updatedFolderId = targetFolderId === 'unassigned' ? '' : targetFolderId;
      await savePersonalResource(currentUserZone().uid, {
        title: item.title,
        description: item.description,
        type: item.type,
        url: item.url,
        category: item.category,
        folderId: updatedFolderId
      }, item.id);
    } catch (err) {
      console.error("Folder migration failed:", err);
    }
  };

  const currentUserZone = () => {
    if (!currentUser) throw new Error("Anonymous state blocks access.");
    return currentUser;
  };

  // Create or Update personal vault resource
  const handleSavePersonal = async (item: { title: string; description: string; type: ResourceType; url: string; category: string; folderId?: string }) => {
    if (!currentUser) return;
    await savePersonalResource(currentUser.uid, item, editingItem?.id);
    setEditingItem(null);
  };

  // Create or Update curator resource hub item (Admin access)
  const handleSaveHub = async (item: { title: string; description: string; type: ResourceType; url: string; category: string; folderId?: string }) => {
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error("Privilege mismatch. Only verified administrators can upload to the Resource Hub.");
    }
    await saveResourceHubItem(currentUser.uid, currentUser.displayName, item, editingItem?.id);
    setEditingItem(null);
  };

  // Open Edit Mode
  const handleEditClick = (item: any) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  // Personal item deletion
  const handleDeletePersonal = async (id: string) => {
    if (!currentUser) return;
    if (confirm("Are you sure you want to remove this study resource from your Personal Vault?")) {
      await deletePersonalResource(currentUser.uid, id);
    }
  };

  // Hub item deletion (Admin only)
  const handleDeleteHub = async (id: string) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    if (confirm("Are you sure you want to delete this shared item from the public Resource Hub? This resets it for all students.")) {
      await deleteResourceHubItem(id);
    }
  };

  // Quick save from shared Hub to candidate private workspace
  const handleImportHubItem = async (hubItem: ResourceHubItem) => {
    if (!currentUser) return;
    try {
      await importItemToPersonalVault(currentUser.uid, hubItem);
    } catch (err) {
      console.error("Failed to copy resource to personal vault:", err);
      alert("Encryption error during copying. Review device access keys.");
    }
  };

  // Batch delete multiple items
  const handleBatchDelete = async (ids: string[]) => {
    if (!currentUser) return;
    const count = ids.length;
    const msg = activeTab === 'personal'
      ? `Are you sure you want to permanently delete the ${count} selected study resource(s) from your Private Vault?`
      : `Are you sure you want to permanently delete the ${count} selected shared item(s) from the public Resource Hub?`;
      
    if (confirm(msg)) {
      try {
        if (activeTab === 'personal') {
          for (const id of ids) {
            await deletePersonalResource(currentUser.uid, id);
          }
        } else {
          if (currentUser.role !== 'admin') return;
          for (const id of ids) {
            await deleteResourceHubItem(id);
          }
        }
        setSelectedIds([]);
      } catch (err) {
        console.error("Batch deletion failed:", err);
      }
    }
  };

  // Batch move multiple items to a folder
  const handleBatchMoveFolder = async (ids: string[], targetFolderId: string) => {
    if (!currentUser) return;
    try {
      const updatedFolderId = targetFolderId === 'unassigned' ? '' : targetFolderId;
      for (const id of ids) {
        const item = personalResources.find(x => x.id === id);
        if (item) {
          await savePersonalResource(currentUser.uid, {
            title: item.title,
            description: item.description,
            type: item.type,
            url: item.url,
            category: item.category,
            folderId: updatedFolderId
          }, item.id);
        }
      }
      setSelectedIds([]);
    } catch (err) {
      console.error("Batch folder migration failed:", err);
    }
  };

  // Toggle selection for a single resource item
  const handleToggleSelect = (id: string, checked: boolean) => {
    setSelectedIds(prev => 
      checked ? [...prev, id] : prev.filter(x => x !== id)
    );
  };

  // Filtering Logic
  const filteredPersonal = useMemo(() => {
    return personalResources.filter(res => {
      const matchesSearch = res.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            res.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            res.url.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || res.category === selectedCategory;
      const matchesType = selectedType === 'all' || res.type === selectedType;
      const matchesFolder = !selectedFolderId || res.folderId === selectedFolderId;
      return matchesSearch && matchesCategory && matchesType && matchesFolder;
    });
  }, [personalResources, searchQuery, selectedCategory, selectedType, selectedFolderId]);

  const filteredHub = useMemo(() => {
    return hubResources.filter(res => {
      const matchesSearch = res.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            res.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            res.url.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || res.category === selectedCategory;
      const matchesType = selectedType === 'all' || res.type === selectedType;
      return matchesSearch && matchesCategory && matchesType;
    });
  }, [hubResources, searchQuery, selectedCategory, selectedType]);

  const activeResourcesCount = activeTab === 'personal' ? filteredPersonal.length : filteredHub.length;

  // Onboarding guides label
  const guideTip = useMemo(() => {
    if (activeTab === 'personal') {
      if (personalResources.length === 0) {
        return "💡 Tip: Your private vault is currently empty! Use the '+ Index Study Material' button at the top to secure your first PDF, Photo post or YouTube lecture.";
      }
      return currentUser && currentUser.role === 'admin'
        ? `📊 Displaying ${filteredPersonal.length} of ${personalResources.length} personalized assets. All URLs and Photos are AES-256 decrypted in-memory inside your local web-isolated workspace.`
        : `📊 Displaying ${filteredPersonal.length} of ${personalResources.length} personalized study materials.`;
    } else {
      if (hubResources.length === 0) {
        return "🕒 The Shared Curation Hub is waiting for expert content uploads. Only admins can initialize these study boards.";
      }
      return "🤝 Hint: Browse verified curations by mentors. Hover over a study block and click 'Save' to import and encrypt it into your private vault.";
    }
  }, [activeTab, personalResources, hubResources, filteredPersonal, filteredHub, currentUser]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center font-sans text-[#1A1A1A]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-[#E5E7EB] border-t-olive-700 rounded-full animate-spin font-sans"></div>
            <Lock className="w-5 h-5 text-olive-700 absolute inset-0 m-auto" />
          </div>
          <span className="text-xs font-mono tracking-widest text-[#64748B] uppercase animate-pulse">
            Configuring Secured Workspace ...
          </span>
        </div>
      </div>
    );
  }

  // --- GATEWAY VISUAL SCREEN (Unauthenticated state) ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] relative overflow-hidden flex flex-col justify-between py-12 px-4 font-sans text-[#1A1A1A]" id="auth_portal_root">
        
        {/* Decorative backdrop elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-olive-800/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-olive-800/5 rounded-full blur-[120px]"></div>

        {/* Global Nav details */}
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between mb-8 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-white border border-[#E5E7EB] rounded-2xl text-olive-800 shadow-sm">
              <ShieldCheck className="w-6 h-6 text-olive-700" />
            </div>
            <div>
              <h1 className="text-sm font-display font-bold tracking-tight text-olive-900 uppercase sm:text-base">UPSC SafeVault</h1>
              <p className="text-[10px] font-mono text-[#64748B] tracking-wider">SECURED STUDY LEDGER</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#64748B]">
            <span>Storage:</span>
            <span className="text-olive-800 bg-olive-50 px-2.5 py-0.5 rounded border border-olive-200 font-mono font-bold">Encrypted Vault</span>
          </div>
        </div>

        {/* Hero Central Block */}
        <div className="max-w-4xl mx-auto w-full text-center my-auto py-8 z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-olive-800 border border-[#E5E7EB] rounded-full text-xs font-mono font-bold tracking-wide uppercase mb-6 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-olive-600" />
            Secure Study Curation & Ledger
          </span>
          
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-display font-extrabold text-olive-900 tracking-tight leading-[1.1] mb-6 font-sans">
            Your Private Syllabus Ledger. <br />
            <span className="text-olive-700 font-bold">
              Organize, Track, and Master.
            </span>
          </h2>

          <p className="text-sm sm:text-base md:text-lg text-[#64748B] max-w-2xl mx-auto leading-relaxed mb-10 font-sans">
            A secure and clean study space for civil services aspirants to collect custom lecture videos, study sheets, web links, custom notes, and reference photos, paired with a curated high-yield learning hub.
          </p>

          {/* Dual Vault Presentation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-10 text-left">
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 text-slate-350">
                <Lock className="w-5 h-5 opacity-40 text-olive-600" />
              </div>
              <h3 className="text-xs font-mono text-olive-700 tracking-widest mb-1.5">Cabinet 01</h3>
              <h4 className="text-sm font-display font-bold text-olive-900 mb-2 font-sans">Personal Private Vault</h4>
              <p className="text-xs text-[#64748B] leading-relaxed font-sans">
                Keep and categorize your study files, private notes, hand-drawn syllabus diagrams, and lecture pointers. Secured inside your browser.
              </p>
            </div>

            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 text-slate-350">
                <Users className="w-5 h-5 opacity-44 text-olive-600" />
              </div>
              <h3 className="text-xs font-mono text-olive-700 tracking-widest mb-1.5">Cabinet 02</h3>
              <h4 className="text-sm font-display font-bold text-olive-900 mb-2 font-sans">Curated Resource Hub</h4>
              <p className="text-xs text-[#64748B] leading-relaxed font-sans">
                Browse official syllabus reviews, exam questions, and expert curated pointers verified by your mentors.
              </p>
            </div>
          </div>

          {/* Secure Google Account Enter Controls */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={handleSignIn}
              className="py-3.5 px-8 bg-olive-700 hover:bg-olive-800 active:translate-y-0.5 text-xs font-bold text-white rounded-xl shadow-md transition-all font-sans cursor-pointer inline-flex items-center gap-2.5"
              id="google-signin-action"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-6.887 4.114-4.82 0-8.73-3.665-8.73-8.514s3.91-8.514 8.73-8.514c2.146 0 4.103.789 5.626 2.193l3.228-3.228C18.156 1.455 15.34 0 12.24 0 5.48 0 0 5.48 0 12.24s5.48 12.24 12.24 12.24c7.07 0 11.758-4.975 11.758-11.956 0-.814-.073-1.429-.228-2.24H12.24z"/>
              </svg>
              Enter Workspace with Google Account
            </button>
            <p className="text-[11px] font-mono text-[#64748B]">
              🔒 Instant passwordless Gmail integration. Your workspace is private to you.
            </p>
          </div>

          {errorBanner && (
            <div className="mt-6 p-3 bg-red-50 border border-red-200 max-w-md mx-auto text-xs text-red-700 rounded-xl" id="auth_error_logs">
              {errorBanner}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="max-w-6xl mx-auto w-full text-center text-xs text-[#64748B] font-mono flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#E5E7EB] pt-6">
          <span>&copy; 2026 UPSC Secure Vault Network. Cryptographically insulated.</span>
          <div className="flex gap-4">
            <span className="text-slate-400">Secure Vault Protocol v2.5</span>
          </div>
        </div>
      </div>
    );
  }

  // --- AUTHENTICATED PORTAL WORKSPACE AREA ---
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] flex flex-col font-sans" id="authenticated_dashboard_root">
      
      {/* ⚠️ Sandbox Mode Warning banner */}
      {isLocalSandbox && currentUser.role === 'admin' && (
        <div className="bg-amber-50 border-b border-amber-200 py-3 px-4 text-xs font-sans text-amber-900 shadow-sm flex items-center justify-between" id="local_sandbox_ribbon">
          <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-amber-100/80 rounded-lg text-amber-800 border border-amber-200 flex-shrink-0">
                <AlertTriangle className="w-4 h-4 animate-pulse" />
              </div>
              <p className="leading-normal font-sans">
                <strong>UPSC Safe-Vault Sandbox Active:</strong> Cloud Firestore resources are currently stored locally in your insulated browser space under 256-bit encryption. Approve database endpoints via settings to connect cloud clusters.
              </p>
            </div>
            <button 
              onClick={() => alert("Simulated Sandbox storage uses the exact same encryption rules as real cloud storage, saving fully scrambled payload strings to localStorage for continuous secure testing.")}
              className="px-2.5 py-1 bg-olive-700 hover:bg-olive-800 text-[10px] font-mono text-white rounded-lg transition-colors cursor-pointer self-end sm:self-auto uppercase tracking-wide"
              lg-id="sandbox-info-btn"
            >
              Learn More
            </button>
          </div>
        </div>
      )}

      {/* Main Sticky Global Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] px-4 py-3 sm:px-6 shadow-sm">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-olive-50 border border-olive-250 rounded-2xl text-olive-800 shadow-sm">
              <ShieldCheck className="w-5 h-5 animate-pulse text-olive-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-display font-extrabold tracking-tight text-olive-900 leading-none uppercase">UPSC SafeVault</h1>
                <span className={`text-[9px] font-mono font-bold leading-none px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                    activeTab === 'personal' 
                      ? 'bg-olive-100 text-olive-800 border-olive-200' 
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  {activeTab === 'personal' ? 'Private' : 'Hub'}
                </span>
              </div>
              <p className="text-[10px] font-mono text-olive-700 mt-0.5">STUDY LEDGER</p>
            </div>
          </div>

          {/* User Bio and Logout controller */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2.5 bg-olive-50/50 p-1.5 rounded-xl border border-olive-100">
              <img 
                src={currentUser.photoURL} 
                alt="Avatar" 
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-lg object-cover border border-[#E5E7EB] shadow-inner flex-shrink-0"
              />
              <div className="hidden sm:block text-left text-xs font-sans">
                <p className="font-bold text-olive-900 line-clamp-1">{currentUser.displayName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] font-mono text-[#64748B] uppercase truncate max-w-[100px]" title={currentUser.email}>
                    {currentUser.email}
                  </span>
                  {currentUser.role === 'admin' ? (
                    <span className="text-[8px] font-bold font-sans text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-250">
                      ADMIN
                    </span>
                  ) : (
                    <span className="text-[8px] font-bold font-sans text-olive-700 bg-olive-50 px-1 py-0.2 rounded border border-olive-200">
                      ASPIRANT
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="p-2.5 text-[#64748B] hover:text-olive-800 hover:bg-olive-50 border border-[#E5E7EB] rounded-xl transition-all cursor-pointer bg-white"
              title="Sign Out of Secure Workspace"
              lg-id="logout-btn"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Primary Workspace Board */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:px-8 space-y-6">
        
        {/* Onboarding tips notifications */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 text-xs font-sans text-[#64748B] flex items-center gap-2.5 shadow-sm justify-between" id="onboarding_guide_banner">
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-olive-600 flex-shrink-0" />
            <p className="leading-snug">{guideTip}</p>
          </div>
          <button 
            onClick={() => setShowStats(!showStats)}
            className="text-[10px] font-bold font-mono text-olive-800 hover:text-olive-950 hover:underline cursor-pointer uppercase flex-shrink-0"
            lg-id="toggle-stats-btn"
          >
            {showStats ? "Hide Stats" : "Show Stats"}
          </button>
        </div>

        {/* Collapsible Statistics Bento Panel */}
        {showStats && (
          <VaultStats
            personalCount={personalResources.length}
            hubCount={hubResources.length}
            personalResources={personalResources}
            hubResources={hubResources}
            isSandbox={isLocalSandbox}
            currentUserRole={currentUser.role}
          />
        )}

        {/* Connected UPSC Platforms Integration links */}
        {currentUser.role === 'admin' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="upsc_external_integration_links">
            <a 
              href="https://imperial-notes.vercel.app/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group bg-white hover:bg-slate-50 border border-[#E5E7EB] p-4 rounded-2xl shadow-xs transition-all flex items-center justify-between gap-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-50 rounded-xl group-hover:scale-105 transition-transform border border-amber-100 flex-shrink-0 text-amber-600">
                  <StickyNote className="w-5 h-5 text-amber-605" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 font-sans">
                    Make Notes
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-950 transition-colors" />
                  </h4>
                  <p className="text-[11px] text-[#64748B] mt-1 font-sans leading-relaxed">
                    Redirect to external premium pad workspace. Compose summaries and import notes back here for synced category organization.
                  </p>
                </div>
              </div>
              <div className="text-[10px] font-mono text-olive-800 bg-olive-50/70 border border-olive-200 px-2 py-1 rounded group-hover:bg-olive-100 transition-all flex items-center gap-1 flex-shrink-0 font-bold uppercase select-none">
                Launch note-maker &rarr;
              </div>
            </a>

            <a 
              href="https://oracle-ai-02.lovable.app/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group bg-white hover:bg-slate-50 border border-[#E5E7EB] p-4 rounded-2xl shadow-xs transition-all flex items-center justify-between gap-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-olive-50 rounded-xl group-hover:scale-105 transition-transform border border-olive-200 flex-shrink-0 text-olive-700">
                  <Sparkles className="w-5 h-5 text-olive-600" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 font-sans">
                    Oracle Desk
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-950 transition-colors" />
                  </h4>
                  <p className="text-[11px] text-[#64748B] mt-1 font-sans leading-relaxed">
                    Access AI Companion services. Formulate outlines, query past test solutions, and sync answers directly under syllabus tags.
                  </p>
                </div>
              </div>
              <div className="text-[10px] font-mono text-olive-800 bg-olive-50 border border-olive-200 px-2 py-1 rounded group-hover:bg-olive-100 transition-all flex items-center gap-1 flex-shrink-0 font-bold uppercase select-none">
                Consult Oracle AI &rarr;
              </div>
            </a>
          </div>
        )}

        {/* Workspace Dual Cabinet Controller Tabs and Search bar */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-sm flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between" id="filter_command_center">
          
          {/* Dual Tabs toggler */}
          <div className="flex items-center p-1.5 bg-[#F1F5F9] border border-[#E5E7EB] rounded-xl max-w-md w-full" id="dual_vault_selectors">
            <button
              onClick={() => {
                setActiveTab('personal');
                setSelectedFolderId(''); // Reset selected folder when switching tabs
              }}
              className={`flex-1 py-2 px-4 rounded-lg text-xs font-semibold font-sans tracking-wide transition-all outline-none flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'personal'
                  ? 'bg-white text-olive-850 font-bold shadow-sm border border-olive-200'
                  : 'text-[#64748B] hover:text-olive-800'
              }`}
              lg-id="tab-personal-btn"
            >
              <Lock className="w-3.5 h-3.5 text-olive-700" />
              Personal Private Vault ({personalResources.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('hub');
                setSelectedFolderId('');
              }}
              className={`flex-1 py-2 px-4 rounded-lg text-xs font-semibold font-sans tracking-wide transition-all outline-none flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'hub'
                  ? 'bg-white text-olive-850 font-bold shadow-sm border border-olive-200'
                  : 'text-[#64748B] hover:text-olive-800'
              }`}
              lg-id="tab-hub-btn"
            >
              <Users className="w-3.5 h-3.5 text-slate-600" />
              Expert Resource Hub ({hubResources.length})
            </button>
          </div>

          {/* Combined Search & Write Button bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:max-w-2xl">
            
            {/* Search Input */}
            <div className="relative w-full">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder={`Search ${activeTab === 'personal' ? 'personal' : 'expert shared'} resources...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E5E7EB] focus:border-olive-600 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#1A1A1A] placeholder-[#94A3B8] outline-none transition-all shadow-sm font-sans"
                id="search_box_input"
              />
            </div>

            {/* Write Button */}
            <button
              onClick={() => {
                setEditingItem(null); // Explicit clear for insert mode
                setIsFormOpen(true);
              }}
              className="py-2.5 px-5 text-xs font-bold leading-none text-white rounded-xl shadow-sm transition-all flex items-center gap-2 w-full sm:w-auto justify-center select-none cursor-pointer bg-olive-700 hover:bg-olive-800 active:translate-y-0.5 flex-shrink-0 font-sans"
              lg-id="add-resource-indicator"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              Index Material
            </button>

          </div>
        </div>

        {/* Categories Tabs Carousel */}
        <div className="bg-white border border-[#E5E7EB] p-2 rounded-2xl flex flex-wrap gap-1.5 items-center shadow-sm" id="category_bar_track">
          <div className="text-[10px] font-mono text-olive-700 uppercase tracking-wider px-3 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-olive-600" />
            Topic:
          </div>
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono tracking-wider transition-all select-none cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-olive-750 text-white font-bold shadow-xs'
                : 'text-[#64748B] hover:text-olive-800'
            }`}
            lg-id="cat-filter-all"
          >
            ALL PAPERS
          </button>
          {UPSCCategories.map(cat => {
            const personalCountInCat = personalResources.filter(x => x.category === cat.value).length;
            const hubCountInCat = hubResources.filter(x => x.category === cat.value).length;
            const hasDataInCat = activeTab === 'personal' ? personalCountInCat > 0 : hubCountInCat > 0;
            
            return (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all select-none cursor-pointer ${
                  selectedCategory === cat.value
                    ? 'bg-olive-50 border border-olive-200 text-olive-800 font-bold'
                    : hasDataInCat
                      ? 'text-olive-800 hover:bg-olive-50/50 font-medium'
                      : 'text-[#94A3B8] hover:text-[#64748B]'
                }`}
                lg-id={`cat-filter-${cat.value}`}
              >
                {cat.value}
              </button>
            );
          })}
        </div>

        {/* Format Selectors and Header labels */}
        <div className="flex items-center justify-between gap-4 mt-2">
          <div className="flex items-center gap-2 text-xs text-[#64748B] font-mono">
            <Grid className="w-3.5 h-3.5 text-olive-700" />
            <span>Viewing <strong className="text-olive-800">{activeResourcesCount}</strong> study tracks</span>
          </div>

          {/* Quick type tags switcher */}
          <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-[#E5E7EB] shadow-sm">
            <span className="text-[10px] text-[#64748B] uppercase font-mono px-1">Type:</span>
            {['all', 'pdf', 'video', 'link', 'photo', 'note', 'other'].map(t => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase transition-colors select-none cursor-pointer ${
                  selectedType === t
                    ? 'bg-olive-750 text-white font-semibold'
                    : 'text-[#64748B] hover:text-olive-800'
                }`}
                lg-id={`type-filter-${t}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Multi-Column Master/Explorer Layout with Folder shelf on Left split */}
        <div className="flex flex-col md:flex-row gap-6 items-start" id="explorer_master_layout">
          
          {/* Left folder panel (Only relevant for personal custom workspace tab to keep clean focus) */}
          {activeTab === 'personal' && (
            <aside className="w-full md:w-64 flex-shrink-0 space-y-4" id="study_folders_cabinet">
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-sm space-y-4 w-full">
                
                {/* Cabinet Header */}
                <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                  <h3 className="text-xs font-display font-black text-olive-900 uppercase tracking-wider flex items-center gap-2 font-sans">
                    <FolderOpen className="w-4 h-4 text-olive-600" />
                    Study Folders
                  </h3>
                  <button
                    onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                    className="p-1 hover:bg-olive-50 rounded-lg text-olive-600 hover:text-olive-850 transition-all cursor-pointer"
                    title="Create Study Folder"
                    type="button"
                    lg-id="add-folder-trigger"
                  >
                    <FolderPlus className="w-4.5 h-4.5 text-olive-700" />
                  </button>
                </div>

                {/* Inline Folder Creation Form */}
                {isCreatingFolder && (
                  <form onSubmit={handleCreateFolder} className="space-y-2 animate-fade-in p-2 bg-olive-50/50 rounded-xl border border-dashed border-olive-200">
                    <input
                      type="text"
                      placeholder="Folder name (e.g. GS2 Polity)"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      className="w-full bg-white border border-[#E5E7EB] rounded-xl px-3 py-1.5 text-xs text-[#1A1A1A] outline-none focus:border-olive-600 font-sans"
                      autoFocus
                      required
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsCreatingFolder(false)}
                        className="px-2 py-1 text-[9.5px] font-bold text-slate-600 bg-white border border-slate-200 rounded-md cursor-pointer hover:bg-slate-50 font-sans"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-2.5 py-1 text-[9.5px] font-bold text-white bg-olive-700 hover:bg-olive-850 rounded-md cursor-pointer font-sans"
                      >
                        Create
                      </button>
                    </div>
                  </form>
                )}

                {/* Folder lists mapping */}
                <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                  
                  {/* Select ALL folders */}
                  <button
                    onClick={() => setSelectedFolderId('')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-sans transition-all flex items-center justify-between cursor-pointer ${
                      selectedFolderId === ''
                        ? 'bg-olive-750 text-white font-bold'
                        : 'text-slate-600 hover:bg-olive-50/50 hover:text-olive-900'
                    }`}
                    type="button"
                  >
                    <span className="flex items-center gap-2 truncate">
                      📁 All Loose & Foldered files
                    </span>
                    <span className={`text-[10px] font-mono px-1.5 rounded ${
                      selectedFolderId === '' ? 'bg-white/20 text-white' : 'bg-olive-100 text-olive-850'
                    }`}>
                      {personalResources.length}
                    </span>
                  </button>

                  {/* Individual custom Folders */}
                  {folders.map(folder => {
                    const count = personalResources.filter(r => r.folderId === folder.id).length;
                    const isSelected = selectedFolderId === folder.id;
                    return (
                      <div key={folder.id} className="group flex items-center justify-between rounded-xl hover:bg-olive-50/30 pr-2">
                        <button
                          onClick={() => setSelectedFolderId(folder.id)}
                          className={`flex-1 text-left px-3 py-1.5 text-xs font-sans transition-all flex items-center gap-2 truncate cursor-pointer ${
                            isSelected
                              ? 'text-olive-850 font-bold bg-olive-50/80 border border-olive-100 rounded-lg'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          type="button"
                        >
                          <span className="truncate">📂 {folder.name}</span>
                        </button>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-[9.5px] bg-olive-50 text-olive-750 px-1.5 rounded font-mono group-hover:bg-olive-100/50">
                            {count}
                          </span>
                          <button
                            onClick={() => handleDeleteFolder(folder.id)}
                            className="p-1 text-[#94A3B8] hover:text-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center"
                            title="Delete folder and release notes inside"
                            type="button"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {folders.length === 0 && !isCreatingFolder && (
                    <div className="text-center py-4 text-[11px] text-[#94A3B8] font-sans">
                      No custom folders created yet. Click the folder icon above to make folder categories.
                    </div>
                  )}
                </div>
              </div>
            </aside>
          )}

          {/* Right/Central: GRID OF DATA CARDS */}
          <div className="flex-1 w-full" id="cards_grid_wrapper">
            {/* Multi-select Header Control Bar */}
            {((activeTab === 'personal' && filteredPersonal.length > 0) || (activeTab === 'hub' && filteredHub.length > 0)) && (
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-3 shadow-sm" id="multi_select_header_bar">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    checked={
                      activeTab === 'personal' 
                        ? filteredPersonal.length > 0 && selectedIds.length === filteredPersonal.length 
                        : filteredHub.length > 0 && selectedIds.length === filteredHub.length
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        const visibleIds = activeTab === 'personal' 
                          ? filteredPersonal.map(x => x.id) 
                          : filteredHub.map(x => x.id);
                        setSelectedIds(visibleIds);
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                    id="select_all_checkbox"
                    className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 cursor-pointer accent-slate-950"
                  />
                  <label htmlFor="select_all_checkbox" className="text-xs font-medium text-slate-700 cursor-pointer select-none font-sans">
                    Select All Shown ({activeTab === 'personal' ? filteredPersonal.length : filteredHub.length} items)
                  </label>
                </div>

                {selectedIds.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-sans">
                    <span className="font-semibold text-slate-950 bg-slate-100 px-2.5 py-0.5 rounded-full">{selectedIds.length} selected</span>
                    <button 
                      onClick={() => setSelectedIds([])}
                      className="text-olive-750 hover:text-olive-900 underline font-semibold cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'personal' ? (
              filteredPersonal.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in" id="personal_grid_cards">
                  {filteredPersonal.map(res => (
                    <ResourceCard
                      key={res.id}
                      item={res}
                      origin="personal"
                      onDelete={handleDeletePersonal}
                      isAdmin={currentUser.role === 'admin'}
                      folders={folders}
                      onEdit={handleEditClick}
                      onMoveFolder={handleMoveFolder}
                      isSelected={selectedIds.includes(res.id)}
                      onToggleSelect={handleToggleSelect}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-[#E5E7EB] rounded-2xl min-h-[300px] shadow-sm" id="empty_personal_vault">
                  <div className="p-4 bg-olive-50 border border-olive-200 rounded-2xl text-olive-800 mb-4 shadow-sm">
                    <Lock className="w-10 h-10 text-olive-700" />
                  </div>
                  <h3 className="text-base font-display font-bold text-olive-900 mb-2 font-sans">Personal Private Vault vacant</h3>
                  <p className="text-xs text-[#64748B] leading-normal max-w-md mx-auto mb-6 font-sans">
                    Select a topic filter tab or write a new document notes. You can also import curated materials from the Resource Hub with the Save button.
                  </p>
                  <div className="flex flex-wrap gap-3 items-center justify-center">
                    <button
                      onClick={() => setIsFormOpen(true)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-olive-700 hover:bg-olive-800 rounded-xl transition-all shadow-sm select-none cursor-pointer font-sans"
                      lg-id="empty-create-btn"
                    >
                      Index New Material
                    </button>
                    <button
                      onClick={() => setActiveTab('hub')}
                      className="px-4 py-2 text-xs font-semibold text-olive-800 hover:bg-olive-50/50 border border-olive-200 rounded-xl transition-colors bg-white select-none cursor-pointer font-sans"
                      lg-id="empty-go-hub"
                    >
                      Browse Curator Materials
                    </button>
                  </div>
                </div>
              )
            ) : (
              filteredHub.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in" id="hub_cards_grid">
                  {filteredHub.map(res => (
                    <ResourceCard
                      key={res.id}
                      item={res}
                      origin="hub"
                      onDelete={handleDeleteHub}
                      onImport={handleImportHubItem}
                      isAdmin={currentUser.role === 'admin'}
                      folders={folders}
                      onEdit={handleEditClick}
                      isSelected={selectedIds.includes(res.id)}
                      onToggleSelect={handleToggleSelect}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-[#E5E7EB] rounded-2xl min-h-[300px] shadow-sm" id="empty_hub_vault">
                  <div className="p-4 bg-olive-50 border border-olive-200 rounded-2xl text-olive-800 mb-4 shadow-sm">
                    <BookOpen className="w-10 h-10 text-olive-700" />
                  </div>
                  <h3 className="text-base font-display font-bold text-olive-900 mb-2 font-sans">Curated Hub vacancy</h3>
                  <p className="text-xs text-[#64748B] leading-normal max-w-md mx-auto mb-6 font-sans">
                    Mentors have not published any materials matching this category selection yet.
                  </p>
                  {currentUser.role === 'admin' && (
                    <button
                      onClick={() => {
                        setEditingItem(null);
                        setIsFormOpen(true);
                      }}
                      className="px-4 py-2 text-xs font-semibold text-white bg-olive-700 hover:bg-olive-800 rounded-xl transition-all shadow-sm select-none cursor-pointer inline-flex items-center gap-1.5 font-sans"
                      lg-id="admin-seed-hub-btn"
                    >
                      <Plus className="w-4 h-4" />
                      Upload Expert Curation
                    </button>
                  )}
                </div>
              )
            )}
          </div>
        </div>

             {/* Short documentation explanation panel */}
        {currentUser.role === 'admin' && (
          <section className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-sm" id="security_disclosure_footer">
            <h3 className="text-xs font-mono text-olive-900 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-olive-600" />
              Security Paradigm & Zero-Trust Guidelines
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs font-sans text-[#64748B] leading-relaxed">
              <div className="space-y-3">
                <p>
                  <strong className="text-olive-900 font-bold">1. Client-Side Cryptography (Isolators):</strong> Grounded references are cryptographically mapped using individual browser-side PBKDF2 derived keys. This prevents administrator override or direct database scraping.
                </p>
                <p>
                  <strong className="text-olive-900 font-bold">2. Google Passwordless Sign-In:</strong> Integrates Google authenticator tokens that initialize accounts instantly with zero password overhead.
                </p>
              </div>
              <div className="space-y-3">
                <p>
                  <strong className="text-olive-900 font-bold">3. Mentor Authority Gates:</strong> Only administrators whose accounts match whitelists (such as <code>raksha05jk.rao@gmail.com</code>) can create or remove indices from the community shared Resource Hub.
                </p>
                <p>
                  <strong className="text-olive-900 font-bold">4. Unified Sync Syncing:</strong> Real-time changes are synchronized atomically. Any pasted notes from your Imperial Notes desk are synchronized into folders immediately.
                </p>
              </div>
            </div>
          </section>
        )}

      </main>

      {/* Floating Resource Creator Modal Form overlay */}
      {isFormOpen && (
        <ResourceForm
          onClose={() => {
            setIsFormOpen(false);
            setEditingItem(null);
          }}
          onSavePersonal={handleSavePersonal}
          onSaveHub={handleSaveHub}
          isAdmin={currentUser.role === 'admin'}
          currentUserDisplayName={currentUser.displayName}
          folders={folders}
          initialItem={editingItem}
        />
      )}

      {/* Primary footer */}
      <footer className="mt-auto py-8 bg-white text-center border-t border-[#E5E7EB] text-xs text-[#64748B] font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>UPSC Personal Vault Network &copy; 2026. Custom encrypted storage for civil services preparation.</span>
          <div className="flex items-center gap-1">
            <span>Powered by</span>
            <span className="text-olive-800 font-bold">Gemini AI Studio</span>
          </div>
        </div>
      </footer>

      {/* 🌟 Floating Multi-Select Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-olive-900 text-white px-5 py-3.5 rounded-2xl shadow-xl z-50 flex flex-col sm:flex-row items-center justify-between gap-4 border border-olive-800 transition-all duration-300 max-w-[90vw] sm:max-w-xl w-full" id="floating_action_bar">
          <div className="flex items-center gap-2">
            <span className="bg-white/15 text-white px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono">
              {selectedIds.length} Selected
            </span>
            <span className="text-xs text-olive-200 font-sans">Batch actions</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {activeTab === 'personal' && (
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleBatchMoveFolder(selectedIds, e.target.value);
                    e.target.value = '';
                  }
                }}
                className="bg-olive-800 hover:bg-olive-750 text-white text-xs px-3 py-2 rounded-xl outline-none cursor-pointer border border-olive-700 font-sans w-full sm:w-auto animate-fade-in"
                defaultValue=""
              >
                <option value="" disabled>📁 Move to Folder...</option>
                <option value="unassigned">📂 Unassigned Folder</option>
                {folders.map(folder => (
                  <option key={folder.id} value={folder.id}>
                    📂 {folder.name}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => handleBatchDelete(selectedIds)}
              className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 font-semibold transition-all cursor-pointer font-sans whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="text-olive-200 hover:text-white text-xs px-2.5 py-2 transition-colors cursor-pointer font-sans"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
