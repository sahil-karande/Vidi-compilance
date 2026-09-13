import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePwaInstall } from '../hooks/usePwaInstall';
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
  Trash2,
  Smartphone,
  Download,
  Wifi,
  RefreshCw
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
  const { isInstallable, isInstalled, isStandalone, promptInstall } = usePwaInstall();
  const [cacheStatus, setCacheStatus] = useState({ cleared: false, checking: false, cachedCount: 0 });
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
    { id: 'app', label: 'Desktop & Mobile App', icon: Smartphone },
    { id: 'account', label: 'Account Security', icon: User }
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-10 text-slate-100 font-sans animate-fade-in">
      
      {/* Header */}
      <div className="mb-8 pb-6 border-b border-white/10">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Workspace Settings
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage corporate entity parameters, statutory notifications, and subscription tiers.
        </p>
      </div>

      {/* Tabs Row */}
      <div className="flex border-b border-white/10 gap-2 mb-8">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all -mb-px ${
                isActive 
                  ? 'border-purple-500 text-purple-300 font-semibold' 
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Box */}
      <div key={activeTab} className="bg-[#12131A]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl animate-fade-in-up">
        
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileSave} className="max-w-xl space-y-5 text-xs animate-fade-in">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Entity Details</h3>
              <p className="text-xs text-slate-400">These parameters configure your automated risk scorecard and compliance calendar.</p>
            </div>

            {saveSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 flex items-center gap-2 shadow-lg">
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
                className="w-full bg-[#181820] border border-white/10 focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Corporate Constitution</label>
              <select 
                value={profileForm.business_type} 
                onChange={(e) => setProfileForm({ ...profileForm, business_type: e.target.value })}
                className="w-full bg-[#181820] border border-white/10 focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none transition-all cursor-pointer"
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
                className="w-full bg-[#181820] border border-white/10 focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none transition-all cursor-pointer"
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
                className="w-full bg-[#181820] border border-white/10 focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none transition-all cursor-pointer"
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
                  className="w-full bg-[#181820] border border-white/10 focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none transition-all cursor-pointer"
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
                  className="w-full bg-[#181820] border border-white/10 focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none transition-all cursor-pointer"
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
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.45)] transition-all disabled:opacity-50"
              >
                {isSavingProfile ? 'Saving...' : 'Save Parameters'}
              </button>
            </div>
          </form>
        )}

        {/* Plan Tab */}
        {activeTab === 'plan' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#16161F] border border-white/10">
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
                    <div key={item.id} className="p-4 rounded-2xl bg-[#16161F] border border-white/10 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-semibold text-white">{item.title}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleAlert(item)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          isSubscribed 
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.2)]' 
                            : 'bg-[#181820] text-slate-400 hover:text-white border border-white/10'
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

        {/* Desktop & Mobile App Tab */}
        {activeTab === 'app' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h3 className="text-base font-bold text-white">Desktop & Mobile Application</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Vidi operates as an installable application on macOS, Windows, Linux, Android, and iOS. 
                Enjoy fast startup and dedicated desktop or mobile window mode.
              </p>
            </div>

            {/* Installation Status Card */}
            <div className="p-5 rounded-2xl bg-[#16161F] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center p-2 shrink-0">
                  <img src="/vidi_icon_only.png" alt="Vidi Icon" className="w-full h-full object-contain" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">Application Status</span>
                    {isInstalled || isStandalone ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Installed (Standalone)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Web Browser Mode
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isInstalled || isStandalone 
                      ? 'Running inside dedicated standalone window.' 
                      : 'You can install this site as an app on your screen for desktop or mobile.'}
                  </p>
                </div>
              </div>

              {!isInstalled && !isStandalone && (
                <button
                  type="button"
                  onClick={promptInstall}
                  className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold transition-all shadow-[0_4px_16px_rgba(147,51,234,0.3)] flex items-center justify-center gap-2 shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Install App</span>
                </button>
              )}
            </div>

            {/* Offline Cache & Service Worker Card */}
            <div className="p-5 rounded-2xl bg-[#16161F] border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Wifi className="w-4 h-4 text-purple-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Offline Cache & Service Worker</h4>
                </div>
                <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active (vidi-pwa-v1)
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Critical core interfaces, fonts, icons, and stylesheets are cached locally. If your network connection drops, 
                Vidi serves the offline fallback interface seamlessly.
              </p>
              <div className="pt-2 flex items-center justify-between border-t border-white/5">
                <span className="text-xs text-slate-400">Clear cached assets and reload fresh copies:</span>
                <button
                  type="button"
                  onClick={async () => {
                    if ('caches' in window) {
                      const keys = await caches.keys();
                      await Promise.all(keys.map(k => caches.delete(k)));
                      setCacheStatus({ cleared: true, checking: false, cachedCount: 0 });
                      setTimeout(() => setCacheStatus({ cleared: false, checking: false, cachedCount: 0 }), 3000);
                    }
                  }}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3 text-slate-400" />
                  <span>{cacheStatus.cleared ? 'Cache Purged!' : 'Purge PWA Cache'}</span>
                </button>
              </div>
            </div>
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
                className="px-4 py-2 bg-[#181820] hover:bg-[#20202c] border border-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-all flex items-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>

            <div className="pt-6 border-t border-white/10 space-y-3">
              <h3 className="text-sm font-bold text-rose-400">Danger Zone</h3>
              <p className="text-xs text-slate-400">Permanently delete your account, session logs, and personal documents.</p>
              <button 
                type="button"
                onClick={handleDeleteAccount}
                className="px-4 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-medium transition-all flex items-center gap-2"
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