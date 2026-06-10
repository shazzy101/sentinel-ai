import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'

export default function DisclaimerPage() {
  useEffect(() => { document.title = 'Disclaimer — Hadaleum' }, [])
  return (
    <div className="min-h-screen bg-bg-base py-16 px-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
        <Link to="/" className="text-sm text-text-muted hover:text-green mb-8 inline-block">← Hadaleum</Link>
        <h1 className="font-display text-3xl font-bold text-text-primary mb-2">Disclaimer</h1>
        <div className="mt-6 rounded-2xl border border-amber/20 bg-amber/5 p-6 space-y-4 text-sm text-text-secondary leading-relaxed">
          <p className="font-semibold text-text-primary text-base">Hadaleum is not a financial advisor.</p>
          <p>All signals, scores, rankings, and analysis on Hadaleum are provided for informational purposes only. They do not constitute financial, investment, or trading advice.</p>
          <p>Copy trading involves risk of loss. Past signal accuracy does not guarantee future results. On-chain transactions are irreversible. Smart contract interactions may fail or result in unexpected outcomes.</p>
          <p>Hadaleum is a data and analytics tool. You are solely responsible for all investment decisions you make using information from this platform.</p>
          <p>Hadaleum is not a registered investment advisor, broker-dealer, or financial institution. We do not provide personalized investment recommendations.</p>
          <p className="text-text-muted text-xs mt-4">By using Hadaleum, you acknowledge and accept these risks.</p>
        </div>
        <div className="mt-8 flex gap-4 text-sm text-text-muted">
          <Link to="/privacy" className="hover:text-text-secondary">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-text-secondary">Terms of Service</Link>
        </div>
      </motion.div>
    </div>
  )
}
