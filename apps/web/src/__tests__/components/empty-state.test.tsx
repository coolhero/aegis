/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '@/components/states/empty-state';

describe('EmptyState', () => {
  it('renders default title and description', () => {
    render(<EmptyState />);
    expect(screen.getByText('No data yet')).toBeTruthy();
    expect(screen.getByText('Data will appear here once available.')).toBeTruthy();
  });

  it('renders custom title and description', () => {
    render(<EmptyState title="No logs found" description="Adjust your filters." />);
    expect(screen.getByText('No logs found')).toBeTruthy();
    expect(screen.getByText('Adjust your filters.')).toBeTruthy();
  });
});
