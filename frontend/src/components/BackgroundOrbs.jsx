export default function BackgroundOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10 select-none">
      {/* Circle 1 - Primary Big Purple Glowing Orb */}
      <div 
        className="absolute -top-[12%] -left-[10%] w-[550px] h-[550px] sm:w-[720px] sm:h-[720px] rounded-full bg-gradient-to-tr from-purple-600/40 via-violet-600/25 to-indigo-600/10 blur-[100px] sm:blur-[135px] animate-float-orb-1" 
      />

      {/* Circle 2 - Big Deep Violet / Indigo Floating Orb */}
      <div 
        className="absolute -bottom-[15%] -right-[12%] w-[520px] h-[520px] sm:w-[680px] sm:h-[680px] rounded-full bg-gradient-to-br from-indigo-600/35 via-purple-700/25 to-fuchsia-600/10 blur-[110px] sm:blur-[145px] animate-float-orb-2" 
      />

      {/* Circle 3 - Big Ambient Mid-Center Floating Orb */}
      <div 
        className="absolute top-[35%] left-[25%] w-[450px] h-[450px] sm:w-[600px] sm:h-[600px] rounded-full bg-gradient-to-r from-purple-500/30 via-fuchsia-500/20 to-violet-600/10 blur-[95px] sm:blur-[130px] animate-float-orb-3" 
      />

      {/* Subtle Geometric Overlay Texture */}
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
