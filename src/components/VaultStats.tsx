import { PersonalResource, ResourceHubItem, UPSCCategories } from '../types';
import { ShieldCheck, BookOpen, Database } from 'lucide-react';

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
  hubResources,
  isSandbox,
  currentUserRole
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
    <div className={`grid grid-cols-1 ${currentUserRole === 'admin' ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6 mb-8 mt-2`} id="vault_stats_section">
      {/* 2. Primary Metrics Block */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between" id="metric_card_totals">
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-[#94A3B8] tracking-widest uppercase">Active Storage</span>
            <div className="p-2 bg-olive-50 rounded-xl text-olive-800 border border-olive-200">
              <Database className="w-5 h-5 text-olive-650" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-[#64748B] font-medium font-sans">Personal Vault</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-3xl font-display font-extrabold text-olive-900">{personalCount}</span>
                <span className="text-xs text-[#64748B] font-mono">items</span>
              </div>
            </div>
            <div className="border-l border-[#E5E7EB] pl-4">
              <p className="text-xs text-[#64748B] font-medium font-sans">Curated Hub</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-3xl font-display font-extrabold text-olive-900">{hubCount}</span>
                <span className="text-xs text-[#64748B] font-mono">expert</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5 pt-4 border-t border-[#E5E7EB] flex items-center justify-between text-[11px] text-[#64748B] font-mono">
          <span>Active Session Sync</span>
          <span className="flex items-center gap-1.5 text-olive-700 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-olive-500 animate-pulse"></span>
            Cloud Safe
          </span>
        </div>
      </div>

      {/* Syllabus Coverage Bento Grid */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-sm md:col-span-1" id="metric_syllabus_coverage">
        <h3 className="text-xs font-bold text-[#94A3B8] tracking-widest uppercase mb-4 flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-olive-600" />
          Syllabus Indexing Map
        </h3>
        <div className="space-y-2.5 max-h-[148px] overflow-y-auto pr-1">
          {categoryStats.map(stat => {
            const hasData = stat.total > 0;
            return (
              <div key={stat.value} className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] font-sans">
                  <span className={hasData ? "text-olive-900 font-semibold" : "text-[#94A3B8]"}>
                    {stat.value} - {stat.label.split(':')[0]}
                  </span>
                  <span className={hasData ? "font-mono font-bold text-olive-800" : "font-mono text-[#94A3B8]"}>
                    {stat.total}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-olive-50 rounded-full overflow-hidden">
                  <div 
                     className="h-full rounded-full transition-all duration-500 bg-olive-600" 
                     style={{ width: `${Math.min(stat.total * 20, 100)}%` }} // 5 items fills a category full bar
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🔒 Encryption Shield Bento Grid */}
      {currentUserRole === 'admin' && (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between" id="metric_security_integrity">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[#94A3B8] tracking-widest uppercase">Vault Security</span>
              <div className="p-1.5 bg-olive-50 rounded-xl text-olive-800 border border-olive-200">
                <ShieldCheck className="w-5 h-5 text-olive-700" />
              </div>
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed font-sans mb-3">
              All stored material listings are encrypted client-side using robust <strong className="text-olive-900">AES-256 GCM</strong> before writing to Firestore.
            </p>
            <div className="grid grid-cols-2 gap-1.5 bg-olive-50/50 border border-olive-150 rounded-xl p-3 text-[11px] font-mono">
              <div className="text-[#64748B]">Engine:</div>
              <div className="text-olive-700 font-bold text-right">WebCrypto API</div>
              <div className="text-[#64748B]">Database:</div>
              <div className="text-olive-850 text-right font-medium">
                {isSandbox ? "Sandbox Local" : "Firestore Cloud"}
              </div>
              <div className="text-[#64748B]">Privilege:</div>
              <div className="text-right text-olive-850 font-bold uppercase">{currentUserRole}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
