import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { JournalEntry, PatternInsight } from '../types';
import { detectPatterns } from '../services/geminiService';
import { RefreshCw, ArrowRight, X, Target, Calendar, PlusCircle, Sparkles, Zap, Hash, PieChart, PenTool } from 'lucide-react';

interface InsightsProps {
  entries: JournalEntry[];
  insights: PatternInsight[];
  onInsightsGenerated: (insights: PatternInsight[]) => void;
  onAddThought: () => void;
  onFilter: (type: 'category' | 'tag', value: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
    'Idea': 'bg-amber-400',
    'Reflection': 'bg-indigo-400',
    'Planning': 'bg-sky-500',
    'Learning': 'bg-emerald-400',
    'Health': 'bg-rose-400',
    'Work': 'bg-slate-500',
    'Random': 'bg-stone-400',
    'Uncategorized': 'bg-stone-300'
};

const Insights: React.FC<InsightsProps> = ({ entries, insights, onInsightsGenerated, onAddThought, onFilter }) => {
  const [loading, setLoading] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<PatternInsight | null>(null);

  const runAnalysis = async () => {
    if (entries.length < 3) return;
    setLoading(true);
    const results = await detectPatterns(entries);
    onInsightsGenerated(results);
    setLoading(false);
  };

  useEffect(() => {
    // Only auto-run if we have enough entries AND insights haven't been generated yet
    if (entries.length >= 3 && insights.length === 0 && !loading) {
      runAnalysis();
    }
  }, [entries.length, insights.length]);

  // --- STATS CALCULATION ---
  const { topCategories, topTags } = useMemo(() => {
    const catCounts: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};

    entries.forEach(e => {
        if (e.analysis?.category) {
            catCounts[e.analysis.category] = (catCounts[e.analysis.category] || 0) + 1;
        }
        if (e.analysis?.tags) {
            e.analysis.tags.forEach(t => {
                const lowerTag = t.toLowerCase();
                tagCounts[lowerTag] = (tagCounts[lowerTag] || 0) + 1;
            });
        }
    });

    const sortedCats = Object.entries(catCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const sortedTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    return { topCategories: sortedCats, topTags: sortedTags };
  }, [entries]);

  // --- FILTER INSIGHTS ---
  // Only show insights that have specific related entries (evidence)
  const validInsights = useMemo(() => {
      return insights.filter(i => i.relatedEntryIds && i.relatedEntryIds.length > 0);
  }, [insights]);

  if (entries.length < 3) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8 border-2 border-dashed border-stone-200 rounded-2xl bg-white/50">
        <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-6 text-stone-400">
          <Zap size={32} strokeWidth={1.5} />
        </div>
        <h3 className="text-lg font-bold text-paper-ink mb-2">Gathering Data</h3>
        <p className="text-stone-500 max-w-xs mx-auto mb-8">Add at least 3 thoughts to unlock AI-powered insights about your patterns.</p>
        <button
            onClick={onAddThought}
            className="px-6 py-3 bg-paper-ink text-white text-base font-medium rounded-full shadow-lg hover:bg-stone-800 hover:shadow-xl transition-all active:scale-95 flex items-center gap-2"
        >
            <PenTool size={18} strokeWidth={2.5} />
            Add a thought
        </button>
      </div>
    );
  }

  // Calculate max value for bar charts to normalize width
  const maxCatCount = topCategories.length > 0 ? topCategories[0][1] : 1;

  return (
    <div className="space-y-8 pb-24">
       
       <div className="flex items-center justify-between px-2">
         <div>
            <h2 className="text-xl font-bold text-paper-ink leading-tight">Overview</h2>
            <p className="text-xs text-stone-400 font-medium">Your thought landscape</p>
         </div>
         <button 
            onClick={runAnalysis} 
            disabled={loading}
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-paper-ink transition-colors bg-white px-3 py-1.5 rounded-full border border-stone-200 shadow-sm disabled:opacity-50"
         >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            {loading ? 'Analyzing...' : 'Refresh'}
         </button>
       </div>

       {/* === SECTION 1: TOPIC ANALYSIS (Categories & Tags) === */}
       <div className="grid grid-cols-1 gap-6">
           
           {/* Top Categories */}
           <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100">
               <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-400 mb-6">
                   <PieChart size={14} />
                   Top Categories
               </h3>
               <div className="space-y-4">
                   {topCategories.length > 0 ? topCategories.map(([cat, count]) => (
                       <div 
                         key={cat} 
                         onClick={() => onFilter('category', cat)}
                         className="group cursor-pointer"
                       >
                           <div className="flex justify-between items-end mb-1">
                               <span className="text-sm font-normal text-stone-700 group-hover:font-bold group-hover:text-paper-ink transition-all">{cat}</span>
                               <span className="text-xs text-stone-400 font-medium">{count} thoughts</span>
                           </div>
                           <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                               <div 
                                    className={`h-full rounded-full ${CATEGORY_COLORS[cat] || 'bg-stone-400'} opacity-80 group-hover:opacity-100 transition-all duration-500`}
                                    style={{ width: `${(count / maxCatCount) * 100}%` }}
                               />
                           </div>
                       </div>
                   )) : (
                       <p className="text-sm text-stone-400 italic">No categories yet.</p>
                   )}
               </div>
           </div>

           {/* Top Hashtags */}
           <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100">
               <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-400 mb-6">
                   <Hash size={14} />
                   Top Hashtags
               </h3>
               <div className="flex flex-wrap gap-2">
                   {topTags.length > 0 ? topTags.map(([tag, count]) => (
                       <button
                           key={tag}
                           onClick={() => onFilter('tag', tag)}
                           className="flex items-center gap-2 px-3 py-2 bg-stone-50 hover:bg-stone-100 border border-stone-200/50 rounded-xl transition-all active:scale-95 group"
                       >
                           <span className="text-sm text-stone-600 group-hover:text-paper-ink">#{tag}</span>
                           <span className="bg-white px-1.5 py-0.5 rounded-md text-[10px] font-bold text-stone-400 shadow-sm group-hover:text-paper-accent">{count}</span>
                       </button>
                   )) : (
                       <p className="text-sm text-stone-400 italic">No tags found yet.</p>
                   )}
               </div>
           </div>
       </div>

       {/* === SECTION 2: PATTERN CARDS === */}
       <div>
         <h3 className="text-sm font-bold uppercase tracking-widest text-stone-500 mb-4 px-1 flex items-center gap-2">
            <Sparkles size={14} />
            Detected Patterns
         </h3>

         {loading ? (
           <div className="flex flex-col gap-4">
             {[1,2,3].map(i => (
               <div key={i} className="w-full bg-white p-6 rounded-3xl border border-stone-100 shadow-sm relative overflow-hidden">
                   <div className="flex justify-between items-start mb-2 relative z-10">
                       <div className="space-y-3 w-3/4">
                           <div className="h-5 bg-stone-200 rounded w-2/3 animate-pulse" />
                           <div className="h-3 bg-stone-100 rounded w-1/3 animate-pulse" />
                       </div>
                       <div className="w-8 h-8 rounded-full bg-stone-100 animate-pulse flex-shrink-0" />
                   </div>
                   {/* Decorative blob placeholder */}
                   <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-stone-50 opacity-50 blur-2xl" />
               </div>
             ))}
           </div>
         ) : (
           <div className="flex flex-col gap-4">
              {validInsights.length === 0 ? (
                  <div className="w-full p-8 bg-stone-50 rounded-3xl border border-stone-100 border-dashed text-center text-stone-400 text-sm">
                      {insights.length > 0 
                        ? "Generic patterns hidden. Keep writing to find strong connections." 
                        : "AI is analyzing your journal for hidden patterns..."}
                  </div>
              ) : (
                  validInsights.map((insight, idx) => (
                      <div 
                          key={idx} 
                          onClick={() => setSelectedInsight(insight)}
                          className="w-full bg-white p-6 rounded-3xl border border-stone-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all group relative overflow-hidden"
                      >
                          {/* Decorative BG Blob */}
                          <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-10 blur-2xl transition-colors
                             ${insight.type === 'habit' ? 'bg-green-400' : 
                               insight.type === 'mood' ? 'bg-blue-400' : 'bg-orange-400'}
                          `} />

                          <div className="flex justify-between items-start">
                              <div className="pr-8">
                                  {/* Updated headline: smaller font size and more spacing */}
                                  <h3 className="text-[13px] font-medium text-paper-ink mb-4 leading-relaxed">{insight.title}</h3>
                                  <p className="text-stone-400 text-xs font-medium uppercase tracking-wider">
                                      Seen {insight.frequency} times
                                  </p>
                              </div>
                              <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center text-stone-400 group-hover:bg-paper-ink group-hover:text-white transition-all flex-shrink-0">
                                  <ArrowRight size={14} />
                              </div>
                          </div>
                      </div>
                  ))
              )}
           </div>
         )}
       </div>

       {/* === DETAILED MODAL OVERLAY (PORTAL) === */}
       {selectedInsight && createPortal(
         <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={() => setSelectedInsight(null)}
            />
            
            {/* Modal Card */}
            <div className="bg-white w-full sm:max-w-lg h-[85vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col relative z-10 animate-in slide-in-from-bottom-10 duration-300">
                
                {/* Header - Compact - Sticky Top */}
                <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-white sticky top-0 z-20">
                    <div>
                        <h2 className="text-lg font-bold text-paper-ink leading-tight">{selectedInsight.title}</h2>
                    </div>
                    <button 
                        onClick={() => setSelectedInsight(null)}
                        className="p-1.5 bg-stone-100 hover:bg-stone-200 rounded-full text-stone-500 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto flex-1 p-6 space-y-8 no-scrollbar">
                    
                    {/* Description */}
                    <div>
                        <p className="text-lg text-stone-600 leading-relaxed font-serif">
                            {selectedInsight.description}
                        </p>
                    </div>

                    {/* Recommendations / Suggestions */}
                    {(selectedInsight.recommendations || selectedInsight.suggestion) && (
                        <div className="bg-green-50/50 rounded-xl p-5 border border-green-100">
                            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-green-700 mb-4">
                                <Target size={16} />
                                Recommended Actions
                            </h4>
                            
                            {selectedInsight.recommendations && selectedInsight.recommendations.length > 0 ? (
                                <ul className="space-y-3">
                                    {selectedInsight.recommendations.map((rec, i) => (
                                        <li key={i} className="flex gap-3 items-start text-stone-700 text-sm font-medium">
                                            <div className="min-w-[6px] h-[6px] rounded-full bg-green-400 mt-1.5" />
                                            {rec}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-stone-700 font-medium">{selectedInsight.suggestion}</p>
                            )}
                        </div>
                    )}

                    {/* Evidence / Related Thoughts */}
                    <div>
                         <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-400 mb-4">
                            <Calendar size={16} />
                            Connected Thoughts
                        </h4>
                        <div className="space-y-3">
                            {entries
                                .filter(e => selectedInsight.relatedEntryIds?.includes(e.id))
                                .map(entry => (
                                    <div key={entry.id} className="p-4 bg-stone-50 rounded-lg border border-stone-100/50">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                                                {new Date(entry.timestamp).toLocaleDateString()}
                                            </span>
                                            {entry.analysis?.category && (
                                                 <span className="text-[9px] px-1.5 py-0.5 bg-white border border-stone-200 rounded text-stone-500">
                                                     {entry.analysis.category}
                                                 </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-stone-600 line-clamp-3 italic">
                                            "{entry.content}"
                                        </p>
                                    </div>
                                ))
                            }
                            {/* We filtered generic patterns out of the main list, so this fallback is less likely to be seen unless data is weird */}
                            {(!selectedInsight.relatedEntryIds || selectedInsight.relatedEntryIds.length === 0) && (
                                <p className="text-sm text-stone-400 italic">
                                    General pattern detected.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
         </div>,
         document.body
       )}
    </div>
  );
};

export default Insights;