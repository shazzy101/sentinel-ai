/** Layered ambient background — aurora orbs for landing, subtle for app */
export default function AppBackground({ variant = 'app' }) {
  const isLanding = variant === 'landing';

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-bg-base" />

      {isLanding ? (
        <>
          {/* Aurora orb A — green, top-center */}
          <div
            className="aurora-a absolute rounded-full blur-[140px]"
            style={{
              width: '800px', height: '600px',
              top: '-15%', left: '20%',
              background: 'radial-gradient(ellipse, rgba(0,217,146,0.22) 0%, transparent 70%)',
            }}
          />
          {/* Aurora orb B — indigo, bottom-right */}
          <div
            className="aurora-b absolute rounded-full blur-[160px]"
            style={{
              width: '700px', height: '500px',
              bottom: '5%', right: '-10%',
              background: 'radial-gradient(ellipse, rgba(99,102,241,0.14) 0%, transparent 70%)',
            }}
          />
          {/* Aurora orb C — teal, left-mid */}
          <div
            className="aurora-c absolute rounded-full blur-[180px]"
            style={{
              width: '500px', height: '400px',
              top: '40%', left: '-8%',
              background: 'radial-gradient(ellipse, rgba(0,185,220,0.10) 0%, transparent 70%)',
            }}
          />
          {/* Subtle vignette at top */}
          <div
            className="absolute inset-x-0 top-0 h-[40vh]"
            style={{ background: 'radial-gradient(ellipse 100% 80% at 50% 0%, rgba(0,217,146,0.05) 0%, transparent 70%)' }}
          />
        </>
      ) : (
        <>
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{ background: 'radial-gradient(ellipse 70% 50% at 0% 0%, rgba(0,217,146,0.06) 0%, transparent 50%)' }}
          />
          <div
            className="absolute inset-0 opacity-30"
            style={{ background: 'radial-gradient(ellipse 50% 40% at 100% 100%, rgba(99,102,241,0.08) 0%, transparent 55%)' }}
          />
          <div
            className="absolute inset-0 opacity-[0.4]"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
              backgroundSize: '64px 64px',
              maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 20%, transparent 70%)',
            }}
          />
        </>
      )}

      <div className="noise-overlay absolute inset-0 opacity-[0.022]" />
    </div>
  );
}
