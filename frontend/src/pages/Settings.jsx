import PricingPage from '../components/PricingPage';

export default function Settings() {
  
  // Connect configuration selects right into your Razorpay sandbox triggers
  const handleCheckoutUpgrade = (tier, cycle) => {
    console.log(`[Subscription Sequence] Target Level: ${tier} | Interval Params: ${cycle}`);
    
    // Day 31 Hook: Alert notifies state mapping configuration prior to Week 8 live payments activation
    alert(
      `Initializing Razorpay Secure Intent for RegIQ ${tier.toUpperCase()} Plan!\n` +
      `Billing Configuration: [${cycle.toUpperCase()}]\n\n` +
      `FastAPI billing router (/api/billing/subscribe) webhooks will initialize script injection in Week 8.`
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#f8fafc', padding: '32px 24px', boxSizing: 'border-box' }}>
      
      {/* Configuration Section Header */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', marginBottom: '32px', borderBottom: '1px solid rgba(51, 65, 85, 0.4)', paddingBottom: '16px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#ffffff', letterSpacing: '-0.01em' }}>
          Workspace Configurations
        </h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>
          Manage your account profile parameters, operational limits, and subscription tiers.
        </p>
      </div>

      {/* Settings Panel Content Shell */}
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(51, 65, 85, 0.6)', borderRadius: '16px', padding: '16px', boxSizing: 'border-box' }}>
          <PricingPage onSelectPlan={handleCheckoutUpgrade} />
        </div>
      </div>
      
    </div>
  );
}