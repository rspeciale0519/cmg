// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ConcurrentSqlSession, verifyConcurrencyTarget, waitForConnectionLock } from "./concurrency-test-support";

// Opt in before reading any target setting or opening a process. No environment file is loaded.
const describeLocal = process.env.CMG_AIRTABLE_CONCURRENCY_TEST === "1" ? describe : describe.skip;

describeLocal("Airtable authority after a real connection lock wait", () => {
  it.each(["owner", "company"] as const)("refuses a waiting save after %s authority changes", async change => {
    const target = verifyConcurrencyTarget();
    const observer = new ConcurrentSqlSession(target);
    const locker = new ConcurrentSqlSession(target);
    const requester = new ConcurrentSqlSession(target);
    const actor = randomUUID();
    const company = randomUUID();
    const connection = randomUUID();
    const app = `cmg_airtable_${randomUUID().replaceAll("-", "")}`;
    let result: Promise<{ value?: string; error?: Error }> | undefined;
    try {
      await observer.query(`set statement_timeout='15s';
        insert into auth.users(id,email,raw_user_meta_data) values('${actor}','${actor}@example.test','{"first_name":"Synthetic","last_name":"Concurrency"}');
        update public.profiles set role='owner',is_active=true where id='${actor}';
        insert into public.partner_companies(id,name,status) values('${company}','Synthetic Airtable lock test','active');
        insert into public.airtable_connections(id,company_id,needs_reconnect) values('${connection}','${company}',false);`);
      await locker.query(`set statement_timeout='15s'; begin; select id from public.airtable_connections where id='${connection}' for update;`);
      await requester.query(`set statement_timeout='15s'; set application_name='${app}';
        set request.jwt.claims='{"sub":"${actor}","role":"authenticated","aal":"aal2"}'; set role authenticated;`);
      result = requester.query(`select public.configure_airtable_company('${company}',1,'{
        "baseId":"app00000000000001","tableId":"tbl00000000000001","mode":"manual","enabled":true,
        "fields":["claim_ref"],"mappings":[{"source":"claim_ref","fieldId":"fld00000000000001","fieldType":"singleLineText"}]
      }');`).then(value => ({ value }), error => ({ error: error instanceof Error ? error : new Error("Unexpected SQL failure.") }));
      await waitForConnectionLock(observer, app);
      await observer.query(change === "owner"
        ? `update public.profiles set role='assistant' where id='${actor}';`
        : `update public.partner_companies set status='inactive' where id='${company}';`);
      await locker.query("rollback;");
      expect((await result).error?.message).toBe("SQLSTATE 42501");
      expect(await observer.query(`select config_revision::text||':'||enabled::text||':'||(base_id is null)::text from public.airtable_connections where id='${connection}';`)).toBe("1:false:true");
      expect(await observer.query(`select count(*) from public.audit_log where action='airtable.configure' and entity_id='${connection}';`)).toBe("0");
    } finally {
      // End only these three local test sessions. Retain their synthetic records.
      await locker.close();
      await result;
      await requester.close();
      await observer.close();
    }
  }, 30_000);

  it("gives concurrent workers only the uncertain request before older pending work", async () => {
    const target = verifyConcurrencyTarget();
    const observer = new ConcurrentSqlSession(target);
    const first = new ConcurrentSqlSession(target);
    const second = new ConcurrentSqlSession(target);
    const company = randomUUID();
    const connection = randomUUID();
    const claim = randomUUID();
    const pending = randomUUID();
    const uncertain = randomUUID();
    const record = `rec${randomUUID().replaceAll("-", "").slice(0, 14)}`;
    try {
      await observer.query(`set statement_timeout='15s';
        insert into public.partner_companies(id,name,status) values('${company}','Synthetic Airtable worker race','active');
        insert into public.airtable_connections(id,company_id) values('${connection}','${company}');
        insert into public.claims(id,status,property_street,property_city,property_zip,loss_date,cause,description)
          values('${claim}','under_review','Synthetic concurrency test','Orlando','32801',current_date,'wind','Synthetic worker ordering');
        insert into public.airtable_delivery_requests(id,claim_id,connection_id,record_id,base_id,table_id,source_revision,config_revision,link_revision,
          selected_fields,source_values,expected_values,digest,authorized_by,status,created_at)
        select id,'${claim}','${connection}','${record}','app00000000000009','tbl00000000000009',1,1,1,
          array['claim_ref'],'{}','{}','synthetic','00000000-0000-4000-a000-000000000001',status,created_at
        from (values('${pending}'::uuid,'pending','2000-01-01'::timestamptz),('${uncertain}'::uuid,'uncertain','2100-01-01'::timestamptz)) rows(id,status,created_at);`);
      const workerSetup = "set statement_timeout='15s'; set request.jwt.claims='{\"role\":\"service_role\"}'; set role service_role;";
      await Promise.all([first.query(workerSetup), second.query(workerSetup)]);
      const results = await Promise.all([
        first.query(`select public.claim_airtable_batch(1,'${claim}');`),
        second.query(`select public.claim_airtable_batch(1,'${claim}');`),
      ]);
      const leases = results.flatMap(result => z.array(z.object({ id: z.uuid(), uncertain: z.boolean() })).parse(JSON.parse(result) as unknown));
      expect(leases).toEqual([{ id: uncertain, uncertain: true }]);
      expect(await observer.query(`select status from public.airtable_delivery_requests where id='${pending}';`)).toBe("pending");
      expect(await observer.query(`select count(*) from public.airtable_delivery_requests where claim_id='${claim}' and status='sending';`)).toBe("1");
    } finally {
      await first.close();
      await second.close();
      await observer.close();
    }
  }, 30_000);

  it("blocks a second pending request for the same external record while the first transaction remains open", async () => {
    const target = verifyConcurrencyTarget();
    const observer = new ConcurrentSqlSession(target);
    const first = new ConcurrentSqlSession(target);
    const second = new ConcurrentSqlSession(target);
    const company = randomUUID();
    const connection = randomUUID();
    const claim = randomUUID();
    const earlier = randomUUID();
    const later = randomUUID();
    const record = `rec${randomUUID().replaceAll("-", "").slice(0, 14)}`;
    try {
      await observer.query(`set statement_timeout='15s';
        insert into public.partner_companies(id,name,status) values('${company}','Synthetic Airtable overlapping workers','active');
        insert into public.airtable_connections(id,company_id) values('${connection}','${company}');
        insert into public.claims(id,status,property_street,property_city,property_zip,loss_date,cause,description)
          values('${claim}','under_review','Synthetic overlapping workers','Orlando','32801',current_date,'wind','Synthetic record serialization');
        insert into public.airtable_delivery_requests(id,claim_id,connection_id,record_id,base_id,table_id,source_revision,config_revision,link_revision,
          selected_fields,source_values,expected_values,digest,authorized_by,status,created_at)
        select id,'${claim}','${connection}','${record}','app00000000000009','tbl00000000000009',1,1,1,
          array['claim_ref',field],'{}','{}','synthetic','00000000-0000-4000-a000-000000000001','pending',created_at
        from (values('${earlier}'::uuid,'status','2000-01-01'::timestamptz),('${later}'::uuid,'messages','2001-01-01'::timestamptz)) fixtures(id,field,created_at);`);
      const workerSetup = "set statement_timeout='15s'; set request.jwt.claims='{\"role\":\"service_role\"}'; set role service_role;";
      await Promise.all([first.query(workerSetup), second.query(workerSetup)]);
      const firstResult = await first.query(`begin; select public.claim_airtable_batch(1,'${claim}');`);
      const firstLeases = z.array(z.object({ id: z.uuid(), uncertain: z.boolean() })).parse(JSON.parse(firstResult) as unknown);
      expect(firstLeases).toEqual([{ id: earlier, uncertain: false }]);
      // The first row update is uncommitted. The second caller can see both pending
      // rows, skip the row lock on the first, and consider the different second row.
      expect(await observer.query(`select count(*) from public.airtable_delivery_requests where claim_id='${claim}' and status='pending';`)).toBe("2");
      expect(await second.query(`select public.claim_airtable_batch(1,'${claim}');`)).toBe("[]");
      await first.query("commit;");
      expect(await observer.query(`select count(*) from public.airtable_delivery_requests where claim_id='${claim}' and status='sending';`)).toBe("1");
      expect(await observer.query(`select status from public.airtable_delivery_requests where id='${later}';`)).toBe("pending");
    } finally {
      await first.close();
      await second.close();
      await observer.close();
    }
  }, 30_000);
});

describeLocal("Airtable record confirmation after a connection lock wait", () => {
  it.each(["configuration", "owner", "company"] as const)("refuses a waiting record confirmation after %s changes", async change => {
    const target = verifyConcurrencyTarget();
    const observer = new ConcurrentSqlSession(target);
    const locker = new ConcurrentSqlSession(target);
    const requester = new ConcurrentSqlSession(target);
    const actor = randomUUID();
    const company = randomUUID();
    const connection = randomUUID();
    const claim = randomUUID();
    const record = `rec${randomUUID().replaceAll("-", "").slice(0, 14)}`;
    const app = `cmg_airtable_${randomUUID().replaceAll("-", "")}`;
    let result: Promise<{ value?: string; error?: Error }> | undefined;
    try {
      await observer.query(`set statement_timeout='15s';
        insert into auth.users(id,email,raw_user_meta_data) values('${actor}','${actor}@example.test','{"first_name":"Synthetic","last_name":"Record proof"}');
        update public.profiles set role='owner',is_active=true where id='${actor}';
        insert into public.partner_companies(id,name,status) values('${company}','Synthetic record proof lock','active');
        insert into public.claims(id,status,property_street,property_city,property_zip,loss_date,cause,description,partner_company_id)
          values('${claim}','under_review','Synthetic record proof wait','Orlando','32801',current_date,'wind','Synthetic record confirmation','${company}');
        insert into public.airtable_connections(id,company_id,base_id,table_id,mappings,default_fields,enabled,needs_reconnect)
          values('${connection}','${company}','app00000000000063','tbl00000000000063',
            '[{"source":"claim_ref","fieldId":"fld00000000000001","fieldType":"singleLineText"}]',array['claim_ref'],true,false);`);
      await locker.query(`set statement_timeout='15s'; begin; select id from public.airtable_connections where id='${connection}' for update;`);
      await requester.query(`set statement_timeout='15s'; set application_name='${app}';
        set request.jwt.claims='{"sub":"${actor}","role":"authenticated","aal":"aal2"}'; set role authenticated;`);
      result = requester.query(`select public.configure_airtable_claim('${claim}',0,'${record}',
        '{"expectedConnectionId":"${connection}","expectedConfigRevision":1}',true);`)
        .then(value => ({ value }), error => ({ error: error instanceof Error ? error : new Error("Unexpected SQL failure.") }));
      await waitForConnectionLock(observer, app);
      if (change === "configuration") {
        await locker.query(`set local request.jwt.claims='{"sub":"${actor}","role":"authenticated","aal":"aal2"}'; set local role authenticated;
          select public.configure_airtable_company('${company}',1,
            '{"baseId":"app00000000000063","tableId":"tbl00000000000063","mode":"automatic","enabled":true,"fields":["claim_ref"],
              "mappings":[{"source":"claim_ref","fieldId":"fld00000000000001","fieldType":"singleLineText"}]}');`);
      } else {
        await observer.query(change === "owner"
          ? `update public.profiles set role='assistant' where id='${actor}';`
          : `update public.partner_companies set status='inactive' where id='${company}';`);
      }
      await locker.query("commit;");
      expect((await result).error?.message).toBe(change === "configuration" ? "SQLSTATE 40001" : "SQLSTATE 42501");
      expect(await observer.query(`select count(*) from public.airtable_claim_links where claim_id='${claim}';`)).toBe("0");
      expect(await observer.query(`select count(*) from public.airtable_delivery_requests where claim_id='${claim}';`)).toBe("0");
      expect(await observer.query(`select count(*) from public.audit_log where action='airtable.link' and entity_id='${claim}';`)).toBe("0");
    } finally {
      await locker.close();
      await result;
      await requester.close();
      await observer.close();
    }
  }, 30_000);
});

describeLocal("Legal authority after a real row lock wait", () => {
  it.each(["firm edit", "handoff start", "package preparation"] as const)("refuses %s after the waiting Owner loses access", async operation => {
    const target = verifyConcurrencyTarget();
    const observer = new ConcurrentSqlSession(target);
    const locker = new ConcurrentSqlSession(target);
    const requester = new ConcurrentSqlSession(target);
    const actor = randomUUID();
    const firm = randomUUID();
    const claim = randomUUID();
    const document = randomUUID();
    const handoff = randomUUID();
    const request = randomUUID();
    const app = `cmg_airtable_${randomUUID().replaceAll("-", "")}`;
    let result: Promise<{ value?: string; error?: Error }> | undefined;
    try {
      await observer.query(`set statement_timeout='15s';
        insert into auth.users(id,email,raw_user_meta_data) values('${actor}','${actor}@example.test','{"first_name":"Synthetic","last_name":"Legal concurrency"}');
        update public.profiles set role='owner',is_active=true where id='${actor}';
        insert into public.law_firms(id,name,contact_name,contact_email,contact_phone,created_by,updated_by)
          values('${firm}','Original synthetic firm','Synthetic contact','firm@example.test','4075550100','${actor}','${actor}');`);
      if (operation !== "firm edit") {
        await observer.query(`insert into public.claims(id,status,property_street,property_city,property_zip,carrier,policy_number,loss_date,cause,description)
            values('${claim}','lor_sent','Synthetic legal lock test','Orlando','32801','Synthetic insurer','SYNTHETIC',current_date-3,'wind','Synthetic legal concurrency');
          insert into public.documents(id,claim_id,storage_path,original_name,kind,mime,size_bytes)
            values('${document}','${claim}','claims/${claim}/${document}.pdf','synthetic-signed.pdf','lor_signed','application/pdf',100);
          update public.claims set status='lor_signed',lor_signed_at=now()-interval '2 days' where id='${claim}';`);
      }
      if (operation === "package preparation") {
        await observer.query(`insert into public.claim_legal_handoffs(id,claim_id,firm_id,firm_snapshot,prior_status,created_by,request_id)
          values('${handoff}','${claim}','${firm}','{"name":"Original synthetic firm","contactName":"Synthetic contact","email":"firm@example.test","phone":"4075550100"}',
            'lor_signed','${actor}','${randomUUID()}');`);
      }
      const lock = operation === "package preparation"
        ? `select id from public.documents where id='${document}' for update;`
        : `select id from public.law_firms where id='${firm}' for update;`;
      await locker.query(`set statement_timeout='15s'; begin; ${lock}`);
      await requester.query(`set statement_timeout='15s'; set application_name='${app}';
        set request.jwt.claims='{"sub":"${actor}","role":"authenticated","aal":"aal2"}'; set role authenticated;`);
      const sql = operation === "firm edit"
        ? `select public.save_law_firm('${firm}','Changed synthetic firm','Synthetic contact','firm@example.test','4075550100',true);`
        : operation === "handoff start"
          ? `select public.start_legal_handoff('${claim}','${firm}','${request}');`
          : `select public.prepare_legal_package('${handoff}',array['${document}'::uuid],array['claim'],'Synthetic review','${request}');`;
      result = requester.query(sql).then(value => ({ value }), error => ({ error: error instanceof Error ? error : new Error("Unexpected SQL failure.") }));
      await waitForConnectionLock(observer, app);
      await observer.query(`update public.profiles set role='assistant' where id='${actor}';`);
      await locker.query("rollback;");
      expect((await result).error?.message).toBe("SQLSTATE 42501");
      if (operation === "firm edit") {
        expect(await observer.query(`select name from public.law_firms where id='${firm}';`)).toBe("Original synthetic firm");
        expect(await observer.query(`select count(*) from public.audit_log where action='law_firm.save' and entity_id='${firm}';`)).toBe("0");
      } else if (operation === "handoff start") {
        expect(await observer.query(`select count(*) from public.claim_legal_handoffs where claim_id='${claim}';`)).toBe("0");
      } else {
        expect(await observer.query(`select count(*) from public.claim_legal_packages where handoff_id='${handoff}';`)).toBe("0");
      }
    } finally {
      await locker.close();
      await result;
      await requester.close();
      await observer.close();
    }
  }, 30_000);
});
