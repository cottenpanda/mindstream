import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { JournalEntry } from '../types';
import { MapPin, ExternalLink, Sparkles, CheckSquare, MessageCircleQuestion, Compass, X, Loader2, MoreHorizontal, Pin, Trash2, Edit2, Save, Camera, Mic, StopCircle, AlertCircle } from 'lucide-react';
import { useGeminiLive } from '../hooks/useGeminiLive';

interface Props {
  entry: JournalEntry;
  onExplore: (entry: JournalEntry) => void;
  isLoadingRelated: boolean;
  onUpdate: (id: string, text: string, images?: string[]) => void;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
  onFilter: (type: 'category' | 'tag', value: string) => void;
}

const CATEGORY_STYLES: Record<string, string> = {
    'Idea': 'bg-amber-100 text-amber-800 border-amber-200',
    'Reflection': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'Planning': 'bg-sky-100 text-sky-800 border-sky-200',
    'Learning': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Health': 'bg-rose-100 text-rose-800 border-rose-200',
    'Work': 'bg-slate-100 text-slate-800 border-slate-200',
    'Random': 'bg-stone-100 text-stone-800 border-stone-200',
    'Uncategorized': 'bg-stone-100 text-stone-600 border-stone-200'
};

const JournalEntryCard: React.FC<Props> = ({ entry, onExplore, isLoadingRelated, onUpdate, onPin, onDelete, onFilter }) => {
  const [activeSheet, setActiveSheet] = useState<'insights' | 'resources' | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  
  // Edit State
  const [editContent, setEditContent] = useState(entry.content);
  const [editImages, setEditImages] = useState<string[]>(entry.images || []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- Gemini Live Integration for Editing ---
  const { isConnected: isListening, isConnecting, start, stop } = useGeminiLive({
    onTranscription: (newText) => {
        setEditContent(prev => prev + newText);
    }
  });

  const toggleListening = () => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  };
  // ------------------------------------------

  // Sync state if entry prop updates while not editing
  useEffect(() => {
    if (!isEditing) {
        setEditContent(entry.content);
        setEditImages(entry.images || []);
    }
  }, [entry.content, entry.images, isEditing]);

  // Helper to start editing with trimmed content (fixes cursor position)
  const startEditing = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      // Trim end to ensure cursor starts at the end of the last word, not on a new line
      setEditContent(entry.content.trimEnd());
      setIsEditing(true);
      setShowMenu(false);
  };

  // Auto-resize textarea
  useLayoutEffect(() => {
    if (isEditing && textareaRef.current) {
      // Reset height to auto to get correct scrollHeight
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${scrollHeight}px`;
    }
  }, [editContent, isEditing]);

  // Focus cursor at end of text when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
        textareaRef.current.focus();
        // Use value from ref to ensure we get the latest rendered value
        const val = textareaRef.current.value;
        textareaRef.current.setSelectionRange(val.length, val.length);
    }
  }, [isEditing]);

  // Handle Menu Open
  const handleMenuOpen = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (menuButtonRef.current) {
          const rect = menuButtonRef.current.getBoundingClientRect();
          // Use viewport coordinates (fixed positioning)
          setMenuPosition({
              top: rect.bottom + 4,
              left: rect.right - 192 // Adjusted to 192 (w-48) to fit text
          });
      }
      setShowMenu(!showMenu);
      setShowDeleteConfirm(false); 
  };

  // Close menu on click outside
  useEffect(() => {
    const closeMenu = () => {
        setShowMenu(false);
        setTimeout(() => setShowDeleteConfirm(false), 200); 
    };
    if (showMenu) {
        window.addEventListener('click', closeMenu);
    }
    return () => window.removeEventListener('click', closeMenu);
  }, [showMenu]);


  // Randomize rotation slightly for organic feel
  const rotation = useMemo(() => Math.random() * 1.5 - 0.75, []);

  const toggleCheck = (idx: number) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(idx)) newChecked.delete(idx);
    else newChecked.add(idx);
    setCheckedItems(newChecked);
  };

  const openResources = () => {
    setActiveSheet('resources');
    if (!entry.relatedContent || entry.relatedContent.length === 0) {
      onExplore(entry);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setEditImages(prev => [...prev, base64String]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number) => {
      setEditImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveEdit = () => {
    if (isListening) stop();
    const contentChanged = editContent.trim() !== entry.content.trim(); 
    const imagesChanged = JSON.stringify(editImages) !== JSON.stringify(entry.images || []);

    if (contentChanged || imagesChanged) {
        onUpdate(entry.id, editContent.trim(), editImages);
    }
    setIsEditing(false);
  };

  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric'
    }).format(new Date(ts));
  };

  const hasAnalysis = entry.analysis && (entry.analysis.nextSteps?.length > 0 || entry.analysis.insightPrompt);
  const isAnalyzing = !entry.isAnalyzed;

  return (
    <>
      <div 
          className="relative mb-6 group"
          style={{ transform: `rotate(${rotation}deg)` }}
      >
        {/* Hidden File Input for Editing */}
        <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            className="hidden"
        />

        {/* Tape Visual OR Category Sticker as Tape */}
        {entry.analysis?.category ? (
            <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onFilter('category', entry.analysis!.category);
                }}
                className={`absolute -top-2.5 left-1/2 -translate-x-1/2 z-20 rotate-1 px-3 py-1 text-[9px] font-bold uppercase tracking-widest border shadow-sm backdrop-blur-[2px] rounded-sm cursor-pointer hover:scale-105 transition-all ${CATEGORY_STYLES[entry.analysis.category] || CATEGORY_STYLES['Uncategorized']}`}
            >
                {entry.analysis.category}
            </button>
        ) : (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-32 h-8 bg-yellow-100/80 rotate-1 backdrop-blur-[1px] shadow-sm z-10 opacity-90" style={{ clipPath: 'polygon(2% 0%, 98% 0%, 100% 100%, 0% 100%)' }} />
        )}

        {/* Pin Indicator */}
        {entry.isPinned && (
            <div className="absolute -top-2 -left-2 z-20 text-paper-accent drop-shadow-sm rotate-[-15deg]">
                <Pin size={18} fill="currentColor" />
            </div>
        )}

        <div className="bg-white shadow-[2px_3px_10px_rgba(0,0,0,0.05)] transition-transform hover:scale-[1.005] duration-300 border border-stone-100/50 rounded-lg overflow-hidden relative">
          
          {/* === AI Sticker "Watermark" === */}
          {entry.analysis?.moodEmoji && (
              <div className="absolute top-2 right-4 text-6xl opacity-10 pointer-events-none rotate-[15deg] filter grayscale transition-all group-hover:grayscale-0 group-hover:opacity-20 group-hover:scale-110 duration-500">
                  {entry.analysis.moodEmoji}
              </div>
          )}

          {/* === MAIN CONTENT AREA === */}
          <div className="p-5 pb-3 relative z-10">
              
              {/* Header: Date, Location & Menu */}
              <div 
                className="flex justify-between items-center mb-3 relative cursor-pointer active:opacity-70"
                onClick={(e) => !isEditing && startEditing(e)}
              > 
                  <div className="flex items-center gap-2 text-xs font-medium text-stone-400">
                    <span>{formatDate(entry.timestamp)}</span>
                    {entry.location && (
                        <>
                            <span className="text-stone-300">&middot;</span>
                            <div className="flex items-center gap-0.5">
                                <MapPin size={10} />
                                <span>{entry.location.latitude.toFixed(1)}, {entry.location.longitude.toFixed(1)}</span>
                            </div>
                        </>
                    )}
                  </div>

                  {/* Options Menu Button */}
                  <div className="relative z-30 -mr-2 -mt-1">
                      <button 
                        ref={menuButtonRef}
                        onClick={handleMenuOpen}
                        className={`p-1.5 rounded-md transition-colors ${showMenu ? 'bg-stone-100 text-stone-600' : 'text-stone-300 hover:text-stone-600 hover:bg-stone-50'}`}
                      >
                          <MoreHorizontal size={16} />
                      </button>
                  </div>
              </div>

              {/* User Content - View vs Edit Mode */}
              <div 
                className="mb-1 relative" 
                onClick={(e) => !isEditing && startEditing(e)}
              >
                  {isEditing ? (
                      <div onClick={e => e.stopPropagation()}>
                        {/* Edit Images Area */}
                        {(editImages.length > 0) && (
                            <div className="pb-4 flex gap-2 overflow-x-auto no-scrollbar">
                                {editImages.map((img, idx) => (
                                    <div key={idx} className="relative flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border border-stone-200 shadow-sm group/img">
                                        <img src={img} alt="preview" className="w-full h-full object-cover" />
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeImage(idx);
                                            }}
                                            className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover/img:opacity-100 transition-opacity"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {/* Textarea matched to p tag styles to prevent jumping */}
                        <textarea 
                            ref={textareaRef}
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full text-sm text-paper-ink leading-relaxed font-sans bg-transparent outline-none resize-none overflow-hidden p-0 m-0"
                            onClick={(e) => e.stopPropagation()}
                            spellCheck={false}
                            style={{ minHeight: '1.5em' }}
                        />

                        {/* Edit Toolbar */}
                        <div className="flex items-center gap-2 mt-4 border-t border-stone-100 pt-2" onClick={e => e.stopPropagation()}>
                            <button onClick={toggleListening} className={`p-2 rounded-full transition-all ${isListening ? 'bg-red-50 text-red-500 ring-1 ring-red-200' : 'bg-stone-50 text-stone-400 hover:text-stone-600'}`}>
                                {isConnecting ? <Loader2 size={16} className="animate-spin" /> : (isListening ? <StopCircle size={16} /> : <Mic size={16} />)}
                            </button>
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full transition-all bg-stone-50 text-stone-400 hover:text-stone-600">
                                <Camera size={16} />
                            </button>
                        </div>
                      </div>
                  ) : (
                      <div className="group/text cursor-pointer relative">
                           {/* Display Images in View Mode */}
                           {entry.images && entry.images.length > 0 && (
                                <div className="mb-3 grid grid-cols-2 gap-2">
                                    {entry.images.map((img, idx) => (
                                        <div key={idx} className="rounded-lg overflow-hidden border border-stone-100 shadow-sm">
                                            <img src={img} alt="attachment" className="w-full h-24 object-cover" />
                                        </div>
                                    ))}
                                </div>
                           )}
                           
                          {/* Content Paragraph - With Truncation */}
                          <p className="text-sm text-paper-ink leading-relaxed font-sans whitespace-pre-wrap line-clamp-3 p-0 m-0">
                              {entry.content.trim()}
                          </p>
                      </div>
                  )}
              </div>

              {/* Tags */}
              {entry.analysis?.tags && entry.analysis.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-1 mt-3">
                    {entry.analysis.tags.slice(0, 3).map(tag => (
                        <button 
                            key={tag} 
                            onClick={(e) => {
                                e.stopPropagation();
                                onFilter('tag', tag.toLowerCase());
                            }}
                            className="text-[10px] text-stone-400 bg-stone-50 px-1.5 py-0.5 rounded border border-stone-100/50 cursor-pointer hover:bg-stone-100 hover:text-stone-600 hover:border-stone-200 transition-all active:scale-95"
                        >
                            #{tag.toLowerCase()}
                        </button>
                    ))}
                </div>
              )}
          </div>

          {/* === ACTION BAR === */}
          {isEditing ? (
             <div className="flex divide-x divide-stone-100 border-t border-stone-100 bg-stone-50/50">
                <button 
                    onClick={() => {
                        setIsEditing(false);
                        if (isListening) stop();
                        setEditContent(entry.content);
                        setEditImages(entry.images || []);
                    }}
                    className="flex-1 py-2.5 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleSaveEdit}
                    className="flex-1 py-2.5 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-paper-accent hover:bg-orange-50 transition-colors"
                >
                    <Save size={14} />
                    Save
                </button>
             </div>
          ) : (
             <div className="flex divide-x divide-stone-100 border-t border-stone-100 bg-stone-50/50">
                {/* Toggle Insight Button */}
                <button 
                    onClick={() => setActiveSheet('insights')}
                    className={`flex-1 py-2.5 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors text-stone-500 hover:text-stone-900 hover:bg-stone-100`}
                >
                    <Sparkles size={14} />
                    Insight
                </button>

                {/* Toggle Resources Button */}
                <button 
                    onClick={openResources}
                    className={`flex-1 py-2.5 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors text-stone-500 hover:text-stone-900 hover:bg-stone-100`}
                >
                    <Compass size={14} />
                    Resources
                </button>
             </div>
          )}
        </div>
      </div>
      
      {/* === MENU PORTAL === */}
      {showMenu && createPortal(
          <div className="fixed inset-0 z-[9999] pointer-events-auto">
             {/* Invisible backdrop to capture clicks */}
             <div className="absolute inset-0" onClick={() => setShowMenu(false)} />
             
             {/* Menu Dropdown */}
             <div 
                className="absolute w-48 bg-white rounded-lg shadow-xl border border-stone-100 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                style={{ top: menuPosition.top, left: menuPosition.left }}
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
             >
                {!showDeleteConfirm ? (
                    <>
                        <button 
                            onClick={(e) => startEditing(e)}
                            className="w-full text-left px-3 py-2 text-xs text-stone-600 hover:bg-stone-50 flex items-center gap-2"
                        >
                            <Edit2 size={12} /> Edit
                        </button>
                        <button 
                            onClick={() => {
                                onPin(entry.id);
                                setShowMenu(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-stone-600 hover:bg-stone-50 flex items-center gap-2"
                        >
                            <Pin size={12} className={entry.isPinned ? "fill-current" : ""} /> {entry.isPinned ? "Unpin" : "Pin"}
                        </button>
                        <div className="h-px bg-stone-100 my-1" />
                        <button 
                            onClick={() => setShowDeleteConfirm(true)}
                            className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 flex items-center gap-2"
                        >
                            <Trash2 size={12} /> Delete
                        </button>
                    </>
                ) : (
                    <div className="p-2 animate-in slide-in-from-right-2 duration-200">
                        <div className="mb-2 px-1">
                            <span className="text-[11px] font-bold text-stone-800 whitespace-nowrap block text-center">
                                Delete this thought?
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-1.5 text-[10px] font-bold text-stone-500 bg-stone-100 rounded hover:bg-stone-200"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => {
                                    onDelete(entry.id);
                                    setShowMenu(false);
                                }}
                                className="flex-1 py-1.5 text-[10px] font-bold text-white bg-stone-800 rounded hover:bg-black shadow-sm"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                )}
             </div>
          </div>,
          document.body
      )}

      {/* === BOTTOM SHEET / MODAL OVERLAY (PORTAL) === */}
      {activeSheet && createPortal(
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-auto">
             {/* Backdrop */}
             <div 
                className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300" 
                onClick={() => setActiveSheet(null)} 
             />
             
             {/* Modal Card */}
             <div className="bg-white w-full sm:max-w-lg h-[85vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col relative z-10 animate-in slide-in-from-bottom-10 duration-300">
                
                {/* Sticky Header */}
                <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-white sticky top-0 z-20">
                     <h2 className="text-lg font-bold text-paper-ink flex items-center gap-2">
                         {activeSheet === 'insights' && (
                             <>
                                <div className="p-1.5 bg-stone-100 rounded-full text-stone-600"><Sparkles size={18} /></div>
                                AI Insight
                             </>
                         )}
                         {activeSheet === 'resources' && (
                             <>
                                <div className="p-1.5 bg-stone-100 rounded-full text-stone-600"><Compass size={18} /></div>
                                Related Resources
                             </>
                         )}
                      </h2>
                      <button 
                         onClick={() => setActiveSheet(null)}
                         className="p-1.5 bg-stone-100 hover:bg-stone-200 rounded-full text-stone-500 transition-colors"
                      >
                         <X size={18} />
                      </button>
                </div>
                
                {/* Scrollable Content */}
                <div className="overflow-y-auto flex-1 p-6 space-y-8 no-scrollbar">
                   {/* INSIGHTS CONTENT */}
                   {activeSheet === 'insights' && (
                       <div className="animate-fadeIn">
                           {isAnalyzing ? (
                               // LOADING SKELETON
                               <div className="space-y-6 py-4">
                                   <div className="space-y-2">
                                       <div className="flex items-center gap-2 mb-4">
                                            <div className="w-4 h-4 rounded bg-stone-200 animate-pulse" />
                                            <div className="h-4 bg-stone-200 rounded w-1/3 animate-pulse"/>
                                       </div>
                                       <div className="h-24 bg-stone-100 rounded-xl border border-stone-100 animate-pulse"/>
                                   </div>
                                    <div className="space-y-2 mt-8">
                                       <div className="h-4 bg-stone-200 rounded w-1/4 animate-pulse mb-4"/>
                                       <div className="h-32 bg-stone-100 rounded-xl border border-stone-100 animate-pulse"/>
                                   </div>
                                   <div className="flex items-center justify-center gap-2 text-stone-400 py-6">
                                       <Loader2 size={16} className="animate-spin text-paper-accent" />
                                       <span className="text-xs font-bold uppercase tracking-widest text-paper-accent">Generating Insights...</span>
                                   </div>
                               </div>
                           ) : hasAnalysis ? (
                               // REAL CONTENT
                               <div className="space-y-8 animate-fadeIn">
                                   {/* Action Plan */}
                                   {entry.analysis?.nextSteps && entry.analysis.nextSteps.length > 0 && (
                                       <div>
                                           <h4 className="font-bold text-stone-900 mb-4 flex items-center gap-2 text-xs uppercase tracking-wide">
                                               <CheckSquare size={16} className="text-paper-accent" />
                                               Suggested Actions
                                           </h4>
                                           <div className="bg-stone-50 rounded-xl p-2 border border-stone-100">
                                               <ul className="space-y-1">
                                                   {entry.analysis.nextSteps.map((step, idx) => (
                                                       <li 
                                                           key={idx} 
                                                           onClick={() => toggleCheck(idx)}
                                                           className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-all hover:bg-white ${checkedItems.has(idx) ? 'opacity-50' : ''}`}
                                                       >
                                                           <div className={`w-6 h-6 border-2 border-stone-300 rounded-md flex-shrink-0 transition-colors flex items-center justify-center bg-white ${checkedItems.has(idx) ? '!bg-paper-ink !border-paper-ink' : ''}`} >
                                                               {checkedItems.has(idx) && <div className="w-2.5 h-2.5 bg-white rounded-[1px]" />}
                                                           </div>
                                                           <span className={`text-base font-medium text-stone-700 transition-all ${checkedItems.has(idx) ? 'line-through text-stone-400' : ''}`}>
                                                               {step}
                                                           </span>
                                                       </li>
                                                   ))}
                                               </ul>
                                           </div>
                                       </div>
                                   )}

                                   {/* Coaching Prompt */}
                                   {entry.analysis?.insightPrompt && (
                                       <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm relative overflow-hidden">
                                           <div className="absolute top-0 right-0 p-4 opacity-5">
                                              <MessageCircleQuestion size={120} />
                                           </div>
                                           <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2 relative z-10">Reflection Question</h4>
                                           <p className="text-xl text-paper-ink font-serif italic relative z-10 leading-relaxed">
                                              "{entry.analysis.insightPrompt}"
                                           </p>
                                       </div>
                                   )}
                               </div>
                           ) : (
                               // EMPTY STATE
                               <div className="py-12 flex flex-col items-center justify-center text-stone-400 text-center">
                                    <Sparkles size={32} className="mb-3 opacity-20" />
                                    <p className="text-sm">No specific insights generated for this entry.</p>
                               </div>
                           )}
                       </div>
                   )}

                   {/* RESOURCES CONTENT */}
                   {activeSheet === 'resources' && (
                       <div className="animate-fadeIn">
                           {isLoadingRelated && (!entry.relatedContent || entry.relatedContent.length === 0) ? (
                               <div className="py-20 flex flex-col items-center justify-center text-stone-400 gap-4">
                                   <Loader2 className="animate-spin text-stone-400" size={40} />
                                   <p className="text-sm font-bold uppercase tracking-widest">Searching the web...</p>
                               </div>
                           ) : (
                               <div className="grid gap-3">
                                   <div className="text-xs text-stone-400 mb-1">
                                       Found for <span className="font-bold text-stone-500">"{entry.analysis?.category}"</span>:
                                   </div>
                                   {entry.relatedContent?.map((item, idx) => (
                                       <a key={idx} href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-4 p-4 bg-white border border-stone-200 rounded-xl hover:border-stone-800 hover:shadow-lg hover:-translate-y-0.5 transition-all group/link active:scale-[0.98]">
                                           <div className="bg-stone-50 p-3 rounded-full text-stone-400 group-hover/link:bg-stone-800 group-hover/link:text-white transition-colors">
                                               <ExternalLink size={18} />
                                           </div>
                                           <div className="flex-1 min-w-0">
                                               <h5 className="font-bold text-stone-800 text-base leading-snug mb-1 truncate">{item.title}</h5>
                                               <p className="text-sm text-stone-500 line-clamp-2 leading-relaxed">{item.snippet}</p>
                                               <div className="mt-2 flex items-center gap-1.5 text-[10px] text-stone-400 uppercase font-bold tracking-wider">
                                                   <span className="w-1.5 h-1.5 rounded-full bg-stone-300"></span>
                                                   {item.source}
                                               </div>
                                           </div>
                                       </a>
                                   ))}
                                   {(!entry.relatedContent || entry.relatedContent.length === 0) && !isLoadingRelated && (
                                       <div className="text-center py-10 text-stone-400">
                                           <p>No resources found for this entry.</p>
                                       </div>
                                   )}
                               </div>
                           )}
                       </div>
                   )}
                </div>
             </div>
          </div>,
          document.body
      )}
    </>
  );
};

export default JournalEntryCard;