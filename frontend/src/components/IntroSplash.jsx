import { useState, useEffect } from 'react';

export default function IntroSplash({ onComplete, onStartDissolve }) {
  const [stage, setStage] = useState(0); // 0: init, 1: logo in, 2: brand in, 3: progress in, 4: exit dissolve
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    // Staggered timeline for clean, non-overlapping assembly
    const t1 = setTimeout(() => setStage(1), 200);   // Logo & Ring
    const t2 = setTimeout(() => setStage(2), 700);   // Brand name & Subtitle
    const t3 = setTimeout(() => setStage(3), 1200);  // Progress ticker
    const t4 = setTimeout(() => {                    // Start dissolve
      setFadingOut(true);
      setStage(4);
      if (onStartDissolve) onStartDissolve();
    }, 2200);
    const t5 = setTimeout(() => {                    // Completely unmount
      if (onComplete) onComplete();
    }, 2700);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [onComplete, onStartDissolve]);

  const handleSkip = () => {
    setFadingOut(true);
    if (onStartDissolve) onStartDissolve();
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 350);
  };

  return (
    <div 
      onClick={handleSkip}
      className={`fixed inset-0 z-[9999] bg-[#0D0E12] flex flex-col items-center justify-center select-none cursor-pointer overflow-hidden transition-all duration-700 ease-out ${
        fadingOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Dynamic Ambient Glow Aura */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600/30 blur-[130px] pointer-events-none animate-pulse" />
      <div className="absolute w-[320px] h-[320px] rounded-full bg-indigo-500/20 blur-[90px] pointer-events-none" />

      {/* Geometric Ambient Grid Texture */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}
      />

      {/* Main Assembly Flow with Dedicated Fixed Dimensions & No Overlapping */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 w-full max-w-md">
        
        {/* 1. Emblem Container (Fixed 140px height so diamond NEVER extends below) */}
        <div className="relative w-36 h-36 flex items-center justify-center mb-5">
          {/* Rotated Diamond Ring (Max diagonal ~115px, completely inside 144px box) */}
          <div 
            className={`absolute w-20 h-20 rounded-2xl border border-purple-500/40 bg-purple-500/5 transition-all duration-700 ease-out ${
              stage >= 1 ? 'scale-100 opacity-100 rotate-45' : 'scale-50 opacity-0 rotate-0'
            }`} 
          />
          
          {/* Pulsing Core Glow */}
          <div 
            className={`absolute w-14 h-14 rounded-xl bg-purple-600/40 blur-md transition-all duration-700 ${
              stage >= 1 ? 'scale-125 opacity-100' : 'scale-50 opacity-0'
            }`}
          />

          {/* Central Logo Image */}
          <img 
            src="/vidi_icon_only.png"
            alt="Vidi Logo"
            className={`w-14 h-14 rounded-2xl object-contain shadow-[0_0_35px_rgba(124,58,237,0.8)] relative z-10 transition-all duration-500 ease-out ${
              stage >= 1 ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
            }`}
          />
        </div>

        {/* 2. Brand Name (Dedicated row, clean spacing) */}
        <div className="flex items-center justify-center gap-2.5 mb-2 h-10">
          <h1 
            className={`text-3xl sm:text-4xl font-extrabold tracking-tight text-white transition-all duration-500 ease-out ${
              stage >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            Vidi
          </h1>
          <span 
            className={`text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 transition-all duration-500 delay-100 ease-out ${
              stage >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            AI Core
          </span>
        </div>

        {/* 3. Subtitle (Dedicated row) */}
        <div className="h-6 mb-8 flex items-center justify-center">
          <p 
            className={`text-xs sm:text-sm text-slate-400 font-medium tracking-wide transition-all duration-500 delay-150 ease-out ${
              stage >= 2 ? 'opacity-100' : 'opacity-0'
            }`}
          >
            Indian Compliance, Now Intelligent.
          </p>
        </div>

        {/* 4. Progress Loading Bar & Grounded Corpora Indicator */}
        <div 
          className={`flex flex-col items-center gap-2.5 transition-all duration-500 ease-out ${
            stage >= 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
        >
          <div className="w-52 h-1 bg-[#1a1b26] rounded-full overflow-hidden border border-white/10 relative">
            <div className="h-full bg-gradient-to-r from-purple-500 via-fuchsia-400 to-indigo-500 rounded-full animate-pulse w-full duration-700" />
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-purple-300/90 pt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <span>GST · MCA 2013 · RBI · IT Corpora Grounded</span>
          </div>
        </div>

      </div>

      {/* Skip Button Hint */}
      <div className="absolute bottom-8 text-[11px] font-mono text-slate-500 hover:text-slate-300 transition-colors">
        Click anywhere to skip →
      </div>
    </div>
  );
}
