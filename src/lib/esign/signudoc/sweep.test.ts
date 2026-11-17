// @vitest-environment node
import {beforeEach,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const m=vi.hoisted(()=>({rpc:vi.fn(),reconcile:vi.fn()}));
vi.mock('./reconcile',()=>({reconcileSignuDocClaim:m.reconcile}));
const {sweepSignuDocSigning}=await import('./sweep');
const id='11111111-1111-4111-8111-111111111111',attempt='22222222-2222-4222-8222-222222222222';
const row={id,claim_ref:'CMG-SYNTHETIC',status:'lor_sent',esign_status:'document.sent',pandadoc_document_id:'signudoc:33333333-3333-4333-8333-333333333333',esign_active_attempt_token:attempt,esign_dispatch_token:null};
beforeEach(()=>{vi.clearAllMocks();m.rpc.mockResolvedValue({data:[row],error:null});m.reconcile.mockResolvedValue({ok:true,filed:true});});
it('uses a bounded leased batch and files completed agreements without staff intervention',async()=>{expect(await sweepSignuDocSigning({rpc:m.rpc} as never,{} as never)).toEqual({selected:1,filed:1,failed:0});expect(m.rpc).toHaveBeenCalledWith('claim_signudoc_poll_batch',{p_limit:4,p_lease_seconds:600});expect(m.reconcile).toHaveBeenCalledOnce();});
it('fails closed on malformed RPC rows and isolates individual claim failures',async()=>{m.rpc.mockResolvedValue({data:[{...row,id:'not-a-uuid'}],error:null});await expect(sweepSignuDocSigning({rpc:m.rpc} as never,{} as never)).rejects.toThrow();expect(m.reconcile).not.toHaveBeenCalled();m.rpc.mockResolvedValue({data:[row,row],error:null});m.reconcile.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce({ok:true,filed:true});expect(await sweepSignuDocSigning({rpc:m.rpc} as never,{} as never)).toEqual({selected:2,filed:1,failed:1});});
