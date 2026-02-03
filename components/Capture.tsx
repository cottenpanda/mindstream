import React, { useState, useRef, useEffect } from 'react';
import { Mic, Send, Loader2, StopCircle, Dices, PenTool, Camera, X, Check, Star, AlertCircle } from 'lucide-react';
import { LocationData } from '../types';
import { useGeminiLive } from '../hooks/useGeminiLive';

interface CaptureProps {
  onSave: (text: string, location?: LocationData, images?: string[]) => void;
  isSaving: boolean;
}

const PROMPTS = [
  "What's one small win you had today?",
  "What's worrying you right now, and why?",
  "Describe a moment today that made you smile.",
  "What is one thing you want to achieve tomorrow?",
  "If you had 1 hour of free time right now, what would you do?",
  "What's a new word or idea you encountered recently?",
  "Who are you grateful for today?",
  "What is a lesson you learned the hard way recently?",
  "Describe your energy level right now in three words.",
  "What is the most beautiful thing you saw today?",
  "If you could send a message to your future self, what would you say?",
  "What is a habit you are trying to build?",
  "Who made a positive impact on your day?",
  "What is something you are procrastinating on?",
  "Describe your perfect morning routine.",
  "What song currently matches your mood?",
  "What is a fear you want to overcome?",
  "Write about a place that makes you feel safe.",
  "What detail in your surroundings are you noticing right now?",
  "What's a decision you're struggling to make?"
];

const Capture: React.FC<CaptureProps> = ({ onSave, isSaving }) => {
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Gemini Live Integration ---
  const { isConnected: isListening, isConnecting, start, stop } = useGeminiLive({
    onTranscription: (newText) => {
        setText(prev => prev + newText);
    },
    onError: (err) => {
        setVoiceError(err.message || "Voice connection interrupted.");
        // Increased timeout to 8 seconds so user can read System Settings instructions
        setTimeout(() => setVoiceError(null), 8000);
    }
  });

  const toggleListening = () => {
    if (isListening) {
      stop();
    } else {
      setVoiceError(null);
      start();
    }
  };
  // -------------------------------

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImages(prev => [...prev, base64String]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const rollDice = () => {
    const randomPrompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    setText(randomPrompt + "\n\n");
  };

  const handleSave = () => {
    if (!text.trim() && images.length === 0) return;
    if (isListening) stop();
    
    // Trigger celebration
    setShowCelebration(true);
    
    // Wait briefly for animation to register before actually saving/navigating
    setTimeout(() => {
        onSave(text, undefined, images);
        setText('');
        setImages([]);
        setShowCelebration(false);
    }, 800);
  };

  return (
    <div className="flex flex-col h-full relative group">
      {/* Hidden File Input */}
      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        onChange={handleImageUpload} 
        className="hidden"
      />

      {/* Notebook binding visual */}
      <div className="absolute -top-4 left-0 right-0 h-8 bg-gradient-to-b from-stone-200 to-transparent opacity-50 z-10" />
      
      <div className="flex-1 bg-white shadow-[2px_4px_16px_rgba(0,0,0,0.08)] rounded-lg overflow-hidden flex flex-col relative rotate-1 transition-transform group-hover:rotate-0 duration-500">
        
        {/* Header Tools */}
        <div className="px-5 py-3 border-b border-stone-100 flex justify-between items-center bg-white z-20 relative">
            <div className="flex items-center gap-2 text-paper-pencil">
                <PenTool size={14} />
                <span className="italic text-xs font-medium">Drafting...</span>
            </div>
            <button 
                onClick={rollDice}
                className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-paper-ink bg-stone-50 border border-stone-200 px-2.5 py-1 rounded-full hover:bg-stone-100 transition-colors font-sans"
            >
                <Dices size={12} />
                Inspire
            </button>
        </div>

        {/* Writing Area */}
        <div className="flex-1 relative flex flex-col">
            {/* Image Preview Area */}
            {images.length > 0 && (
                <div className="px-6 pt-6 pb-2 flex gap-2 overflow-x-auto no-scrollbar z-20">
                    {images.map((img, idx) => (
                        <div key={idx} className="relative flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border border-stone-200 shadow-sm group/img">
                            <img src={img} alt="preview" className="w-full h-full object-cover" />
                            <button 
                                onClick={() => removeImage(idx)}
                                className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover/img:opacity-100 transition-opacity"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Start writing here..."
            className="w-full h-full resize-none outline-none text-sm text-paper-ink placeholder:text-stone-300 bg-transparent px-6 py-6 font-sans leading-relaxed"
            spellCheck={false}
            />
            
            {/* --- LISTENING OVERLAY --- */}
            {(isListening || isConnecting) && (
                <div className="absolute inset-0 bg-paper-bg/95 backdrop-blur-md flex flex-col items-center justify-center z-30 animate-in fade-in duration-300">
                    
                    <div className="relative mb-12">
                         <div className="absolute -inset-6 bg-gradient-to-r from-orange-400 via-rose-400 to-amber-400 rounded-full blur-2xl opacity-40 animate-pulse"></div>
                         <div className="relative p-10 rounded-full shadow-2xl shadow-orange-500/30 overflow-hidden scale-100">
                             <div className="absolute inset-0 bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 bg-[length:400%_400%] animate-gradient-flow"></div>
                             <div className="relative z-10 text-white drop-shadow-md">
                                {isConnecting ? <Loader2 size={48} className="animate-spin" /> : <Mic size={48} strokeWidth={2} />}
                             </div>
                         </div>
                    </div>
                    
                    <h3 className="text-lg font-bold text-stone-700 mb-2 tracking-wide">
                        {isConnecting ? "Connecting..." : "Listening..."}
                    </h3>
                    <p className="text-stone-400 text-sm font-medium mb-10">Speak your thoughts freely</p>

                    <button 
                        onClick={stop} 
                        className="px-8 py-3 bg-white border border-stone-200 shadow-sm text-stone-600 font-bold rounded-full hover:bg-stone-50 hover:text-stone-900 transition-all active:scale-95"
                    >
                        Done Speaking
                    </button>
                </div>
            )}

            {/* --- ERROR TOAST --- */}
            {voiceError && (
                <div className="absolute bottom-20 left-4 right-4 z-50 flex justify-center animate-in slide-in-from-bottom-4">
                    <div className="bg-red-50 text-red-600 border border-red-100 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium max-w-full">
                        <AlertCircle size={18} className="flex-shrink-0" />
                        <span className="truncate">{voiceError}</span>
                    </div>
                </div>
            )}

            {/* --- CELEBRATION OVERLAY --- */}
            {showCelebration && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-40 flex flex-col items-center justify-center animate-in fade-in duration-300">
                    <div className="relative">
                        {/* Animated Stars */}
                        <Star className="absolute -top-12 -left-12 text-yellow-400 w-8 h-8 animate-bounce delay-100" fill="currentColor" />
                        <Star className="absolute -top-8 -right-12 text-orange-400 w-6 h-6 animate-pulse" fill="currentColor" />
                        <Star className="absolute -bottom-10 left-8 text-amber-300 w-10 h-10 animate-spin-slow" fill="currentColor" />
                        
                        <div className="bg-green-500 text-white p-6 rounded-full shadow-xl animate-in zoom-in duration-300">
                            <Check size={48} strokeWidth={3} />
                        </div>
                    </div>
                    <h3 className="mt-6 text-xl font-bold text-stone-800 animate-in slide-in-from-bottom-4 duration-500">Thought Captured!</h3>
                </div>
            )}
        </div>

        {/* Footer Actions - Compact */}
        <div className="px-4 py-2 bg-stone-50 border-t border-stone-100 flex items-center justify-between z-20 relative">
             <div className="flex gap-1">
                <button 
                    onClick={toggleListening} 
                    className={`p-2 rounded-full transition-all ${isListening 
                        ? 'bg-orange-500 text-white shadow-md ring-2 ring-orange-200' 
                        : 'hover:bg-white text-stone-400 hover:text-stone-600'}`}
                >
                    {isListening ? <StopCircle size={18} /> : <Mic size={18} />}
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full transition-all hover:bg-white text-stone-400 hover:text-stone-600">
                    <Camera size={18} />
                </button>
             </div>

             <button 
                onClick={handleSave}
                disabled={(!text.trim() && images.length === 0) || isSaving}
                className={`px-5 py-1.5 rounded-lg transition-all text-sm font-bold
                    ${(!text.trim() && images.length === 0) || isSaving ? 'bg-stone-200 text-stone-400 cursor-not-allowed' : 'bg-paper-ink text-white hover:bg-black shadow-md hover:shadow-lg active:translate-y-0.5'}
                `}
             >
                {isSaving ? 'Saving...' : 'Save'}
             </button>
        </div>
      </div>
    </div>
  );
};

export default Capture;