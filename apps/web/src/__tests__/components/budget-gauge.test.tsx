/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BudgetGauge } from '@/components/budget/budget-gauge';

describe('BudgetGauge', () => {
  it('renders with correct percentage', () => {
    render(<BudgetGauge used={750} total={1000} label="Tokens" />);
    expect(screen.getByText('75.0%')).toBeTruthy();
    expect(screen.getByText('Tokens')).toBeTruthy();
    expect(screen.getByText('750 used')).toBeTruthy();
    expect(screen.getByText('1,000 total')).toBeTruthy();
  });

  it('shows green color for low usage', () => {
    const { container } = render(<BudgetGauge used={200} total={1000} label="Cost" />);
    const bar = container.querySelector('.bg-green-500');
    expect(bar).toBeTruthy();
  });

  it('shows yellow color for medium usage (70-89%)', () => {
    const { container } = render(<BudgetGauge used={800} total={1000} label="Cost" />);
    const bar = container.querySelector('.bg-yellow-500');
    expect(bar).toBeTruthy();
  });

  it('shows red color for high usage (90%+)', () => {
    const { container } = render(<BudgetGauge used={950} total={1000} label="Cost" />);
    const bar = container.querySelector('.bg-red-500');
    expect(bar).toBeTruthy();
  });

  it('handles zero total gracefully', () => {
    render(<BudgetGauge used={0} total={0} label="Tokens" />);
    expect(screen.getByText('0.0%')).toBeTruthy();
  });

  it('caps at 100% when over budget', () => {
    const { container } = render(<BudgetGauge used={1200} total={1000} label="Tokens" />);
    const bar = container.querySelector('[style]');
    expect(bar?.getAttribute('style')).toContain('100%');
  });
});
