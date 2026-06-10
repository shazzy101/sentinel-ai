import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

const FEATURES = [
  {
    title: 'API Access',
    desc: 'Programmatic access to all 2,796 wallet scores, signals, and AI analyses. JSON API with your own key.',
  },
  {
    title: 'Bulk Data Export',
    desc: 'Export full wallet datasets, signal history, and performance metrics as CSV or JSON.',
  },
  {
    title: 'Custom Watchlists',
    desc: 'Build and monitor proprietary wallet lists beyond our standard universe. Bespoke scoring.',
  },
  {
    title: 'Signal History',
    desc: '90 days of resolved signal outcomes with accuracy metrics. Full audit trail.',
  },
  {
    title: 'Dedicated Support',
    desc: 'Slack/email line direct to the founder. SLA-backed response times.',
  },
  {
    title: 'White-label Reports',
    desc: 'AI-generated weekly intelligence reports branded for your fund.',
  },
];

const TIERS = [
  {
    name: 'Startup',
    price: '$499',
    period: '/mo',
    features: [
      'API access',
      '100k API calls/mo',
      'Bulk data export',
      'Email support',
    ],
    highlight: false,
    cta: 'Get started',
  },
  {
    name: 'Growth',
    price: '$1,999',
    period: '/mo',
    features: [
      'Everything in Startup',
      'Custom watchlists',
      'Signal history',
      'Slack support',
      '1M API calls/mo',
    ],
    highlight: true,
    cta: 'Most popular',
  },
  {
    name: 'Enterprise',
    price: '$4,999',
    period: '/mo',
    features: [
      'Everything in Growth',
      'White-label reports',
      'Dedicated integration support',
      'Unlimited API calls',
      'SLA guarantee',
    ],
    highlight: false,
    cta: 'Contact us',
  },
];

export default function InstitutionalPage() {
  const [form, setForm] = useState({ name: '', company: '', email: '', usecase: '' });

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const body = encodeURIComponent(
      `Name: ${form.name}\nFund/Company: ${form.company}\nEmail: ${form.email}\n\nUse case:\n${form.usecase}`
    );
    window.location.href = `mailto:institutional@hadaleum.com?subject=Institutional%20Inquiry%20%E2%80%94%20${encodeURIComponent(form.company)}&body=${body}`;
  }

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <div className="max-w-5xl mx-auto px-6 py-16">

        {/* Back nav */}
        <div className="mb-10">
          <Link to="/" className="text-sm text-text-muted hover:text-text-secondary transition-colors">
            ← Hadaleum
          </Link>
        </div>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mb-20 max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-green/20 bg-green/10 px-3.5 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-green" />
            <span className="text-xs font-medium tracking-wide text-green">Institutional</span>
          </div>
          <h1 className="font-display font-bold text-4xl md:text-5xl leading-[1.07] tracking-tight text-text-primary mb-5">
            Enterprise Ethereum Intelligence
          </h1>
          <p className="text-lg text-text-secondary leading-relaxed max-w-2xl">
            For trading desks, funds, and researchers who need the full picture.
          </p>
        </motion.div>

        {/* Features grid */}
        <section className="mb-24">
          <div className="text-[11px] uppercase tracking-[2px] text-green mb-3">Capabilities</div>
          <h2 className="font-display text-2xl font-bold text-text-primary mb-8">Everything the platform can offer, unlocked.</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.38 }}
                className="rounded-2xl border border-border-default bg-bg-surface p-6"
              >
                <div className="text-green text-xs font-bold uppercase tracking-widest mb-2">{f.title}</div>
                <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="mb-24">
          <div className="text-[11px] uppercase tracking-[2px] text-green mb-3">Pricing</div>
          <h2 className="font-display text-2xl font-bold text-text-primary mb-8">One institutional customer beats many retail users.</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-2xl border p-6 flex flex-col ${
                  tier.highlight
                    ? 'border-green/30 ring-1 ring-green/10 bg-bg-surface shadow-[0_0_40px_rgba(0,200,100,0.07)]'
                    : 'border-border-default bg-bg-surface'
                }`}
              >
                {tier.highlight && (
                  <div className="text-[10px] font-bold uppercase tracking-widest text-green mb-3">Most popular</div>
                )}
                <div className="font-display text-xl font-bold text-text-primary mb-1">{tier.name}</div>
                <div className="mb-5">
                  <span className="text-3xl font-bold text-text-primary">{tier.price}</span>
                  <span className="text-text-muted text-sm">{tier.period}</span>
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm text-text-secondary">
                      <span className="text-green text-xs mt-0.5">✓</span>
                      {feat}
                    </li>
                  ))}
                </ul>
                <a
                  href={`mailto:institutional@hadaleum.com?subject=Institutional%20Inquiry%20%E2%80%94%20${encodeURIComponent(tier.name)}`}
                  className={`block text-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                    tier.highlight
                      ? 'bg-green text-text-inverse hover:bg-green-bright shadow-glow'
                      : 'border border-border-default text-text-secondary hover:bg-bg-elevated'
                  }`}
                >
                  {tier.highlight ? tier.cta : tier.cta}
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Contact form */}
        <section className="mb-16">
          <div className="text-[11px] uppercase tracking-[2px] text-green mb-3">Contact</div>
          <h2 className="font-display text-2xl font-bold text-text-primary mb-2">Get in touch</h2>
          <p className="text-sm text-text-muted mb-8">Tell us about your use case and we'll get back within 24 hours.</p>
          <form onSubmit={handleSubmit} className="max-w-2xl bg-bg-surface border border-border-default rounded-2xl p-8 flex flex-col gap-5">
            <div className="grid md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="inst-name" className="text-xs text-text-muted uppercase tracking-widest">Name</label>
                <input
                  id="inst-name"
                  name="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Jane Smith"
                  className="bg-bg-base border border-border-default rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-green/50 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="inst-company" className="text-xs text-text-muted uppercase tracking-widest">Fund / Company</label>
                <input
                  id="inst-company"
                  name="company"
                  type="text"
                  required
                  value={form.company}
                  onChange={handleChange}
                  placeholder="Acme Capital"
                  className="bg-bg-base border border-border-default rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-green/50 transition-colors"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="inst-email" className="text-xs text-text-muted uppercase tracking-widest">Email</label>
              <input
                id="inst-email"
                name="email"
                type="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="jane@acme.com"
                className="bg-bg-base border border-border-default rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-green/50 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="inst-usecase" className="text-xs text-text-muted uppercase tracking-widest">Use case</label>
              <textarea
                id="inst-usecase"
                name="usecase"
                required
                rows={4}
                value={form.usecase}
                onChange={handleChange}
                placeholder="Describe how you'd use Hadaleum data — API integration, research workflows, signal monitoring, etc."
                className="bg-bg-base border border-border-default rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-green/50 transition-colors resize-none"
              />
            </div>
            <button
              type="submit"
              className="self-start bg-green text-text-inverse font-semibold text-sm px-8 py-3 rounded-xl shadow-glow hover:bg-green-bright transition-colors"
            >
              Send inquiry →
            </button>
          </form>
        </section>

        {/* Footer trust line */}
        <div className="border-t border-border-default pt-8 text-center">
          <p className="text-sm text-text-muted">
            Currently serving traders and researchers. Institutional onboarding takes 24–48 hours.
          </p>
          <p className="text-xs text-text-muted mt-2">
            <Link to="/" className="hover:text-text-secondary transition-colors">← Back to Hadaleum</Link>
            {' · '}
            <a href="mailto:institutional@hadaleum.com" className="hover:text-text-secondary transition-colors">institutional@hadaleum.com</a>
          </p>
        </div>

      </div>
    </div>
  );
}
