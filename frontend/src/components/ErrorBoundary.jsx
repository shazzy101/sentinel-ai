import { Component } from 'react';
import * as Sentry from '@sentry/react';

/**
 * Catches render/runtime errors in its subtree and shows a recoverable fallback
 * instead of a blank white screen. Wrap the whole app and each lazy route.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Report to Sentry (no-op if not configured) and the console for local dev.
    try {
      Sentry.captureException(error, { extra: { componentStack: info?.componentStack } });
    } catch { /* ignore */ }
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback({ error: this.state.error, reset: this.handleReset });
    }

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="font-display text-[20px] font-bold text-text-primary mb-2">
          Something went wrong
        </div>
        <p className="text-[13px] text-text-muted max-w-sm mb-5">
          This section hit an unexpected error. Your data is safe — try reloading it.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-xl bg-green px-5 py-2.5 text-[13px] font-semibold text-text-inverse hover:bg-green-bright transition-colors"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl border border-border-default px-5 py-2.5 text-[13px] text-text-secondary hover:bg-bg-elevated transition-colors"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
