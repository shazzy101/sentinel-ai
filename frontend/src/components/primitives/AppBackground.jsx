/** Layered ambient background — depth without distraction */
export default function AppBackground({ variant = 'app' }) {
  const isLanding = variant === 'landing';

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-bg-base" />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          background: isLanding
            ? 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,217,146,0.12) 0%, transparent 55%)'
            : 'radial-gradient(ellipse 70% 50% at 0% 0%, rgba(0,217,146,0.06) 0%, transparent 50%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: 'radial-gradient(ellipse 50% 40% at 100% 100%, rgba(99,102,241,0.08) 0%, transparent 55%)',
        }}
      />
      <div className="noise-overlay absolute inset-0 opacity-[0.025]" />
      {!isLanding && (
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 20%, transparent 70%)',
          }}
        />
      )}
    </div>
  );
}
