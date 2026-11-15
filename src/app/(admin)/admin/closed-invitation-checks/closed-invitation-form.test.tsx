import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ check: vi.fn() }));
vi.mock('./actions', () => ({ checkClosedInvitation: mocks.check }));
import { ClosedInvitationForm } from './closed-invitation-form';
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('renders only a private token input and blocks another submission after settlement', async () => { mocks.check.mockResolvedValue({ status: 'error', message: 'closed' }); const { container } = render(<ClosedInvitationForm label="Used"/>); expect(container.querySelectorAll('input')).toHaveLength(1); const input = screen.getByLabelText('Used token'); expect(input.getAttribute('type')).toBe('password'); fireEvent.change(input, { target: { value: 'A'.repeat(43) } }); const button = screen.getByRole('button', { name: 'Check once' }); await act(async () => { fireEvent.submit(button.closest('form')!); }); expect(mocks.check).toHaveBeenCalledTimes(1); expect(screen.getByRole('status').textContent).toBe('closed'); expect((button as HTMLButtonElement).disabled).toBe(true); await act(async () => { fireEvent.submit(button.closest('form')!); }); expect(mocks.check).toHaveBeenCalledTimes(1); });
