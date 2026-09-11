import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import PricingPage from '../components/PricingPage';
import { chatAPI } from '../lib/api';
import { 
  User, 
  CreditCard, 
  Bell, 
  ShieldAlert, 
  LogOut, 
  Check, 
  Building2,
  Trash2
} from 'lucide-react';

// Map our UI list directly to official backend ALERT_TOPICS
const AVAILABLE_ALERTS = [
  { id: 'gst_revisions', topic: 'GST rate changes', corpus: 'gst', title: 'GST Rates & Circular Notifications', desc: 'CBIC rate adjustments, exemptions, and compliance schedules.' },
  { id: 'rbi_notifications', topic: 'RBI NBFC regulations', corpus: 'rbi', title: 'RBI Non-Banking Master Circulars', desc: 'Prudential guidelines, credit policies, and FEMA circulars.' },
  { id: 'sebi_circulars', topic: 'SEBI mutual fund regulations', corpus: 'sebi', title: 'SEBI Prudential & Disclosure Guidelines', desc: 'LODR compliance, insider trading, and mutual fund circulars.' },
  { id: 'mca_filing_deadlines', topic: 'MCA annual filing', corpus: 'mca', title: 'MCA Companies Act Statutory Deadlines', desc: 'Statutory filing timelines, Form 11, and Director KYC rules.' }
];

export default function Settings() {
  const { signOut, user, updateUserProfile } = useAuth() || {};
  const [activeTab, setActiveTab] = useState('profile');
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [profileForm, setProfileForm] = useState({
    name: user?.name || 'Sahil Karande',
    business_type: user?.business_profile?.business_type || 'Private Limited',
    industry: user?.business_profile?.industry || 'Fintech',
    turnover_range: user?.business_profile?.turnover_range || '₹1Cr - ₹5Cr',
    gst_registered: user?.business_profile?.gst_registered || 'Yes',
    has_foreign_funding: user?.business_profile?.has_foreign_funding || 'No'
  });

  const [dbAlerts, setDbAlerts] = useState({});

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
      setProfileForm({
        name: user.name || 'Sahil Karande',
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
    setSaveSuccess(false);
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
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
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
        setDbAlerts((prev) => ({ ...prev, [item.topic]: updated }));
      } else {
        const created = await chatAPI.createAlert({ topic: item.topic, corpus: item.corpus });
        setDbAlerts((prev) => ({ ...prev, [item.topic]: created }));
      }
    } catch (err) {
      console.error('Failed to update alert status:', err);
    }
  };

  const handleDeleteAccount = () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      alert('Account deletion request registered. Please contact support to complete.');
    }
  };

  const TABS = [
    { id: 'profile', label: 'Company Profile', icon: Building2 },
    { id: 'plan', label: 'Plan & Billing', icon: CreditCard },
    { id: 'alerts', label: 'Regulatory Alerts', icon: Bell },
    { id: 'account', label: 'Account Security', icon: User }
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-10 text-slate-100 font-sans">
      
      {/* Header */}
      <div className="mb-8 pb-6 border-b border-slate-800/80">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Workspace Settings
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage corporate entity parameters, statutory notifications, and subscription tiers.
        </p>
      </div>

      {/* Tabs Row */}
      <div className="flex border-b border-slate-800 gap-2 mb-8">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
                isActive 
                  ? 'border-indigo-500 text-white font-semibold' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Box */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
        
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileSave} className="max-w-xl space-y-5 text-xs">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Entity Details</h3>
              <p className="text-xs text-slate-400">These parameters configure your automated risk scorecard and compliance calendar.</p>
            </div>

            {saveSuccess && (
              <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>Company parameters successfully saved.</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Operator / Full Name</label>
              <input 
                type="text" 
                value={profileForm.name} 
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Corporate Constitution</label>
              <select 
                value={profileForm.business_type} 
                onChange={(e) => setProfileForm({ ...profileForm, business_type: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none"
              >
                <option value="Private Limited">Private Limited</option>
                <option value="LLP">LLP</option>
                <option value="Partnership">Partnership</option>
                <option value="Proprietorship">Proprietorship</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Industry Sector</label>
              <select 
                value={profileForm.industry} 
                onChange={(e) => setProfileForm({ ...profileForm, industry: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none"
              >
                <option value="Fintech">Fintech</option>
                <option value="SaaS / Tech Services">SaaS / Tech Services</option>
                <option value="Manufacturing">Manufacturing</option>
                <option value="E-commerce">E-commerce</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Annual Financial Turnover</label>
              <select 
                value={profileForm.turnover_range} 
                onChange={(e) => setProfileForm({ ...profileForm, turnover_range: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none"
              >
                <option value="Under ₹20 Lakhs">Under ₹20 Lakhs</option>
                <option value="₹20 Lakhs - ₹1Cr">₹20 Lakhs - ₹1Cr</option>
                <option value="₹1Cr - ₹5Cr">₹1Cr - ₹5Cr</option>
                <option value="Above ₹5Cr">Above ₹5Cr</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Registered for GST?</label>
                <select 
                  value={profileForm.gst_registered} 
                  onChange={(e) => setProfileForm({ ...profileForm, gst_registered: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Foreign Inflow / FDI?</label>
                <select 
                  value={profileForm.has_foreign_funding} 
                  onChange={(e) => setProfileForm({ ...profileForm, has_foreign_funding: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none"
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button 
                type="submit" 
                disabled={isSavingProfile}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {isSavingProfile ? 'Saving...' : 'Save Parameters'}
              </button>
            </div>
          </form>
        )}

        {/* Plan Tab */}
        {activeTab === 'plan' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <span className="text-[11px] font-mono uppercase text-slate-500 tracking-wider font-semibold">Active Plan</span>
                <div className="text-xl font-bold text-white mt-0.5 capitalize">{user?.role || 'Free'} Tier</div>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-mono uppercase text-slate-500 tracking-wider font-semibold">Status</span>
                <div className="text-xs font-medium text-emerald-400 mt-0.5 flex items-center gap-1.5 justify-end">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Active Workspace</span>
                </div>
              </div>
            </div>

            <PricingPage userEmail={user?.email} />
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Statutory Circular Notification Feeds</h3>
              <p className="text-xs text-slate-400">Toggle active push updates when new notifications or master directions are published.</p>
            </div>

            {loadingAlerts ? (
              <div className="text-xs text-slate-500 py-4">Synchronizing notification feeds...</div>
            ) : (
              <div className="space-y-3">
                {AVAILABLE_ALERTS.map((item) => {
                  const isSubscribed = dbAlerts[item.topic]?.is_active || false;
                  return (
                    <div key={item.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-semibold text-white">{item.title}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleAlert(item)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          isSubscribed 
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' 
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                        }`}
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

        {/* Account Tab */}
        {activeTab === 'account' && (
          <div className="max-w-xl space-y-8">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white">Session Management</h3>
              <p className="text-xs text-slate-400">Sign out of your active session on this device.</p>
              <button 
                type="button"
                onClick={signOut}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>

            <div className="pt-6 border-t border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-rose-400">Danger Zone</h3>
              <p className="text-xs text-slate-400">Permanently delete your account, session logs, and personal documents.</p>
              <button 
                type="button"
                onClick={handleDeleteAccount}
                className="px-4 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}