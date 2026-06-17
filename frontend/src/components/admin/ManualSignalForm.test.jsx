import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import ManualSignalForm, { buildSignalPayload } from './ManualSignalForm';

// ─── buildSignalPayload ───────────────────────────────────────────────────────

describe('buildSignalPayload', () => {
  it('splits comma-separated whale_wallets into an array', () => {
    const payload = buildSignalPayload({
      asset: 'ETH',
      direction: 'long',
      confidence: '4',
      whale_wallets: '0xAAA, 0xBBB, 0xCCC',
      tx_hashes: '',
    });
    expect(payload.whale_wallets).toEqual(['0xAAA', '0xBBB', '0xCCC']);
  });

  it('splits comma-separated tx_hashes into an array', () => {
    const payload = buildSignalPayload({
      asset: 'ETH',
      direction: 'long',
      confidence: '3',
      whale_wallets: '',
      tx_hashes: '0xhash1, 0xhash2',
    });
    expect(payload.tx_hashes).toEqual(['0xhash1', '0xhash2']);
  });

  it('returns empty arrays when whale_wallets and tx_hashes are empty strings', () => {
    const payload = buildSignalPayload({
      asset: 'BTC',
      direction: 'short',
      confidence: '2',
      whale_wallets: '',
      tx_hashes: '',
    });
    expect(payload.whale_wallets).toEqual([]);
    expect(payload.tx_hashes).toEqual([]);
  });

  it('coerces numeric string fields to numbers', () => {
    const payload = buildSignalPayload({
      asset: 'ETH',
      direction: 'long',
      confidence: '5',
      entry_low: '3000',
      entry_high: '3400',
      target: '4200',
      stop_loss: '2800',
      whale_wallets: '',
      tx_hashes: '',
    });
    expect(payload.confidence).toBe(5);
    expect(payload.entry_low).toBe(3000);
    expect(payload.entry_high).toBe(3400);
    expect(payload.target).toBe(4200);
    expect(payload.stop_loss).toBe(2800);
  });

  it('returns null for empty numeric fields', () => {
    const payload = buildSignalPayload({
      asset: 'SOL',
      direction: 'long',
      confidence: '',
      entry_low: '',
      entry_high: '',
      target: '',
      stop_loss: '',
      whale_wallets: '',
      tx_hashes: '',
    });
    expect(payload.confidence).toBeNull();
    expect(payload.entry_low).toBeNull();
    expect(payload.target).toBeNull();
  });

  it('uppercases and trims the asset', () => {
    const payload = buildSignalPayload({
      asset: '  eth  ',
      direction: 'long',
      confidence: '3',
      whale_wallets: '',
      tx_hashes: '',
    });
    expect(payload.asset).toBe('ETH');
  });

  it('trims whitespace from individual wallet addresses', () => {
    const payload = buildSignalPayload({
      asset: 'ETH',
      direction: 'long',
      confidence: '4',
      whale_wallets: '  0xAAA  ,  0xBBB  ',
      tx_hashes: '',
    });
    expect(payload.whale_wallets).toEqual(['0xAAA', '0xBBB']);
  });

  it('filters out blank entries from comma-separated lists', () => {
    const payload = buildSignalPayload({
      asset: 'ETH',
      direction: 'long',
      confidence: '4',
      whale_wallets: '0xAAA,,0xBBB, ',
      tx_hashes: '',
    });
    expect(payload.whale_wallets).toEqual(['0xAAA', '0xBBB']);
  });
});

// ─── ManualSignalForm component ───────────────────────────────────────────────

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/asset/i), { target: { value: 'ETH' } });
  fireEvent.change(screen.getByLabelText(/direction/i), { target: { value: 'long' } });
  fireEvent.change(screen.getByLabelText(/confidence/i), { target: { value: '4' } });
}

describe('ManualSignalForm — validation', () => {
  let onSubmit;

  beforeEach(() => {
    onSubmit = vi.fn();
    render(<ManualSignalForm onSubmit={onSubmit} />);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error and does NOT call onSubmit when asset is missing', () => {
    // Leave asset blank, fill the rest
    fireEvent.change(screen.getByLabelText(/direction/i), { target: { value: 'long' } });
    fireEvent.change(screen.getByLabelText(/confidence/i), { target: { value: '3' } });
    fireEvent.click(screen.getByTestId('msf-submit'));

    expect(screen.getByText(/asset is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows an error and does NOT call onSubmit when direction is missing', () => {
    fireEvent.change(screen.getByLabelText(/asset/i), { target: { value: 'BTC' } });
    fireEvent.change(screen.getByLabelText(/confidence/i), { target: { value: '3' } });
    // Leave direction blank
    fireEvent.click(screen.getByTestId('msf-submit'));

    expect(screen.getByText(/direction must be long or short/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows an error and does NOT call onSubmit when confidence is missing', () => {
    fireEvent.change(screen.getByLabelText(/asset/i), { target: { value: 'SOL' } });
    fireEvent.change(screen.getByLabelText(/direction/i), { target: { value: 'short' } });
    // Leave confidence blank
    fireEvent.click(screen.getByTestId('msf-submit'));

    expect(screen.getByText(/confidence must be 1.5/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('ManualSignalForm — valid submit', () => {
  let onSubmit;

  beforeEach(() => {
    onSubmit = vi.fn();
    render(<ManualSignalForm onSubmit={onSubmit} />);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls onSubmit with normalized payload when all required fields are filled', () => {
    fillValidForm();
    fireEvent.change(screen.getByLabelText(/entry low/i), { target: { value: '3000' } });
    fireEvent.change(screen.getByLabelText(/entry high/i), { target: { value: '3400' } });
    fireEvent.change(screen.getByLabelText(/target/i), { target: { value: '4200' } });
    fireEvent.change(screen.getByLabelText(/stop loss/i), { target: { value: '2800' } });
    fireEvent.change(screen.getByLabelText(/whale wallets/i), {
      target: { value: '0xAAA, 0xBBB' },
    });
    fireEvent.change(screen.getByLabelText(/tx hashes/i), {
      target: { value: '0xhash1' },
    });
    fireEvent.click(screen.getByTestId('msf-submit'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.asset).toBe('ETH');
    expect(payload.direction).toBe('long');
    expect(payload.confidence).toBe(4);
    expect(payload.entry_low).toBe(3000);
    expect(payload.entry_high).toBe(3400);
    expect(payload.target).toBe(4200);
    expect(payload.stop_loss).toBe(2800);
    expect(payload.whale_wallets).toEqual(['0xAAA', '0xBBB']);
    expect(payload.tx_hashes).toEqual(['0xhash1']);
  });

  it('calls onSubmit with empty arrays when wallets/hashes are blank', () => {
    fillValidForm();
    fireEvent.click(screen.getByTestId('msf-submit'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.whale_wallets).toEqual([]);
    expect(payload.tx_hashes).toEqual([]);
  });
});
