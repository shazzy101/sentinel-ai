import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'

export default function PrivacyPage() {
  useEffect(() => { document.title = 'Privacy Policy — Hadaleum' }, [])
  return (
    <div className="min-h-screen bg-bg-base py-16 px-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
        <Link to="/" className="text-sm text-text-muted hover:text-green mb-8 inline-block">← Hadaleum</Link>
        <h1 className="font-display text-3xl font-bold text-text-primary mb-2">Privacy Policy</h1>
        <p className="text-text-muted text-sm mb-10">Last updated: June 2026</p>
        <div className="prose prose-invert max-w-none space-y-6 text-sm text-text-secondary leading-relaxed">
          <section>
            <h2 className="font-display text-lg font-bold text-text-primary mb-2">1. What we collect</h2>
            <p>When you create an account, we collect your email address. We do not collect your name, phone number, or any payment details (payment is handled by Stripe).</p>
            <p className="mt-2">When you use the app, we may collect anonymous usage data (page views, feature clicks) to improve the product. We do not sell this data.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-text-primary mb-2">2. How we use your data</h2>
            <ul className="list-disc ml-5 space-y-1">
              <li>To authenticate your account (via Supabase Auth)</li>
              <li>To manage your subscription (via Stripe)</li>
              <li>To send product and alert emails you explicitly opt into</li>
              <li>To improve product features via aggregate analytics</li>
            </ul>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-text-primary mb-2">3. Wallet data</h2>
            <p>Hadaleum is non-custodial. We do not store, access, or transmit your private keys or seed phrases. Your MetaMask wallet address is only read locally in your browser to facilitate copy trades.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-text-primary mb-2">4. Third parties</h2>
            <p>We use the following third-party services:</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li><strong>Supabase</strong> — authentication and database (GDPR compliant)</li>
              <li><strong>Stripe</strong> — payment processing (PCI DSS compliant)</li>
              <li><strong>Anthropic</strong> — AI signal generation (no personal data sent)</li>
              <li><strong>Cloudflare</strong> — hosting and CDN</li>
            </ul>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-text-primary mb-2">5. Data retention</h2>
            <p>Account data is retained as long as your account is active. You may request deletion by emailing us. We will process deletion requests within 30 days.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-text-primary mb-2">6. Contact</h2>
            <p>Questions? Email: privacy@hadaleum.com</p>
          </section>
        </div>
        <div className="mt-10 flex gap-4 text-sm text-text-muted">
          <Link to="/terms" className="hover:text-text-secondary">Terms of Service</Link>
          <Link to="/disclaimer" className="hover:text-text-secondary">Disclaimer</Link>
        </div>
      </motion.div>
    </div>
  )
}
