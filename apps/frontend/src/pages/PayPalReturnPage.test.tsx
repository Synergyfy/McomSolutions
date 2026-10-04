import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PayPalReturnPage from './PayPalReturnPage';

const { captureMock } = vi.hoisted(() => ({
  captureMock: vi.fn(),
}));

vi.mock('../services/payment/hooks', () => ({
  usePaypalCapture: () => ({ mutateAsync: captureMock }),
}));

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <PayPalReturnPage />
    </MemoryRouter>,
  );
}

describe('PayPalReturnPage failure banners (Phase 7 frontend smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a banner when the PayPal order ID is missing', async () => {
    renderAt('/payment/paypal/return?plan=Gold');
    expect(await screen.findByText('Payment Failed')).toBeInTheDocument();
    expect(
      screen.getByText('No PayPal order ID found. Please try again.'),
    ).toBeInTheDocument();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('shows the server message when capture fails', async () => {
    captureMock.mockRejectedValueOnce({
      response: { data: { message: 'Order already captured' } },
    });
    renderAt('/payment/paypal/return?token=ORDER-1&plan=Gold');
    expect(await screen.findByText('Payment Failed')).toBeInTheDocument();
    expect(screen.getByText('Order already captured')).toBeInTheDocument();
  });

  it('falls back to a generic banner when capture fails without a message', async () => {
    captureMock.mockRejectedValueOnce(new Error('network down'));
    renderAt('/payment/paypal/return?token=ORDER-2&plan=Gold');
    expect(await screen.findByText('Payment Failed')).toBeInTheDocument();
    expect(
      screen.getByText('Payment capture failed. Please contact support.'),
    ).toBeInTheDocument();
  });
});
