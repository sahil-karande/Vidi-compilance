import { useState } from 'react';

export default function PricingPage({ onSelectPlan }) {
  // Toggle states: 'monthly' | 'quarterly' | 'yearly'
  const [billingCycle, setBillingCycle] = useState('monthly');

  // Exact tier calculations and limits from your master matrix
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
      // Live calculation indicators showing exact savings matching your master plan parameters
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
      actionText: 'Upgrade via Razorpay 💳',
      popular: true
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      subtext: 'Dedicated scale parameters',
      desc: 'Customized baseline isolation parameters and SLA uptime contracts.',
      features: [
        'Unlimited runtime access parameters',
        'All standard corpora + custom data integration',
        'Up to 20 user console seats',
        'Full custom white-label system branding',
        'Dedicated secure vector nodes',
        'Priority SLA backend line support'
      ],
      tier: 'enterprise',
      actionText: 'Contact Sales Engineers'
    }
  ];

  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '24px 16px', boxSizing: 'border-box' }}>
      
      {/* Upper Selector Toggle Layout */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '32px', fontWeight: '800', margin: '0 0 12px 0', color: '#ffffff', letterSpacing: '-0.02em' }}>
          Predictable Workspace Tiers
        </h2>
        <p style={{ fontSize: '15px', color: '#94a3b8', margin: '0 0 28px 0' }}>
          Select a tier that matches your ongoing corporate compliance parameters.
        </p>

        {/* Pricing Segment Controls + Dynamic Savings Pills */}
        <div style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(30, 41, 59, 0.4)', padding: '6px', borderRadius: '12px', border: '1px solid rgba(51, 65, 85, 0.6)', gap: '4px' }}>
          {['monthly', 'quarterly', 'yearly'].map((cycle) => (
            <button
              key={cycle}
              onClick={() => setBillingCycle(cycle)}
              style={{
                background: billingCycle === cycle ? '#4f46e5' : 'transparent',
                color: billingCycle === cycle ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '600',
                textTransform: 'capitalize',
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {cycle}
              {cycle === 'quarterly' && (
                <span style={{ fontSize: '10px', background: billingCycle === cycle ? '#818cf8' : 'rgba(99, 102, 241, 0.15)', color: billingCycle === cycle ? '#ffffff' : '#818cf8', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                  Save 10%
                </span>
              )}
              {cycle === 'yearly' && (
                <span style={{ fontSize: '10px', background: billingCycle === cycle ? '#10b981' : 'rgba(16, 185, 129, 0.15)', color: billingCycle === cycle ? '#ffffff' : '#10b981', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                  Save 25%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Responsive Grid Canvas Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', alignItems: 'stretch' }}>
        {plans.map((plan) => (
          <div
            key={plan.name}
            style={{
              background: 'rgba(15, 23, 42, 0.4)',
              border: plan.popular ? '2px solid #6366f1' : '1px solid rgba(51, 65, 85, 0.6)',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              boxSizing: 'border-box',
              backdropFilter: 'blur(12px)'
            }}
          >
            {plan.popular && (
              <span style={{ position: 'absolute', top: '-12px', right: '20px', background: '#4f46e5', color: '#ffffff', fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                RECOMMENDED
              </span>
            )}

            {/* Typography Plan Headers */}
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '700', color: '#ffffff' }}>{plan.name}</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '12px', color: '#64748b', lineHeight: '1.4', minHeight: '34px', textAlign: 'left' }}>{plan.desc}</p>
            
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '2px' }}>
              <span style={{ fontSize: '32px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.01em' }}>{plan.price}</span>
              <span style={{ fontSize: '13px', color: '#64748b' }}>{plan.period}</span>
            </div>
            
            <div style={{ fontSize: '12px', color: plan.popular ? '#818cf8' : '#475569', fontWeight: '500', marginBottom: '20px', textAlign: 'left' }}>
              {plan.subtext}
            </div>

            {/* Features Feature List Node Iterator */}
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {plan.features.map((feat) => {
                const isCrossed = feat.startsWith('✗');
                return (
                  <li key={feat} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: isCrossed ? '#475569' : '#94a3b8', textAlign: 'left', lineHeight: '1.4' }}>
                    <span style={{ color: isCrossed ? '#ef4444' : '#6366f1', fontWeight: 'bold' }}>
                      {isCrossed ? '•' : '✓'}
                    </span>
                    {isCrossed ? feat.substring(2) : feat}
                  </li>
                );
              })}
            </ul>

            {/* Strategic Upgrade Action Trigger Link */}
            <button
              onClick={() => !plan.disabled && plan.tier !== 'free' && onSelectPlan(plan.tier, billingCycle)}
              disabled={plan.tier === 'free' || plan.disabled}
              style={{
                width: '100%',
                background: plan.popular ? 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)' : 'rgba(30, 41, 59, 0.3)',
                color: plan.tier === 'free' ? '#475569' : '#ffffff',
                border: plan.popular || plan.tier === 'free' ? 'none' : '1px solid #334155',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: (plan.tier === 'free' || plan.disabled) ? 'default' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: plan.popular ? '0 4px 14px rgba(79, 70, 229, 0.2)' : 'none',
                opacity: plan.disabled ? 0.3 : 1
              }}
              onMouseEnter={(e) => {
                if (plan.tier !== 'free' && !plan.popular && !plan.disabled) {
                  e.currentTarget.style.borderColor = '#6366f1';
                  e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (plan.tier !== 'free' && !plan.popular && !plan.disabled) {
                  e.currentTarget.style.borderColor = '#334155';
                  e.currentTarget.style.background = 'rgba(30, 41, 59, 0.3)';
                }
              }}
            >
              {plan.tier === 'free' ? 'Active Framework' : plan.actionText}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}