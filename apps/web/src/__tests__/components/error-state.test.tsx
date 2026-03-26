/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorState } from '@/components/states/error-state';

describe('ErrorState', () => {
  it('renders default error message', () => {
    render(<ErrorState />);
    expect(screen.getByText('Something went wrong.')).toBeTruthy();
  });

  it('renders custom message', () => {
    render(<ErrorState message="Network error occurred." />);
    expect(screen.getByText('Network error occurred.')).toBeTruthy();
  });

  it('shows retry button when onRetry is provided', () => {
    const onRetry = jest.fn();
    render(<ErrorState onRetry={onRetry} />);
    const button = screen.getByTestId('retry-button');
    expect(button).toBeTruthy();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = jest.fn();
    render(<ErrorState onRetry={onRetry} />);
    fireEvent.click(screen.getByTestId('retry-button'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('hides retry button when onRetry is not provided', () => {
    render(<ErrorState />);
    expect(screen.queryByTestId('retry-button')).toBeNull();
  });
});
