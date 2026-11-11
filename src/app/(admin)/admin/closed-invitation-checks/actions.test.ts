import { beforeEach, describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ owner: vi.fn(), open: vi.fn(), accept: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ notFound: () => { throw Error('NOT_FOUND'); } }));
vi.mock('@/lib/authz', () => ({ requireOwner: mocks.owner, requireOpenPath: mocks.open }));
vi.mock('@/lib/actions/invite', () => ({ acceptInvite: mocks.accept }));
const { checkClosedInvitation } = await import('./actions');
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('VERCEL_ENV', 'preview'); mocks.owner.mockResolvedValue({ role: 'owner' }); mocks.accept.mockResolvedValue({ status: 'error', message: 'closed' }); });
const form = () => { const data = new FormData(); data.set('token', 'A'.repeat(43)); return data; };
describe('closed invitation test action', () => {
    it.each(['production', 'development', ''])('blocks %s before auth or acceptance', async (env) => { vi.stubEnv('VERCEL_ENV', env); await expect(checkClosedInvitation({ status: 'idle' }, form())).rejects.toThrow('NOT_FOUND'); expect(mocks.owner).not.toHaveBeenCalled(); expect(mocks.accept).not.toHaveBeenCalled(); });
    it('enforces Owner guard before reading input', async () => { mocks.owner.mockRejectedValueOnce(Error('NOT_FOUND')); const data = { get: () => { throw Error('Input read before authorization'); } } as unknown as FormData; await expect(checkClosedInvitation({ status: 'idle' }, data)).rejects.toThrow('NOT_FOUND'); expect(mocks.accept).not.toHaveBeenCalled(); });
    it('enforces open invitation surface', async () => { mocks.open.mockImplementationOnce(() => { throw Error('CLOSED'); }); await expect(checkClosedInvitation({ status: 'idle' }, form())).rejects.toThrow('CLOSED'); expect(mocks.accept).not.toHaveBeenCalled(); });
    it.each(['', 'short', '!'.repeat(43)])('refuses malformed input without acceptance', async (token) => { const data = form(); data.set('token', token); expect((await checkClosedInvitation({ status: 'idle' }, data)).status).toBe('error'); expect(mocks.accept).not.toHaveBeenCalled(); });
    it('forwards only one token and fixed idle state, stripping added account fields', async () => { const data = form(); data.set('password', 'must-not-forward'); data.set('firstName', 'must-not-forward'); mocks.accept.mockResolvedValueOnce({ status: 'error', message: 'closed', values: { token: 'private' }, fieldErrors: { password: ['private'] } }); const result = await checkClosedInvitation({ status: 'success', message: 'forged' }, data); expect(mocks.accept).toHaveBeenCalledTimes(1); const [state, forwarded] = mocks.accept.mock.calls[0]; expect(state).toEqual({ status: 'idle' }); expect([...forwarded.keys()]).toEqual(['token']); expect(forwarded.get('token')).toBe('A'.repeat(43)); expect(result).toEqual({ status: 'error', message: 'closed' }); });
});
