import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();

  const handleCTA = () => {
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#f8fafc', fontFamily: 'sans-serif', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Navbar */}
      <header style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>⚡</span>
          <h1 style={{ margin: 0, fontSize: '20px', color: '#818cf8', fontWeight: '700', letterSpacing: '0.05em' }}>RegIQ</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button 
            onClick={() => navigate('/login')} 
            style={{ background: 'transparent', color: '#94a3b8', border: 'none', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
          >
            Sign In
          </button>
          <button 
            onClick={handleCTA} 
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}
          >
            Get Started
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main style={{ flex: 1, width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '60px 24px', textAlign: 'center', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        
        <div style={{ inlineSize: 'fit-content', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#818cf8', padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '24px' }}>
          🔒 Grounded Financial Regulation Q&A Engine
        </div>

        <h1 style={{ margin: '0 0 20px 0', fontSize: '48px', fontWeight: '800', lineHeight: '1.2', color: '#ffffff', maxWidth: '800px', letterSpacing: '-0.02em' }}>
          Automate Indian SME Compliance with <span style={{ background: 'linear-gradient(to right, #818cf8, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Zero Hallucination</span>
        </h1>

        <p style={{ margin: '0 0 40px 0', fontSize: '18px', color: '#94a3b8', maxWidth: '640px', lineHeight: '1.6' }}>
          Ask plain-language questions across GST, RBI, SEBI, and MCA. Receive pinpoint answers grounded directly in official regulatory context logs and circular updates.
        </p>

        {/* Call to Actions */}
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '60px' }}>
          <button 
            onClick={handleCTA} 
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)', color: '#fff', border: 'none', borderRadius: '12px', padding: '16px 32px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 20px rgba(79, 70, 229, 0.4)' }}
          >
            Try Free Workspace
          </button>
          <button 
            onClick={() => {
              const element = document.getElementById('features-grid');
              element?.scrollIntoView({ behavior: 'smooth' });
            }} 
            style={{ background: 'rgba(30, 41, 59, 0.5)', color: '#f8fafc', border: '1px solid #334155', borderRadius: '12px', padding: '16px 32px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}
          >
            Explore Features
          </button>
        </div>

        {/* Social Proof Indicator Text */}
        <div style={{ borderTop: '1px solid rgba(51, 65, 85, 0.4)', paddingTop: '24px', width: '100%', maxWidth: '600px' }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold' }}>
            TRUSTED BY BUSINESS OWNERS COGNIZANT OF CORPORATE COMPLIANCE PARAMS
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginTop: '16px', fontSize: '14px', color: '#64748b', fontWeight: '600' }}>
            <span>• GST Portal Logs</span>
            <span>• RBI Notifications</span>
            <span>• SEBI Directives</span>
            <span>• MCA Filings</span>
          </div>
        </div>

        {/* Feature Highlights Grid Section */}
        <div id="features-grid" style={{ width: '100%', marginTop: '100px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', textAlign: 'left' }}>
          
          {/* Feature 1 — Citations */}
          <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(51, 65, 85, 0.6)', borderRadius: '16px', padding: '32px', backdropFilter: 'blur(12px)' }}>
            <div style={{ fontSize: '24px', marginBottom: '16px' }}>📌</div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#818cf8', fontWeight: '600' }}>Grounded Source Citations</h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8', lineHeight: '1.6' }}>
              Every response is locked onto verified database chunks. Click citations to view exact circular numbers, issuing authorities, clauses, and official dates instantly.
            </p>
          </div>

          {/* Feature 2 — Risk Scorecard */}
          <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(51, 65, 85, 0.6)', borderRadius: '16px', padding: '32px', backdropFilter: 'blur(12px)' }}>
            <div style={{ fontSize: '24px', marginBottom: '16px' }}>📊</div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#818cf8', fontWeight: '600' }}>Compliance Risk Scorecard</h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8', lineHeight: '1.6' }}>
              Automatically tracks your corporate profile configurations and aggregates real-time Red/Amber/Green status maps across multiple regulatory jurisdictions.
            </p>
          </div>

          {/* Feature 3 — Regulation Alerts */}
          <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(51, 65, 85, 0.6)', borderRadius: '16px', padding: '32px', backdropFilter: 'blur(12px)' }}>
            <div style={{ fontSize: '24px', marginBottom: '16px' }}>🔔</div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#818cf8', fontWeight: '600' }}>Real-Time Change Alerts</h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8', lineHeight: '1.6' }}>
              Our background cron systems monitor legislative revisions weekly. Get immediate in-app and email updates detailing exactly how rules alter your workflows.
            </p>
          </div>

        </div>

      </main>

      {/* Footer Disclaimer Layout */}
      <footer style={{ width: '100%', borderTop: '1px solid #1e293b', padding: '24px', textAlign: 'center', boxSizing: 'border-box', backgroundColor: 'rgba(15, 23, 42, 0.2)' }}>
        <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
          &copy; {new Date().getFullYear()} RegIQ Framework. Designed for Indian SME corporate parameters.
        </p>
      </footer>
    </div>
  );
}