import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock apiFetch (used for public /api/signals fetch) ──────────────────────

vi.mock('@/lib/apiClient', () => ({
  apiFetch: vi.fn().mockResolvedValue({ signals: [], count: 0 }),
  getApiBase: vi.fn(() => ''),
  apiUrl: vi.fn((p) => p),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import AdminPage from './Admin';
import { apiFetch, getApiBase } from '@/lib/apiClient';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ADMIN_KEY_SESSION = 'hadaleum_admin_key';

function renderAdmin() {
  return render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>,
  );
}

// Build a minimal Response-like object for global.fetch mocks
function mockResponse(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Admin page — gate', () => {
  beforeEach(() => {
    sessionStorage.removeItem(ADMIN_KEY_SESSION);
    vi.clearAllMocks();
  });

  afterEach(() => {
    sessionStorage.removeItem(ADMIN_KEY_SESSION);
    vi.clearAllMocks();
  });

  it('shows the password gate when no admin key is stored', () => {
    renderAdmin();
    expect(screen.getByTestId('admin-key-input')).toBeInTheDocument();
    expect(screen.getByTestId('admin-unlock-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-content')).toBeNull();
  });

  it('shows the gate with no admin content visible', () => {
    renderAdmin();
    expect(screen.queryByTestId('pending-section')).toBeNull();
    expect(screen.queryByTestId('manual-section')).toBeNull();
  });
});

describe('Admin page — unlock flow', () => {
  beforeEach(() => {
    sessionStorage.removeItem(ADMIN_KEY_SESSION);
    vi.clearAllMocks();
  });

  afterEach(() => {
    sessionStorage.removeItem(ADMIN_KEY_SESSION);
    vi.clearAllMocks();
  });

  it('reveals admin content after entering a key and clicking Unlock', async () => {
    // Mock global.fetch for admin API calls
    const fetchMock = vi.fn((url) => {
      if (url.includes('/api/admin/signals/pending')) {
        return mockResponse({ signals: [], count: 0 });
      }
      return mockResponse({ signals: [], count: 0 });
    });
    global.fetch = fetchMock;

    renderAdmin();

    fireEvent.change(screen.getByTestId('admin-key-input'), {
      target: { value: 'test-admin-key' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('admin-unlock-btn'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    });
  });

  it('stores the key in sessionStorage after unlock', async () => {
    const fetchMock = vi.fn(() => mockResponse({ signals: [], count: 0 }));
    global.fetch = fetchMock;

    renderAdmin();

    fireEvent.change(screen.getByTestId('admin-key-input'), {
      target: { value: 'my-secret-key' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('admin-unlock-btn'));
    });

    expect(sessionStorage.getItem(ADMIN_KEY_SESSION)).toBe('my-secret-key');
  });

  it('skips the gate if a key is already in sessionStorage', async () => {
    sessionStorage.setItem(ADMIN_KEY_SESSION, 'pre-stored-key');

    const fetchMock = vi.fn(() => mockResponse({ signals: [], count: 0 }));
    global.fetch = fetchMock;

    await act(async () => {
      renderAdmin();
    });

    await waitFor(() => {
      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('admin-key-input')).toBeNull();
  });
});

describe('Admin page — approve', () => {
  beforeEach(() => {
    sessionStorage.setItem(ADMIN_KEY_SESSION, 'test-key');
    vi.clearAllMocks();
  });

  afterEach(() => {
    sessionStorage.removeItem(ADMIN_KEY_SESSION);
    vi.clearAllMocks();
  });

  it('calls approve endpoint with X-Admin-Key header and refreshes list', async () => {
    const PENDING_SIGNAL = {
      id: 'sig-001',
      asset: 'ETH',
      direction: 'long',
      confidence: 4,
      entry_low: 3000,
      entry_high: 3400,
      target: 4200,
      stop_loss: 2800,
      explanation: 'Test explanation',
      pattern_type: 'Accumulation',
      created_at: '2026-06-17T10:00:00.000Z',
    };

    // Track all fetch calls so we can assert on them
    const calls = [];
    const fetchMock = vi.fn((url, opts) => {
      calls.push({ url, opts });
      if (url.includes('/api/admin/signals/pending')) {
        // First call returns one signal; subsequent calls return empty
        const isPendingFirst = calls.filter((c) => c.url.includes('/pending')).length === 1;
        return mockResponse({ signals: isPendingFirst ? [PENDING_SIGNAL] : [], count: isPendingFirst ? 1 : 0 });
      }
      if (url.includes('/approve')) {
        return mockResponse({ success: true });
      }
      return mockResponse({ signals: [], count: 0 });
    });
    global.fetch = fetchMock;

    await act(async () => {
      renderAdmin();
    });

    // Wait for pending signal to appear
    await waitFor(() => {
      expect(screen.getByTestId(`pending-row-${PENDING_SIGNAL.id}`)).toBeInTheDocument();
    });

    // Click approve
    await act(async () => {
      fireEvent.click(screen.getByTestId(`approve-btn-${PENDING_SIGNAL.id}`));
    });

    // Find the approve call
    const approveCall = calls.find((c) => c.url.includes('/approve'));
    expect(approveCall).toBeDefined();
    expect(approveCall.url).toContain(`/api/admin/signals/${PENDING_SIGNAL.id}/approve`);
    expect(approveCall.opts.headers['X-Admin-Key']).toBe('test-key');
  });
});

describe('Admin page — 401 re-gates', () => {
  beforeEach(() => {
    sessionStorage.setItem(ADMIN_KEY_SESSION, 'bad-key');
    vi.clearAllMocks();
  });

  afterEach(() => {
    sessionStorage.removeItem(ADMIN_KEY_SESSION);
    vi.clearAllMocks();
  });

  it('shows the gate again and clears sessionStorage when admin API returns 401', async () => {
    const fetchMock = vi.fn((url) => {
      if (url.includes('/api/admin/signals/pending')) {
        return mockResponse({ detail: 'Unauthorized' }, 401);
      }
      return mockResponse({ signals: [], count: 0 });
    });
    global.fetch = fetchMock;

    await act(async () => {
      renderAdmin();
    });

    await waitFor(() => {
      expect(screen.getByTestId('admin-key-input')).toBeInTheDocument();
    });

    expect(sessionStorage.getItem(ADMIN_KEY_SESSION)).toBeNull();
  });
});

describe('Admin page — lock button', () => {
  beforeEach(() => {
    sessionStorage.setItem(ADMIN_KEY_SESSION, 'test-key');
    vi.clearAllMocks();
  });

  afterEach(() => {
    sessionStorage.removeItem(ADMIN_KEY_SESSION);
    vi.clearAllMocks();
  });

  it('clicking Lock returns to the gate and clears sessionStorage', async () => {
    const fetchMock = vi.fn(() => mockResponse({ signals: [], count: 0 }));
    global.fetch = fetchMock;

    await act(async () => {
      renderAdmin();
    });

    await waitFor(() => {
      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('admin-lock-btn'));
    });

    expect(screen.getByTestId('admin-key-input')).toBeInTheDocument();
    expect(sessionStorage.getItem(ADMIN_KEY_SESSION)).toBeNull();
  });
});
