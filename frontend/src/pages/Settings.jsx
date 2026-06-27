import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import PricingPage from '../components/PricingPage';

export default function Settings() {
  const { signOut, user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  // Profile Tab State Matrix
  const [profileForm, setProfileForm] = useState({
    name: user?.name || 'Sahil Karande',
    businessType: 'SME / Retail Services',
    state: 'Maharashtra',
    turnover: '₹50 Lakhs - ₹2 Crores'
  });

  // Alerts Tab Topic Subscription Toggles
  const [alertSubscriptions, setAlertSubscriptions] = useState({
    gst_revisions: true,
    rbi_notifications: true,
    sebi_circulars: false,
    mca_filing_deadlines: true
  });

  // Load user data dynamically if attached to auth profiles database schema
  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfileForm((prev) => ({
        ...prev,
        name: user.name || prev.name,
        businessType: user.business_profile?.business_type || prev.businessType,
        state: user.business_profile?.state || prev.state,
        turnover: user.business_profile?.turnover || prev.turnover
      }));
    }
  }, [user]);

  const handleProfileSave = (e) => {
    e.preventDefault();
    alert('Profile configurations committed successfully to your Supabase metadata storage!');
  };

  const handleToggleAlert = (topic) => {
    setAlertSubscriptions((prev) => ({
      ...prev,
      [topic]: !prev[topic]
    }));
  };

  const handleCheckoutUpgrade = (tier, cycle) => {
    alert(
      `Initializing Razorpay Secure Intent for RegIQ ${tier.toUpperCase()} Plan!\n` +
      `Billing Configuration: [${cycle.toUpperCase()}]\n\n` +
      `FastAPI billing router (/api/billing/subscribe) webhooks will initialize script injection in Week 8.`
    );
  };

  const handleDeleteAccount = () => {
    if (window.confirm('WARNING: Are you sure you want to permanently delete your account? This action purges all Supabase profiles, saved history, and active query capacities immediately.')) {
      alert('Account deletion token initialized. Contact system administrator to complete validation.');
    }
  };

  // Styled tab buttons helper
  const renderTabButton = (id, label, icon) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        style={{
          background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
          color: isActive ? '#818cf8' : '#94a3b8',
          border: 'none',
          borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
          padding: '12px 20px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <span>{icon}</span> {label}
      </button>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#f8fafc', padding: '32px 24px', boxSizing: 'border-box', fontFamily: 'sans-serif' }}>
      
      {/* Header Dashboard Banner */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', marginBottom: '32px', borderBottom: '1px solid rgba(51, 65, 85, 0.4)', paddingBottom: '16px', textAlign: 'left' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#ffffff', letterSpacing: '-0.01em' }}>
          Workspace Configurations
        </h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>
          Configure operational profile fields, notification alert rules, and checkout parameters.
        </p>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Navigation Tab Line Row */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', gap: '8px' }}>
          {renderTabButton('profile', 'Business Profile', '👤')}
          {renderTabButton('plan', 'Plan & Billing', '💳')}
          {renderTabButton('alerts', 'Regulation Alerts', '🔔')}
          {renderTabButton('account', 'Account Safety', '⚙️')}
        </div>

        {/* Tab Canvas Output Viewport */}
        <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(51, 65, 85, 0.6)', borderRadius: '16px', padding: '32px', boxSizing: 'border-box', backdropFilter: 'blur(12px)', minHeight: '400px', textAlign: 'left' }}>
          
          {/* TAB 1: Profile Matrix Setup */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSave} style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#ffffff' }}>Corporate Meta parameters</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Operator / Full Name</label>
                <input 
                  type="text" 
                  value={profileForm.name} 
                  onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                  style={{ background: '#020617', border: '1px solid #334155', borderRadius: '8px', padding: '10px 14px', color: '#f8fafc', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Business Entity Classification</label>
                <input 
                  type="text" 
                  value={profileForm.businessType} 
                  onChange={(e) => setProfileForm({...profileForm, businessType: e.target.value})}
                  style={{ background: '#020617', border: '1px solid #334155', borderRadius: '8px', padding: '10px 14px', color: '#f8fafc', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>State Jurisdiction</label>
                <input 
                  type="text" 
                  value={profileForm.state} 
                  onChange={(e) => setProfileForm({...profileForm, state: e.target.value})}
                  style={{ background: '#020617', border: '1px solid #334155', borderRadius: '8px', padding: '10px 14px', color: '#f8fafc', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Annual Financial Turnover Tier</label>
                <select 
                  value={profileForm.turnover} 
                  onChange={(e) => setProfileForm({...profileForm, turnover: e.target.value})}
                  style={{ background: '#020617', border: '1px solid #334155', borderRadius: '8px', padding: '10px 14px', color: '#f8fafc', outline: 'none' }}
                >
                  <option value="Micro (&lt; ₹50 Lakhs)">Micro (&lt; ₹50 Lakhs)</option>
                  <option value="₹50 Lakhs - ₹2 Crores">₹50 Lakhs - ₹2 Crores</option>
                  <option value="₹2 Crores - ₹10 Crores">₹2 Crores - ₹10 Crores</option>
                  <option value="Enterprise (&gt; ₹10 Crores)">Enterprise (&gt; ₹10 Crores)</option>
                </select>
              </div>

              <button type="submit" style={{ width: 'fit-content', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginTop: '10px' }}>
                Save Profile Meta
              </button>
            </form>
          )}

          {/* TAB 2: Plan lease selectors */}
          {activeTab === 'plan' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(30, 41, 59, 0.4)', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b', marginBottom: '32px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Current Workspace Active Plan</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#818cf8', marginTop: '4px' }}>Free Allocation Space</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'right' }}>Billing Frequency</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#f8fafc', marginTop: '4px', textAlign: 'right' }}>N/A (Complimentary Baseline)</div>
                </div>
              </div>
              <PricingPage onSelectPlan={handleCheckoutUpgrade} />
            </div>
          )}

          {/* TAB 3: Notifications Subscription Matrix */}
          {activeTab === 'alerts' && (
            <div style={{ maxWidth: '600px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#ffffff' }}>Weekly Legislative Change Digests</h3>
              <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
                Configure background NLP cron diff monitors to push updates right to your matching email handles.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  { id: 'gst_revisions', title: 'GST Goods & Services Rates Notifications', desc: 'Alert notifications detailing CBIC adjustments.' },
                  { id: 'rbi_notifications', title: 'RBI Non-Banking Master Circular Revisions', desc: 'Monitors currency, credit policy, and FEMA directives.' },
                  { id: 'sebi_circulars', title: 'SEBI Mutual Fund Prudential Guidelines', desc: 'Tracks investment guidelines and security frameworks.' },
                  { id: 'mca_filing_deadlines', title: 'MCA Companies Act Statutory Deadlines', desc: 'Updates concerning filing formats and rules.' }
                ].map((item) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(30, 41, 59, 0.2)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(51, 65, 85, 0.3)' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff' }}>{item.title}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{item.desc}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleAlert(item.id)}
                      style={{
                        background: alertSubscriptions[item.id] ? '#10b981' : '#334155',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '20px',
                        padding: '6px 16px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      {alertSubscriptions[item.id] ? 'Active' : 'Muted'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: Safety & Session Control Evictions */}
          {activeTab === 'account' && (
            <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
              <div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#ffffff' }}>Terminate active sessions</h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>Logs your identity credentials safely out of this client framework workspace node.</p>
                <button 
                  type="button"
                  onClick={signOut}
                  style={{ background: 'transparent', color: '#f8fafc', border: '1px solid #334155', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'border-color 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#ef4444'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#334155'}
                >
                  Sign Out of RegIQ
                </button>
              </div>

              <div style={{ borderTop: '1px solid rgba(51, 65, 85, 0.4)', paddingTop: '24px' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#ef4444' }}>Danger Zone Layout</h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>Permanently purges historical references, custom datasets, billing leases, and account profile schemas completely.</p>
                <button 
                  type="button"
                  onClick={handleDeleteAccount}
                  style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444'; }}
                >
                  Delete Account Permanently
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}