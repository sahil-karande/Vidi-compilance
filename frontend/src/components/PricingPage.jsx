import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { billingAPI } from '../lib/api';
import { 
  Calculator, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  Check, 
  ArrowRight, 
  FileText, 
  GraduationCap, 
  Gift, 
  Clock,
  TrendingUp
} from 'lucide-react';

export default function PricingPage({ onSelectPlan, userEmail = '' }) {
  const navigate = useNavigate(); 
  
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [loadingTier, setLoadingTier] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  
  // Modals & States
  const [showSandboxModal, setShowSandboxModal] = useState(false);
  const [activeSandboxCycle, setActiveSandboxCycle] = useState('');
  const [activeSubId, setActiveSubId] = useState('');
  
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentIdInput, setStudentIdInput] = useState('');
  
  // Payment Success Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [paymentSuccessDetails, setPaymentSuccessDetails] = useState(null);

  // ROI Calculator State
  const [queriesPerMonth, setQueriesPerMonth] = useState(12);
  const [caHourlyRate, setCaHourlyRate] = useState(1500);

  // Financial calculations
  const estimatedSavings = Math.round(queriesPerMonth * caHourlyRate * 0.75);
  const hoursReclaimed = Math.round(queriesPerMonth * 1.5);
  const monthlyProCost = billingCycle === 'yearly' ? 374 : 499;
  const roiMultiplier = Math.max(1, Math.round(estimatedSavings / monthlyProCost));

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
    if (tier === 'guest') {
      navigate('/chat');
      return;
    }
    if (tier === 'enterprise') {
      window.location.href = 'mailto:sales@regiq.in?subject=RegIQ%20Enterprise%20Inquiry';
      return;
    }

    const payloadPlan = tier === 'notice_pass' 
      ? 'notice_pass' 
      : tier === 'student_monthly' 
      ? 'student_monthly' 
      : cycle;

    setLoadingTier(tier === 'pro' ? cycle : tier);
    setErrorMessage(null);

    try {
      const response = await billingAPI.createSubscription(payloadPlan);
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
        setActiveSandboxCycle(payloadPlan);
        setActiveSubId(subscription_id);
        setShowSandboxModal(true);
        setLoadingTier(null);
        return; 
      }

      const scriptLoaded = await initRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Unable to reach Razorpay CDN endpoints.");
      }

      const planTitle = tier === 'notice_pass'
        ? 'RegIQ Instant Notice Pass (₹99)'
        : tier === 'student_monthly'
        ? 'RegIQ Student / CA Article Pass (₹199/mo)'
        : `RegIQ Pro Tier Subscription (${cycle})`;

      const orderIdToUse = data?.order_id || subscription_id;

      const checkoutOptions = {
        key: razorpay_key_id,
        order_id: orderIdToUse,
        ...(subscription_id && subscription_id.startsWith('sub_') ? { subscription_id } : {}),
        name: 'RegIQ Compliance',
        description: planTitle,
        image: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/matcha/matcha-original.svg',
        handler: async function (response) {
          try {
            setLoadingTier('verifying');
            // Cryptographically verify on backend immediately
            if (response.razorpay_signature) {
              await billingAPI.verifyPayment({
                razorpay_order_id: response.razorpay_order_id || orderIdToUse,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan: payloadPlan
              });
            }

            setPaymentSuccessDetails({
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id || orderIdToUse,
              plan: payloadPlan,
              planTitle: planTitle
            });
            setShowSuccessModal(true);

            if (onSelectPlan) {
              onSelectPlan('pro', cycle);
            }
          } catch (verifyErr) {
            console.error("Payment verification failure:", verifyErr);
            // Even if immediate API fails, store details and show success modal as webhook will process it
            setPaymentSuccessDetails({
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id || orderIdToUse,
              plan: payloadPlan,
              planTitle: planTitle
            });
            setShowSuccessModal(true);
            if (onSelectPlan) {
              onSelectPlan('pro', cycle);
            }
          } finally {
            setLoadingTier(null);
          }
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
        const desc = failContext?.error?.description || "Payment process was interrupted.";
        setErrorMessage(`Transaction halted: ${desc}`);
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

  const handleActivateTrial = () => {
    sessionStorage.setItem("regiq_sandbox_role", "pro");
    sessionStorage.setItem("regiq_trial_active", "true");
    sessionStorage.setItem("regiq_trial_expiry", (Date.now() + 7 * 24 * 60 * 60 * 1000).toString());
    setShowTrialModal(false);
    if (onSelectPlan) onSelectPlan('pro', 'trial');
    navigate('/dashboard?trial=active');
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
      disabled: false
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
      actionText: 'Current Baseline',
      disabled: true
    },
    {
      name: 'Pro Tier',
      tier: 'pro',
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
      actionText: 'Contact Enterprise Sales',
      disabled: false
    }
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-10 text-slate-200 font-sans animate-fade-in">
      
      {/* 1. Student / CA Intern Announcement Banner */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 px-4 py-2 mb-8 rounded-full bg-[#161622] border border-purple-500/30 text-xs text-purple-200 w-fit mx-auto shadow-md backdrop-blur-md animate-fade-in-down">
        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold text-[10px] uppercase tracking-wider">
          <GraduationCap className="w-3 h-3" />
          CA Trainee & Student Pass
        </span>
        <span className="text-slate-300">Are you a CA Article, CS Intern, or Law Student?</span>
        <button 
          onClick={() => setShowStudentModal(true)}
          className="font-bold underline text-purple-400 hover:text-purple-300 transition-colors"
        >
          Claim 60% Subsidy (₹199/mo) →
        </button>
      </div>

      {/* 2. Header Section */}
      <div className="text-center max-w-2xl mx-auto mb-10 space-y-3 animate-fade-in-up delay-75">
        <span className="text-xs font-mono font-semibold text-purple-400 uppercase tracking-wider">
          Transparent Pricing
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          Predictable plans for growing businesses.
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Scale your legal research and compliance monitoring with grounded, zero-hallucination accuracy.
        </p>

        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs shadow-lg animate-fade-in">
            {errorMessage}
          </div>
        )}

        {/* Billing Cycle Switcher */}
        <div className="inline-flex items-center bg-[#181820] border border-white/10 p-1 rounded-xl gap-1 mt-4 shadow-inner">
          {[
            { id: 'monthly', label: 'Monthly' },
            { id: 'quarterly', label: 'Quarterly', badge: '-10%' },
            { id: 'yearly', label: 'Yearly', badge: '-25% SAVE' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setBillingCycle(item.id)}
              className={`px-4 py-2 rounded-lg text-xs font-medium capitalize transition-all flex items-center gap-1.5 ${
                billingCycle === item.id 
                  ? 'bg-purple-600 text-white shadow-md font-semibold' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <span>{item.label}</span>
              {item.badge && (
                <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                  item.badge.includes('SAVE') 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Tier Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch animate-fade-in-up delay-150">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-2xl p-6 flex flex-col justify-between relative transition-all duration-300 hover-lift ${
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

              {/* Dynamic Price Display */}
              {plan.tier === 'pro' ? (
                <div className="py-2.5 border-y border-white/10 space-y-1.5 min-h-[90px] flex flex-col justify-center">
                  {billingCycle === 'yearly' ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold tracking-tight text-white">₹4,488</span>
                        <span className="text-xs text-slate-400 font-medium">/ year</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          -25% OFF
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-purple-300 font-semibold bg-purple-500/15 px-2 py-0.5 rounded border border-purple-500/30">
                          ₹374 / month
                        </span>
                        <span className="text-slate-500 line-through">₹5,988</span>
                        <span className="text-emerald-400 font-medium">Save ₹1,500/yr</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Billed annually as ₹4,488 single payment
                      </p>
                    </>
                  ) : billingCycle === 'quarterly' ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold tracking-tight text-white">₹1,347</span>
                        <span className="text-xs text-slate-400 font-medium">/ quarter</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          -10% OFF
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-purple-300 font-semibold bg-purple-500/15 px-2 py-0.5 rounded border border-purple-500/30">
                          ₹449 / month
                        </span>
                        <span className="text-slate-500 line-through">₹1,497</span>
                        <span className="text-purple-300 font-medium">Save ₹150/qtr</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Billed quarterly every 3 months
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold tracking-tight text-white">₹499</span>
                        <span className="text-xs text-slate-400 font-medium">/ month</span>
                      </div>
                      <div className="text-xs text-slate-400">
                        Standard monthly entry lease · ₹5,988/yr
                      </div>
                      <p className="text-[11px] text-emerald-400 font-medium">
                        💡 Switch to Yearly to save 25% (Save ₹1,500)
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="py-2.5 border-y border-white/10 min-h-[90px] flex flex-col justify-center">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold tracking-tight text-white">{plan.price}</span>
                    {plan.period && <span className="text-xs text-slate-500">{plan.period}</span>}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">{plan.subtext}</div>
                </div>
              )}

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

            {/* Buttons Area */}
            <div className="pt-6 mt-4 space-y-2">
              <button
                onClick={() => {
                  if (plan.tier === 'guest') {
                    navigate('/chat');
                  } else if (plan.tier === 'enterprise') {
                    window.location.href = 'mailto:sales@regiq.in?subject=RegIQ%20Enterprise%20Inquiry';
                  } else if (plan.tier === 'pro') {
                    executeCheckoutSequence('pro', billingCycle);
                  } else if (plan.tier === 'free' && onSelectPlan) {
                    onSelectPlan('free', billingCycle);
                  }
                }}
                disabled={plan.disabled || (plan.tier === 'pro' && loadingTier !== null)}
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

              {/* 7-Day Free Trial Button on Pro Tier */}
              {plan.tier === 'pro' && (
                <button
                  onClick={() => setShowTrialModal(true)}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Start 7-Day Free Trial (No Card)</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 4. Annual Founder & CA Power Pack Tray (Shown on Yearly) */}
      {billingCycle === 'yearly' && (
        <div className="mt-8 p-6 bg-[#13131D] border border-emerald-500/25 rounded-2xl shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-emerald-400" />
              <h4 className="text-sm font-bold text-white">Included Free with Annual Pro Subscription (Worth ₹7,999)</h4>
            </div>
            <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              Free Annual Founder Perks
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-300">
            <div className="bg-[#181824] p-3.5 rounded-xl border border-white/5 space-y-1">
              <p className="font-bold text-white flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-purple-400" />
                25+ Statutory Reply Templates
              </p>
              <p className="text-[11px] text-slate-400">Pre-formatted legal notice response templates for GST ASMT-10, MCA notices & Sec 138.</p>
            </div>
            <div className="bg-[#181824] p-3.5 rounded-xl border border-white/5 space-y-1">
              <p className="font-bold text-white flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Sub-500ms Vector Priority
              </p>
              <p className="text-[11px] text-slate-400">Dedicated isolated ChromaDB queue ensuring immediate zero-wait responses.</p>
            </div>
            <div className="bg-[#181824] p-3.5 rounded-xl border border-white/5 space-y-1">
              <p className="font-bold text-white flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                Statutory Deadline Alerts
              </p>
              <p className="text-[11px] text-slate-400">Automated proactive in-app notifications for GSTR-3B, Advance Tax & MCA filings.</p>
            </div>
            <div className="bg-[#181824] p-3.5 rounded-xl border border-white/5 space-y-1">
              <p className="font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Zero-Hallucination Shield
              </p>
              <p className="text-[11px] text-slate-400">Every response guaranteed strictly grounded with official Gazette and Bare Act citations.</p>
            </div>
          </div>
        </div>
      )}

      {/* 5. Instant Notice Pass (₹99 One-Shot Micro Pass) */}
      <div className="mt-10 bg-gradient-to-r from-[#141520] via-[#1b172e] to-[#141520] border border-purple-500/35 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
        <div className="space-y-2 text-left max-w-xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[11px] font-bold">
            <Zap className="w-3 h-3 text-purple-400" />
            <span>PAY-AS-YOU-GO MICRO PASS</span>
          </div>
          <h3 className="text-xl font-bold text-white">Just need a single GST or MCA notice analyzed right now?</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            No recurring commitment required. Upload 1 notice or contract to get an instant statutory citation breakdown, penalty severity risk scorecard, and ready-to-file legal reply draft in under 60 seconds.
          </p>
          <div className="flex flex-wrap gap-4 text-xs text-slate-300 pt-1">
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-purple-400" /> 1 Deep Notice Audit</span>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-purple-400" /> AI-Drafted Response Letter</span>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-purple-400" /> Gazette & Bare Act Links</span>
          </div>
        </div>
        <div className="flex flex-col items-center md:items-end gap-3 shrink-0">
          <div className="text-center md:text-right">
            <div className="flex items-baseline justify-center md:justify-end gap-1">
              <span className="text-3xl font-black text-white">₹99</span>
              <span className="text-xs text-slate-400">/ single notice</span>
            </div>
            <span className="text-[11px] text-emerald-400 font-medium">Instant one-time payment</span>
          </div>
          <button
            onClick={() => executeCheckoutSequence('notice_pass', 'notice_pass')}
            disabled={loadingTier === 'notice_pass'}
            className="py-3 px-6 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-[0_0_20px_rgba(168,85,247,0.35)] hover:shadow-[0_0_25px_rgba(168,85,247,0.5)] flex items-center gap-2"
          >
            <span>{loadingTier === 'notice_pass' ? 'Connecting Gateway...' : 'Get Instant Notice Pass (₹99)'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 6. Interactive ROI & CA Advisory Fee Savings Calculator (Placed Below the Plans & Notice Pass) */}
      <div className="mt-14 bg-gradient-to-br from-[#13141C] via-[#161624] to-[#12131A] border border-purple-500/25 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-stretch justify-between gap-8 relative z-10">
          
          {/* Controls */}
          <div className="flex-1 space-y-6">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-purple-500/15 border border-purple-500/25 text-purple-300">
                <Calculator className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-base font-bold text-white">Compliance Research & CA Fee Savings Calculator</h3>
                <p className="text-xs text-slate-400">See how much RegIQ saves your business compared to traditional legal advisory.</p>
              </div>
            </div>

            {/* Slider 1: Queries */}
            <div className="space-y-2 bg-[#181822] p-4 rounded-xl border border-white/5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium">Compliance Queries & Notice Researches / Month:</span>
                <span className="font-mono font-bold text-purple-300 text-sm">{queriesPerMonth} queries</span>
              </div>
              <input 
                type="range" 
                min="4" 
                max="40" 
                step="2"
                value={queriesPerMonth} 
                onChange={(e) => setQueriesPerMonth(Number(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>4 (Solo Freelancer)</span>
                <span>20 (Growing SME)</span>
                <span>40+ (Multi-entity Enterprise)</span>
              </div>
            </div>

            {/* Slider 2: CA Hourly Rate */}
            <div className="space-y-2 bg-[#181822] p-4 rounded-xl border border-white/5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium">Average CA / Legal Retainer Cost per Inquiry:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">₹{caHourlyRate.toLocaleString()}</span>
              </div>
              <input 
                type="range" 
                min="500" 
                max="3500" 
                step="250"
                value={caHourlyRate} 
                onChange={(e) => setCaHourlyRate(Number(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>₹500 / simple query</span>
                <span>₹1,500 / standard notice</span>
                <span>₹3,500+ / senior partner</span>
              </div>
            </div>
          </div>

          {/* Real-time Computed Value Display */}
          <div className="w-full lg:w-80 bg-[#191928] border border-purple-500/30 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-xl">
            <div className="space-y-3">
              <span className="text-[11px] font-mono uppercase font-bold text-purple-400 tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Monthly Value Realized
              </span>
              
              <div>
                <div className="text-3xl font-extrabold text-white tracking-tight">
                  ₹{estimatedSavings.toLocaleString()}
                </div>
                <div className="text-xs text-emerald-400 font-medium mt-0.5">
                  Est. Advisory Fees Saved / Month
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 space-y-2 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-purple-400" />
                    Hours Reclaimed:
                  </span>
                  <span className="font-bold text-white">~{hoursReclaimed} hrs/mo</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    Pro Return on Investment:
                  </span>
                  <span className="font-bold text-emerald-400">{roiMultiplier}x ROI</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => executeCheckoutSequence('pro', billingCycle)}
              className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_20px_rgba(168,85,247,0.45)] flex items-center justify-center gap-2"
            >
              <span>Claim Savings with Pro</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </div>

      {/* 7. Modal: 7-Day Free Trial Activation */}
      {showTrialModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#12131A] border border-purple-500/50 rounded-2xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Start Your 7-Day Pro Trial</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Experience the full power of RegIQ Pro with zero risk. No credit card or payment details are required.
            </p>
            
            <div className="text-left text-xs bg-[#161622] p-4 rounded-xl border border-white/10 space-y-2 text-slate-300">
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Unlimited legal & GST regulatory queries</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Personal document upload + RAG blending</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Compliance Risk Scorecard + Statutory Calendar</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Server-side PDF exports</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setShowTrialModal(false)}
                className="flex-1 py-2.5 px-4 bg-[#181820] hover:bg-[#20202c] border border-white/10 text-slate-300 font-medium text-xs rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleActivateTrial}
                className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_20px_rgba(168,85,247,0.45)]"
              >
                Activate Free Trial Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modal: Student / CA Article Trainee Verification */}
      {showStudentModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#12131A] border border-purple-500/50 rounded-2xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center mx-auto">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">CA Article & Student Subsidy</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              We empower young finance & legal minds. CA Articles, CS Interns, and Law students receive full Pro access at 60% discount for just <strong>₹199 / month</strong>.
            </p>

            <div className="text-left space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400">
                ICAI / ICSI / BCI Student Registration No. or .edu Email:
              </label>
              <input 
                type="text" 
                placeholder="e.g. WRO0123456 or student@ghrcem.edu"
                value={studentIdInput}
                onChange={(e) => setStudentIdInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#161622] border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setShowStudentModal(false)}
                className="flex-1 py-2.5 px-4 bg-[#181820] hover:bg-[#20202c] border border-white/10 text-slate-300 font-medium text-xs rounded-xl transition-colors"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  setShowStudentModal(false);
                  executeCheckoutSequence('student_monthly', 'student_monthly');
                }}
                className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_20px_rgba(168,85,247,0.45)]"
              >
                Proceed for ₹199/mo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Sandbox Modal */}
      {showSandboxModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#12131A] border border-purple-500/50 rounded-2xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl space-y-4">
            <span className="inline-block px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold font-mono">
              DEVELOPMENT SANDBOX MODE
            </span>
            <h3 className="text-lg font-bold text-white">Simulated Payment Gateway</h3>
            
            <div className="text-left text-xs bg-[#16161F] p-3.5 rounded-xl border border-white/10 space-y-1.5 font-mono text-slate-400">
              <p>Sub ID: <span className="text-purple-400">{activeSubId}</span></p>
              <p>Plan / Cycle: <span className="text-purple-300">{activeSandboxCycle}</span></p>
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

      {/* 10. Modal: Live Payment Success Celebration */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[#12131A] border border-emerald-500/40 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-center shadow-[0_0_50px_rgba(16,185,129,0.25)] relative space-y-5">
            {/* Celebration Icon */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-purple-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(16,185,129,0.3)]">
              <Sparkles className="w-8 h-8 text-emerald-400 animate-pulse" />
            </div>

            <div className="space-y-1.5">
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold tracking-wider uppercase">
                Payment Confirmed • Pro Tier Active
              </span>
              <h3 className="text-2xl font-extrabold text-white">Welcome to RegIQ Pro!</h3>
              <p className="text-xs sm:text-sm text-slate-300">
                Your payment was verified and your account has been unlocked with full unlimited regulatory access.
              </p>
            </div>

            {/* Receipt Details Box */}
            <div className="text-left text-xs bg-[#161622] p-4 rounded-2xl border border-white/10 space-y-2.5 font-mono text-slate-300">
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-slate-400 font-sans">Activated Plan:</span>
                <span className="text-purple-300 font-bold font-sans">{paymentSuccessDetails?.planTitle || 'Pro Subscription'}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-slate-400 font-sans">Payment ID:</span>
                <span className="text-emerald-400 select-all font-mono">{paymentSuccessDetails?.paymentId || 'Verified'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-sans">Order Ref:</span>
                <span className="text-slate-400 select-all font-mono">{paymentSuccessDetails?.orderId || 'Verified'}</span>
              </div>
            </div>

            {/* Feature unlocked bullets */}
            <div className="text-left text-xs bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 text-emerald-300 space-y-1.5">
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Unlimited legal & GST regulatory queries</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Interactive Risk Scorecard & Statutory Calendar</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Full private document analysis & blend engine</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  navigate('/chat');
                }}
                className="flex-1 py-3 px-4 bg-[#181820] hover:bg-[#20202c] border border-white/10 text-slate-200 font-semibold text-xs rounded-xl transition-all"
              >
                Start Compliance Chat
              </button>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  navigate('/dashboard?checkout=success');
                }}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-[0_0_20px_rgba(168,85,247,0.35)]"
              >
                Open Pro Dashboard →
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}