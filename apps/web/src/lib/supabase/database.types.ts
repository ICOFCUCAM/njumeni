
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "organization_invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by_principal_id": string | null,"created_at": string,"created_by_principal_id": string,"email_normalized": string,"expires_at": string,"id": string,"organization_id": string,"revoked_at": string | null,"status": string,"token_hash": string,"updated_at": string,"workspace_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by_principal_id"?: string | null,"created_at"?: string,"created_by_principal_id"?: string,"email_normalized": string,"expires_at": string,"id"?: string,"organization_id": string,"revoked_at"?: string | null,"status"?: string,"token_hash": string,"updated_at"?: string,"workspace_id"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by_principal_id"?: string | null,"created_at"?: string,"created_by_principal_id"?: string,"email_normalized"?: string,"expires_at"?: string,"id"?: string,"organization_id"?: string,"revoked_at"?: string | null,"status"?: string,"token_hash"?: string,"updated_at"?: string,"workspace_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_invitations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "organization_invitations_workspace_org_fkey"
      columns: ["workspace_id","organization_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"organization_memberships": {
                  Row: {
                    "created_at": string,"id": string,"invited_by_principal_id": string | null,"joined_at": string,"organization_id": string,"principal_id": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"invited_by_principal_id"?: string | null,"joined_at"?: string,"organization_id": string,"principal_id": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"invited_by_principal_id"?: string | null,"joined_at"?: string,"organization_id"?: string,"principal_id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_memberships_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"name": string,"owner_principal_id": string,"slug": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind": string,"name": string,"owner_principal_id"?: string,"slug": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"name"?: string,"owner_principal_id"?: string,"slug"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"display_name": string | null,"family_name": string | null,"given_name": string | null,"locale": string,"principal_id": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string | null,"family_name"?: string | null,"given_name"?: string | null,"locale"?: string,"principal_id": string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string | null,"family_name"?: string | null,"given_name"?: string | null,"locale"?: string,"principal_id"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"workspace_memberships": {
                  Row: {
                    "created_at": string,"id": string,"invited_by_principal_id": string | null,"joined_at": string,"principal_id": string,"status": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"invited_by_principal_id"?: string | null,"joined_at"?: string,"principal_id": string,"status"?: string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"invited_by_principal_id"?: string | null,"joined_at"?: string,"principal_id"?: string,"status"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_memberships_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "created_at": string,"created_by_principal_id": string,"id": string,"kind": string,"name": string,"organization_id": string,"slug": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by_principal_id"?: string,"id"?: string,"kind": string,"name": string,"organization_id": string,"slug": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by_principal_id"?: string,"id"?: string,"kind"?: string,"name"?: string,"organization_id"?: string,"slug"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspaces_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_organization_invitation":
{ Args: { "p_token_hash": string }; Returns: {
              "organization_id": string,"organization_membership_id": string,"workspace_id": string,"workspace_membership_id": string
            }[]
                           },
"ai_authorise_execution":
{ Args: { "p_agent_key": string,"p_egress_classes": (string)[],"p_estimated_tokens": number,"p_organization_id": string,"p_provider_key": string,"p_workspace_id": string }; Returns: Json
                           },
"ai_get_workspace_settings":
{ Args: { "p_organization_id": string,"p_workspace_id": string }; Returns: Json
                           },
"ai_record_execution":
{ Args: { "p_agent_key": string,"p_duration_ms": number,"p_egress_classes": (string)[],"p_input_refs": Json,"p_input_tokens": number,"p_model_id": string,"p_organization_id": string,"p_output_tokens": number,"p_prompt_version": string,"p_provider_key": string,"p_refusal_reason": string,"p_retrieval_refs": Json,"p_safety_flags": (string)[],"p_status": string,"p_verification_outcome": string,"p_workspace_id": string }; Returns: string
                           },
"ai_update_workspace_settings":
{ Args: { "p_allowed_egress": (string)[],"p_allowed_providers": (string)[],"p_monthly_token_budget": number,"p_organization_id": string,"p_workspace_id": string }; Returns: undefined
                           },
"argument_add_graph":
{ Args: { "p_ai_execution_id"?: string,"p_edges": Json,"p_issue_id": string,"p_nodes": Json }; Returns: Json
                           },
"argument_create_issue":
{ Args: { "p_organization_id": string,"p_research_run_id"?: string,"p_title": string,"p_workspace_id": string }; Returns: string
                           },
"argument_get_graph":
{ Args: { "p_issue_id": string }; Returns: Json
                           },
"argument_list_issues":
{ Args: { "p_organization_id": string,"p_workspace_id": string }; Returns: {
              "created_at": string,"issue_id": string,"node_count": number,"proposed_count": number,"research_run_id": string,"title": string
            }[]
                           },
"argument_review_node":
{ Args: { "p_decision": string,"p_node_id": string }; Returns: undefined
                           },
"assign_organization_role":
{ Args: { "p_organization_id": string,"p_principal_id": string,"p_role_key": string }; Returns: string
                           },
"assign_workspace_role":
{ Args: { "p_organization_id": string,"p_principal_id": string,"p_role_key": string,"p_workspace_id": string }; Returns: string
                           },
"evidence_add_event":
{ Args: { "p_date_precision": string,"p_description": string,"p_event_date": string,"p_evidence_item_id": string,"p_passage_id"?: string }; Returns: string
                           },
"evidence_add_redaction":
{ Args: { "p_end_offset": number,"p_passage_id": string,"p_reason": string,"p_start_offset": number }; Returns: string
                           },
"evidence_chronology":
{ Args: { "p_organization_id": string,"p_workspace_id": string }; Returns: {
              "date_precision": string,"description": string,"event_date": string,"event_id": string,"evidence_item_id": string,"evidence_title": string,"origin": string,"passage_id": string
            }[]
                           },
"evidence_create_item":
{ Args: { "p_evidence_type"?: string,"p_organization_id": string,"p_privilege"?: string,"p_sensitivity"?: string,"p_title": string,"p_workspace_id": string }; Returns: string
                           },
"evidence_create_proposition":
{ Args: { "p_organization_id": string,"p_statement": string,"p_workspace_id": string }; Returns: string
                           },
"evidence_custody_log":
{ Args: { "p_evidence_item_id": string }; Returns: {
              "actor_kind": string,"event_type": string,"item_sequence": number,"occurred_at": string,"record_hash": string
            }[]
                           },
"evidence_link_proposition":
{ Args: { "p_evidence_item_id": string,"p_note"?: string,"p_passage_id"?: string,"p_proposition_id": string,"p_relation": string }; Returns: string
                           },
"evidence_list_entities":
{ Args: { "p_evidence_item_id": string }; Returns: {
              "entity_type": string,"normalised_value": string,"passage_id": string,"raw_value": string
            }[]
                           },
"evidence_list_items":
{ Args: { "p_organization_id": string,"p_workspace_id": string }; Returns: {
              "created_at": string,"event_count": number,"evidence_item_id": string,"evidence_type": string,"latest_filename": string,"latest_scan_status": string,"latest_version": number,"legal_hold": boolean,"passage_count": number,"privilege": string,"sensitivity": string,"status": string,"title": string
            }[]
                           },
"evidence_list_propositions":
{ Args: { "p_organization_id": string,"p_workspace_id": string }; Returns: Json
                           },
"evidence_proposition_conflicts":
{ Args: { "p_organization_id": string,"p_workspace_id": string }; Returns: {
              "contradicting_items": number,"proposition_id": string,"qualifying_items": number,"statement": string,"status": string,"supporting_items": number
            }[]
                           },
"evidence_read_passages":
{ Args: { "p_evidence_item_id": string }; Returns: {
              "content": string,"ordinal": number,"page_number": number,"passage_id": string,"redaction_count": number
            }[]
                           },
"evidence_register_file":
{ Args: { "p_byte_size": number,"p_content_sha256": string,"p_evidence_item_id": string,"p_mime_type": string,"p_original_filename": string,"p_storage_object_key": string }; Returns: string
                           },
"evidence_request_deletion":
{ Args: { "p_evidence_item_id": string,"p_reason": string }; Returns: undefined
                           },
"evidence_set_legal_hold":
{ Args: { "p_evidence_item_id": string,"p_hold": boolean,"p_reason": string }; Returns: undefined
                           },
"evidence_verify_custody":
{ Args: { "p_evidence_item_id": string }; Returns: Json
                           },
"evidence_worker_pending_files":
{ Args: { "p_limit"?: number }; Returns: {
              "byte_size": number,"content_sha256": string,"evidence_file_id": string,"evidence_item_id": string,"mime_type": string,"needs_extraction": boolean,"organization_id": string,"original_filename": string,"scan_status": string,"storage_object_key": string,"workspace_id": string
            }[]
                           },
"evidence_worker_record_extraction":
{ Args: { "p_entities": Json,"p_events": Json,"p_evidence_file_id": string,"p_extractor": string,"p_extractor_version": string,"p_failure_code": string,"p_page_count": number,"p_passages": Json,"p_status": string,"p_text_sha256": string }; Returns: string
                           },
"evidence_worker_record_scan":
{ Args: { "p_detail": string,"p_evidence_file_id": string,"p_observed_sha256": string,"p_verdict": string }; Returns: undefined
                           },
"get_organization_entitlements":
{ Args: { "p_organization_id": string }; Returns: {
              "effective_from": string,"effective_until": string,"enabled": boolean,"entitlement_key": string,"limit_value": number,"plan_key": string,"subscription_status": string
            }[]
                           },
"has_permission":
{ Args: { "p_organization_id": string,"p_permission_key": string,"p_workspace_id"?: string }; Returns: boolean
                           },
"is_organization_owner":
{ Args: { "p_organization_id": string }; Returns: boolean
                           },
"legal_authority_graph":
{ Args: { "p_as_of"?: string,"p_max_depth"?: number,"p_max_nodes"?: number,"p_relationship_types"?: (string)[],"p_root_authority_id": string }; Returns: Json
                           },
"legal_authority_version_as_of":
{ Args: { "p_authority_id": string,"p_known_at"?: string,"p_valid_on": string }; Returns: {
              "authority_version_id": string,"normalised_content_hash": string,"recorded_at": string,"source_content_hash": string,"source_uri": string,"valid_from": string,"valid_until": string,"version_number": number
            }[]
                           },
"legal_citation_source_metadata":
{ Args: { "p_source_keys": (string)[] }; Returns: Json
                           },
"legal_embedding_pending_passages":
{ Args: { "p_limit"?: number,"p_profile_key": string }; Returns: {
              "content": string,"language_code": string,"passage_id": string
            }[]
                           },
"legal_embedding_store":
{ Args: { "p_embeddings": Json,"p_profile_key": string }; Returns: number
                           },
"legal_ingestion_append_authority":
{ Args: { "p_authority": Json,"p_job_id": string,"p_jurisdiction_code": string,"p_lease_token": string,"p_normalisation_profile": string,"p_passages": Json,"p_retrieved_at": string,"p_source_key": string,"p_source_uri": string }; Returns: string
                           },
"legal_ingestion_append_relationship":
{ Args: { "p_effective_from": string,"p_from_external_id": string,"p_job_id": string,"p_lease_token": string,"p_provenance_uri": string,"p_relationship_type": string,"p_source_key": string,"p_source_note": string,"p_to_external_id": string }; Returns: boolean
                           },
"legal_ingestion_begin_run":
{ Args: { "p_adapter_key": string,"p_adapter_version": string,"p_batch_key": string,"p_cursor": string,"p_source_key": string }; Returns: string
                           },
"legal_ingestion_claim_job":
{ Args: { "p_lease_seconds"?: number,"p_worker_id": string }; Returns: {
              "adapter_key": string,"adapter_version": string,"attempt_count": number,"checkpoint": Json,"cursor_reference": string,"job_id": string,"lease_token": string,"source_id": string
            }[]
                           },
"legal_ingestion_enqueue_job":
{ Args: { "p_adapter_key": string,"p_adapter_version": string,"p_idempotency_key": string,"p_max_attempts"?: number,"p_source_id": string }; Returns: string
                           },
"legal_ingestion_finish_job":
{ Args: { "p_failure_code"?: string,"p_job_id": string,"p_lease_token": string,"p_retry_delay_seconds"?: number,"p_status": string }; Returns: string
                           },
"legal_ingestion_heartbeat":
{ Args: { "p_job_id": string,"p_lease_seconds"?: number,"p_lease_token": string }; Returns: boolean
                           },
"legal_ingestion_persist_run_result":
{ Args: { "p_created": number,"p_discovered": number,"p_failure_codes": (string)[],"p_next_cursor": string,"p_run_id": string,"p_skipped": number,"p_status": string,"p_unchanged": number }; Returns: boolean
                           },
"legal_ingestion_save_checkpoint":
{ Args: { "p_completed_external_ids": (string)[],"p_created": number,"p_cursor": string,"p_discovered": number,"p_failures": number,"p_job_id": string,"p_lease_token": string,"p_skipped": number,"p_unchanged": number }; Returns: boolean
                           },
"legal_jurisdiction_coverage_snapshot":
{ Args: { "p_jurisdiction_code": string }; Returns: Json
                           },
"legal_jurisdiction_record_coverage_scope":
{ Args: { "p_authority_types": (string)[],"p_jurisdiction_code": string,"p_reason": string,"p_review_interval_days": number,"p_reviewer": string }; Returns: Json
                           },
"legal_record_retrieval_evaluation":
{ Args: { "p_case_count": number,"p_code_revision": string,"p_content_licence": string,"p_dataset_key": string,"p_dataset_version": number,"p_gates": Json,"p_jurisdiction_code": string,"p_metrics": Json,"p_passed": boolean,"p_recorded_by": string }; Returns: string
                           },
"legal_search_passages_lexical":
{ Args: { "p_as_of_date": string,"p_authority_types"?: (string)[],"p_jurisdiction_code": string,"p_language_codes": (string)[],"p_limit"?: number,"p_query": string }; Returns: {
              "authority_id": string,"authority_title": string,"authority_type": string,"authority_version_id": string,"citation": string,"jurisdiction_code": string,"language_code": string,"legal_status": string,"lexical_score": number,"page_number": number,"passage_content": string,"passage_id": string,"section_path": (string)[],"source_content_hash": string,"source_key": string,"source_uri": string,"valid_from": string,"valid_until": string
            }[]
                           },
"legal_search_passages_semantic":
{ Args: { "p_as_of_date": string,"p_authority_types"?: (string)[],"p_embedding": string,"p_embedding_model_key": string,"p_jurisdiction_code": string,"p_language_codes": (string)[],"p_limit"?: number }; Returns: {
              "authority_id": string,"authority_title": string,"authority_type": string,"authority_version_id": string,"citation": string,"jurisdiction_code": string,"language_code": string,"legal_status": string,"page_number": number,"passage_content": string,"passage_id": string,"section_path": (string)[],"semantic_score": number,"source_content_hash": string,"source_key": string,"source_uri": string,"valid_from": string,"valid_until": string
            }[]
                           },
"legal_source_record_coverage_review":
{ Args: { "p_authority_types": (string)[],"p_coverage_from": string,"p_coverage_until": string,"p_known_gaps"?: (string)[],"p_languages": (string)[],"p_last_verified_at": string,"p_reason": string,"p_reviewer": string,"p_source_id": string }; Returns: Json
                           },
"legal_source_record_rights_review":
{ Args: { "p_attribution_text": string,"p_licence_identifier": string,"p_licence_version": string,"p_permissions": Json,"p_restrictions"?: (string)[],"p_review_expires_at": string,"p_reviewed_at": string,"p_reviewer": string,"p_source_id": string,"p_terms_uri": string }; Returns: Json
                           },
"legal_source_set_activation":
{ Args: { "p_adapter_key": string,"p_adapter_version": string,"p_ingestion_enabled": boolean,"p_operator": string,"p_reason": string,"p_source_id": string,"p_status": string }; Returns: Json
                           },
"legal_worker_source_config":
{ Args: { "p_source_id": string }; Returns: Json
                           },
"list_assignable_roles":
{ Args: { "p_organization_id": string,"p_workspace_id"?: string }; Returns: {
              "description": string,"display_name": string,"role_key": string,"scope": string
            }[]
                           },
"list_role_bindings":
{ Args: { "p_organization_id": string,"p_workspace_id"?: string }; Returns: {
              "assigned_at": string,"binding_id": string,"principal_id": string,"role_key": string,"role_name": string
            }[]
                           },
"list_security_audit_events":
{ Args: { "p_before_sequence"?: number,"p_limit"?: number,"p_organization_id": string,"p_workspace_id"?: string }; Returns: {
              "actor_principal_id": string,"correlation_id": string,"event_id": string,"event_key": string,"metadata": Json,"occurred_at": string,"organization_id": string,"outcome": string,"resource_id": string,"resource_type": string,"sequence_id": number,"workspace_id": string
            }[]
                           },
"record_usage_event":
{ Args: { "p_idempotency_key": string,"p_metadata"?: Json,"p_organization_id": string,"p_quantity": number,"p_unit": string,"p_usage_key": string,"p_workspace_id": string }; Returns: string
                           },
"research_authority_context":
{ Args: { "p_as_of_date": string,"p_authority_ids": (string)[],"p_organization_id": string,"p_workspace_id": string }; Returns: {
              "after_as_of": boolean,"effective_from": string,"from_authority_id": string,"relationship_type": string,"to_authority_id": string,"to_citation": string,"to_title": string
            }[]
                           },
"research_get_run":
{ Args: { "p_run_id": string }; Returns: Json
                           },
"research_list_jurisdictions":
{ Args: Record<PropertyKey, never>; Returns: {
              "code": string,"coverage_level": string,"name": string,"official_languages": (string)[]
            }[]
                           },
"research_list_runs":
{ Args: { "p_organization_id": string,"p_workspace_id": string }; Returns: {
              "as_of_date": string,"created_at": string,"failed_claims": number,"jurisdiction_code": string,"question": string,"run_id": string,"status": string,"verified_claims": number
            }[]
                           },
"research_record_run":
{ Args: { "p_as_of_date": string,"p_claims": Json,"p_engine_version": string,"p_findings": Json,"p_jurisdiction_code": string,"p_language_codes": (string)[],"p_limitations": Json,"p_organization_id": string,"p_question": string,"p_retrieval_mode": string,"p_workspace_id": string }; Returns: string
                           },
"research_search_lexical":
{ Args: { "p_as_of_date": string,"p_authority_types"?: (string)[],"p_jurisdiction_code": string,"p_language_codes": (string)[],"p_limit"?: number,"p_organization_id": string,"p_query": string,"p_workspace_id": string }; Returns: {
              "authority_id": string,"authority_title": string,"authority_type": string,"authority_version_id": string,"citation": string,"jurisdiction_code": string,"language_code": string,"legal_status": string,"lexical_score": number,"page_number": number,"passage_content": string,"passage_id": string,"section_path": (string)[],"source_content_hash": string,"source_key": string,"source_uri": string,"valid_from": string,"valid_until": string
            }[]
                           },
"research_search_semantic":
{ Args: { "p_as_of_date": string,"p_authority_types"?: (string)[],"p_embedding": string,"p_embedding_model_key": string,"p_jurisdiction_code": string,"p_language_codes": (string)[],"p_limit"?: number,"p_organization_id": string,"p_workspace_id": string }; Returns: {
              "authority_id": string,"authority_title": string,"authority_type": string,"authority_version_id": string,"citation": string,"jurisdiction_code": string,"language_code": string,"legal_status": string,"page_number": number,"passage_content": string,"passage_id": string,"section_path": (string)[],"semantic_score": number,"source_content_hash": string,"source_key": string,"source_uri": string,"valid_from": string,"valid_until": string
            }[]
                           },
"research_source_permissions":
{ Args: { "p_organization_id": string,"p_source_keys": (string)[],"p_workspace_id": string }; Returns: {
              "attribution_text": string,"display_permitted": boolean,"licence_identifier": string,"quote_permitted": boolean,"source_key": string
            }[]
                           },
"revoke_organization_invitation":
{ Args: { "p_invitation_id": string }; Returns: boolean
                           },
"revoke_organization_role":
{ Args: { "p_binding_id": string }; Returns: boolean
                           },
"revoke_workspace_role":
{ Args: { "p_binding_id": string }; Returns: boolean
                           },
"set_organization_membership_status":
{ Args: { "p_membership_id": string,"p_status": string }; Returns: boolean
                           },
"set_workspace_membership_status":
{ Args: { "p_membership_id": string,"p_status": string }; Returns: boolean
                           },
"verify_security_audit_chain":
{ Args: Record<PropertyKey, never>; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
