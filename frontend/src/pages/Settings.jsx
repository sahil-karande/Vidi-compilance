import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import PricingPage from '../components/PricingPage';
import { chatAPI } from '../lib/api'; // Fixed: Import unified chatAPI wrapper configuration instance

// Map our UI list directly to official backend ALERT_TOPICS
const AVAILABLE_ALERTS = [
  { id: 'gst_revisions', topic: 'GST rate changes', corpus: 'gst', title: 'GST Goods & Services Rates Notifications', desc: 'Alert notifications detailing CBIC adjustments.' },
  { id: 'rbi_notifications', topic: 'RBI NBFC regulations', corpus: 'rbi', title: 'RBI Non-Banking Master Circular Revisions', desc: 'Monitors currency, credit policy, and FEMA directives.' },
  { id: 'sebi_circulars', topic: 'SEBI mutual fund regulations', corpus: 'sebi', title: 'SEBI Mutual Fund Prudential Guidelines', desc: 'Tracks investment guidelines and security frameworks.' },
  { id: 'mca_filing_deadlines', topic: 'MCA annual filing', corpus: 'mca', title: 'MCA Companies Act Statutory Deadlines', desc: 'Updates concerning filing formats and rules.' }
];

export default function Settings() {
  const { signOut, user, updateUserProfile } = useAuth() || {};
  const [activeTab, setActiveTab] = useState('profile');
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Profile Tab State Matrix aligned with onboard database schemas
  const [profileForm, setProfileForm] = useState({
    name: user?.name || 'Sahil Karande',
    business_type: user?.business_profile?.business_type || 'Private Limited',
    industry: user?.business_profile?.industry || 'Fintech',
    turnover_range: user?.business_profile?.turnover_range || '₹1Cr - ₹5Cr',
    gst_registered: user?.business_profile?.gst_registered || 'Yes',
    has_foreign_funding: user?.business_profile?.has_foreign_funding || 'No'
  });

  // Lookup map for alerts from database
  const [dbAlerts, setDbAlerts] = useState({});

  // Fetch active alerts from backend on mount
  const fetchAlertSubscriptions = async () => {
    try {
      setLoadingAlerts(true);
      const data = await chatAPI.listAlerts();
      
      const alertMap = {};
      if (Array.isArray(data)) {
        data.forEach((alert) => {
          alertMap[alert.topic] = alert;
        });
      }
      setDbAlerts(alertMap);
    } catch (err) {
      console.error('Failed to load alert configurations:', err);
    } finally {
      setLoadingAlerts(false);
    }
  };

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfileForm({
        name: user.name || '',
        business_type: user.business_profile?.business_type || 'Private Limited',
        industry: user.business_profile?.industry || 'Fintech',
        turnover_range: user.business_profile?.turnover_range || '₹1Cr - ₹5Cr',
        gst_registered: user.business_profile?.gst_registered || 'Yes',
        has_foreign_funding: user.business_profile?.has_foreign_funding || 'No'
      });
      
      fetchAlertSubscriptions();
    }
  }, [user]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      if (updateUserProfile) {
        await updateUserProfile({
          name: profileForm.name,
          business_profile: {
            business_type: profileForm.business_type,
            industry: profileForm.industry,
            turnover_range: profileForm.turnover_range,
            gst_registered: profileForm.gst_registered,
            has_foreign_funding: profileForm.has_foreign_funding
          }
        });
        alert('Profile configurations committed successfully to your database storage!');
      }
    } catch (err) {
      console.error('Failed to update business configuration profile:', err);
      alert('Failed to save profile configurations.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleToggleAlert = async (item) => {
    const existingAlert = dbAlerts[item.topic];

    try {
      if (existingAlert) {
        const updated = await chatAPI.updateAlert(existingAlert.id, {
          is_active: !existingAlert.is_active
        });
        
        setDbAlerts((prev) => ({
          ...prev,
          [item.topic]: updated
        }));
      } else {
        const created = await chatAPI.createAlert({
          topic: item.topic,
          corpus: item.corpus
        });

        setDbAlerts((prev) => ({
          ...prev,
          [item.topic]: created
        }));
      }
    } catch (err) {
      console.error('Failed to update alert status:', err);
      alert('Failed to save alert preference. Please try again.');
    }
  };

  const handleCheckoutUpgrade = (tier, cycle) => {
    console.log(`Razorpay billing sequence dispatched for tier: ${tier}, cycle: ${cycle}`);
  };

  const handleDeleteAccount = () => {
    if (window.confirm('WARNING: Are you sure you want to permanently delete your account? This action purges all profiles, saved history, and active query capacities immediately.')) {
      alert('Account deletion token initialized. Contact system administrator to complete validation.');
    }
  };

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
      
      <div style={{ maxWidth: '1200px', margin: '0 auto', marginBottom: '32px', borderBottom: '1px solid rgba(51, 65, 85, 0.4)', paddingBottom: '16px', textAlign: 'left' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#ffffff', letterSpacing: '-0.01em' }}>
          Workspace Configurations
        </h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>
          Configure operational profile fields, notification alert rules, and checkout parameters.
        </p>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', gap: '8px' }}>
          {renderTabButton('profile', 'Business Profile', '👤')}
          {renderTabButton('plan', 'Plan & Billing', 'card')}
          {renderTabButton('alerts', 'Regulation Alerts', '🔔')}
          {renderTabButton('account', 'Account Safety', '⚙️')}
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(51, 65, 85, 0.6)', borderRadius: '16px', padding: '32px', boxSizing: 'border-box', backdropFilter: 'blur(12px)', minHeight: '400px', textAlign: 'left' }}>
          
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
                <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Business Entity Constitution</label>
                <select 
                  value={profileForm.business_type} 
                  onChange={(e) => setProfileForm({...profileForm, business_type: e.target.value})}
                  style={{ background: '#020617', border: '1px solid #334155', borderRadius: '8px', padding: '10px 14px', color: '#f8fafc', outline: 'none' }}
                >
                  <option value="Private Limited">Private Limited</option>
                  <option value="LLP">LLP</option>
                  <option value="Partnership">Partnership</option>
                  <option value="Proprietorship">Proprietorship</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Industry Sector</label>
                <select 
                  value={profileForm.industry} 
                  onChange={(e) => setProfileForm({...profileForm, industry: e.target.value})}
                  style={{ background: '#020617', border: '1px solid #334155', borderRadius: '8px', padding: '10px 14px', color: '#f8fafc', outline: 'none' }}
                >
                  <option value="Fintech">Fintech</option>
                  <option value="SaaS / Tech Services">SaaS / Tech Services</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="E-commerce">E-commerce</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Annual Financial Turnover Tier</label>
                <select 
                  value={profileForm.turnover_range} 
                  onChange={(e) => setProfileForm({...profileForm, turnover_range: e.target.value})}
                  style={{ background: '#020617', border: '1px solid #334155', borderRadius: '8px', padding: '10px 14px', color: '#f8fafc', outline: 'none' }}
                >
                  <option value="Under ₹20 Lakhs">Under ₹20 Lakhs</option>
                  <option value="₹20 Lakhs - ₹1Cr">₹20 Lakhs - ₹1Cr</option>
                  <option value="₹1Cr - ₹5Cr">₹1Cr - ₹5Cr</option>
                  <option value="Above ₹5Cr">Above ₹5Cr</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Registered for GST?</label>
                  <select 
                    value={profileForm.gst_registered} 
                    onChange={(e) => setProfileForm({...profileForm, gst_registered: e.target.value})}
                    style={{ background: '#020617', border: '1px solid #334155', borderRadius: '8px', padding: '10px 14px', color: '#f8fafc', outline: 'none' }}
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Foreign Funding (FDI)?</label>
                  <select 
                    value={profileForm.has_foreign_funding} 
                    onChange={(e) => setProfileForm({...profileForm, has_foreign_funding: e.target.value})}
                    style={{ background: '#020617', border: '1px solid #334155', borderRadius: '8px', padding: '10px 14px', color: '#f8fafc', outline: 'none' }}
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSavingProfile}
                style={{ width: 'fit-content', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginTop: '10px', opacity: isSavingProfile ? 0.6 : 1 }}
              >
                {isSavingProfile ? 'Saving Parameters...' : 'Save Profile Meta'}
              </button>
            </form>
          )}

          {activeTab === 'plan' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(30, 41, 59, 0.4)', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b', marginBottom: '32px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Current Workspace Active Plan</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#818cf8', marginTop: '4px' }}>{user?.role?.toUpperCase() || 'FREE'} Tier</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'right' }}>Status</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#f8fafc', marginTop: '4px', textAlign: 'right' }}>Active Operational Space</div>
                </div>
              </div>
              <PricingPage onSelectPlan={handleCheckoutUpgrade} userEmail={user?.email} />
            </div>
          )}

          {activeTab === 'alerts' && (
            <div style={{ maxWidth: '600px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#ffffff' }}>Weekly Legislative Change Digests</h3>
              <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
                Configure background NLP cron diff monitors to push updates right to your matching email handles.
              </p>

              {loadingAlerts ? (
                <div style={{ color: '#94a3b8', fontSize: '14px' }}>Synchronizing preferences with database...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {AVAILABLE_ALERTS.map((item) => {
                    const isSubscribed = dbAlerts[item.topic]?.is_active || false;

                    return (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyOrigin: 'center', justifyContent: 'space-between', background: 'rgba(30, 41, 59, 0.2)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(51, 65, 85, 0.3)' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff' }}>{item.title}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{item.desc}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleAlert(item)}
                          style={{
                            background: isSubscribed ? '#10b981' : '#334155',
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
                          {isSubscribed ? 'Active' : 'Muted'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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