import { PersonalResource, ResourceHubItem, UPSCCategories } from '../types';
import { BookOpen, Database, Layers } from 'lucide-react';

interface VaultStatsProps {
  personalCount: number;
  hubCount: number;
  personalResources: PersonalResource[];
  hubResources: ResourceHubItem[];
  isSandbox: boolean;
  currentUserRole: 'user' | 'admin';
}

export default function VaultStats({
  personalCount,
  hubCount,
  personalResources,
  hubResources
}: VaultStatsProps) {
  
  // Calculate category breakdowns for progress indicators
  const categoryStats = UPSCCategories.map(cat => {
    const personalInCat = personalResources.filter(r => r.category === cat.value).length;
    const hubInCat = hubResources.filter(r => r.category === cat.value).length;
    return {
      ...cat,
      personalCount: personalInCat,
      hubCount: hubInCat,
      total: personalInCat + hubInCat
    };
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 mt-2" id="vault_stats_section">
      {/* 1. Primary Metrics Block */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-xs flex flex-col justify-between" id="metric_card_totals">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-olive-50 rounded-lg text-olive-800 border border-olive-200">
              <Database className="w-4 h-4 text-olive-700" />
            </div>
            <span className="text-xs font-bold text-olive-900 uppercase tracking-wider font-sans">Active Storage Overview</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-olive-800 font-mono font-bold bg-olive-50 border border-olive-200 px-2 py-0.5 rounded-full">
              Permanent Storage Active
            </span>
            <span className="flex items-center gap-1 text-[10px] text-olive-700 font-mono font-bold bg-olive-50/70 border border-olive-200 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-olive-500 animate-pulse"></span>
              Persistent Ledger
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 bg-[#F8FAFC] p-3 rounded-xl border border-[#E5E7EB]">
          <div>
            <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-wide font-sans">Personal Vault</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-display font-black text-olive-900">{personalCount}</span>
              <span className="text-[10px] text-[#64748B] font-mono">indexed files</span>
            </div>
          </div>
          <div className="border-l border-[#E5E7EB] pl-3">
            <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-wide font-sans">Curated Hub</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-display font-black text-olive-900">{hubCount}</span>
              <span className="text-[10px] text-[#64748B] font-mono">shared guides</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Syllabus Indexing Map - Compact 3-Column Paper Pills */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-xs" id="metric_syllabus_coverage">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-bold text-olive-900 uppercase tracking-wider flex items-center gap-1.5 font-sans">
            <BookOpen className="w-4 h-4 text-olive-600" />
            Syllabus Indexing Map
          </h3>
          <span className="text-[10px] text-[#64748B] font-mono flex items-center gap-1">
            <Layers className="w-3 h-3 text-olive-600" />
            {categoryStats.filter(c => c.total > 0).length} / {categoryStats.length} Papers Active
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {categoryStats.map(stat => {
            const hasData = stat.total > 0;
            return (
              <div 
                key={stat.value} 
                className={`p-2 rounded-xl border transition-all flex items-center justify-between ${
                  hasData 
                    ? 'bg-olive-50/60 border-olive-200/80 text-olive-950 font-semibold' 
                    : 'bg-[#F8FAFC] border-[#E5E7EB] text-slate-400'
                }`}
              >
                <div className="truncate pr-1">
                  <span className="text-[10px] font-mono block font-bold truncate">{stat.value}</span>
                  <span className="text-[9px] text-[#64748B] block truncate font-sans">{stat.label.split(':')[0]}</span>
                </div>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-bold flex-shrink-0 ${
                  hasData ? 'bg-olive-750 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  {stat.total}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
