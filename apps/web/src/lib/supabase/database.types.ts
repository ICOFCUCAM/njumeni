export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      organization_invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by_principal_id: string | null;
          created_at: string;
          created_by_principal_id: string;
          email_normalized: string;
          expires_at: string;
          id: string;
          organization_id: string;
          revoked_at: string | null;
          status: string;
          token_hash: string;
          updated_at: string;
          workspace_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          accepted_by_principal_id?: string | null;
          created_at?: string;
          created_by_principal_id?: string;
          email_normalized: string;
          expires_at: string;
          id?: string;
          organization_id: string;
          revoked_at?: string | null;
          status?: string;
          token_hash: string;
          updated_at?: string;
          workspace_id?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by_principal_id?: string | null;
          created_at?: string;
          created_by_principal_id?: string;
          email_normalized?: string;
          expires_at?: string;
          id?: string;
          organization_id?: string;
          revoked_at?: string | null;
          status?: string;
          token_hash?: string;
          updated_at?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_invitations_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_invitations_workspace_org_fkey';
            columns: ['workspace_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id', 'organization_id'];
          },
        ];
      };
      organization_memberships: {
        Row: {
          created_at: string;
          id: string;
          invited_by_principal_id: string | null;
          joined_at: string;
          organization_id: string;
          principal_id: string;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          invited_by_principal_id?: string | null;
          joined_at?: string;
          organization_id: string;
          principal_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          invited_by_principal_id?: string | null;
          joined_at?: string;
          organization_id?: string;
          principal_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_memberships_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          name: string;
          owner_principal_id: string;
          slug: string;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          kind: string;
          name: string;
          owner_principal_id?: string;
          slug: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          name?: string;
          owner_principal_id?: string;
          slug?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          family_name: string | null;
          given_name: string | null;
          locale: string;
          principal_id: string;
          timezone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          family_name?: string | null;
          given_name?: string | null;
          locale?: string;
          principal_id: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          family_name?: string | null;
          given_name?: string | null;
          locale?: string;
          principal_id?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspace_memberships: {
        Row: {
          created_at: string;
          id: string;
          invited_by_principal_id: string | null;
          joined_at: string;
          principal_id: string;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          invited_by_principal_id?: string | null;
          joined_at?: string;
          principal_id: string;
          status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          invited_by_principal_id?: string | null;
          joined_at?: string;
          principal_id?: string;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_memberships_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          created_by_principal_id: string;
          id: string;
          kind: string;
          name: string;
          organization_id: string;
          slug: string;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by_principal_id?: string;
          id?: string;
          kind: string;
          name: string;
          organization_id: string;
          slug: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by_principal_id?: string;
          id?: string;
          kind?: string;
          name?: string;
          organization_id?: string;
          slug?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspaces_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_organization_invitation: {
        Args: { p_token_hash: string };
        Returns: {
          organization_id: string;
          organization_membership_id: string;
          workspace_id: string;
          workspace_membership_id: string;
        }[];
      };
      ai_authorise_execution: {
        Args: {
          p_agent_key: string;
          p_egress_classes: string[];
          p_estimated_tokens: number;
          p_organization_id: string;
          p_provider_key: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      ai_get_workspace_settings: {
        Args: { p_organization_id: string; p_workspace_id: string };
        Returns: Json;
      };
      ai_record_execution: {
        Args: {
          p_agent_key: string;
          p_duration_ms: number;
          p_egress_classes: string[];
          p_input_refs: Json;
          p_input_tokens: number;
          p_model_id: string;
          p_organization_id: string;
          p_output_tokens: number;
          p_prompt_version: string;
          p_provider_key: string;
          p_refusal_reason: string;
          p_retrieval_refs: Json;
          p_safety_flags: string[];
          p_status: string;
          p_verification_outcome: string;
          p_workspace_id: string;
        };
        Returns: string;
      };
      ai_set_risk_classification: {
        Args: {
          p_class: string;
          p_conformity_reference?: string;
          p_organization_id: string;
          p_workspace_id: string;
        };
        Returns: undefined;
      };
      ai_update_workspace_settings: {
        Args: {
          p_allowed_egress: string[];
          p_allowed_providers: string[];
          p_monthly_token_budget: number;
          p_organization_id: string;
          p_workspace_id: string;
        };
        Returns: undefined;
      };
      api_key_create: {
        Args: {
          p_days?: number;
          p_name: string;
          p_organization_id: string;
          p_scopes: string[];
          p_workspace_id: string;
        };
        Returns: Json;
      };
      api_key_list: { Args: { p_organization_id: string; p_workspace_id: string }; Returns: Json };
      api_key_matter_list: { Args: { p_key: string }; Returns: Json };
      api_key_research_get_run: { Args: { p_key: string; p_run_id: string }; Returns: Json };
      api_key_revoke: { Args: { p_key_id: string }; Returns: undefined };
      argument_add_graph: {
        Args: { p_ai_execution_id?: string; p_edges: Json; p_issue_id: string; p_nodes: Json };
        Returns: Json;
      };
      argument_create_issue: {
        Args: {
          p_organization_id: string;
          p_research_run_id?: string;
          p_title: string;
          p_workspace_id: string;
        };
        Returns: string;
      };
      argument_get_graph: { Args: { p_issue_id: string }; Returns: Json };
      argument_list_issues: {
        Args: { p_organization_id: string; p_workspace_id: string };
        Returns: {
          created_at: string;
          issue_id: string;
          node_count: number;
          proposed_count: number;
          research_run_id: string;
          title: string;
        }[];
      };
      argument_review_node: { Args: { p_decision: string; p_node_id: string }; Returns: undefined };
      assign_organization_role: {
        Args: { p_organization_id: string; p_principal_id: string; p_role_key: string };
        Returns: string;
      };
      assign_workspace_role: {
        Args: {
          p_organization_id: string;
          p_principal_id: string;
          p_role_key: string;
          p_workspace_id: string;
        };
        Returns: string;
      };
      billing_generate_invoice: {
        Args: {
          p_organization_id: string;
          p_period_end: string;
          p_period_start: string;
          p_tax_rate_percent?: number;
        };
        Returns: string;
      };
      billing_grant_credits: {
        Args: { p_credits: number; p_note: string; p_organization_id: string };
        Returns: undefined;
      };
      billing_invoice_get: { Args: { p_invoice_id: string }; Returns: Json };
      billing_overview: { Args: { p_organization_id: string }; Returns: Json };
      billing_plans: { Args: Record<PropertyKey, never>; Returns: Json };
      billing_webhook: {
        Args: { p_payload: string; p_provider: string; p_signature: string };
        Returns: Json;
      };
      client_create: {
        Args: {
          p_contact_note?: string;
          p_identifier?: string;
          p_kind: string;
          p_name: string;
          p_organization_id: string;
        };
        Returns: string;
      };
      client_list: { Args: { p_organization_id: string }; Returns: Json };
      compliance_add_obligation: {
        Args: {
          p_authority_passage_id: string;
          p_description?: string;
          p_organization_id: string;
          p_review_interval_days?: number;
          p_title: string;
          p_workspace_id: string;
        };
        Returns: string;
      };
      compliance_assess: {
        Args: {
          p_evidence_item_id?: string;
          p_note: string;
          p_obligation_id: string;
          p_status: string;
        };
        Returns: undefined;
      };
      compliance_register: {
        Args: { p_organization_id: string; p_workspace_id: string };
        Returns: Json;
      };
      conflict_check_decide: {
        Args: { p_check_id: string; p_decision: string; p_note?: string };
        Returns: undefined;
      };
      conflict_check_list: { Args: { p_organization_id: string }; Returns: Json };
      conflict_check_run: {
        Args: {
          p_names: string[];
          p_organization_id: string;
          p_subject: string;
          p_workspace_id: string;
        };
        Returns: string;
      };
      document_create: {
        Args: {
          p_issue_id?: string;
          p_organization_id: string;
          p_research_run_id?: string;
          p_template_key: string;
          p_title: string;
          p_workspace_id: string;
        };
        Returns: string;
      };
      document_decide: {
        Args: { p_decision: string; p_document_id: string; p_note?: string };
        Returns: undefined;
      };
      document_get: { Args: { p_document_id: string; p_version?: number }; Returns: Json };
      document_list: { Args: { p_organization_id: string; p_workspace_id: string }; Returns: Json };
      document_list_templates: { Args: Record<PropertyKey, never>; Returns: Json };
      document_record_export: {
        Args: { p_document_id: string; p_format: string; p_sha256: string; p_version: number };
        Returns: boolean;
      };
      document_save_version: {
        Args: {
          p_ai_execution_id?: string;
          p_change_note?: string;
          p_citations?: Json;
          p_document_id: string;
          p_expected_version: number;
          p_sections: Json;
        };
        Returns: number;
      };
      document_submit: { Args: { p_document_id: string }; Returns: undefined };
      document_template_create: {
        Args: {
          p_document_type: string;
          p_name: string;
          p_organization_id: string;
          p_sections: Json;
        };
        Returns: string;
      };
      document_templates_for: { Args: { p_organization_id: string }; Returns: Json };
      document_withdraw: { Args: { p_document_id: string }; Returns: undefined };
      early_access_list: { Args: { p_status?: string }; Returns: Json };
      early_access_purge_expired: { Args: Record<PropertyKey, never>; Returns: number };
      early_access_request: {
        Args: {
          p_audience: string;
          p_consent: boolean;
          p_email: string;
          p_full_name: string;
          p_interest: string;
          p_jurisdictions: string[];
          p_message: string;
          p_organisation: string;
        };
        Returns: string;
      };
      early_access_set_status: {
        Args: { p_request_id: string; p_status: string };
        Returns: undefined;
      };
      evidence_add_event: {
        Args: {
          p_date_precision: string;
          p_description: string;
          p_event_date: string;
          p_evidence_item_id: string;
          p_passage_id?: string;
        };
        Returns: string;
      };
      evidence_add_redaction: {
        Args: {
          p_end_offset: number;
          p_passage_id: string;
          p_reason: string;
          p_start_offset: number;
        };
        Returns: string;
      };
      evidence_chronology: {
        Args: { p_organization_id: string; p_workspace_id: string };
        Returns: {
          date_precision: string;
          description: string;
          event_date: string;
          event_id: string;
          evidence_item_id: string;
          evidence_title: string;
          origin: string;
          passage_id: string;
        }[];
      };
      evidence_create_item: {
        Args: {
          p_evidence_type?: string;
          p_organization_id: string;
          p_privilege?: string;
          p_sensitivity?: string;
          p_title: string;
          p_workspace_id: string;
        };
        Returns: string;
      };
      evidence_create_proposition: {
        Args: { p_organization_id: string; p_statement: string; p_workspace_id: string };
        Returns: string;
      };
      evidence_custody_log: {
        Args: { p_evidence_item_id: string };
        Returns: {
          actor_kind: string;
          event_type: string;
          item_sequence: number;
          occurred_at: string;
          record_hash: string;
        }[];
      };
      evidence_link_proposition: {
        Args: {
          p_evidence_item_id: string;
          p_note?: string;
          p_passage_id?: string;
          p_proposition_id: string;
          p_relation: string;
        };
        Returns: string;
      };
      evidence_list_entities: {
        Args: { p_evidence_item_id: string };
        Returns: {
          entity_type: string;
          normalised_value: string;
          passage_id: string;
          raw_value: string;
        }[];
      };
      evidence_list_items: {
        Args: { p_organization_id: string; p_workspace_id: string };
        Returns: {
          created_at: string;
          event_count: number;
          evidence_item_id: string;
          evidence_type: string;
          latest_filename: string;
          latest_scan_status: string;
          latest_version: number;
          legal_hold: boolean;
          passage_count: number;
          privilege: string;
          sensitivity: string;
          status: string;
          title: string;
        }[];
      };
      evidence_list_propositions: {
        Args: { p_organization_id: string; p_workspace_id: string };
        Returns: Json;
      };
      evidence_proposition_conflicts: {
        Args: { p_organization_id: string; p_workspace_id: string };
        Returns: {
          contradicting_items: number;
          proposition_id: string;
          qualifying_items: number;
          statement: string;
          status: string;
          supporting_items: number;
        }[];
      };
      evidence_read_passages: {
        Args: { p_evidence_item_id: string };
        Returns: {
          content: string;
          ordinal: number;
          page_number: number;
          passage_id: string;
          redaction_count: number;
        }[];
      };
      evidence_register_file: {
        Args: {
          p_byte_size: number;
          p_content_sha256: string;
          p_evidence_item_id: string;
          p_mime_type: string;
          p_original_filename: string;
          p_storage_object_key: string;
        };
        Returns: string;
      };
      evidence_request_deletion: {
        Args: { p_evidence_item_id: string; p_reason: string };
        Returns: undefined;
      };
      evidence_set_legal_hold: {
        Args: { p_evidence_item_id: string; p_hold: boolean; p_reason: string };
        Returns: undefined;
      };
      evidence_verify_custody: { Args: { p_evidence_item_id: string }; Returns: Json };
      evidence_worker_pending_files: {
        Args: { p_limit?: number };
        Returns: {
          byte_size: number;
          content_sha256: string;
          evidence_file_id: string;
          evidence_item_id: string;
          mime_type: string;
          needs_extraction: boolean;
          organization_id: string;
          original_filename: string;
          scan_status: string;
          storage_object_key: string;
          workspace_id: string;
        }[];
      };
      evidence_worker_record_extraction: {
        Args: {
          p_entities: Json;
          p_events: Json;
          p_evidence_file_id: string;
          p_extractor: string;
          p_extractor_version: string;
          p_failure_code: string;
          p_page_count: number;
          p_passages: Json;
          p_status: string;
          p_text_sha256: string;
        };
        Returns: string;
      };
      evidence_worker_record_scan: {
        Args: {
          p_detail: string;
          p_evidence_file_id: string;
          p_observed_sha256: string;
          p_verdict: string;
        };
        Returns: undefined;
      };
      get_organization_entitlements: {
        Args: { p_organization_id: string };
        Returns: {
          effective_from: string;
          effective_until: string;
          enabled: boolean;
          entitlement_key: string;
          limit_value: number;
          plan_key: string;
          subscription_status: string;
        }[];
      };
      glci_agent_dispatch_create: {
        Args: {
          p_conversation_id: string;
          p_dispatch_id: string;
          p_question_sequence: number;
          p_session_url: string;
        };
        Returns: string;
      };
      glci_agent_reply: {
        Args: { p_content: string; p_data?: Json; p_dispatch_id: string };
        Returns: number;
      };
      glci_ai_record_call: {
        Args: {
          p_conversation_id: string;
          p_cost_usd: number;
          p_engine: string;
          p_input_tokens: number;
          p_model: string;
          p_outcome: string;
          p_output_tokens: number;
          p_reason: string;
        };
        Returns: undefined;
      };
      glci_ai_settings_get: { Args: Record<PropertyKey, never>; Returns: Json };
      glci_ai_settings_set: {
        Args: {
          p_anthropic_model: string;
          p_fallback_enabled: boolean;
          p_monthly_budget_usd: number;
          p_primary_engine: string;
          p_reason: string;
        };
        Returns: Json;
      };
      glci_audit_checkpoint: { Args: Record<PropertyKey, never>; Returns: Json };
      glci_audit_export: { Args: { p_from?: number; p_to?: number }; Returns: Json };
      glci_audit_feed: { Args: { p_limit?: number }; Returns: Json };
      glci_change_event_sections: { Args: { p_event_id: string }; Returns: Json };
      glci_change_events: {
        Args: { p_include_baseline?: boolean; p_jurisdiction_code?: string; p_limit?: number };
        Returns: Json;
      };
      glci_change_impacts: { Args: { p_event_id: string }; Returns: Json };
      glci_command_conversation: { Args: { p_conversation_id: string }; Returns: Json };
      glci_command_record: {
        Args: {
          p_author_kind: string;
          p_content: string;
          p_conversation_id: string;
          p_data: Json;
          p_engine: string;
          p_intent: string;
        };
        Returns: number;
      };
      glci_continuous_status: { Args: Record<PropertyKey, never>; Returns: Json };
      glci_conversation_dispatches: { Args: { p_conversation_id: string }; Returns: Json };
      glci_currency: { Args: { p_jurisdiction_code: string }; Returns: Json };
      glci_currency_overview: { Args: Record<PropertyKey, never>; Returns: Json };
      glci_decide_action: {
        Args: { p_decision: string; p_note: string; p_request_id: string };
        Returns: Json;
      };
      glci_decide_proposal: {
        Args: { p_decision: string; p_note: string; p_proposal_id: string };
        Returns: string;
      };
      glci_dismiss_issue: { Args: { p_issue_id: string; p_reason: string }; Returns: undefined };
      glci_engineering_task_brief: { Args: { p_task_id: string }; Returns: Json };
      glci_engineering_task_dispatch_failed: {
        Args: { p_error: string; p_task_id: string };
        Returns: undefined;
      };
      glci_engineering_task_dispatched: {
        Args: { p_executor: string; p_session_url: string; p_task_id: string };
        Returns: undefined;
      };
      glci_engineering_task_report: {
        Args: {
          p_error?: string;
          p_pull_request_url: string;
          p_status: string;
          p_summary: string;
          p_task_id: string;
        };
        Returns: string;
      };
      glci_engineering_tasks_list: { Args: { p_limit?: number }; Returns: Json };
      glci_examine_authorities: {
        Args: { p_jurisdiction_code: string; p_limit?: number; p_terms: string[] };
        Returns: Json;
      };
      glci_execute_proposal: { Args: { p_proposal_id: string }; Returns: Json };
      glci_governance_report: { Args: Record<PropertyKey, never>; Returns: Json };
      glci_issues_list: { Args: { p_status?: string }; Returns: Json };
      glci_monitor_claim: {
        Args: { p_lease_seconds?: number; p_limit?: number; p_worker_id: string };
        Returns: {
          config: Json;
          jurisdiction_code: string;
          lease_token: string;
          monitor_adapter_key: string;
          official_uri: string;
          previous_fingerprint: string;
          source_key: string;
          target_key: string;
        }[];
      };
      glci_monitor_record: {
        Args: {
          p_duration_ms: number;
          p_failure_class: string;
          p_failure_code: string;
          p_fingerprint: string;
          p_lease_token: string;
          p_observed: Json;
          p_target_key: string;
        };
        Returns: string;
      };
      glci_monitoring_status: { Args: Record<PropertyKey, never>; Returns: Json };
      glci_observatory: { Args: Record<PropertyKey, never>; Returns: Json };
      glci_onboarding_register: { Args: Record<PropertyKey, never>; Returns: Json };
      glci_reanalyse_change: { Args: { p_event_id: string }; Returns: number };
      glci_reconcile_issues: { Args: Record<PropertyKey, never>; Returns: Json };
      glci_record_deployment: {
        Args: {
          p_checksum: string;
          p_description: string;
          p_kind: string;
          p_outcome: string;
          p_reference: string;
          p_request_id: string;
          p_verification: Json;
        };
        Returns: string;
      };
      glci_register_target: {
        Args: {
          p_config?: Json;
          p_jurisdiction_code: string;
          p_monitor_adapter_key: string;
          p_name: string;
          p_notes?: string;
          p_official_uri: string;
          p_source_key: string;
          p_target_key: string;
          p_target_type: string;
        };
        Returns: string;
      };
      glci_registry: { Args: Record<PropertyKey, never>; Returns: Json };
      glci_request_action: {
        Args: { p_action_type: string; p_payload: Json; p_reason: string; p_subject: string };
        Returns: string;
      };
      glci_request_check: { Args: { p_target_key: string }; Returns: undefined };
      glci_request_engineering_task: {
        Args: {
          p_conversation_id?: string;
          p_instruction: string;
          p_jurisdiction_code: string;
          p_target_key: string;
        };
        Returns: Json;
      };
      glci_run_currency_verification: { Args: { p_jurisdiction_code?: string }; Returns: Json };
      glci_run_recovery_drill: { Args: Record<PropertyKey, never>; Returns: Json };
      glci_set_governance_policy: {
        Args: { p_reason: string; p_require_two_person: boolean };
        Returns: undefined;
      };
      glci_set_target_monitor: {
        Args: { p_adapter_key: string; p_config: Json; p_reason: string; p_target_key: string };
        Returns: undefined;
      };
      glci_set_target_status: {
        Args: { p_reason: string; p_status: string; p_target_key: string };
        Returns: string;
      };
      glci_target_observations: { Args: { p_limit?: number; p_target_key: string }; Returns: Json };
      glci_tick: { Args: Record<PropertyKey, never>; Returns: Json };
      glci_upsert_jurisdiction_profile: {
        Args: { p_jurisdiction_code: string; p_profile: Json };
        Returns: undefined;
      };
      glci_verify_audit_chain: { Args: Record<PropertyKey, never>; Returns: Json };
      glci_worker_heartbeat: {
        Args: { p_summary: Json; p_worker_id: string; p_worker_kind: string };
        Returns: undefined;
      };
      has_permission: {
        Args: { p_organization_id: string; p_permission_key: string; p_workspace_id?: string };
        Returns: boolean;
      };
      institutional_report: { Args: { p_organization_id: string }; Returns: Json };
      is_organization_owner: { Args: { p_organization_id: string }; Returns: boolean };
      jurisdiction_readiness: { Args: Record<PropertyKey, never>; Returns: Json };
      knowledge_get: { Args: { p_item_id: string }; Returns: Json };
      knowledge_publish: {
        Args: {
          p_body: string;
          p_kind: string;
          p_organization_id: string;
          p_review_due?: string;
          p_source_id?: string;
          p_source_type?: string;
          p_tags?: string[];
          p_title: string;
        };
        Returns: string;
      };
      knowledge_retire: { Args: { p_item_id: string }; Returns: undefined };
      knowledge_search: {
        Args: { p_kind?: string; p_organization_id: string; p_query?: string };
        Returns: Json;
      };
      legal_authority_graph: {
        Args: {
          p_as_of?: string;
          p_max_depth?: number;
          p_max_nodes?: number;
          p_relationship_types?: string[];
          p_root_authority_id: string;
        };
        Returns: Json;
      };
      legal_authority_version_as_of: {
        Args: { p_authority_id: string; p_known_at?: string; p_valid_on: string };
        Returns: {
          authority_version_id: string;
          normalised_content_hash: string;
          recorded_at: string;
          source_content_hash: string;
          source_uri: string;
          valid_from: string;
          valid_until: string;
          version_number: number;
        }[];
      };
      legal_citation_source_metadata: { Args: { p_source_keys: string[] }; Returns: Json };
      legal_embedding_pending_passages: {
        Args: { p_limit?: number; p_profile_key: string };
        Returns: {
          content: string;
          language_code: string;
          passage_id: string;
        }[];
      };
      legal_embedding_store: {
        Args: { p_embeddings: Json; p_profile_key: string };
        Returns: number;
      };
      legal_glossary_terms: {
        Args: { p_languages: string[] };
        Returns: {
          concept_key: string;
          language_code: string;
          preferred: boolean;
          term: string;
        }[];
      };
      legal_ingestion_append_authority: {
        Args: {
          p_authority: Json;
          p_job_id: string;
          p_jurisdiction_code: string;
          p_lease_token: string;
          p_normalisation_profile: string;
          p_passages: Json;
          p_retrieved_at: string;
          p_source_key: string;
          p_source_uri: string;
        };
        Returns: string;
      };
      legal_ingestion_append_relationship: {
        Args: {
          p_effective_from: string;
          p_from_external_id: string;
          p_job_id: string;
          p_lease_token: string;
          p_provenance_uri: string;
          p_relationship_type: string;
          p_source_key: string;
          p_source_note: string;
          p_to_external_id: string;
        };
        Returns: boolean;
      };
      legal_ingestion_begin_run: {
        Args: {
          p_adapter_key: string;
          p_adapter_version: string;
          p_batch_key: string;
          p_cursor: string;
          p_source_key: string;
        };
        Returns: string;
      };
      legal_ingestion_claim_job: {
        Args: { p_lease_seconds?: number; p_worker_id: string };
        Returns: {
          adapter_key: string;
          adapter_version: string;
          attempt_count: number;
          checkpoint: Json;
          cursor_reference: string;
          job_id: string;
          lease_token: string;
          source_id: string;
        }[];
      };
      legal_ingestion_complete_dataset_sync: {
        Args: {
          p_dataset: string;
          p_dataset_last_modified: string;
          p_dataset_sha256: string;
          p_dataset_size_bytes: number;
          p_job_id: string;
          p_lease_token: string;
          p_listed_external_ids: string[];
          p_retrieved_at: string;
          p_source_key: string;
          p_source_uri: string;
        };
        Returns: Json;
      };
      legal_ingestion_due_item_retries: {
        Args: { p_limit?: number; p_source_key: string };
        Returns: string[];
      };
      legal_ingestion_enqueue_continuation: {
        Args: { p_idempotency_key: string; p_max_attempts?: number; p_previous_job_id: string };
        Returns: string;
      };
      legal_ingestion_enqueue_job: {
        Args: {
          p_adapter_key: string;
          p_adapter_version: string;
          p_idempotency_key: string;
          p_max_attempts?: number;
          p_source_id: string;
        };
        Returns: string;
      };
      legal_ingestion_finish_job: {
        Args: {
          p_failure_code?: string;
          p_job_id: string;
          p_lease_token: string;
          p_retry_delay_seconds?: number;
          p_status: string;
        };
        Returns: string;
      };
      legal_ingestion_heartbeat: {
        Args: { p_job_id: string; p_lease_seconds?: number; p_lease_token: string };
        Returns: boolean;
      };
      legal_ingestion_last_dataset_sync: {
        Args: { p_dataset: string; p_source_key: string };
        Returns: Json;
      };
      legal_ingestion_persist_run_result: {
        Args: {
          p_created: number;
          p_discovered: number;
          p_failure_codes: string[];
          p_next_cursor: string;
          p_run_id: string;
          p_skipped: number;
          p_status: string;
          p_unchanged: number;
        };
        Returns: boolean;
      };
      legal_ingestion_record_item_outcome: {
        Args: {
          p_external_id: string;
          p_failure_class: string;
          p_failure_code: string;
          p_job_id: string;
          p_lease_token: string;
          p_source_key: string;
          p_succeeded: boolean;
        };
        Returns: string;
      };
      legal_ingestion_save_checkpoint: {
        Args: {
          p_completed_external_ids: string[];
          p_created: number;
          p_cursor: string;
          p_discovered: number;
          p_failures: number;
          p_job_id: string;
          p_lease_token: string;
          p_skipped: number;
          p_unchanged: number;
        };
        Returns: boolean;
      };
      legal_jurisdiction_coverage_snapshot: {
        Args: { p_jurisdiction_code: string };
        Returns: Json;
      };
      legal_jurisdiction_record_coverage_scope: {
        Args: {
          p_authority_types: string[];
          p_jurisdiction_code: string;
          p_reason: string;
          p_review_interval_days: number;
          p_reviewer: string;
        };
        Returns: Json;
      };
      legal_record_retrieval_evaluation: {
        Args: {
          p_case_count: number;
          p_code_revision: string;
          p_content_licence: string;
          p_dataset_key: string;
          p_dataset_version: number;
          p_gates: Json;
          p_jurisdiction_code: string;
          p_metrics: Json;
          p_passed: boolean;
          p_recorded_by: string;
        };
        Returns: string;
      };
      legal_refresh_authority_centroids: { Args: { p_profile_key: string }; Returns: number };
      legal_route_authorities: {
        Args: {
          p_as_of_date: string;
          p_authority_types?: string[];
          p_embedding: string;
          p_embedding_model_key: string;
          p_jurisdiction_code: string;
          p_language_codes: string[];
          p_limit?: number;
        };
        Returns: {
          authority_id: string;
          authority_version_id: string;
          route_score: number;
        }[];
      };
      legal_search_passages_lexical: {
        Args: {
          p_as_of_date: string;
          p_authority_types?: string[];
          p_jurisdiction_code: string;
          p_language_codes: string[];
          p_limit?: number;
          p_query: string;
        };
        Returns: {
          authority_id: string;
          authority_title: string;
          authority_type: string;
          authority_version_id: string;
          citation: string;
          jurisdiction_code: string;
          language_code: string;
          legal_status: string;
          lexical_score: number;
          page_number: number;
          passage_content: string;
          passage_id: string;
          section_path: string[];
          source_content_hash: string;
          source_key: string;
          source_uri: string;
          valid_from: string;
          valid_until: string;
        }[];
      };
      legal_search_passages_semantic: {
        Args: {
          p_as_of_date: string;
          p_authority_types?: string[];
          p_embedding: string;
          p_embedding_model_key: string;
          p_jurisdiction_code: string;
          p_language_codes: string[];
          p_limit?: number;
        };
        Returns: {
          authority_id: string;
          authority_title: string;
          authority_type: string;
          authority_version_id: string;
          citation: string;
          jurisdiction_code: string;
          language_code: string;
          legal_status: string;
          page_number: number;
          passage_content: string;
          passage_id: string;
          section_path: string[];
          semantic_score: number;
          source_content_hash: string;
          source_key: string;
          source_uri: string;
          valid_from: string;
          valid_until: string;
        }[];
      };
      legal_search_passages_semantic_within: {
        Args: {
          p_as_of_date: string;
          p_authority_ids: string[];
          p_embedding: string;
          p_embedding_model_key: string;
          p_jurisdiction_code: string;
          p_language_codes: string[];
          p_limit?: number;
        };
        Returns: {
          authority_id: string;
          authority_title: string;
          authority_type: string;
          authority_version_id: string;
          citation: string;
          jurisdiction_code: string;
          language_code: string;
          legal_status: string;
          page_number: number;
          passage_content: string;
          passage_id: string;
          section_path: string[];
          semantic_score: number;
          source_content_hash: string;
          source_key: string;
          source_uri: string;
          valid_from: string;
          valid_until: string;
        }[];
      };
      legal_source_licence_policy_get: { Args: { p_source_key: string }; Returns: Json };
      legal_source_record_coverage_review: {
        Args: {
          p_authority_types: string[];
          p_coverage_from: string;
          p_coverage_until: string;
          p_known_gaps?: string[];
          p_languages: string[];
          p_last_verified_at: string;
          p_reason: string;
          p_reviewer: string;
          p_source_id: string;
        };
        Returns: Json;
      };
      legal_source_record_licence_policy: {
        Args: {
          p_acquisition_hosts: string[];
          p_attribution_text: string;
          p_conditions: string[];
          p_evidence_uris: string[];
          p_legal_basis: string;
          p_licence_identifier: string;
          p_licence_uri: string;
          p_permitted_datasets: string[];
          p_permitted_uses: Json;
          p_recorded_by: string;
          p_source_key: string;
        };
        Returns: number;
      };
      legal_source_record_rights_review: {
        Args: {
          p_attribution_text: string;
          p_licence_identifier: string;
          p_licence_version: string;
          p_permissions: Json;
          p_restrictions?: string[];
          p_review_expires_at: string;
          p_reviewed_at: string;
          p_reviewer: string;
          p_source_id: string;
          p_terms_uri: string;
        };
        Returns: Json;
      };
      legal_source_set_activation: {
        Args: {
          p_adapter_key: string;
          p_adapter_version: string;
          p_ingestion_enabled: boolean;
          p_operator: string;
          p_reason: string;
          p_source_id: string;
          p_status: string;
        };
        Returns: Json;
      };
      legal_worker_source_config: { Args: { p_source_id: string }; Returns: Json };
      list_assignable_roles: {
        Args: { p_organization_id: string; p_workspace_id?: string };
        Returns: {
          description: string;
          display_name: string;
          role_key: string;
          scope: string;
        }[];
      };
      list_role_bindings: {
        Args: { p_organization_id: string; p_workspace_id?: string };
        Returns: {
          assigned_at: string;
          binding_id: string;
          principal_id: string;
          role_key: string;
          role_name: string;
        }[];
      };
      list_security_audit_events: {
        Args: {
          p_before_sequence?: number;
          p_limit?: number;
          p_organization_id: string;
          p_workspace_id?: string;
        };
        Returns: {
          actor_principal_id: string;
          correlation_id: string;
          event_id: string;
          event_key: string;
          metadata: Json;
          occurred_at: string;
          organization_id: string;
          outcome: string;
          resource_id: string;
          resource_type: string;
          sequence_id: number;
          workspace_id: string;
        }[];
      };
      matter_add_barrier: {
        Args: { p_matter_id: string; p_principal_id: string; p_reason: string };
        Returns: undefined;
      };
      matter_add_deadline: {
        Args: {
          p_basis?: string;
          p_due_at: string;
          p_location?: string;
          p_matter_id: string;
          p_title: string;
          p_type: string;
        };
        Returns: string;
      };
      matter_add_party: {
        Args: {
          p_contact_note?: string;
          p_matter_id: string;
          p_name: string;
          p_represents_party_id?: string;
          p_role: string;
        };
        Returns: string;
      };
      matter_add_task: {
        Args: {
          p_assignee_principal_id?: string;
          p_description?: string;
          p_due_date?: string;
          p_matter_id: string;
          p_priority?: string;
          p_title: string;
        };
        Returns: string;
      };
      matter_assign: {
        Args: { p_matter_id: string; p_principal_id: string; p_role: string };
        Returns: undefined;
      };
      matter_assign_team: { Args: { p_matter_id: string; p_unit_id: string }; Returns: number };
      matter_create: {
        Args: {
          p_description?: string;
          p_intake?: Json;
          p_jurisdiction_code: string;
          p_legal_category: string;
          p_organization_id: string;
          p_title: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      matter_get: { Args: { p_matter_id: string }; Returns: Json };
      matter_link: {
        Args: { p_link_type: string; p_matter_id: string; p_target_id: string };
        Returns: undefined;
      };
      matter_list: { Args: { p_organization_id: string; p_workspace_id: string }; Returns: Json };
      matter_my_agenda: { Args: { p_days?: number }; Returns: Json };
      matter_open_checked: {
        Args: {
          p_client_id?: string;
          p_conflict_check_id: string;
          p_description?: string;
          p_intake?: Json;
          p_jurisdiction_code: string;
          p_legal_category: string;
          p_organization_id: string;
          p_title: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      matter_professional: { Args: { p_matter_id: string }; Returns: Json };
      matter_record_event: {
        Args: {
          p_detail?: Json;
          p_event_type: string;
          p_matter_id: string;
          p_occurred_at?: string;
          p_summary: string;
        };
        Returns: undefined;
      };
      matter_record_export: {
        Args: { p_files: number; p_matter_id: string; p_sha256: string };
        Returns: undefined;
      };
      matter_set_status: {
        Args: { p_matter_id: string; p_note?: string; p_status: string };
        Returns: undefined;
      };
      matter_team_candidates: { Args: { p_matter_id: string }; Returns: Json };
      matter_update_deadline: {
        Args: { p_deadline_id: string; p_status: string };
        Returns: undefined;
      };
      matter_update_task: { Args: { p_status: string; p_task_id: string }; Returns: undefined };
      org_member_directory: { Args: { p_organization_id: string }; Returns: Json };
      org_structure: { Args: { p_organization_id: string }; Returns: Json };
      org_unit_add_member: {
        Args: { p_principal_id: string; p_unit_id: string };
        Returns: undefined;
      };
      org_unit_create: {
        Args: {
          p_kind: string;
          p_location?: string;
          p_name: string;
          p_organization_id: string;
          p_parent_id?: string;
        };
        Returns: string;
      };
      organization_get_settings: { Args: { p_organization_id: string }; Returns: Json };
      organization_update_settings: {
        Args: {
          p_organization_id: string;
          p_require_conflict_check: boolean;
          p_validity_days?: number;
        };
        Returns: undefined;
      };
      platform_commercial_analytics: { Args: Record<PropertyKey, never>; Returns: Json };
      platform_health: { Args: Record<PropertyKey, never>; Returns: Json };
      platform_is_operator: { Args: Record<PropertyKey, never>; Returns: boolean };
      platform_operations_status: { Args: Record<PropertyKey, never>; Returns: Json };
      platform_overview: { Args: Record<PropertyKey, never>; Returns: Json };
      platform_verify_sso_domain: { Args: { p_domain: string }; Returns: undefined };
      professional_report: {
        Args: { p_organization_id: string; p_workspace_id: string };
        Returns: Json;
      };
      record_usage_event: {
        Args: {
          p_idempotency_key: string;
          p_metadata?: Json;
          p_organization_id: string;
          p_quantity: number;
          p_unit: string;
          p_usage_key: string;
          p_workspace_id: string;
        };
        Returns: string;
      };
      research_authority_context: {
        Args: {
          p_as_of_date: string;
          p_authority_ids: string[];
          p_organization_id: string;
          p_workspace_id: string;
        };
        Returns: {
          after_as_of: boolean;
          effective_from: string;
          from_authority_id: string;
          relationship_type: string;
          to_authority_id: string;
          to_citation: string;
          to_title: string;
        }[];
      };
      research_get_run: { Args: { p_run_id: string }; Returns: Json };
      research_list_jurisdictions: {
        Args: Record<PropertyKey, never>;
        Returns: {
          code: string;
          coverage_level: string;
          name: string;
          official_languages: string[];
        }[];
      };
      research_list_jurisdictions_profile: {
        Args: Record<PropertyKey, never>;
        Returns: {
          citation_style: string;
          code: string;
          coverage_level: string;
          name: string;
          official_languages: string[];
          parent_code: string;
        }[];
      };
      research_list_runs: {
        Args: { p_organization_id: string; p_workspace_id: string };
        Returns: {
          as_of_date: string;
          created_at: string;
          failed_claims: number;
          jurisdiction_code: string;
          question: string;
          run_id: string;
          status: string;
          verified_claims: number;
        }[];
      };
      research_question_list: { Args: Record<PropertyKey, never>; Returns: Json };
      research_question_purge_expired: { Args: Record<PropertyKey, never>; Returns: number };
      research_question_submit: {
        Args: {
          p_as_of_date: string;
          p_consent: boolean;
          p_contact_email: string;
          p_jurisdiction_code: string;
          p_question: string;
          p_response_language: string;
        };
        Returns: string;
      };
      research_record_run: {
        Args: {
          p_as_of_date: string;
          p_claims: Json;
          p_engine_version: string;
          p_findings: Json;
          p_jurisdiction_code: string;
          p_language_codes: string[];
          p_limitations: Json;
          p_organization_id: string;
          p_question: string;
          p_retrieval_mode: string;
          p_workspace_id: string;
        };
        Returns: string;
      };
      research_route_authorities: {
        Args: {
          p_as_of_date: string;
          p_authority_types?: string[];
          p_embedding: string;
          p_embedding_model_key: string;
          p_jurisdiction_code: string;
          p_language_codes: string[];
          p_limit?: number;
          p_organization_id: string;
          p_workspace_id: string;
        };
        Returns: {
          authority_id: string;
          authority_version_id: string;
          route_score: number;
        }[];
      };
      research_run_currency_notices: { Args: { p_run_id: string }; Returns: Json };
      research_search_lexical: {
        Args: {
          p_as_of_date: string;
          p_authority_types?: string[];
          p_jurisdiction_code: string;
          p_language_codes: string[];
          p_limit?: number;
          p_organization_id: string;
          p_query: string;
          p_workspace_id: string;
        };
        Returns: {
          authority_id: string;
          authority_title: string;
          authority_type: string;
          authority_version_id: string;
          citation: string;
          jurisdiction_code: string;
          language_code: string;
          legal_status: string;
          lexical_score: number;
          page_number: number;
          passage_content: string;
          passage_id: string;
          section_path: string[];
          source_content_hash: string;
          source_key: string;
          source_uri: string;
          valid_from: string;
          valid_until: string;
        }[];
      };
      research_search_semantic: {
        Args: {
          p_as_of_date: string;
          p_authority_types?: string[];
          p_embedding: string;
          p_embedding_model_key: string;
          p_jurisdiction_code: string;
          p_language_codes: string[];
          p_limit?: number;
          p_organization_id: string;
          p_workspace_id: string;
        };
        Returns: {
          authority_id: string;
          authority_title: string;
          authority_type: string;
          authority_version_id: string;
          citation: string;
          jurisdiction_code: string;
          language_code: string;
          legal_status: string;
          page_number: number;
          passage_content: string;
          passage_id: string;
          section_path: string[];
          semantic_score: number;
          source_content_hash: string;
          source_key: string;
          source_uri: string;
          valid_from: string;
          valid_until: string;
        }[];
      };
      research_search_semantic_within: {
        Args: {
          p_as_of_date: string;
          p_authority_ids: string[];
          p_embedding: string;
          p_embedding_model_key: string;
          p_jurisdiction_code: string;
          p_language_codes: string[];
          p_limit?: number;
          p_organization_id: string;
          p_workspace_id: string;
        };
        Returns: {
          authority_id: string;
          authority_title: string;
          authority_type: string;
          authority_version_id: string;
          citation: string;
          jurisdiction_code: string;
          language_code: string;
          legal_status: string;
          page_number: number;
          passage_content: string;
          passage_id: string;
          section_path: string[];
          semantic_score: number;
          source_content_hash: string;
          source_key: string;
          source_uri: string;
          valid_from: string;
          valid_until: string;
        }[];
      };
      research_source_permissions: {
        Args: { p_organization_id: string; p_source_keys: string[]; p_workspace_id: string };
        Returns: {
          attribution_text: string;
          display_permitted: boolean;
          licence_identifier: string;
          quote_permitted: boolean;
          source_key: string;
        }[];
      };
      retention_report: { Args: { p_organization_id: string }; Returns: Json };
      retention_set_policy: {
        Args: { p_class: string; p_organization_id: string; p_years: number };
        Returns: undefined;
      };
      review_decide: {
        Args: { p_decision: string; p_note?: string; p_request_id: string };
        Returns: undefined;
      };
      review_list: {
        Args: { p_organization_id: string; p_status?: string; p_workspace_id: string };
        Returns: Json;
      };
      review_request_create: {
        Args: {
          p_gate: string;
          p_organization_id: string;
          p_reason: string;
          p_subject_id: string;
          p_subject_type: string;
          p_workspace_id: string;
        };
        Returns: string;
      };
      revoke_organization_invitation: { Args: { p_invitation_id: string }; Returns: boolean };
      revoke_organization_role: { Args: { p_binding_id: string }; Returns: boolean };
      revoke_workspace_role: { Args: { p_binding_id: string }; Returns: boolean };
      schema_fingerprint: { Args: Record<PropertyKey, never>; Returns: Json };
      set_organization_membership_status: {
        Args: { p_membership_id: string; p_status: string };
        Returns: boolean;
      };
      set_workspace_membership_status: {
        Args: { p_membership_id: string; p_status: string };
        Returns: boolean;
      };
      sso_add_domain: { Args: { p_domain: string; p_organization_id: string }; Returns: Json };
      sso_configure: {
        Args: {
          p_enforced?: boolean;
          p_issuer: string;
          p_metadata_url?: string;
          p_organization_id: string;
          p_protocol: string;
        };
        Returns: undefined;
      };
      sso_discover: { Args: { p_email: string }; Returns: Json };
      sso_status: { Args: { p_organization_id: string }; Returns: Json };
      support_access_decide: {
        Args: { p_decision: string; p_request_id: string };
        Returns: undefined;
      };
      support_access_list: { Args: { p_organization_id: string }; Returns: Json };
      support_access_request: {
        Args: { p_minutes: number; p_organization_id: string; p_reason: string };
        Returns: string;
      };
      verification_check_research_run: {
        Args: { p_check_date?: string; p_run_id: string };
        Returns: Json;
      };
      verification_get_run_quality: { Args: { p_run_id: string }; Returns: Json };
      verify_security_audit_chain: { Args: Record<PropertyKey, never>; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
