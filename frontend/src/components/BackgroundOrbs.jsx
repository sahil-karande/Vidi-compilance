export default function BackgroundOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none">
      {/* Circle 1 - Top-Left to Bottom-Right Corner Drifter */}
      <div 
        className="absolute -top-[10%] -left-[10%] w-[500px] h-[500px] sm:w-[650px] sm:h-[650px] rounded-full blur-[75px] sm:blur-[100px] animate-float-orb-1" 
        style={{
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.45) 0%, rgba(147, 51, 234, 0.22) 42%, rgba(126, 34, 206, 0.08) 68%, transparent 85%)'
        }}
      />

      {/* Circle 2 - Bottom-Right to Top-Left Corner Drifter */}
      <div 
        className="absolute -bottom-[10%] -right-[10%] w-[480px] h-[480px] sm:w-[620px] sm:h-[620px] rounded-full blur-[80px] sm:blur-[105px] animate-float-orb-2" 
        style={{
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.42) 0%, rgba(124, 58, 237, 0.20) 42%, rgba(91, 33, 182, 0.07) 68%, transparent 85%)'
        }}
      />

      {/* Circle 3 - Top-Right to Bottom-Left Corner Drifter */}
      <div 
        className="absolute -top-[8%] right-[5%] w-[420px] h-[420px] sm:w-[560px] sm:h-[560px] rounded-full blur-[70px] sm:blur-[95px] animate-float-orb-3" 
        style={{
          background: 'radial-gradient(circle, rgba(192, 132, 252, 0.38) 0%, rgba(168, 85, 247, 0.18) 42%, rgba(147, 51, 234, 0.06) 68%, transparent 85%)'
        }}
      />

      {/* Subtle Geometric Texture */}
      <div 
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}
      />
    </div>
  );
}
