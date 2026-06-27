import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function Landing() {
  const navigate = useNavigate();
  
  // Dynamic window width state hook to handle pure inline CSS media queries elegantly
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleCTA = () => {
    navigate('/login');
  };

  const isMobile = windowWidth <= 768;
  const isTablet = windowWidth <= 1024 && windowWidth > 768;

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#f8fafc', fontFamily: 'sans-serif', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Navbar */}
      <header style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '16px' : '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>⚡</span>
          <h1 style={{ margin: 0, fontSize: isMobile ? '18px' : '20px', color: '#818cf8', fontWeight: '700', letterSpacing: '0.05em' }}>RegIQ</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '20px' }}>
          <button 
            onClick={() => navigate('/login')} 
            style={{ background: 'transparent', color: '#94a3b8', border: 'none', fontSize: isMobile ? '13px' : '14px', fontWeight: '600', cursor: 'pointer' }}
          >
            Sign In
          </button>
          <button 
            onClick={handleCTA} 
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)', color: '#fff', border: 'none', borderRadius: '8px', padding: isMobile ? '6px 12px' : '8px 16px', fontSize: isMobile ? '13px' : '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}
          >
            Get Started
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main style={{ flex: 1, width: '100%', maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '30px 16px 60px' : '60px 24px', textAlign: 'center', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        
        <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#818cf8', padding: '6px 16px', borderRadius: '20px', fontSize: isMobile ? '10px' : '12px', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '24px', display: 'inline-block' }}>
          🔒 Grounded Financial Regulation Q&A Engine
        </div>

        {/* Responsive scaling font sizes */}
        <h1 style={{ margin: '0 0 20px 0', fontSize: isMobile ? '28px' : isTablet ? '38px' : '48px', fontWeight: '800', lineHeight: '1.3', color: '#ffffff', maxWidth: '800px', letterSpacing: '-0.02em' }}>
          Automate Indian SME Compliance with <span style={{ background: 'linear-gradient(to right, #818cf8, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Zero Hallucination</span>
        </h1>

        <p style={{ margin: '0 0 40px 0', fontSize: isMobile ? '15px' : '18px', color: '#94a3b8', maxWidth: '640px', lineHeight: '1.6' }}>
          Ask plain-language questions across GST, RBI, SEBI, and MCA. Receive pinpoint answers grounded directly in official regulatory context logs and circular updates.
        </p>

        {/* Dynamic CTAs button stack directions */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '16px', justifyContent: 'center', width: isMobile ? '100%' : 'auto', maxWidth: isMobile ? '280px' : 'none', marginBottom: '60px' }}>
          <button 
            onClick={handleCTA} 
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)', color: '#fff', border: 'none', borderRadius: '12px', padding: isMobile ? '14px 24px' : '16px 32px', fontSize: isMobile ? '15px' : '16px', fontWeight: '600', cursor: 'pointer', width: '100%', boxShadow: '0 4px 20px rgba(79, 70, 229, 0.4)' }}
          >
            Try Free Workspace
          </button>
          <button 
            onClick={() => {
              const element = document.getElementById('features-grid');
              element?.scrollIntoView({ behavior: 'smooth' });
            }} 
            style={{ background: 'rgba(30, 41, 59, 0.5)', color: '#f8fafc', border: '1px solid #334155', borderRadius: '12px', padding: isMobile ? '14px 24px' : '16px 32px', fontSize: isMobile ? '15px' : '16px', fontWeight: '600', cursor: 'pointer', width: '100%' }}
          >
            Explore Features
          </button>
        </div>

        {/* Social Proof Indicator Text */}
        <div style={{ borderTop: '1px solid rgba(51, 65, 85, 0.4)', paddingTop: '24px', width: '100%', maxWidth: '600px' }}>
          <p style={{ margin: 0, fontSize: '11px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold' }}>
            TRUSTED BY BUSINESS OWNERS COGNIZANT OF COMPLIANCE
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: isMobile ? '12px' : '32px', marginTop: '16px', fontSize: isMobile ? '12px' : '14px', color: '#64748b', fontWeight: '600', flexWrap: 'wrap' }}>
            <span>• GST Portal Logs</span>
            <span>• RBI Notifications</span>
            <span>• SEBI Directives</span>
            <span>• MCA Filings</span>
          </div>
        </div>

        {/* Responsive Grid System: Shifts stack behavior on viewport decay */}
        <div id="features-grid" style={{ width: '100%', marginTop: isMobile ? '60px' : '100px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', textAlign: 'left' }}>
          
          {/* Feature 1 */}
          <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(51, 65, 85, 0.6)', borderRadius: '16px', padding: isMobile ? '24px' : '32px', backdropFilter: 'blur(12px)' }}>
            <div style={{ fontSize: '24px', marginBottom: '16px' }}>📌</div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#818cf8', fontWeight: '600' }}>Grounded Source Citations</h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8', lineHeight: '1.6' }}>
              Every response is locked onto verified database chunks. Click citations to view exact circular numbers, issuing authorities, clauses, and official dates instantly.
            </p>
          </div>

          {/* Feature 2 */}
          <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(51, 65, 85, 0.6)', borderRadius: '16px', padding: isMobile ? '24px' : '32px', backdropFilter: 'blur(12px)' }}>
            <div style={{ fontSize: '24px', marginBottom: '16px' }}>📊</div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#818cf8', fontWeight: '600' }}>Compliance Risk Scorecard</h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8', lineHeight: '1.6' }}>
              Automatically tracks your corporate profile configurations and aggregates real-time Red/Amber/Green status maps across multiple regulatory jurisdictions.
            </p>
          </div>

          {/* Feature 3 */}
          <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(51, 65, 85, 0.6)', borderRadius: '16px', padding: isMobile ? '24px' : '32px', backdropFilter: 'blur(12px)' }}>
            <div style={{ fontSize: '24px', marginBottom: '16px' }}>🔔</div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#818cf8', fontWeight: '600' }}>Real-Time Change Alerts</h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8', lineHeight: '1.6' }}>
              Our background cron systems monitor legislative revisions weekly. Get immediate in-app and email updates detailing exactly how rules alter your workflows.
            </p>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer style={{ width: '100%', borderTop: '1px solid #1e293b', padding: '24px', textAlign: 'center', boxSizing: 'border-box', backgroundColor: 'rgba(15, 23, 42, 0.2)' }}>
        <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
          &copy; {new Date().getFullYear()} RegIQ Framework. Designed for Indian SME corporate parameters.
        </p>
      </footer>
    </div>
  );
}