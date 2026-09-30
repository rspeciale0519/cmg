export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: number
          ip: unknown
          meta: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: never
          ip?: unknown
          meta?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: never
          ip?: unknown
          meta?: Json
        }
        Relationships: []
      }
      claim_events: {
        Row: {
          author_id: string | null
          body: string
          claim_id: string
          created_at: string
          external_event_key: string | null
          id: string
          type: Database["public"]["Enums"]["claim_event_type"]
          visibility: Database["public"]["Enums"]["claim_event_visibility"]
        }
        Insert: {
          author_id?: string | null
          body: string
          claim_id: string
          created_at?: string
          external_event_key?: string | null
          id?: string
          type: Database["public"]["Enums"]["claim_event_type"]
          visibility?: Database["public"]["Enums"]["claim_event_visibility"]
        }
        Update: {
          author_id?: string | null
          body?: string
          claim_id?: string
          created_at?: string
          external_event_key?: string | null
          id?: string
          type?: Database["public"]["Enums"]["claim_event_type"]
          visibility?: Database["public"]["Enums"]["claim_event_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "claim_events_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_events_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_financials: {
        Row: {
          claim_id: string
          created_at: string
          fee_percent: number | null
          notes: string | null
          settlement_amount: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          claim_id: string
          created_at?: string
          fee_percent?: number | null
          notes?: string | null
          settlement_amount?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          claim_id?: string
          created_at?: string
          fee_percent?: number | null
          notes?: string | null
          settlement_amount?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_financials_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: true
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_financials_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_partner_summaries: {
        Row: {
          claim_id: string
          claim_ref: string
          filed_at: string | null
          homeowner_name: string | null
          lor_signed_at: string | null
          partner_company_id: string
          property_city: string | null
          property_street: string | null
          settled_at: string | null
          settlement_amount: number | null
          status: Database["public"]["Enums"]["claim_status"]
          updated_at: string
        }
        Insert: {
          claim_id: string
          claim_ref: string
          filed_at?: string | null
          homeowner_name?: string | null
          lor_signed_at?: string | null
          partner_company_id: string
          property_city?: string | null
          property_street?: string | null
          settled_at?: string | null
          settlement_amount?: number | null
          status: Database["public"]["Enums"]["claim_status"]
          updated_at?: string
        }
        Update: {
          claim_id?: string
          claim_ref?: string
          filed_at?: string | null
          homeowner_name?: string | null
          lor_signed_at?: string | null
          partner_company_id?: string
          property_city?: string | null
          property_street?: string | null
          settled_at?: string | null
          settlement_amount?: number | null
          status?: Database["public"]["Enums"]["claim_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_partner_summaries_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: true
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_partner_summaries_partner_company_id_fkey"
            columns: ["partner_company_id"]
            isOneToOne: false
            referencedRelation: "partner_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_ref_counters: {
        Row: {
          last_value: number
          year: number
        }
        Insert: {
          last_value?: number
          year: number
        }
        Update: {
          last_value?: number
          year?: number
        }
        Relationships: []
      }
      claim_status_history: {
        Row: {
          changed_by: string | null
          claim_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["claim_status"] | null
          id: string
          note: string | null
          to_status: Database["public"]["Enums"]["claim_status"]
        }
        Insert: {
          changed_by?: string | null
          claim_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["claim_status"] | null
          id?: string
          note?: string | null
          to_status: Database["public"]["Enums"]["claim_status"]
        }
        Update: {
          changed_by?: string | null
          claim_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["claim_status"] | null
          id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["claim_status"]
        }
        Relationships: [
          {
            foreignKeyName: "claim_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_status_history_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claimants: {
        Row: {
          claim_id: string
          created_at: string
          email: string
          first_name: string
          id: string
          initials: string
          is_primary: boolean
          last_name: string
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          claim_id: string
          created_at?: string
          email: string
          first_name: string
          id?: string
          initials: string
          is_primary?: boolean
          last_name: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          claim_id?: string
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          initials?: string
          is_primary?: boolean
          last_name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claimants_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          assigned_adjuster_id: string | null
          carrier: string | null
          carrier_tenure: Database["public"]["Enums"]["carrier_tenure"] | null
          cause: Database["public"]["Enums"]["cause_of_loss"]
          claim_number: string | null
          claim_ref: string
          contractor_company: string | null
          contractor_email: string | null
          contractor_name: string | null
          contractor_phone: string | null
          created_at: string
          denied_at: string | null
          description: string
          esign_active_attempt_token: string | null
          esign_dispatch_started_at: string | null
          esign_dispatch_token: string | null
          esign_status: string | null
          filed_at: string | null
          id: string
          intake_referral_partner_id: string | null
          lor_contract_type:
            | Database["public"]["Enums"]["lor_contract_type"]
            | null
          lor_signed_at: string | null
          loss_date: string
          loss_time: string | null
          pandadoc_document_id: string | null
          partner_company_id: string | null
          policy_number: string | null
          prior_outcome:
            | Database["public"]["Enums"]["prior_claim_outcome"]
            | null
          prior_roof_claim: boolean
          property_city: string
          property_state: string
          property_street: string
          property_street2: string | null
          property_zip: string
          referrer_email: string | null
          referrer_name: string | null
          requested_adjuster: string | null
          settled_at: string | null
          status: Database["public"]["Enums"]["claim_status"]
          updated_at: string
        }
        Insert: {
          assigned_adjuster_id?: string | null
          carrier?: string | null
          carrier_tenure?: Database["public"]["Enums"]["carrier_tenure"] | null
          cause: Database["public"]["Enums"]["cause_of_loss"]
          claim_number?: string | null
          claim_ref: string
          contractor_company?: string | null
          contractor_email?: string | null
          contractor_name?: string | null
          contractor_phone?: string | null
          created_at?: string
          denied_at?: string | null
          description: string
          esign_active_attempt_token?: string | null
          esign_dispatch_started_at?: string | null
          esign_dispatch_token?: string | null
          esign_status?: string | null
          filed_at?: string | null
          id?: string
          intake_referral_partner_id?: string | null
          lor_contract_type?:
            | Database["public"]["Enums"]["lor_contract_type"]
            | null
          lor_signed_at?: string | null
          loss_date: string
          loss_time?: string | null
          pandadoc_document_id?: string | null
          partner_company_id?: string | null
          policy_number?: string | null
          prior_outcome?:
            | Database["public"]["Enums"]["prior_claim_outcome"]
            | null
          prior_roof_claim?: boolean
          property_city: string
          property_state?: string
          property_street: string
          property_street2?: string | null
          property_zip: string
          referrer_email?: string | null
          referrer_name?: string | null
          requested_adjuster?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          updated_at?: string
        }
        Update: {
          assigned_adjuster_id?: string | null
          carrier?: string | null
          carrier_tenure?: Database["public"]["Enums"]["carrier_tenure"] | null
          cause?: Database["public"]["Enums"]["cause_of_loss"]
          claim_number?: string | null
          claim_ref?: string
          contractor_company?: string | null
          contractor_email?: string | null
          contractor_name?: string | null
          contractor_phone?: string | null
          created_at?: string
          denied_at?: string | null
          description?: string
          esign_active_attempt_token?: string | null
          esign_dispatch_started_at?: string | null
          esign_dispatch_token?: string | null
          esign_status?: string | null
          filed_at?: string | null
          id?: string
          intake_referral_partner_id?: string | null
          lor_contract_type?:
            | Database["public"]["Enums"]["lor_contract_type"]
            | null
          lor_signed_at?: string | null
          loss_date?: string
          loss_time?: string | null
          pandadoc_document_id?: string | null
          partner_company_id?: string | null
          policy_number?: string | null
          prior_outcome?:
            | Database["public"]["Enums"]["prior_claim_outcome"]
            | null
          prior_roof_claim?: boolean
          property_city?: string
          property_state?: string
          property_street?: string
          property_street2?: string | null
          property_zip?: string
          referrer_email?: string | null
          referrer_name?: string | null
          requested_adjuster?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_assigned_adjuster_id_fkey"
            columns: ["assigned_adjuster_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_intake_referral_partner_id_fkey"
            columns: ["intake_referral_partner_id"]
            isOneToOne: false
            referencedRelation: "partner_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_partner_company_id_fkey"
            columns: ["partner_company_id"]
            isOneToOne: false
            referencedRelation: "partner_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          claim_id: string | null
          consent_text: string
          created_at: string
          email: string
          granted_at: string
          id: string
          ip: unknown
          kind: Database["public"]["Enums"]["consent_kind"]
          lead_id: string | null
          phone: string | null
          withdrawn_at: string | null
        }
        Insert: {
          claim_id?: string | null
          consent_text: string
          created_at?: string
          email: string
          granted_at?: string
          id?: string
          ip?: unknown
          kind: Database["public"]["Enums"]["consent_kind"]
          lead_id?: string | null
          phone?: string | null
          withdrawn_at?: string | null
        }
        Update: {
          claim_id?: string | null
          consent_text?: string
          created_at?: string
          email?: string
          granted_at?: string
          id?: string
          ip?: unknown
          kind?: Database["public"]["Enums"]["consent_kind"]
          lead_id?: string | null
          phone?: string | null
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          claim_id: string
          created_at: string
          external_event_key: string | null
          id: string
          kind: Database["public"]["Enums"]["document_kind"]
          mime: string
          original_name: string
          size_bytes: number
          storage_path: string
          updated_at: string
          uploaded_by: string | null
          visibility: Database["public"]["Enums"]["document_visibility"]
        }
        Insert: {
          claim_id: string
          created_at?: string
          external_event_key?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          mime: string
          original_name: string
          size_bytes: number
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
          visibility?: Database["public"]["Enums"]["document_visibility"]
        }
        Update: {
          claim_id?: string
          created_at?: string
          external_event_key?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          mime?: string
          original_name?: string
          size_bytes?: number
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
          visibility?: Database["public"]["Enums"]["document_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "documents_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      esign_dispatch_attempts: {
        Row: {
          actor_id: string | null
          claim_id: string
          claim_token: string
          completed_at: string | null
          mode: string
          phase: string
          provider_document_id: string | null
          request_id: string
          result: Json
          started_at: string
          state: string
        }
        Insert: {
          actor_id?: string | null
          claim_id: string
          claim_token: string
          completed_at?: string | null
          mode: string
          phase?: string
          provider_document_id?: string | null
          request_id: string
          result?: Json
          started_at?: string
          state: string
        }
        Update: {
          actor_id?: string | null
          claim_id?: string
          claim_token?: string
          completed_at?: string | null
          mode?: string
          phase?: string
          provider_document_id?: string | null
          request_id?: string
          result?: Json
          started_at?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "esign_dispatch_attempts_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esign_dispatch_attempts_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      esign_recipient_completions: {
        Row: {
          claim_id: string
          completed_at: string
          document_id: string
          recipient_hash: string
        }
        Insert: {
          claim_id: string
          completed_at?: string
          document_id: string
          recipient_hash: string
        }
        Update: {
          claim_id?: string
          completed_at?: string
          document_id?: string
          recipient_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "esign_recipient_completions_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_upload_files: {
        Row: {
          copy_started_at: string | null
          index: number
          last_reconciled_at: string | null
          mime: string
          original_name: string
          session_id: string
          size_bytes: number
          storage_path: string
          upload_path: string
          verification: Json | null
        }
        Insert: {
          copy_started_at?: string | null
          index: number
          last_reconciled_at?: string | null
          mime: string
          original_name: string
          session_id: string
          size_bytes: number
          storage_path: string
          upload_path: string
          verification?: Json | null
        }
        Update: {
          copy_started_at?: string | null
          index?: number
          last_reconciled_at?: string | null
          mime?: string
          original_name?: string
          session_id?: string
          size_bytes?: number
          storage_path?: string
          upload_path?: string
          verification?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "intake_upload_files_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "intake_upload_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_upload_sessions: {
        Row: {
          cleanup_after: string
          completed_at: string | null
          created_at: string
          expires_at: string
          file_count: number
          id: string
          result: Json | null
          sign_until: string
          status: string
          submission: Json
          token_hash: string
        }
        Insert: {
          cleanup_after: string
          completed_at?: string | null
          created_at: string
          expires_at: string
          file_count: number
          id: string
          result?: Json | null
          sign_until: string
          status?: string
          submission: Json
          token_hash: string
        }
        Update: {
          cleanup_after?: string
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          file_count?: number
          id?: string
          result?: Json | null
          sign_until?: string
          status?: string
          submission?: Json
          token_hash?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          acceptance_attempt_id: string | null
          accepted_at: string | null
          accepted_by: string | null
          claim_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          partner_company_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          token_hash: string
        }
        Insert: {
          acceptance_attempt_id?: string | null
          accepted_at?: string | null
          accepted_by?: string | null
          claim_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          partner_company_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          token_hash: string
        }
        Update: {
          acceptance_attempt_id?: string | null
          accepted_at?: string | null
          accepted_by?: string | null
          claim_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          partner_company_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_partner_company_id_fkey"
            columns: ["partner_company_id"]
            isOneToOne: false
            referencedRelation: "partner_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string
          email: string | null
          id: string
          ip: unknown
          message: string | null
          name: string
          phone: string
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: unknown
          message?: string | null
          name: string
          phone: string
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: unknown
          message?: string | null
          name?: string
          phone?: string
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      notifications_outbox: {
        Row: {
          attempts: number
          created_at: string
          dedupe_key: string | null
          id: string
          last_error: string | null
          next_attempt_at: string
          payload: Json
          recipient_email: string
          sent_at: string | null
          status: Database["public"]["Enums"]["outbox_status"]
          template: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          dedupe_key?: string | null
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json
          recipient_email: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbox_status"]
          template: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          dedupe_key?: string | null
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json
          recipient_email?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbox_status"]
          template?: string
          updated_at?: string
        }
        Relationships: []
      }
      pandadoc_webhook_events: {
        Row: {
          event_id: string
          payload_summary: Json
          received_at: string
        }
        Insert: {
          event_id: string
          payload_summary?: Json
          received_at?: string
        }
        Update: {
          event_id?: string
          payload_summary?: Json
          received_at?: string
        }
        Relationships: []
      }
      partner_companies: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          default_fee_percent: number | null
          id: string
          intake_referral_code: string
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["partner_company_status"]
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          default_fee_percent?: number | null
          id?: string
          intake_referral_code?: string
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["partner_company_status"]
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          default_fee_percent?: number | null
          id?: string
          intake_referral_code?: string
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["partner_company_status"]
          updated_at?: string
        }
        Relationships: []
      }
      private_upload_files: {
        Row: {
          copy_started_at: string | null
          index: number
          kind: Database["public"]["Enums"]["document_kind"]
          last_reconciled_at: string | null
          mime: string
          original_name: string
          session_id: string
          size_bytes: number
          storage_path: string
          upload_path: string
          verification: Json | null
          visibility: Database["public"]["Enums"]["document_visibility"]
        }
        Insert: {
          copy_started_at?: string | null
          index: number
          kind: Database["public"]["Enums"]["document_kind"]
          last_reconciled_at?: string | null
          mime: string
          original_name: string
          session_id: string
          size_bytes: number
          storage_path: string
          upload_path: string
          verification?: Json | null
          visibility: Database["public"]["Enums"]["document_visibility"]
        }
        Update: {
          copy_started_at?: string | null
          index?: number
          kind?: Database["public"]["Enums"]["document_kind"]
          last_reconciled_at?: string | null
          mime?: string
          original_name?: string
          session_id?: string
          size_bytes?: number
          storage_path?: string
          upload_path?: string
          verification?: Json | null
          visibility?: Database["public"]["Enums"]["document_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "private_upload_files_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "private_upload_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      private_upload_sessions: {
        Row: {
          claim_id: string
          cleanup_after: string
          completed_at: string | null
          created_at: string
          expires_at: string
          file_count: number
          id: string
          result: Json | null
          sign_until: string
          status: string
          token_hash: string
          uploaded_by: string
        }
        Insert: {
          claim_id: string
          cleanup_after: string
          completed_at?: string | null
          created_at: string
          expires_at: string
          file_count: number
          id: string
          result?: Json | null
          sign_until: string
          status?: string
          token_hash: string
          uploaded_by: string
        }
        Update: {
          claim_id?: string
          cleanup_after?: string
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          file_count?: number
          id?: string
          result?: Json | null
          sign_until?: string
          status?: string
          token_hash?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          is_active: boolean
          last_name: string | null
          partner_company_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id: string
          is_active?: boolean
          last_name?: string | null
          partner_company_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          partner_company_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_partner_company_id_fkey"
            columns: ["partner_company_id"]
            isOneToOne: false
            referencedRelation: "partner_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          updated_at: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          updated_at?: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      storage_cleanup_queue: {
        Row: {
          attempts: number
          bucket_id: string
          claim_id: string | null
          dead_at: string | null
          document_id: string | null
          enqueued_at: string
          id: number
          last_error: string | null
          next_attempt_at: string
          object_path: string
          processed_at: string | null
        }
        Insert: {
          attempts?: number
          bucket_id: string
          claim_id?: string | null
          dead_at?: string | null
          document_id?: string | null
          enqueued_at?: string
          id?: never
          last_error?: string | null
          next_attempt_at?: string
          object_path: string
          processed_at?: string | null
        }
        Update: {
          attempts?: number
          bucket_id?: string
          claim_id?: string | null
          dead_at?: string | null
          document_id?: string | null
          enqueued_at?: string
          id?: never
          last_error?: string | null
          next_attempt_at?: string
          object_path?: string
          processed_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abandon_invite_acceptance: {
        Args: { p_attempt_id: string; p_invite_id: string }
        Returns: boolean
      }
      accept_intake_transaction: {
        Args: {
          p_adjuster_id: string
          p_carrier: string
          p_carrier_tenure: Database["public"]["Enums"]["carrier_tenure"]
          p_claim_id: string
          p_default_fee_percent: number
          p_ip: unknown
          p_lor_contract_type: Database["public"]["Enums"]["lor_contract_type"]
          p_new_partner_name: string
          p_note: string
          p_partner_choice: string
          p_partner_company_id: string
          p_policy_number: string
          p_portal_url: string
        }
        Returns: Json
      }
      admin_user_directory: {
        Args: never
        Returns: {
          email: string
          last_sign_in_at: string
          mfa_confirmed_at: string
          mfa_enrolled: boolean
          user_id: string
        }[]
      }
      allowed_claim_transitions: {
        Args: { p_from: Database["public"]["Enums"]["claim_status"] }
        Returns: Database["public"]["Enums"]["claim_status"][]
      }
      apply_esign_webhook_state: {
        Args: {
          p_attempt_token: string
          p_claim_id: string
          p_document_id: string
          p_status: string
        }
        Returns: string
      }
      assert_claim_loss_date: {
        Args: { p_loss_date: string }
        Returns: undefined
      }
      begin_intake_upload_session: {
        Args: {
          p_files: Json
          p_id: string
          p_submission: Json
          p_token_hash: string
        }
        Returns: Json
      }
      begin_invite_acceptance: {
        Args: { p_attempt_id: string; p_token_hash: string }
        Returns: Json
      }
      begin_private_upload_session: {
        Args: {
          p_claim_id: string
          p_files: Json
          p_id: string
          p_token_hash: string
          p_uploaded_by: string
        }
        Returns: Json
      }
      cancel_intake_upload_session: {
        Args: { p_id: string; p_token_hash: string }
        Returns: Json
      }
      cancel_private_upload_session: {
        Args: { p_id: string; p_token_hash: string }
        Returns: Json
      }
      change_staff_privileges: {
        Args: {
          p_active?: boolean
          p_role?: Database["public"]["Enums"]["app_role"]
          p_target: string
        }
        Returns: {
          created_at: string
          first_name: string | null
          id: string
          is_active: boolean
          last_name: string | null
          partner_company_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_rate_limit: {
        Args: { p_key: string; p_max: number; p_window: string }
        Returns: boolean
      }
      claim_esign_dispatch: {
        Args: {
          p_actor_id?: string
          p_claim_id: string
          p_claim_token: string
          p_lease_seconds?: number
          p_mode: string
          p_request_id: string
        }
        Returns: Json
      }
      claim_intake_upload_copy: {
        Args: { p_id: string; p_index: number; p_token_hash: string }
        Returns: Json
      }
      claim_outbox_batch: {
        Args: { p_ids?: string[]; p_lease_seconds?: number; p_limit?: number }
        Returns: {
          attempts: number
          created_at: string
          id: string
          payload: Json
          recipient_email: string
          template: string
        }[]
      }
      claim_pandadoc_webhook_event: {
        Args: {
          p_claim_token: string
          p_event_id: string
          p_lease_seconds?: number
          p_payload_hash: string
        }
        Returns: Json
      }
      claim_private_upload_copy: {
        Args: { p_id: string; p_index: number; p_token_hash: string }
        Returns: Json
      }
      claim_status_counts: {
        Args: never
        Returns: {
          claim_count: number
          status: Database["public"]["Enums"]["claim_status"]
        }[]
      }
      claim_storage_cleanup_batch: {
        Args: {
          p_lease_seconds?: number
          p_limit?: number
          p_max_attempts?: number
        }
        Returns: {
          attempts: number
          bucket_id: string
          id: number
          object_path: string
        }[]
      }
      complete_pandadoc_webhook_event: {
        Args: {
          p_claim_token: string
          p_event_id: string
          p_payload_summary: Json
        }
        Returns: boolean
      }
      enqueue_storage_cleanup_exact: {
        Args: {
          p_bucket_id: string
          p_claim_id?: string
          p_object_paths: string[]
        }
        Returns: number
      }
      esign_attempt_is_active: {
        Args: {
          p_attempt_token: string
          p_claim_id: string
          p_document_id: string
        }
        Returns: boolean
      }
      finalize_esign_pdf: {
        Args: {
          p_attempt_token: string
          p_claim_id: string
          p_document_id: string
          p_external_event_key: string
          p_original_name: string
          p_size_bytes: number
          p_storage_path: string
        }
        Returns: Json
      }
      finalize_intake_upload_session: {
        Args: { p_id: string; p_token_hash: string; p_verified: Json }
        Returns: Json
      }
      finalize_invite_acceptance: {
        Args: {
          p_attempt_id: string
          p_first_name: string
          p_invite_id: string
          p_ip: unknown
          p_last_name: string
          p_user_id: string
        }
        Returns: Json
      }
      finalize_private_upload_session: {
        Args: { p_document_ids: string[]; p_id: string; p_token_hash: string }
        Returns: Json
      }
      issue_invite_transaction: {
        Args: {
          p_claim_id: string
          p_email: string
          p_expires_at: string
          p_invited_by: string
          p_ip: unknown
          p_partner_company_id: string
          p_payload: Json
          p_role: Database["public"]["Enums"]["app_role"]
          p_token_hash: string
        }
        Returns: Json
      }
      link_invited_claimant: {
        Args: { p_claim_id: string; p_email: string; p_user_id: string }
        Returns: boolean
      }
      mark_esign_dispatch_sending: {
        Args: {
          p_claim_token: string
          p_provider_document_id: string
          p_request_id: string
        }
        Returns: boolean
      }
      next_claim_ref: { Args: never; Returns: string }
      partner_company_profile: {
        Args: never
        Returns: {
          contact_email: string
          contact_name: string
          contact_phone: string
          id: string
          name: string
        }[]
      }
      partner_referral_company: {
        Args: never
        Returns: {
          id: string
          name: string
        }[]
      }
      portal_claim_contact: {
        Args: { p_claim_id: string }
        Returns: {
          first_name: string
          last_name: string
        }[]
      }
      reassign_claim: {
        Args: { p_claim_id: string; p_new_adjuster: string }
        Returns: undefined
      }
      reconcile_esign_dispatch: {
        Args: {
          p_attempt_token: string
          p_claim_id: string
          p_document_id: string
          p_outcome: string
        }
        Returns: string
      }
      reconcile_intake_upload_cleanup: {
        Args: { p_limit?: number }
        Returns: Json
      }
      reconcile_private_upload_cleanup: {
        Args: { p_limit?: number }
        Returns: Json
      }
      record_esign_recipient_completion: {
        Args: {
          p_attempt_token: string
          p_claim_id: string
          p_document_id: string
          p_recipient_hash: string
        }
        Returns: Json
      }
      refresh_claim_partner_summary: {
        Args: { p_claim_id: string }
        Returns: undefined
      }
      release_pandadoc_webhook_event: {
        Args: { p_claim_token: string; p_error: string; p_event_id: string }
        Returns: boolean
      }
      settle_esign_dispatch: {
        Args: {
          p_claim_token: string
          p_request_id: string
          p_result?: Json
          p_state: string
        }
        Returns: boolean
      }
      staff_claims_projection: {
        Args: never
        Returns: {
          adjuster_name: string
          assigned_adjuster_id: string
          claim_ref: string
          id: string
          intake_referral_partner_id: string
          intake_referral_partner_name: string
          loss_date: string
          partner_company_id: string
          partner_name: string
          property_city: string
          property_state: string
          property_street: string
          property_zip: string
          search_text: string
          status: Database["public"]["Enums"]["claim_status"]
          updated_at: string
        }[]
      }
      submit_claim_transaction: {
        Args: {
          p_audit?: Json
          p_claim: Json
          p_claimants: Json
          p_consents: Json
          p_documents: Json
          p_outbox: Json
          p_partner_company_id?: string
        }
        Returns: Json
      }
      submit_contact_transaction: {
        Args: { p_consent: Json; p_lead: Json; p_outbox: Json }
        Returns: Json
      }
    }
    Enums: {
      app_role: "owner" | "adjuster" | "assistant" | "customer" | "partner"
      carrier_tenure: "lt_1_year" | "one_to_two_years" | "three_plus_years"
      cause_of_loss:
        | "wind"
        | "hail"
        | "wind_hail"
        | "hurricane"
        | "water"
        | "fire_smoke"
        | "flood"
        | "mold"
        | "other"
      claim_event_type:
        | "status"
        | "note"
        | "question"
        | "reply"
        | "document"
        | "system"
      claim_event_visibility: "internal" | "customer" | "partner" | "shared"
      claim_status:
        | "new_intake"
        | "under_review"
        | "lor_sent"
        | "lor_signed"
        | "documenting"
        | "filed"
        | "negotiating"
        | "settlement_offered"
        | "settled"
        | "closed"
        | "denied"
        | "reopened"
        | "rejected"
      consent_kind: "sms" | "email"
      document_kind:
        | "declarations"
        | "photo"
        | "contract"
        | "lor_unsigned"
        | "lor_signed"
        | "estimate"
        | "denial"
        | "correspondence"
        | "other"
      document_visibility: "internal" | "customer"
      lead_status: "new" | "contacted" | "converted" | "dismissed"
      lor_contract_type: "emergency" | "non_emergency" | "supplemental"
      outbox_status: "pending" | "sent" | "failed" | "dead"
      partner_company_status: "active" | "inactive"
      prior_claim_outcome:
        | "paid_nothing"
        | "paid_no_repairs"
        | "paid_repaired"
        | "unsure"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["owner", "adjuster", "assistant", "customer", "partner"],
      carrier_tenure: ["lt_1_year", "one_to_two_years", "three_plus_years"],
      cause_of_loss: [
        "wind",
        "hail",
        "wind_hail",
        "hurricane",
        "water",
        "fire_smoke",
        "flood",
        "mold",
        "other",
      ],
      claim_event_type: [
        "status",
        "note",
        "question",
        "reply",
        "document",
        "system",
      ],
      claim_event_visibility: ["internal", "customer", "partner", "shared"],
      claim_status: [
        "new_intake",
        "under_review",
        "lor_sent",
        "lor_signed",
        "documenting",
        "filed",
        "negotiating",
        "settlement_offered",
        "settled",
        "closed",
        "denied",
        "reopened",
        "rejected",
      ],
      consent_kind: ["sms", "email"],
      document_kind: [
        "declarations",
        "photo",
        "contract",
        "lor_unsigned",
        "lor_signed",
        "estimate",
        "denial",
        "correspondence",
        "other",
      ],
      document_visibility: ["internal", "customer"],
      lead_status: ["new", "contacted", "converted", "dismissed"],
      lor_contract_type: ["emergency", "non_emergency", "supplemental"],
      outbox_status: ["pending", "sent", "failed", "dead"],
      partner_company_status: ["active", "inactive"],
      prior_claim_outcome: [
        "paid_nothing",
        "paid_no_repairs",
        "paid_repaired",
        "unsure",
      ],
    },
  },
} as const

