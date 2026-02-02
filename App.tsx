import React, { useState, useEffect, useMemo } from 'react';
import { PlusCircle, BookOpen, Zap, Flame, Filter, X, Calendar, PenTool } from 'lucide-react';
import Capture from './components/Capture';
import JournalEntryCard from './components/JournalEntryCard';
import Insights from './components/Insights';
import CalendarView from './components/CalendarView';
import { JournalEntry, ViewState, LocationData, PatternInsight } from './types';
import { analyzeEntry, findRelatedContent } from './services/geminiService';

const STORAGE_KEY = 'mindstream_entries_v1';
const INSIGHTS_KEY = 'mindstream_insights_v1';

export default function App() {
  // Changed default view to 'journal' (Library)
  const [view, setView] = useState<ViewState>('journal');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [insights, setInsights] = useState<PatternInsight[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingRelatedId, setLoadingRelatedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<{ type: 'category' | 'tag'; value: string } | null>(null);
  
  // Load from local storage on mount
  useEffect(() => {
    const savedEntries = localStorage.getItem(STORAGE_KEY);
    if (savedEntries) {
      setEntries(JSON.parse(savedEntries));
    }
    const savedInsights = localStorage.getItem(INSIGHTS_KEY);
    if (savedInsights) {
        setInsights(JSON.parse(savedInsights));
    }
  }, []);

  // Save to local storage whenever entries change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  // Save insights to local storage
  useEffect(() => {
    localStorage.setItem(INSIGHTS_KEY, JSON.stringify(insights));
  }, [insights]);
  
  const handleAddEntry = async (text: string, location?: LocationData, images?: string[]) => {
    const trimmedText = text.trim();
    if (!trimmedText && (!images || images.length === 0)) return;

    setIsProcessing(true);
    setInsights([]); // Invalidate insights on new data
    const newId = crypto.randomUUID();
    
    // Optimistic UI update
    const tempEntry: JournalEntry = {
      id: newId,
      content: trimmedText,
      images,
      timestamp: Date.now(),
      location,
      isAnalyzed: false,
      isPinned: false
    };

    setEntries(prev => [tempEntry, ...prev]);
    // Switch to journal view to show the new entry
    setView('journal'); 

    try {
      // Analyze with Gemini
      const analysis = await analyzeEntry(trimmedText, images);
      
      setEntries(prev => prev.map(e => {
        if (e.id === newId) {
          return { ...e, analysis, isAnalyzed: true };
        }
        return e;
      }));
    } catch (e) {
      console.error("Failed to analyze", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExplore = async (entry: JournalEntry) => {
    if (!entry.analysis?.category) return;
    setLoadingRelatedId(entry.id);
    
    try {
        // Pass content, category, AND tags for better context
        const related = await findRelatedContent(
            entry.content, 
            entry.analysis.category,
            entry.analysis.tags || []
        );
        setEntries(prev => prev.map(e => {
            if (e.id === entry.id) {
                return { ...e, relatedContent: related };
            }
            return e;
        }));
    } catch(e) {
        console.error("Explore failed", e);
    } finally {
        setLoadingRelatedId(null);
    }
  };

  const handleUpdateEntry = (id: string, newContent: string, newImages?: string[]) => {
    const trimmedContent = newContent.trim();
    setEntries(prev => prev.map(e => e.id === id ? { ...e, content: trimmedContent, images: newImages } : e));
    setInsights([]); // Invalidate insights on edit
  };

  const handleTogglePin = (id: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, isPinned: !e.isPinned } : e));
  };

  const handleDeleteEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    setInsights([]); // Invalidate insights on delete
  };

  const handleSetFilter = (type: 'category' | 'tag', value: string) => {
    setActiveFilter({ type, value });
    setView('journal');
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearFilter = () => setActiveFilter(null);
  
  // Sort: Pinned first, then by timestamp descending
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.timestamp - a.timestamp;
    });
  }, [entries]);

  // Apply Filter
  const filteredEntries = useMemo(() => {
    let result = sortedEntries;
    if (activeFilter) {
      result = result.filter(entry => {
        if (activeFilter.type === 'category') {
           return entry.analysis?.category === activeFilter.value;
        } else {
           // Case-insensitive check for tags
           return entry.analysis?.tags?.some(t => t.toLowerCase() === activeFilter.value.toLowerCase());
        }
      });
    }
    return result;
  }, [sortedEntries, activeFilter]);

  // Calculate Streak
  const streak = useMemo(() => {
    if (entries.length === 0) return 0;
    
    const sortedDates = [...entries]
        .map(e => new Date(e.timestamp).setHours(0,0,0,0))
        .sort((a,b) => b - a); // Newest first
    
    // Remove duplicates (multiple entries per day)
    const uniqueDates = [...new Set(sortedDates)];
    
    let currentStreak = 0;
    const today = new Date().setHours(0,0,0,0);
    const yesterday = today - 86400000;

    // Check if the most recent entry is today or yesterday to start the count
    if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
        return 0;
    }

    // Consecutive check
    for (let i = 0; i < uniqueDates.length; i++) {
        const diff = (uniqueDates[0] - uniqueDates[i]) / 86400000;
        if (diff === i) {
            currentStreak++;
        } else {
            break;
        }
    }
    return currentStreak;
  }, [entries]);

  return (
    // Fixed inset-0 creates a full-screen app container.
    <div className="fixed inset-0 bg-[#1F1F1F] flex items-center justify-center p-4">
      <div className="relative w-full max-w-md h-[95vh] flex flex-col bg-paper-bg text-paper-ink overflow-hidden rounded-2xl shadow-2xl">
      
      {/* Header - Compact version */}
      <header className="absolute top-0 left-0 right-0 z-50 bg-paper-bg/95 backdrop-blur-md border-b border-stone-100/50 py-3 shadow-sm transition-all">
        <div className="max-w-md mx-auto px-4 flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight text-paper-ink">
                MindStream
                <span className="text-paper-accent text-2xl leading-none">.</span>
            </h1>
            
            <div className="flex items-center gap-4">
                {/* Streak Counter */}
                {streak > 1 && (
                    <div className="flex items-center gap-1 text-orange-500 animate-pulse-slow">
                        <Flame size={16} fill="currentColor" />
                        <span className="text-xs font-bold tracking-wide">{streak} day streak</span>
                    </div>
                )}
                <div className="text-[10px] font-bold tracking-widest uppercase text-paper-pencil">
                    {entries.length} Thoughts
                </div>
            </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden w-full relative z-0 no-scrollbar">
        <div className="max-w-md mx-auto px-4 pt-20 pb-32 min-h-full">
            {view === 'capture' && (
            <div className="h-[calc(100dvh-12rem)] min-h-[400px]">
                <Capture onSave={handleAddEntry} isSaving={isProcessing} />
            </div>
            )}

            {view === 'journal' && (
            <div className="space-y-5">
                {/* Active Filter Banner */}
                {activeFilter && (
                    <div className="bg-stone-100/80 backdrop-blur-sm border border-stone-200 rounded-lg p-3 mb-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-2">
                            <div className="bg-white p-1.5 rounded-md text-stone-400 shadow-sm">
                               <Filter size={14} /> 
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-sm font-medium text-stone-600">
                                    Filtered by <span className="text-stone-900 font-bold">{activeFilter.type === 'tag' ? '#' : ''}{activeFilter.value}</span>
                                </span>
                                <span className="text-xs font-bold text-stone-400 bg-white px-1.5 py-0.5 rounded-md border border-stone-100">
                                    {filteredEntries.length}
                                </span>
                            </div>
                        </div>
                        <button 
                            onClick={handleClearFilter}
                            className="p-1.5 hover:bg-white rounded-full text-stone-400 hover:text-stone-800 transition-all"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {filteredEntries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8 border-2 border-dashed border-stone-200 rounded-2xl bg-white/50">
                        <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-6 text-stone-400">
                            <BookOpen size={32} strokeWidth={1.5} />
                        </div>
                        <h3 className="text-lg font-bold text-paper-ink mb-2">
                            {activeFilter ? "No matching thoughts." : "The page is blank."}
                        </h3>
                        <p className="text-stone-500 max-w-xs mx-auto mb-8">
                             {activeFilter ? "Try clearing the filter or adding a new one." : "Time to plant some seeds."}
                        </p>
                        {activeFilter ? (
                             <button 
                                onClick={handleClearFilter}
                                className="px-6 py-3 bg-stone-100 text-stone-600 text-base font-bold rounded-full hover:bg-stone-200 transition-all"
                             >
                                 Clear Filter
                             </button>
                        ) : (
                            <button 
                                onClick={() => setView('capture')} 
                                className="px-6 py-3 bg-paper-ink text-white text-base font-medium rounded-full shadow-lg hover:bg-stone-800 hover:shadow-xl transition-all active:scale-95 flex items-center gap-2"
                            >
                                <PenTool size={18} strokeWidth={2.5} />
                                Add a thought
                            </button>
                        )}
                    </div>
                ) : (
                    filteredEntries.map(entry => (
                        <JournalEntryCard 
                            key={entry.id} 
                            entry={entry} 
                            onExplore={handleExplore}
                            isLoadingRelated={loadingRelatedId === entry.id}
                            onUpdate={handleUpdateEntry}
                            onPin={handleTogglePin}
                            onDelete={handleDeleteEntry}
                            onFilter={handleSetFilter}
                        />
                    ))
                )}
            </div>
            )}
            
            {view === 'calendar' && (
                <CalendarView
                    entries={entries}
                    onExplore={handleExplore}
                    isLoadingRelatedId={loadingRelatedId}
                    onUpdate={handleUpdateEntry}
                    onPin={handleTogglePin}
                    onDelete={handleDeleteEntry}
                    onFilter={handleSetFilter}
                    onAddThought={() => setView('capture')}
                />
            )}

            {view === 'insights' && (
            <Insights 
                entries={entries} 
                insights={insights}
                onInsightsGenerated={setInsights}
                onAddThought={() => setView('capture')} 
                onFilter={handleSetFilter}
            />
            )}
        </div>
      </main>

      {/* Floating Bottom Navigation */}
      <nav className="absolute bottom-6 left-0 right-0 z-50 pointer-events-none">
        <div className="max-w-[320px] mx-auto bg-white/90 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-full px-6 py-3 flex justify-between items-center pointer-events-auto ring-1 ring-black/5">
          
          {/* 1. Library (Journal) */}
          <button 
            onClick={() => {
                setView('journal');
                setActiveFilter(null);
            }}
            className={`flex flex-col items-center gap-0.5 w-12 transition-all ${view === 'journal' ? 'text-paper-ink scale-110' : 'text-stone-400 hover:text-stone-600'}`}
          >
            <BookOpen size={20} />
          </button>
          
          {/* 2. Write (Capture) */}
          <button 
            onClick={() => setView('capture')}
            className={`flex flex-col items-center gap-0.5 w-12 transition-all ${view === 'capture' ? 'text-paper-ink scale-110' : 'text-stone-400 hover:text-stone-600'}`}
          >
            <PenTool size={20} />
          </button>

          {/* 3. Overview (Insights) */}
          <button 
            onClick={() => setView('insights')}
            className={`flex flex-col items-center gap-0.5 w-12 transition-all ${view === 'insights' ? 'text-paper-ink scale-110' : 'text-stone-400 hover:text-stone-600'}`}
          >
            <Zap size={20} />
          </button>
          
          {/* 4. Calendar */}
          <button 
            onClick={() => {
                setView('calendar');
                setActiveFilter(null);
            }}
            className={`flex flex-col items-center gap-0.5 w-12 transition-all ${view === 'calendar' ? 'text-paper-ink scale-110' : 'text-stone-400 hover:text-stone-600'}`}
          >
            <Calendar size={20} />
          </button>
        </div>
      </nav>
    </div>
</div>
  );
}