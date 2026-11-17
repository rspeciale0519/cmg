import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({prepare:vi.fn(),refresh:vi.fn(),remind:vi.fn()}));
vi.mock('@/lib/actions/signudoc',()=>({prepareAgreementReview:m.prepare,refreshSignuDocAgreement:m.refresh,remindSignuDocSigner:m.remind}));
vi.mock('@/lib/actions/esign',()=>({submitLorRecovery:vi.fn(async()=>({status:'success',message:'synthetic send'}))}));
import {SignuDocControls} from './signudoc-controls';
afterEach(cleanup);
beforeEach(()=>{vi.clearAllMocks();m.prepare.mockResolvedValue({ok:true,token:'synthetic-review-token',pdfBase64:btoa('%PDF-SYNTHETIC'),filename:'review.pdf',recipients:[{role:'Homeowner1',name:'Avery Synthetic',email:'avery@example.invalid'}],feePercent:10,agreement:'non_emergency',expiresAt:Date.now()+600000});URL.createObjectURL=vi.fn(()=>'blob:synthetic');URL.revokeObjectURL=vi.fn();vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});});
const base={claimId:'11111111-1111-4111-8111-111111111111',requestId:'22222222-2222-4222-8222-222222222222',canStart:true,canRefresh:false,ready:true};
it('requires preparation and explicit review confirmation before enabling send',async()=>{
 render(<SignuDocControls {...base}/>);expect((screen.getByRole('button',{name:'Send reviewed agreement'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Prepare agreement for review'}));
 await waitFor(()=>expect(screen.getByText('avery@example.invalid')).toBeTruthy());
 expect(screen.getByText('Avery Synthetic')).toBeTruthy();expect((screen.getByRole('button',{name:'Send reviewed agreement'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByRole('checkbox'));expect((screen.getByRole('button',{name:'Send reviewed agreement'}) as HTMLButtonElement).disabled).toBe(false);
 expect(document.querySelector<HTMLInputElement>('input[name="reviewToken"]')?.value).toBe('synthetic-review-token');expect(m.remind).not.toHaveBeenCalled();
});
it('refreshes an existing request and shows which homeowner is outstanding',async()=>{
 m.refresh.mockResolvedValue({ok:true,filed:false,message:'Waiting for Avery Synthetic.',signers:[{role:'Homeowner1',name:'Avery Synthetic',status:'notified'}]});
 render(<SignuDocControls {...base} canStart={false} canRefresh/>);fireEvent.click(screen.getByRole('button',{name:'Refresh signing status'}));await waitFor(()=>expect(screen.getByText('Waiting for Avery Synthetic.')).toBeTruthy());expect(m.refresh).toHaveBeenCalledWith(base.claimId);
});
