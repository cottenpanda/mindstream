import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RotateCcw, PenTool } from 'lucide-react';
import { JournalEntry } from '../types';
import JournalEntryCard from './JournalEntryCard';

interface CalendarViewProps {
  entries: JournalEntry[];
  onExplore: (entry: JournalEntry) => void;
  isLoadingRelatedId: string | null;
  onUpdate: (id: string, text: string, images?: string[]) => void;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
  onFilter: (type: 'category' | 'tag', value: string) => void;
  onAddThought: () => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Helper to get category hex color for the gradient
const getCategoryHex = (category?: string) => {
    switch(category) {
        case 'Idea': return '#f59e0b'; // amber-500
        case 'Reflection': return '#6366f1'; // indigo-500
        case 'Planning': return '#0ea5e9'; // sky-500
        case 'Learning': return '#10b981'; // emerald-500
        case 'Health': return '#f43f5e'; // rose-500
        case 'Work': return '#64748b'; // slate-500
        case 'Random': return '#78716c'; // stone-500
        default: return '#d6d3d1'; // stone-300
    }
};

const CalendarView: React.FC<CalendarViewProps> = ({ 
    entries, 
    onExplore, 
    isLoadingRelatedId, 
    onUpdate, 
    onPin, 
    onDelete, 
    onFilter,
    onAddThought
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Calendar Logic ---
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const today = new Date();
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const prevMonth = () => {
      setDirection('left');
      setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
      setDirection('right');
      setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
      const now = new Date();
      setDirection(now < currentDate ? 'left' : 'right');
      setCurrentDate(now);
      setSelectedDate(now);
  };

  const handleDateClick = (day: number) => {
      setSelectedDate(new Date(year, month, day));
  };

  // --- Keyboard Navigation ---
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const newDate = new Date(selectedDate);
    switch(e.key) {
        case 'ArrowLeft': newDate.setDate(selectedDate.getDate() - 1); break;
        case 'ArrowRight': newDate.setDate(selectedDate.getDate() + 1); break;
        case 'ArrowUp': newDate.setDate(selectedDate.getDate() - 7); break;
        case 'ArrowDown': newDate.setDate(selectedDate.getDate() + 7); break;
        default: return;
    }
    
    // Sync month view if navigating out of bounds
    if (newDate.getMonth() !== month) {
        setDirection(newDate < selectedDate ? 'left' : 'right');
        setCurrentDate(newDate);
    }
    setSelectedDate(newDate);
  };

  // --- Swipe Handlers ---
  const onTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
      if (!touchStart || !touchEnd) return;
      const distance = touchStart - touchEnd;
      const isLeftSwipe = distance > 50;
      const isRightSwipe = distance < -50;
      if (isLeftSwipe) nextMonth();
      if (isRightSwipe) prevMonth();
      setTouchStart(null);
      setTouchEnd(null);
  };

  // --- Data Mapping & Stats ---
  
  // 1. Calculate Monthly Stats
  const monthlyStats = useMemo(() => {
    const currentMonthEntries = entries.filter(e => {
        const d = new Date(e.timestamp);
        return d.getMonth() === month && d.getFullYear() === year;
    });

    if (currentMonthEntries.length === 0) return null;

    const catCounts: Record<string, number> = {};
    const sentCounts: Record<string, number> = {};

    currentMonthEntries.forEach(e => {
        if (e.analysis?.category) catCounts[e.analysis.category] = (catCounts[e.analysis.category] || 0) + 1;
        if (e.analysis?.sentiment) sentCounts[e.analysis.sentiment] = (sentCounts[e.analysis.sentiment] || 0) + 1;
    });

    const topCategory = Object.entries(catCounts).sort((a,b) => b[1] - a[1])[0]?.[0] || 'Mixed';
    const topSentiment = Object.entries(sentCounts).sort((a,b) => b[1] - a[1])[0]?.[0] as 'positive' | 'neutral' | 'negative' || 'neutral';

    return {
        count: currentMonthEntries.length,
        topCategory,
        topSentiment
    };
  }, [entries, month, year]);

  // 2. Map Entries to Days
  const entryMap = useMemo(() => {
      const map = new Map<string, JournalEntry[]>();
      entries.forEach(entry => {
          const date = new Date(entry.timestamp);
          const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          if (!map.has(key)) map.set(key, []);
          map.get(key)?.push(entry);
      });
      return map;
  }, [entries]);

  const selectedEntries = useMemo(() => {
      const key = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
      return (entryMap.get(key) || []).sort((a, b) => b.timestamp - a.timestamp);
  }, [selectedDate, entryMap]);

  // Generate grid cells
  const gridCells = useMemo(() => {
      const cells = [];
      
      // Empty cells
      for (let i = 0; i < firstDayOfMonth; i++) {
          cells.push(<div key={`empty-${i}`} className="aspect-square" />);
      }

      // Day cells
      for (let day = 1; day <= daysInMonth; day++) {
          const dateKey = `${year}-${month}-${day}`;
          const dayEntries = entryMap.get(dateKey);
          const hasEntries = dayEntries && dayEntries.length > 0;
          
          const dateObj = new Date(year, month, day);
          const dayOfWeek = dateObj.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          const isSelected = 
            selectedDate.getDate() === day && 
            selectedDate.getMonth() === month && 
            selectedDate.getFullYear() === year;
            
          const isToday = 
            today.getDate() === day && 
            today.getMonth() === month && 
            today.getFullYear() === year;

          // Determine Display Content
          let gradientStyle = {};

          if (hasEntries) {
            // Gradient Bar Logic
            const counts: Record<string, number> = {};
            dayEntries.forEach(e => {
                const cat = e.analysis?.category || 'Uncategorized';
                counts[cat] = (counts[cat] || 0) + 1;
            });
            const sortedCats = Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .map(([cat]) => cat);
            const colors = sortedCats.map(cat => getCategoryHex(cat));
            gradientStyle = {
                background: colors.length === 1 
                    ? colors[0] 
                    : `linear-gradient(to right, ${colors.join(', ')})`
            };
          }

          cells.push(
              <button
                  key={day}
                  onClick={() => handleDateClick(day)}
                  className={`
                    relative aspect-square flex flex-col items-center justify-start pt-3 rounded-xl transition-all duration-200 outline-none
                    ${isSelected 
                        ? 'bg-stone-800 text-white shadow-md scale-105 z-10' 
                        : `hover:bg-stone-100 focus:bg-stone-100 ${isWeekend ? 'text-stone-400' : 'text-stone-700'}`
                    }
                    ${isToday && !isSelected ? 'ring-1 ring-stone-300 bg-white' : ''}
                  `}
              >
                  <span className={`text-sm ${isSelected ? 'font-bold' : 'font-medium'}`}>
                    {day}
                  </span>
                  
                  {hasEntries && (
                      <div 
                        className="w-5 h-1 rounded-full mt-1 shadow-sm opacity-90"
                        style={gradientStyle}
                      />
                  )}
              </button>
          );
      }
      return cells;
  }, [year, month, entryMap, selectedDate, firstDayOfMonth, daysInMonth]);

  return (
    <div 
        className="space-y-6 pb-24 outline-none" 
        tabIndex={0} 
        onKeyDown={handleKeyDown}
        ref={containerRef}
    >
        {/* Calendar Card */}
        <div 
            className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6 select-none"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            
            {/* Header Navigation */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-paper-ink">
                        {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h2>
                    {!isCurrentMonth && (
                        <button 
                            onClick={goToToday}
                            className="p-1.5 rounded-full bg-stone-50 text-stone-400 hover:text-paper-ink hover:bg-stone-100 transition-all active:scale-95"
                            title="Jump to Today"
                        >
                            <RotateCcw size={14} />
                        </button>
                    )}
                </div>
                <div className="flex gap-2">
                    <button onClick={prevMonth} className="p-2 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors active:bg-stone-200">
                        <ChevronLeft size={20} />
                    </button>
                    <button onClick={nextMonth} className="p-2 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors active:bg-stone-200">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Monthly Summary Dashboard - Minimal & Clean */}
            {monthlyStats ? (
                // Use custom grid columns to give the middle section (Category) more space (approx 50%) to prevent overlap
                <div className="mb-8 grid grid-cols-[1.1fr_1.6fr_0.7fr] gap-2 px-1">
                    <div className="flex flex-col items-start gap-1">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Monthly Vibe</div>
                        <div className="text-sm font-normal text-paper-ink capitalize leading-tight">{monthlyStats.topSentiment}</div>
                    </div>
                    
                    <div className="flex flex-col items-start gap-1 border-l border-stone-100 pl-3 overflow-hidden">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Top Focus</div>
                        {/* break-words ensures really long words don't overflow, though the column is now wide enough for most */}
                        <div className="text-sm font-normal text-paper-ink leading-tight break-words">{monthlyStats.topCategory}</div>
                    </div>
                    
                    <div className="flex flex-col items-start gap-1 border-l border-stone-100 pl-3">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Entries</div>
                        <div className="text-sm font-normal text-paper-ink leading-tight">{monthlyStats.count}</div>
                    </div>
                </div>
            ) : (
                <div className="mb-8 p-4 text-center border border-dashed border-stone-100 rounded-xl">
                    <p className="text-xs text-stone-400 italic">No thoughts recorded this month.</p>
                </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {WEEKDAYS.map(d => (
                    <div key={d} className="text-center text-[10px] font-bold text-stone-400 uppercase tracking-widest py-2">
                        {d}
                    </div>
                ))}
                
                {/* Animation Wrapper */}
                <React.Fragment key={`${year}-${month}`}>
                    <div className={`contents animate-in duration-300 fade-in fill-mode-forwards ${direction === 'right' ? 'slide-in-from-right-4' : 'slide-in-from-left-4'}`}>
                        {gridCells}
                    </div>
                </React.Fragment>
            </div>
        </div>

        {/* Selected Date Entries */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300" key={selectedDate.toISOString()}>
            <div className="flex items-center gap-2 mb-4 px-2">
                <div className="text-xs font-bold uppercase tracking-widest text-stone-500">
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
                <div className="h-px bg-stone-200 flex-1" />
            </div>

            {selectedEntries.length > 0 ? (
                <div className="space-y-4">
                    {selectedEntries.map(entry => (
                        <JournalEntryCard 
                            key={entry.id} 
                            entry={entry} 
                            onExplore={onExplore}
                            isLoadingRelated={isLoadingRelatedId === entry.id}
                            onUpdate={onUpdate}
                            onPin={onPin}
                            onDelete={onDelete}
                            onFilter={onFilter}
                        />
                    ))}
                </div>
            ) : (
                <div className="py-12 flex flex-col items-center justify-center text-stone-400 text-center border border-dashed border-stone-200 rounded-2xl bg-white/50">
                    <CalendarIcon size={32} className="mb-3 opacity-20" />
                    <p className="text-sm mb-6">No thoughts recorded specifically on this day.</p>
                    <button 
                        onClick={onAddThought}
                        className="px-6 py-3 bg-paper-ink text-white text-base font-medium rounded-full shadow-lg hover:bg-stone-800 hover:shadow-xl transition-all active:scale-95 flex items-center gap-2"
                    >
                        <PenTool size={18} strokeWidth={2.5} />
                        Add a thought
                    </button>
                </div>
            )}
        </div>
    </div>
  );
};

export default CalendarView;