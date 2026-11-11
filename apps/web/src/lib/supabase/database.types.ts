
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
"assign_organization_role":
{ Args: { "p_organization_id": string,"p_principal_id": string,"p_role_key": string }; Returns: string
                           },
"assign_workspace_role":
{ Args: { "p_organization_id": string,"p_principal_id": string,"p_role_key": string,"p_workspace_id": string }; Returns: string
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
