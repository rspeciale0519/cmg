import type { Database as GeneratedDatabase,Json } from "./database";

export type {
  CompositeTypes,
  Enums,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "./database";

type Functions = GeneratedDatabase["public"]["Functions"];

type NullableFields<T, Keys extends keyof T> = {
  [Key in keyof T]: Key extends Keys ? T[Key] | null : T[Key];
};

type NullableArgs<
  Name extends keyof Functions,
  Keys extends keyof Functions[Name]["Args"],
> = Omit<Functions[Name], "Args"> & {
  Args: NullableFields<Functions[Name]["Args"], Keys>;
};

// Generation does not retain these SQL null contracts. Keep database.ts as the
// untouched CLI output; preserve every other field and optional argument here.
type FunctionOverrides = {
  // Forward-migration RPC contract. The generated baseline remains untouched;
  // regenerate with the local stack before merge/activation.
  claim_signudoc_poll_batch:{Args:{p_limit?:number;p_lease_seconds?:number};Returns:Json};
  // Error and retry fields are nullable for successful, held, and dead claims.
  settle_outbox_claim_v2: NullableArgs<"settle_outbox_claim_v2", "p_error" | "p_retry_seconds">;
  // 20260815240000: optional intake facts use COALESCE; partner fields depend on
  // p_partner_choice, and status notes can be null.
  accept_intake_transaction: NullableArgs<
    "accept_intake_transaction",
    | "p_carrier"
    | "p_carrier_tenure"
    | "p_lor_contract_type"
    | "p_new_partner_name"
    | "p_note"
    | "p_partner_company_id"
    | "p_policy_number"
  >;
  // 20260815190000: cleanup may precede creation of a claim row.
  enqueue_storage_cleanup_exact: NullableArgs<
    "enqueue_storage_cleanup_exact",
    "p_claim_id"
  >;
  // 20260815190000: the invite role determines which target IDs are null.
  issue_invite_transaction: NullableArgs<
    "issue_invite_transaction",
    "p_claim_id" | "p_partner_company_id"
  >;
  // 20260815210000, extended by 20260917120000: nullable assignment IDs and
  // LEFT JOIN names remain null, and a claim that arrived without a vendor link
  // has neither a referral partner ID nor a referral partner name.
  staff_claims_projection: Omit<Functions["staff_claims_projection"], "Returns"> & {
    Returns: NullableFields<
      Functions["staff_claims_projection"]["Returns"][number],
      | "adjuster_name"
      | "assigned_adjuster_id"
      | "intake_referral_partner_id"
      | "intake_referral_partner_name"
      | "partner_company_id"
      | "partner_name"
    >[];
  };
  // 20260815230000: both arguments default to NULL (Json already includes null).
  submit_claim_transaction: NullableArgs<
    "submit_claim_transaction",
    "p_audit" | "p_partner_company_id"
  >;
};

export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<GeneratedDatabase["public"], "Functions"> & {
    Functions: Omit<Functions, keyof FunctionOverrides> & FunctionOverrides;
  };
};
