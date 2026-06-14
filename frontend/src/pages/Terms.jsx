import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'

export default function TermsPage() {
  useEffect(() => { document.title = 'Terms of Service — Hadaleum' }, [])
  return (
    <div className="min-h-screen bg-bg-base py-16 px-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
        <Link to="/" className="text-sm text-text-muted hover:text-green mb-8 inline-block">← Hadaleum</Link>
        <h1 className="font-display text-3xl font-bold text-text-primary mb-2">Terms of Service</h1>
        <p className="text-text-muted text-sm mb-10">Last updated: June 2026</p>
        <div className="space-y-6 text-sm text-text-secondary leading-relaxed">
          <section>
            <h2 className="font-display text-lg font-bold text-text-primary mb-2">1. Acceptance</h2>
            <p>By using Hadaleum, you agree to these terms. If you do not agree, do not use the service.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-text-primary mb-2">2. Not financial advice</h2>
            <p>Hadaleum provides informational tools only. Nothing on Hadaleum constitutes financial, investment, or trading advice. All signals, scores, and rankings are informational. You are solely responsible for any investment decisions you make.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-text-primary mb-2">3. Subscription</h2>
            <p>Pro subscriptions are billed monthly or annually via Stripe. You may cancel at any time; access continues until the end of the billing period. Refunds are not provided for partial periods unless required by applicable law.</p>
            <p className="mt-2">Free trial periods are 3 days. At the end of the trial, you will be charged unless you cancel.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-text-primary mb-2">4. Non-custodial trading</h2>
            <p>Copy trading on Hadaleum is executed directly via your MetaMask wallet. Hadaleum never holds, controls, or accesses your private keys or funds. You bear full responsibility for all transactions you execute.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-text-primary mb-2">5. Risk acknowledgment</h2>
            <p>Cryptocurrency trading involves significant risk of loss. Smart contract interactions may fail, incur unexpected gas costs, or result in slippage. Past signal accuracy does not guarantee future results. Do not trade with funds you cannot afford to lose.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-text-primary mb-2">6. Intellectual property</h2>
            <p>All content, scoring algorithms, and AI-generated signals are the intellectual property of Hadaleum. You may not reproduce or redistribute them without permission.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-text-primary mb-2">7. Limitation of liability</h2>
            <p>Hadaleum is provided "as is". We are not liable for any financial losses, trading losses, or damages arising from use of the platform.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-text-primary mb-2">8. Contact</h2>
            <p>Questions? Email: legal@hadaleum.com</p>
          </section>
        </div>
        <div className="mt-10 flex gap-4 text-sm text-text-muted">
          <Link to="/privacy" className="hover:text-text-secondary">Privacy Policy</Link>
          <Link to="/disclaimer" className="hover:text-text-secondary">Disclaimer</Link>
        </div>
      </motion.div>
    </div>
  )
}
