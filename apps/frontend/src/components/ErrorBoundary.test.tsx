import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

function Boom(): React.JSX.Element {
  throw new Error('kaput');
}

describe('ErrorBoundary (Phase 7 frontend smoke)', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>dashboard content</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('dashboard content')).toBeInTheDocument();
  });

  it('renders the fallback error state when a child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('recovers via Try Again', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let explode = true;
    function Flaky(): React.JSX.Element {
      if (explode) throw new Error('kaput');
      return <p>recovered content</p>;
    }
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    explode = false;
    fireEvent.click(screen.getByText('Try Again'));
    expect(screen.getByText('recovered content')).toBeInTheDocument();
  });
});
