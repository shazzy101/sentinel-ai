/**
 * Admin — password-gated admin panel.
 *
 * Gate: prompts for admin key → stores in sessionStorage as 'hadaleum_admin_key'.
 * All admin API calls send `X-Admin-Key: <stored key>` header.
 * On 401/403 the gate is shown again.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiFetch, getApiBase } from '../lib/apiClient';
import PendingSignalRow from '../components/admin/PendingSignalRow';
import ManualSignalForm from '../components/admin/ManualSignalForm';

// ─── Admin fetch helper ──────────────────────────────────────────────────────

const ADMIN_KEY_SESSION = 'hadaleum_admin_key';

function adminFetch(path, key, options = {}) {
  const base = getApiBase();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      'X-Admin-Key': key,
    },
  });
}

// ─── Gate ────────────────────────────────────────────────────────────────────

function AdminGate({ onUnlock, error }) {
  const [keyInput, setKeyInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (keyInput.trim()) onUnlock(keyInput.trim());
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-xl p-8 space-y-5">
        <h1 className="text-xl font-bold text-white text-center">Admin Access</h1>
        <p className="text-xs text-text-muted text-center">Enter your admin key to continue.</p>

        {error && (
          <p className="text-xs text-loss bg-loss/10 border border-loss/30 rounded px-3 py-2 text-center" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            data-testid="admin-key-input"
            placeholder="Admin key"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-text-muted focus:outline-none focus:border-signal/50"
            autoComplete="current-password"
          />
          <button
            type="submit"
            data-testid="admin-unlock-btn"
            className="w-full py-2 text-sm font-semibold rounded bg-signal/20 text-signal border border-signal/40 hover:bg-signal/30 transition-colors"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Skeletons ───────────────────────────────────────────────────────────────

function SkeletonRows({ count = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="border border-white/10 rounded-lg p-4 bg-white/5 animate-pulse h-24" />
      ))}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ children }) {
  return (
    <h2 className="text-base font-semibold text-white border-b border-white/10 pb-2 mb-4">
      {children}
    </h2>
  );
}

// ─── Main Admin page ─────────────────────────────────────────────────────────

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem(ADMIN_KEY_SESSION) || '');
  const [gateError, setGateError] = useState('');

  // Pending signals
  const [pending, setPending] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState('');

  // Posted signals (those with tweet_id)
  const [postedSignals, setPostedSignals] = useState([]);
  const [postedLoading, setPostedLoading] = useState(false);

  // Manual form
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Track record recompute
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineMsg, setPipelineMsg] = useState('');

  // ─── Auth helper ──────────────────────────────────────────────────────────

  const clearAuth = useCallback((msg = 'Unauthorized — enter your admin key.') => {
    sessionStorage.removeItem(ADMIN_KEY_SESSION);
    setAdminKey('');
    setGateError(msg);
  }, []);

  const handleAuthResponse = useCallback(
    (res) => {
      if (res.status === 401 || res.status === 403) {
        clearAuth('Invalid or expired admin key.');
        return false;
      }
      return true;
    },
    [clearAuth],
  );

  // ─── Unlock ───────────────────────────────────────────────────────────────

  const handleUnlock = (key) => {
    sessionStorage.setItem(ADMIN_KEY_SESSION, key);
    setAdminKey(key);
    setGateError('');
  };

  const handleLock = () => {
    clearAuth('');
    setGateError('');
  };

  // ─── Fetch pending signals ────────────────────────────────────────────────

  const fetchPending = useCallback(async () => {
    if (!adminKey) return;
    setPendingLoading(true);
    setPendingError('');
    try {
      const res = await adminFetch('/api/admin/signals/pending', adminKey);
      if (!handleAuthResponse(res)) return;
      if (!res.ok) {
        setPendingError(`Failed to load pending signals (${res.status}).`);
        return;
      }
      const body = await res.json();
      setPending(body.data?.signals ?? body.signals ?? (Array.isArray(body) ? body : []));
    } catch {
      setPendingError('Network error loading pending signals.');
    } finally {
      setPendingLoading(false);
    }
  }, [adminKey, handleAuthResponse]);

  // ─── Fetch posted signals ─────────────────────────────────────────────────

  const fetchPosted = useCallback(async () => {
    if (!adminKey) return;
    setPostedLoading(true);
    try {
      const body = await apiFetch('/api/signals');
      const all = body.data?.signals ?? body.signals ?? (Array.isArray(body) ? body : []);
      setPostedSignals(all.filter((s) => s.tweet_id));
    } catch {
      // Non-fatal; just show empty
      setPostedSignals([]);
    } finally {
      setPostedLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    if (adminKey) {
      fetchPending();
      fetchPosted();
    }
  }, [adminKey, fetchPending, fetchPosted]);

  // ─── Approve ─────────────────────────────────────────────────────────────

  const handleApprove = async (id) => {
    try {
      const res = await adminFetch(`/api/admin/signals/${id}/approve`, adminKey, { method: 'POST' });
      if (!handleAuthResponse(res)) return;
      if (!res.ok) {
        setPendingError(`Approve failed (${res.status}).`);
        return;
      }
      fetchPending();
      fetchPosted();
    } catch {
      setPendingError('Network error during approve.');
    }
  };

  // ─── Reject ──────────────────────────────────────────────────────────────

  const handleReject = async (id) => {
    try {
      const res = await adminFetch(`/api/admin/signals/${id}/reject`, adminKey, { method: 'POST' });
      if (!handleAuthResponse(res)) return;
      if (!res.ok) {
        setPendingError(`Reject failed (${res.status}).`);
        return;
      }
      fetchPending();
    } catch {
      setPendingError('Network error during reject.');
    }
  };

  // ─── Manual create ────────────────────────────────────────────────────────

  const handleManualSubmit = async (payload) => {
    setFormLoading(true);
    setFormError('');
    setFormSuccess('');
    try {
      const res = await adminFetch('/api/admin/signals', adminKey, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!handleAuthResponse(res)) return;
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setFormError(body?.detail || `Create failed (${res.status}).`);
        return;
      }
      setFormSuccess('Signal created successfully.');
      fetchPending();
    } catch {
      setFormError('Network error creating signal.');
    } finally {
      setFormLoading(false);
    }
  };

  // ─── Run trust pipeline ───────────────────────────────────────────────────

  const handleRunPipeline = async () => {
    setPipelineLoading(true);
    setPipelineMsg('');
    try {
      const res = await adminFetch('/api/admin/run-trust-pipeline', adminKey, { method: 'POST' });
      if (!handleAuthResponse(res)) return;
      if (!res.ok) {
        setPipelineMsg(`Pipeline failed (${res.status}).`);
        return;
      }
      const body = await res.json().catch(() => ({}));
      setPipelineMsg(
        body?.message || `Pipeline ran — ${body?.pending_preview?.length ?? 0} pending signals processed.`,
      );
    } catch {
      setPipelineMsg('Network error triggering pipeline.');
    } finally {
      setPipelineLoading(false);
    }
  };

  // ─── Gate check ──────────────────────────────────────────────────────────

  if (!adminKey) {
    return <AdminGate onUnlock={handleUnlock} error={gateError} />;
  }

  // ─── Admin content ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg p-4 sm:p-8 space-y-10" data-testid="admin-content">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
        <button
          data-testid="admin-lock-btn"
          onClick={handleLock}
          className="text-xs text-text-muted hover:text-loss transition-colors border border-white/10 rounded px-3 py-1.5"
        >
          Lock / Logout
        </button>
      </div>

      {/* Pending signals */}
      <section data-testid="pending-section">
        <SectionHeader>
          Pending Signals{' '}
          <span className="text-text-muted text-xs font-normal ml-1">
            (Approving posts to X automatically)
          </span>
        </SectionHeader>

        {pendingError && (
          <p className="text-xs text-loss mb-3" role="alert">{pendingError}</p>
        )}

        {pendingLoading ? (
          <SkeletonRows count={3} />
        ) : pending.length === 0 ? (
          <p className="text-sm text-text-muted py-6 text-center">No pending signals.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((s) => (
              <PendingSignalRow
                key={s.id}
                signal={s}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        )}
      </section>

      {/* Manual entry */}
      <section data-testid="manual-section">
        <SectionHeader>Create Signal Manually</SectionHeader>
        {formError && (
          <p className="text-xs text-loss mb-3" role="alert">{formError}</p>
        )}
        {formSuccess && (
          <p className="text-xs text-signal mb-3">{formSuccess}</p>
        )}
        <ManualSignalForm onSubmit={handleManualSubmit} loading={formLoading} />
      </section>

      {/* Posted signals */}
      <section data-testid="posted-section">
        <SectionHeader>Scheduled / Posted Signals</SectionHeader>
        {postedLoading ? (
          <SkeletonRows count={2} />
        ) : postedSignals.length === 0 ? (
          <p className="text-sm text-text-muted py-6 text-center">No signals posted to X yet.</p>
        ) : (
          <div className="space-y-2">
            {postedSignals.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between border border-white/10 rounded-lg px-4 py-3 bg-white/5"
              >
                <span className="text-sm font-mono text-white">{s.asset}</span>
                <a
                  href={`https://twitter.com/i/web/status/${s.tweet_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-signal underline underline-offset-2 hover:opacity-80"
                >
                  View tweet
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Track record management */}
      <section data-testid="pipeline-section">
        <SectionHeader>Track Record Management</SectionHeader>
        <p className="text-xs text-text-muted mb-3">
          Trigger a full trust-pipeline recompute: re-score all pending outcomes and rebuild
          win/loss stats.
        </p>
        <button
          data-testid="run-pipeline-btn"
          onClick={handleRunPipeline}
          disabled={pipelineLoading}
          className="px-5 py-2 text-sm font-semibold rounded bg-white/5 text-white border border-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {pipelineLoading ? 'Running…' : 'Run Trust Pipeline'}
        </button>
        {pipelineMsg && (
          <p className="text-xs text-text-muted mt-2">{pipelineMsg}</p>
        )}
      </section>
    </div>
  );
}
