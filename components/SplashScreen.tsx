import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [showTagline, setShowTagline] = useState(false);
  const [showButton, setShowButton] = useState(false);
  
  // Typewriter state
  const fullText = "MindStream";
  const [displayText, setDisplayText] = useState("");
  const [isTypingComplete, setIsTypingComplete] = useState(false);

  useEffect(() => {
    // Typewriter effect
    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      if (currentIndex < fullText.length) {
        setDisplayText(fullText.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
        setIsTypingComplete(true);
        
        // Sequence animations after typing
        setTimeout(() => setShowTagline(true), 500);
        setTimeout(() => setShowButton(true), 1200);
      }
    }, 120); // 120ms per char

    return () => clearInterval(typingInterval);
  }, []);

  const handleStart = () => {
    setIsExiting(true);
    // Wait for the exit transition to complete before unmounting
    setTimeout(onComplete, 600); 
  };

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-paper-bg text-paper-ink transition-all duration-700 ease-in-out ${isExiting ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100'}`}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E")`
      }}
    >
      <div className="text-center relative z-10 p-8 flex flex-col items-center">
        {/* Logo with Typewriter Effect */}
        {/* Added pl-3 to optically center the text by shifting it slightly right */}
        {/* Reduced mb-6 to mb-2 to bring tagline closer */}
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2 min-h-[60px] flex items-baseline justify-center pl-3">
          {displayText}
          {/* Dot appears after typing */}
          <span 
            className={`text-paper-accent text-5xl leading-none transition-all duration-500 transform ${isTypingComplete ? 'opacity-100 scale-100 animate-pulse-slow' : 'opacity-0 scale-50'}`}
          >
            .
          </span>
        </h1>

        {/* Tagline */}
        <div 
          className={`h-8 transition-all duration-1000 ease-out transform ${showTagline ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
            <p className="text-stone-500 font-serif italic text-lg tracking-wide">
                Think freely. Discover patterns.
            </p>
        </div>

        {/* Action Button */}
        {/* Reduced mt-16 to mt-12 to move CTA up */}
        <div 
          className={`mt-12 transition-all duration-1000 ease-out transform ${showButton ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
             <button 
                onClick={handleStart}
                className="group relative px-8 py-3 bg-paper-ink text-white rounded-full font-medium tracking-wide overflow-hidden shadow-lg hover:shadow-xl transition-all active:scale-95"
             >
                 <span className="relative z-10 flex items-center gap-2">
                     Begin a thought
                     <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                 </span>
                 {/* Hover effect overlay */}
                 <div className="absolute inset-0 bg-stone-700 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300 ease-out" />
             </button>
        </div>
      </div>

      {/* Footer subtle text */}
      <div 
        className={`absolute bottom-8 text-[10px] text-stone-300 uppercase tracking-widest font-bold transition-opacity duration-1000 delay-1000 ${showButton ? 'opacity-100' : 'opacity-0'}`}
      >
         Private &bull; Intelligent &bull; Personal
      </div>
    </div>
  );
};

export default SplashScreen;