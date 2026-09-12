import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { billingAPI } from '../lib/api';

export default function PricingPage({ onSelectPlan, userEmail = '' }) {
  const navigate = useNavigate(); 
  
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [loadingTier, setLoadingTier] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  
  const [showSandboxModal, setShowSandboxModal] = useState(false);
  const [activeSandboxCycle, setActiveSandboxCycle] = useState('');
  const [activeSubId, setActiveSubId] = useState('');

  const initRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const executeCheckoutSequence = async (tier, cycle) => {
    if (tier !== 'pro') {
      if (onSelectPlan) onSelectPlan(tier, cycle);
      return;
    }

    setLoadingTier(cycle);
    setErrorMessage(null);

    try {
      const response = await billingAPI.createSubscription(cycle);
      const data = response?.data ? response.data : response;
      const subscription_id = data?.subscription_id;
      const razorpay_key_id = data?.razorpay_key_id;

      if (!subscription_id) {
        throw new Error("Gateway failed to return a valid payment identification signature.");
      }

      if (
        razorpay_key_id === "rzp_test_sandbox_key" || 
        !razorpay_key_id || 
        subscription_id?.startsWith("sub_simulated_")
      ) {
        console.log("[billing] Sandbox active. Intercepting external gateway calls.");
        setActiveSandboxCycle(cycle);
        setActiveSubId(subscription_id);
        setShowSandboxModal(true);
        setLoadingTier(null);
        return; 
      }

      const scriptLoaded = await initRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Unable to reach Razorpay CDN endpoints.");
      }

      const checkoutOptions = {
        key: razorpay_key_id,
        subscription_id: subscription_id, 
        name: 'RegIQ Compliance',
        description: `RegIQ Pro Tier Subscription (${cycle})`,
        image: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/matcha/matcha-original.svg', 
        handler: function (response) {
          alert(`Transaction validated. Subscription ID: ${response.razorpay_subscription_id}`);
          if (onSelectPlan) onSelectPlan('pro', cycle);
          navigate('/dashboard?checkout=success');
        },
        prefill: {
          email: userEmail || 'sahil.test@ghrcem.edu'
        },
        theme: {
          color: '#9333ea'
        }
      };

      const nativeWindowInstance = new window.Razorpay(checkoutOptions);
      nativeWindowInstance.on('payment.failed', function (failContext) {
        setErrorMessage(`Transaction halted: ${failContext.error.description}`);
      });
      nativeWindowInstance.open();

    } catch (err) {
      console.error("Subscription initialization failure:", err);
      setErrorMessage(err.response?.data?.detail || err.message || "Failed to start standard pricing checkout flow.");
    } finally {
      setLoadingTier(null);
    }
  };

  const handleSandboxSuccess = () => {
    setShowSandboxModal(false);
    sessionStorage.setItem("regiq_sandbox_role", "pro");
    if (onSelectPlan) {
      onSelectPlan('pro', activeSandboxCycle);
    }
    navigate('/dashboard?checkout=success');
  };

  const plans = [
    {
      name: 'Guest Access',
      price: 'Free',
      period: '',
      subtext: 'No authentication required',
      desc: 'Quick initial sandbox evaluation for solo startup operators.',
      features: [
        '3 queries / day allocation',
        'GST Corpus coverage only',
        '✗ No chat history persistence',
        '✗ No plain / legal toggle filters',
        'Single session local seat'
      ],
      tier: 'guest',
      actionText: 'Try Anonymous Sandbox',
      disabled: true
    },
    {
      name: 'Free Tier',
      price: '₹0',
      period: '',
      subtext: 'Requires identity verification',
      desc: 'Essential compliance monitoring baseline for growing local SMEs.',
      features: [
        '20 queries / day allocation',
        'All 4 core regulatory corpora',
        'Persistent chat history logs',
        'Plain / Legal language toggle matrix',
        'Single user seat access'
      ],
      tier: 'free',
      actionText: 'Current Baseline'
    },
    {
      name: 'Pro Tier',
      price: billingCycle === 'monthly' ? '₹499' : billingCycle === 'quarterly' ? '₹449' : '₹374',
      period: '/ month',
      subtext: billingCycle === 'monthly' ? 'Standard monthly entry lease' : billingCycle === 'quarterly' ? 'Billed quarterly (Save ₹150/yr)' : 'Billed annually (Save ₹1,500/yr)',
      desc: 'Complete automated operational intelligence shell for expanding teams.',
      features: [
        'Unlimited regulatory queries',
        'All 4 core regulatory corpora',
        'Interactive compliance risk scorecard',
        'Dynamic statutory compliance calendar',
        'Personal doc upload + RAG blending',
        'Server-side automated PDF exports',
        'Real-time automated change alerts'
      ],
      tier: 'pro',
      actionText: 'Upgrade to Pro',
      popular: true
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      subtext: 'Dedicated scale & on-premise vectors',
      desc: 'Custom SLA uptime guarantees, dedicated vector nodes, and white-label deployment.',
      features: [
        'Unlimited regulatory queries',
        'All standard corpora + custom ERP / DMS integration',
        'Unlimited user console seats',
        'Full custom compliance audit exports',
        'Dedicated isolated ChromaDB vector nodes',
        '24/7 dedicated legal engineer SLA support'
      ],
      tier: 'enterprise',
      actionText: 'Contact Enterprise Sales'
    }
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-12 text-slate-200 font-sans">
      
      {/* Sandbox Modal */}
      {showSandboxModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#12131A] border border-purple-500/50 rounded-2xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl space-y-4">
            <span className="inline-block px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold font-mono">
              DEVELOPMENT SANDBOX MODE
            </span>
            <h3 className="text-lg font-bold text-white">Simulated Payment Gateway</h3>
            
            <div className="text-left text-xs bg-[#16161F] p-3.5 rounded-xl border border-white/10 space-y-1.5 font-mono text-slate-400">
              <p>Sub ID: <span className="text-purple-400">{activeSubId}</span></p>
              <p>Account: <span className="text-slate-200">{userEmail || 'dev@regiq.in'}</span></p>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setShowSandboxModal(false)}
                className="flex-1 py-2.5 px-4 bg-[#181820] hover:bg-[#20202c] border border-white/10 text-slate-300 font-medium text-xs rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSandboxSuccess}
                className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_20px_rgba(168,85,247,0.45)]"
              >
                Simulate Success
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
        <span className="text-xs font-mono font-semibold text-purple-400 uppercase tracking-wider">
          Transparent Pricing
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Predictable plans for growing businesses.
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Scale your legal research and compliance monitoring with grounded, zero-hallucination accuracy.
        </p>

        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs shadow-lg">
            {errorMessage}
          </div>
        )}

        {/* Billing Cycle Switcher */}
        <div className="inline-flex items-center bg-[#181820] border border-white/10 p-1 rounded-xl gap-1 mt-4">
          {['monthly', 'quarterly', 'yearly'].map((cycle) => (
            <button
              key={cycle}
              onClick={() => setBillingCycle(cycle)}
              className={`px-4 py-2 rounded-lg text-xs font-medium capitalize transition-all flex items-center gap-1.5 ${
                billingCycle === cycle 
                  ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>{cycle}</span>
              {cycle === 'quarterly' && (
                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded font-semibold">
                  -10%
                </span>
              )}
              {cycle === 'yearly' && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-semibold">
                  -25%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tier Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-2xl p-6 flex flex-col justify-between relative transition-all ${
              plan.popular 
                ? 'bg-[#16161F] border-2 border-purple-500 shadow-[0_0_35px_rgba(168,85,247,0.2)]' 
                : 'bg-[#12131A]/90 border border-white/10 hover:border-white/20'
            }`}
          >
            {plan.popular && (
              <span className="absolute -top-3 right-6 bg-purple-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-[0_0_12px_rgba(168,85,247,0.4)]">
                Most Popular
              </span>
            )}

            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-white">{plan.name}</h3>
                <p className="text-xs text-slate-400 mt-1 min-h-[36px]">{plan.desc}</p>
              </div>

              <div className="py-2 border-y border-white/10">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight text-white">{plan.price}</span>
                  <span className="text-xs text-slate-500">{plan.period}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">{plan.subtext}</div>
              </div>

              {/* Features List */}
              <ul className="space-y-2.5 text-xs text-slate-300">
                {plan.features.map((feat) => {
                  const isCrossed = feat.startsWith('✗');
                  return (
                    <li key={feat} className={`flex items-start gap-2.5 ${isCrossed ? 'text-slate-600' : 'text-slate-300'}`}>
                      <span className={`font-bold ${isCrossed ? 'text-slate-600' : 'text-purple-400'}`}>
                        {isCrossed ? '—' : '✓'}
                      </span>
                      <span>{isCrossed ? feat.substring(2) : feat}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="pt-6 mt-4">
              <button
                onClick={() => !plan.disabled && plan.tier !== 'free' && executeCheckoutSequence(plan.tier, billingCycle)}
                disabled={plan.tier === 'free' || plan.disabled || (plan.tier === 'pro' && loadingTier !== null)}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-all ${
                  plan.popular 
                    ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.45)]' 
                    : plan.tier === 'free' 
                    ? 'bg-[#181820]/60 text-slate-500 cursor-default border border-white/10' 
                    : 'bg-[#181820] hover:bg-[#20202c] text-slate-200 hover:text-white border border-white/10'
                } disabled:opacity-40`}
              >
                {plan.tier === 'free' ? 'Current Baseline' : (plan.tier === 'pro' && loadingTier !== null) ? 'Connecting Gateway...' : plan.actionText}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}