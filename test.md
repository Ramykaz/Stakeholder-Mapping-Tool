# Test Execution and Coverage Inventory

Date: 2026-04-10

## Overview

| Metric | Count |
|---|---:|
| Total tests | 315 |
| Backend (pytest) | 253 |
| Frontend (Jest) | 62 |

## Test Types

| Type | Count |
|---|---:|
| Backend Integration/API | 81 |
| Backend Service/Integration | 52 |
| Backend Unit | 182 |

## Backend Tests

| # | Test ID | Type | Description |
|---:|---|---|---|
| 1 | ingestion/tests/test_concept_note_view.py::TestProjectConceptNoteView::test_get_returns_empty_payload_when_concept_note_missing | Backend Unit | Get returns empty payload when concept note missing (concept_note_view). |
| 2 | ingestion/tests/test_project_document_endpoints.py::TestProjectDocumentEndpoints::test_project_document_context_prioritizes_cleaned_text_and_focus_snippets | Backend Integration/API | Project document context prioritizes cleaned text and focus snippets (project_document_endpoints). |
| 3 | ingestion/tests/test_project_document_endpoints.py::TestProjectDocumentEndpoints::test_project_document_reextract_returns_404_for_foreign_project | Backend Integration/API | Project document reextract returns 404 for foreign project (project_document_endpoints). |
| 4 | ingestion/tests/test_project_document_endpoints.py::TestProjectDocumentEndpoints::test_project_document_reextract_runs_and_sets_extracted_at | Backend Integration/API | Project document reextract runs and sets extracted at (project_document_endpoints). |
| 5 | ingestion/tests/test_project_document_endpoints.py::TestProjectDocumentEndpoints::test_project_document_status_returns_extracted_state_with_timestamp | Backend Integration/API | Project document status returns extracted state with timestamp (project_document_endpoints). |
| 6 | ingestion/tests/test_project_document_endpoints.py::TestProjectDocumentEndpoints::test_project_documents_counts_use_review_semantics | Backend Integration/API | Project documents counts use review semantics (project_document_endpoints). |
| 7 | ingestion/tests/test_project_document_endpoints.py::TestProjectDocumentEndpoints::test_project_documents_get_marks_extracting_state_when_pending_run_exists | Backend Integration/API | Project documents get marks extracting state when pending run exists (project_document_endpoints). |
| 8 | ingestion/tests/test_views.py::TestIngestView::test_valid_pdf_returns_201 | Backend Integration/API | Valid pdf returns 201 (views). |
| 9 | ingestion/tests/test_views.py::TestIngestView::test_valid_docx_returns_201 | Backend Integration/API | Valid docx returns 201 (views). |
| 10 | ingestion/tests/test_views.py::TestIngestView::test_valid_txt_returns_201 | Backend Integration/API | Valid txt returns 201 (views). |
| 11 | ingestion/tests/test_views.py::TestIngestView::test_valid_markdown_returns_201 | Backend Integration/API | Valid markdown returns 201 (views). |
| 12 | ingestion/tests/test_views.py::TestIngestView::test_oversized_file_returns_413 | Backend Integration/API | Oversized file returns 413 (views). |
| 13 | ingestion/tests/test_views.py::TestIngestView::test_unsupported_format_returns_415 | Backend Integration/API | Unsupported format returns 415 (views). |
| 14 | ingestion/tests/test_views.py::TestIngestView::test_extraction_error_returns_422 | Backend Integration/API | Extraction error returns 422 (views). |
| 15 | ingestion/tests/test_views.py::TestIngestView::test_ingestion_error_returns_500_structured_json | Backend Integration/API | Ingestion error returns 500 structured json (views). |
| 16 | ingestion/tests/test_views.py::TestIngestView::test_missing_file_field_returns_400 | Backend Integration/API | Missing file field returns 400 (views). |
| 17 | ingestion/tests/test_workflow.py::TestWorkflowStatus::test_project_get_workflow_status_step_1_complete_when_initiative_name_set | Backend Integration/API | Project get workflow status step 1 complete when initiative name set (workflow). |
| 18 | ingestion/tests/test_workflow.py::TestWorkflowStatus::test_project_get_workflow_status_step_2_complete_when_document_processed | Backend Integration/API | Project get workflow status step 2 complete when document processed (workflow). |
| 19 | ingestion/tests/test_workflow.py::TestWorkflowStatus::test_project_get_workflow_status_step_5_complete_when_done_report_exists | Backend Integration/API | Project get workflow status step 5 complete when done report exists (workflow). |
| 20 | ingestion/tests/test_workflow.py::TestWorkflowStatus::test_workflow_status_view_returns_current_step_and_steps_with_urls | Backend Integration/API | Workflow status view returns current step and steps with urls (workflow). |
| 21 | ner/tests/test_acronym_map_seed.py::TestAcronymMapSeed::test_expected_default_acronyms_exist | Backend Unit | Expected default acronyms exist (acronym_map_seed). |
| 22 | ner/tests/test_acronym_map_seed.py::TestAcronymMapSeed::test_undp_expansion_seeded | Backend Unit | Undp expansion seeded (acronym_map_seed). |
| 23 | ner/tests/test_auth_api.py::TestAuthAPI::test_login_unknown_user_returns_invalid_credentials | Backend Integration/API | Login unknown user returns invalid credentials (auth_api). |
| 24 | ner/tests/test_auth_api.py::TestAuthAPI::test_login_wrong_password_returns_specific_error | Backend Integration/API | Login wrong password returns specific error (auth_api). |
| 25 | ner/tests/test_auth_api.py::TestAuthAPI::test_project_access_isolated_per_user | Backend Integration/API | Project access isolated per user (auth_api). |
| 26 | ner/tests/test_auth_api.py::TestAuthAPI::test_protected_endpoints_require_authentication | Backend Integration/API | Protected endpoints require authentication (auth_api). |
| 27 | ner/tests/test_auth_api.py::TestAuthAPI::test_register_allowlisted_undp_email_auto_assigns_admin | Backend Integration/API | Register allowlisted undp email auto assigns admin (auth_api). |
| 28 | ner/tests/test_auth_api.py::TestAuthAPI::test_register_invalid_email_returns_400 | Backend Integration/API | Register invalid email returns 400 (auth_api). |
| 29 | ner/tests/test_auth_api.py::TestAuthAPI::test_register_login_me_logout_flow | Backend Integration/API | Register login me logout flow (auth_api). |
| 30 | ner/tests/test_auth_api.py::TestAuthAPI::test_register_non_allowlisted_undp_email_remains_regular_user | Backend Integration/API | Register non allowlisted undp email remains regular user (auth_api). |
| 31 | ner/tests/test_auth_api.py::TestAuthAPI::test_register_non_undp_email_remains_regular_user | Backend Integration/API | Register non undp email remains regular user (auth_api). |
| 32 | ner/tests/test_auth_api.py::TestAuthAPI::test_register_short_password_returns_400 | Backend Integration/API | Register short password returns 400 (auth_api). |
| 33 | ner/tests/test_auth_api.py::TestAuthAPI::test_taxonomy_read_open_write_admin_only | Backend Integration/API | Taxonomy read open write admin only (auth_api). |
| 34 | ner/tests/test_auth_api.py::TestAuthAPI::test_user_data_isolation_for_documents | Backend Integration/API | User data isolation for documents (auth_api). |
| 35 | ner/tests/test_contextual_summary_api.py::TestContextualSummaryApi::test_summary_generated_when_relation_exists_with_sparse_chunk_evidence | Backend Service/Integration | Summary generated when relation exists with sparse chunk evidence (contextual_summary_api). |
| 36 | ner/tests/test_contextual_summary_api.py::TestContextualSummaryApi::test_summary_refresh_normalizes_markdown_artifacts | Backend Service/Integration | Summary refresh normalizes markdown artifacts (contextual_summary_api). |
| 37 | ner/tests/test_contextual_summary_api.py::TestContextualSummaryApi::test_summary_refresh_regenerates | Backend Service/Integration | Summary refresh regenerates (contextual_summary_api). |
| 38 | ner/tests/test_contextual_summary_api.py::TestContextualSummaryApi::test_summary_returns_cached_value_when_available | Backend Service/Integration | Summary returns cached value when available (contextual_summary_api). |
| 39 | ner/tests/test_contextual_summary_api.py::TestContextualSummaryApi::test_summary_timeout_returns_fallback_retryable | Backend Service/Integration | Summary timeout returns fallback retryable (contextual_summary_api). |
| 40 | ner/tests/test_contextual_summary_api.py::TestContextualSummaryTimeouts::test_resolve_timeout_respects_higher_requested_timeout | Backend Service/Integration | Resolve timeout respects higher requested timeout (contextual_summary_api). |
| 41 | ner/tests/test_contextual_summary_api.py::TestContextualSummaryTimeouts::test_resolve_timeout_uses_default_floor_for_unknown_provider | Backend Service/Integration | Resolve timeout uses default floor for unknown provider (contextual_summary_api). |
| 42 | ner/tests/test_contextual_summary_api.py::TestContextualSummaryTimeouts::test_resolve_timeout_uses_provider_floor_for_azure | Backend Service/Integration | Resolve timeout uses provider floor for azure (contextual_summary_api). |
| 43 | ner/tests/test_dedup_review_api.py::TestDeduplicationReviewAPI::test_review_list_returns_pending | Backend Unit | Review list returns pending (dedup_review_api). |
| 44 | ner/tests/test_dedup_review_api.py::TestDeduplicationReviewAPI::test_keep_separate_resolves_candidate | Backend Unit | Keep separate resolves candidate (dedup_review_api). |
| 45 | ner/tests/test_dedup_review_api.py::TestDeduplicationReviewAPI::test_merge_flags_losing_entity | Backend Unit | Merge flags losing entity (dedup_review_api). |
| 46 | ner/tests/test_dedup_review_api.py::TestDeduplicationReviewAPI::test_non_owner_denied | Backend Unit | Non owner denied (dedup_review_api). |
| 47 | ner/tests/test_deduplicator.py::TestDeduplicateEntities::test_deduplicate_different_entity_types | Backend Unit | Deduplicate different entity types (deduplicator). |
| 48 | ner/tests/test_deduplicator.py::TestDeduplicateEntities::test_deduplicate_invalid_confidence | Backend Unit | Deduplicate invalid confidence (deduplicator). |
| 49 | ner/tests/test_deduplicator.py::TestDeduplicateEntities::test_deduplicate_merge_duplicates | Backend Unit | Deduplicate merge duplicates (deduplicator). |
| 50 | ner/tests/test_deduplicator.py::TestDeduplicateEntities::test_deduplicate_new_entities | Backend Unit | Deduplicate new entities (deduplicator). |
| 51 | ner/tests/test_deduplicator.py::TestDeduplicateEntities::test_deduplicate_skip_invalid_entities | Backend Unit | Deduplicate skip invalid entities (deduplicator). |
| 52 | ner/tests/test_document_review_integrity.py::TestDocumentReviewIntegrity::test_entities_endpoint_falls_back_to_document_entities_without_mentions | Backend Integration/API | Entities endpoint falls back to document entities without mentions (document_review_integrity). |
| 53 | ner/tests/test_document_review_integrity.py::TestDocumentReviewIntegrity::test_entities_endpoint_is_mention_backed_and_excerpt_contains_entity | Backend Integration/API | Entities endpoint is mention backed and excerpt contains entity (document_review_integrity). |
| 54 | ner/tests/test_document_review_integrity.py::TestDocumentReviewIntegrity::test_relationships_endpoint_uses_source_document_evidence | Backend Integration/API | Relationships endpoint uses source document evidence (document_review_integrity). |
| 55 | ner/tests/test_edge_cases.py::TestDeduplicatorEdgeCases::test_all_entities_invalid | Backend Unit | All entities invalid (edge_cases). |
| 56 | ner/tests/test_edge_cases.py::TestDeduplicatorEdgeCases::test_confidence_exactly_one | Backend Unit | Confidence exactly one (edge_cases). |
| 57 | ner/tests/test_edge_cases.py::TestDeduplicatorEdgeCases::test_confidence_zero | Backend Unit | Confidence zero (edge_cases). |
| 58 | ner/tests/test_edge_cases.py::TestDeduplicatorEdgeCases::test_duplicate_entities_in_same_batch | Backend Unit | Duplicate entities in same batch (edge_cases). |
| 59 | ner/tests/test_edge_cases.py::TestDeduplicatorEdgeCases::test_empty_extraction_list | Backend Unit | Empty extraction list (edge_cases). |
| 60 | ner/tests/test_edge_cases.py::TestDeduplicatorEdgeCases::test_very_long_canonical_name | Backend Unit | Very long canonical name (edge_cases). |
| 61 | ner/tests/test_edge_cases.py::TestPipelineEdgeCases::test_all_chunks_return_empty_entities | Backend Unit | All chunks return empty entities (edge_cases). |
| 62 | ner/tests/test_edge_cases.py::TestPipelineEdgeCases::test_joint_extraction_maps_parenthetical_relation_endpoints | Backend Unit | Joint extraction maps parenthetical relation endpoints (edge_cases). |
| 63 | ner/tests/test_edge_cases.py::TestPipelineEdgeCases::test_joint_extraction_persists_entities_when_no_relationships | Backend Unit | Joint extraction persists entities when no relationships (edge_cases). |
| 64 | ner/tests/test_edge_cases.py::TestPipelineEdgeCases::test_single_chunk_with_many_entities | Backend Unit | Single chunk with many entities (edge_cases). |
| 65 | ner/tests/test_entity_dedup_service.py::TestEntityDedupService::test_acronym_expansion_merges_into_existing_entity | Backend Unit | Acronym expansion merges into existing entity (entity_dedup_service). |
| 66 | ner/tests/test_entity_dedup_service.py::TestEntityDedupService::test_cross_type_entities_never_merge | Backend Unit | Cross type entities never merge (entity_dedup_service). |
| 67 | ner/tests/test_entity_dedup_service.py::TestEntityDedupService::test_exact_normalized_match_merges_same_type | Backend Unit | Exact normalized match merges same type (entity_dedup_service). |
| 68 | ner/tests/test_entity_dedup_service.py::TestEntityDedupService::test_fuzzy_auto_merge_same_type | Backend Unit | Fuzzy auto merge same type (entity_dedup_service). |
| 69 | ner/tests/test_entity_dedup_service.py::TestEntityDedupService::test_fuzzy_borderline_creates_review_candidate | Backend Unit | Fuzzy borderline creates review candidate (entity_dedup_service). |
| 70 | ner/tests/test_entity_flag.py::TestEntityFlagView::test_flag_sets_is_flagged_true | Backend Unit | Flag sets is flagged true (entity_flag). |
| 71 | ner/tests/test_entity_flag.py::TestEntityFlagView::test_unflag_restores_entity | Backend Unit | Unflag restores entity (entity_flag). |
| 72 | ner/tests/test_entity_flag.py::TestEntityFlagView::test_flagged_entity_absent_from_graph_api | Backend Unit | Flagged entity absent from graph api (entity_flag). |
| 73 | ner/tests/test_entity_mention_count_dedup.py::TestEntityMentionCountDedup::test_mention_count_dedup_uses_unique_normalized_mentions | Backend Unit | Mention count dedup uses unique normalized mentions (entity_mention_count_dedup). |
| 74 | ner/tests/test_entity_phase_linking.py::TestEntityPhaseLinking::test_phase_variant_is_linked_to_parent_entity | Backend Unit | Phase variant is linked to parent entity (entity_phase_linking). |
| 75 | ner/tests/test_entity_phase_linking.py::TestEntityPhaseLinking::test_phase_variant_not_auto_merged_even_with_high_similarity | Backend Unit | Phase variant not auto merged even with high similarity (entity_phase_linking). |
| 76 | ner/tests/test_entity_profile_api.py::TestEntityProfileApi::test_profile_endpoint_forbidden_for_non_owner | Backend Unit | Profile endpoint forbidden for non owner (entity_profile_api). |
| 77 | ner/tests/test_entity_profile_api.py::TestEntityProfileApi::test_profile_endpoint_returns_aliases_projects_relationships | Backend Unit | Profile endpoint returns aliases projects relationships (entity_profile_api). |
| 78 | ner/tests/test_entity_review_candidates.py::TestEntityReviewCandidatesApi::test_list_pending_candidates | Backend Unit | List pending candidates (entity_review_candidates). |
| 79 | ner/tests/test_entity_review_candidates.py::TestEntityReviewCandidatesApi::test_resolve_keep_separate | Backend Unit | Resolve keep separate (entity_review_candidates). |
| 80 | ner/tests/test_entity_review_candidates.py::TestEntityReviewCandidatesApi::test_resolve_merge | Backend Unit | Resolve merge (entity_review_candidates). |
| 81 | ner/tests/test_entity_review_candidates.py::TestEntityReviewCandidatesApi::test_resolve_stale_candidate_returns_400 | Backend Unit | Resolve stale candidate returns 400 (entity_review_candidates). |
| 82 | ner/tests/test_export.py::TestReportExport::test_generate_docx_report_returns_non_empty_bytes | Backend Integration/API | Generate docx report returns non empty bytes (export). |
| 83 | ner/tests/test_export.py::TestReportExport::test_generate_pdf_report_returns_non_empty_bytes | Backend Integration/API | Generate pdf report returns non empty bytes (export). |
| 84 | ner/tests/test_export.py::TestReportExport::test_get_export_status_true_false_and_complete_count | Backend Integration/API | Get export status true false and complete count (export). |
| 85 | ner/tests/test_export.py::TestReportExport::test_report_export_api_accepts_format_query_param | Backend Integration/API | Report export api accepts format query param (export). |
| 86 | ner/tests/test_export.py::TestReportExport::test_report_export_view_returns_200_with_pdf_and_docx_headers | Backend Integration/API | Report export view returns 200 with pdf and docx headers (export). |
| 87 | ner/tests/test_export.py::TestReportExport::test_report_export_view_returns_400_when_no_complete_sections | Backend Integration/API | Report export view returns 400 when no complete sections (export). |
| 88 | ner/tests/test_graph_edges.py::TestGraphEdgesView::test_graph_endpoint_document_not_found_still_returns_404 | Backend Unit | Graph endpoint document not found still returns 404 (graph_edges). |
| 89 | ner/tests/test_graph_edges.py::TestGraphEdgesView::test_graph_endpoint_includes_edges_for_documents_with_relations | Backend Unit | Graph endpoint includes edges for documents with relations (graph_edges). |
| 90 | ner/tests/test_graph_edges.py::TestGraphEdgesView::test_graph_endpoint_returns_empty_edges_for_entity_only_documents | Backend Unit | Graph endpoint returns empty edges for entity only documents (graph_edges). |
| 91 | ner/tests/test_graph_payload_api.py::TestGraphPayloadApi::test_project_graph_includes_style_degree_and_confidence | Backend Unit | Project graph includes style degree and confidence (graph_payload_api). |
| 92 | ner/tests/test_guidance.py::TestGuidanceInjection::test_empty_guidance_does_not_add_guidance_block | Backend Unit | Empty guidance does not add guidance block (guidance). |
| 93 | ner/tests/test_guidance.py::TestGuidanceInjection::test_guidance_items_included_and_ordered | Backend Unit | Guidance items included and ordered (guidance). |
| 94 | ner/tests/test_guidance.py::TestGuidanceInjection::test_guidance_without_base_context_still_injected | Backend Unit | Guidance without base context still injected (guidance). |
| 95 | ner/tests/test_intake.py::TestInitiativeProfileContext::test_get_project_context_falls_back_to_concept_note | Backend Unit | Get project context falls back to concept note (intake). |
| 96 | ner/tests/test_intake.py::TestInitiativeProfileContext::test_get_project_context_falls_back_to_description_then_empty | Backend Unit | Get project context falls back to description then empty (intake). |
| 97 | ner/tests/test_intake.py::TestInitiativeProfileContext::test_get_project_context_handles_initiative_profile_missing | Backend Unit | Get project context handles initiative profile missing (intake). |
| 98 | ner/tests/test_intake.py::TestInitiativeProfileContext::test_get_project_context_uses_initiative_profile_first | Backend Unit | Get project context uses initiative profile first (intake). |
| 99 | ner/tests/test_intake.py::TestInitiativeProfileContext::test_to_context_string_with_all_fields | Backend Unit | To context string with all fields (intake). |
| 100 | ner/tests/test_intake.py::TestInitiativeProfileContext::test_to_context_string_with_empty_fields | Backend Unit | To context string with empty fields (intake). |
| 101 | ner/tests/test_intake.py::TestInitiativeProfileContext::test_to_context_string_with_partial_fields | Backend Unit | To context string with partial fields (intake). |
| 102 | ner/tests/test_llm_settings.py::TestLLMSettingsEndpoint::test_llm_connection_test_rejects_malformed_azure_endpoint | Backend Integration/API | Llm connection test rejects malformed azure endpoint (llm_settings). |
| 103 | ner/tests/test_llm_settings.py::TestLLMSettingsEndpoint::test_llm_connection_test_requires_supported_provider | Backend Integration/API | Llm connection test requires supported provider (llm_settings). |
| 104 | ner/tests/test_llm_settings.py::TestLLMSettingsEndpoint::test_llm_connection_test_returns_error_status_for_provider_failures | Backend Integration/API | Llm connection test returns error status for provider failures (llm_settings). |
| 105 | ner/tests/test_llm_settings.py::TestLLMSettingsEndpoint::test_llm_connection_test_returns_ok_payload | Backend Integration/API | Llm connection test returns ok payload (llm_settings). |
| 106 | ner/tests/test_personas.py::TestPersonas::test_generate_personas_for_project_creates_for_types_with_available_entities | Backend Service/Integration | Generate personas for project creates for types with available entities (personas). |
| 107 | ner/tests/test_personas.py::TestPersonas::test_generate_personas_for_project_creates_from_single_entity_type | Backend Service/Integration | Generate personas for project creates from single entity type (personas). |
| 108 | ner/tests/test_personas.py::TestPersonas::test_generate_personas_replaces_existing_on_regeneration | Backend Service/Integration | Generate personas replaces existing on regeneration (personas). |
| 109 | ner/tests/test_personas.py::TestPersonas::test_generate_single_persona_parses_json_when_response_content_is_wrapped | Backend Service/Integration | Generate single persona parses json when response content is wrapped (personas). |
| 110 | ner/tests/test_personas.py::TestPersonas::test_generate_single_persona_returns_none_on_json_parse_failure | Backend Service/Integration | Generate single persona returns none on json parse failure (personas). |
| 111 | ner/tests/test_personas.py::TestPersonas::test_persona_generate_view_returns_202 | Backend Service/Integration | Persona generate view returns 202 (personas). |
| 112 | ner/tests/test_personas.py::TestPersonas::test_persona_generate_view_returns_400_without_entities | Backend Service/Integration | Persona generate view returns 400 without entities (personas). |
| 113 | ner/tests/test_personas.py::TestPersonas::test_persona_list_view_returns_expected_schema | Backend Service/Integration | Persona list view returns expected schema (personas). |
| 114 | ner/tests/test_pipeline.py::TestExtractEntitiesForDocument::test_clean_slate_replacement | Backend Service/Integration | Clean slate replacement (pipeline). |
| 115 | ner/tests/test_pipeline.py::TestExtractEntitiesForDocument::test_document_not_found | Backend Service/Integration | Document not found (pipeline). |
| 116 | ner/tests/test_pipeline.py::TestExtractEntitiesForDocument::test_extract_entities_success | Backend Service/Integration | Extract entities success (pipeline). |
| 117 | ner/tests/test_pipeline.py::TestExtractEntitiesForDocument::test_missing_groq_api_key | Backend Service/Integration | Missing groq api key (pipeline). |
| 118 | ner/tests/test_pipeline.py::TestExtractEntitiesForDocument::test_multiple_runs_are_preserved_in_history | Backend Service/Integration | Multiple runs are preserved in history (pipeline). |
| 119 | ner/tests/test_pipeline.py::TestExtractEntitiesForDocument::test_no_chunks | Backend Service/Integration | No chunks (pipeline). |
| 120 | ner/tests/test_pipeline.py::TestExtractEntitiesForDocument::test_openai_output_uses_existing_entity_schema | Backend Service/Integration | Openai output uses existing entity schema (pipeline). |
| 121 | ner/tests/test_pipeline.py::TestExtractEntitiesForDocument::test_openai_provider_dispatch | Backend Service/Integration | Openai provider dispatch (pipeline). |
| 122 | ner/tests/test_pipeline.py::TestExtractEntitiesForDocument::test_rate_limit_error | Backend Service/Integration | Rate limit error (pipeline). |
| 123 | ner/tests/test_priority.py::TestPriorityTable::test_compute_priority_scores_sorted_descending | Backend Service/Integration | Compute priority scores sorted descending (priority). |
| 124 | ner/tests/test_priority.py::TestPriorityTable::test_compute_priority_scores_type_filter | Backend Service/Integration | Compute priority scores type filter (priority). |
| 125 | ner/tests/test_priority.py::TestPriorityTable::test_flag_orphans_endpoint_flags_zero_degree_only | Backend Service/Integration | Flag orphans endpoint flags zero degree only (priority). |
| 126 | ner/tests/test_priority.py::TestPriorityTable::test_generate_notes_rejects_invalid_action | Backend Service/Integration | Generate notes rejects invalid action (priority). |
| 127 | ner/tests/test_priority.py::TestPriorityTable::test_generate_notes_resume_contract | Backend Service/Integration | Generate notes resume contract (priority). |
| 128 | ner/tests/test_priority.py::TestPriorityTable::test_generate_notes_start_contract | Backend Service/Integration | Generate notes start contract (priority). |
| 129 | ner/tests/test_priority.py::TestPriorityTable::test_generate_notes_stop_contract | Backend Service/Integration | Generate notes stop contract (priority). |
| 130 | ner/tests/test_priority.py::TestPriorityTable::test_priority_csv_export_headers | Backend Service/Integration | Priority csv export headers (priority). |
| 131 | ner/tests/test_project_extract_incremental.py::TestProjectExtractEntitiesIncremental::test_extracts_only_unextracted_documents | Backend Integration/API | Extracts only unextracted documents (project_extract_incremental). |
| 132 | ner/tests/test_project_extract_incremental.py::TestProjectExtractEntitiesIncremental::test_no_new_documents_returns_completed_noop | Backend Integration/API | No new documents returns completed noop (project_extract_incremental). |
| 133 | ner/tests/test_relation_deduplicator.py::test_deduplicate_relations_keeps_highest_confidence | Backend Unit | Deduplicate relations keeps highest confidence (relation_deduplicator). |
| 134 | ner/tests/test_relation_deduplicator.py::test_deduplicate_relations_normalizes_labels | Backend Unit | Deduplicate relations normalizes labels (relation_deduplicator). |
| 135 | ner/tests/test_relation_deduplicator.py::test_deduplicate_relations_different_entities_preserved | Backend Unit | Deduplicate relations different entities preserved (relation_deduplicator). |
| 136 | ner/tests/test_relation_deduplicator.py::test_deduplicate_relations_different_labels_preserved | Backend Unit | Deduplicate relations different labels preserved (relation_deduplicator). |
| 137 | ner/tests/test_relation_deduplicator.py::test_deduplicate_relations_empty_list | Backend Unit | Deduplicate relations empty list (relation_deduplicator). |
| 138 | ner/tests/test_relation_deduplicator.py::test_deduplicate_relations_single_item | Backend Unit | Deduplicate relations single item (relation_deduplicator). |
| 139 | ner/tests/test_report.py::TestReportGenerator::test_friendly_error_maps_db_capacity_limit | Backend Service/Integration | Friendly error maps db capacity limit (report). |
| 140 | ner/tests/test_report.py::TestReportGenerator::test_generate_all_sections_creates_records_and_transitions_done | Backend Service/Integration | Generate all sections creates records and transitions done (report). |
| 141 | ner/tests/test_report.py::TestReportGenerator::test_generate_all_sections_handles_worker_exception_without_crashing | Backend Service/Integration | Generate all sections handles worker exception without crashing (report). |
| 142 | ner/tests/test_report.py::TestReportGenerator::test_generate_report_section_normalizes_markdown_artifacts | Backend Service/Integration | Generate report section normalizes markdown artifacts (report). |
| 143 | ner/tests/test_report.py::TestReportGenerator::test_generate_report_section_saves_done_on_success | Backend Service/Integration | Generate report section saves done on success (report). |
| 144 | ner/tests/test_report.py::TestReportGenerator::test_generate_report_section_saves_error_on_failure | Backend Service/Integration | Generate report section saves error on failure (report). |
| 145 | ner/tests/test_report_view.py::TestProjectReportViewTransientErrors::test_old_non_transient_error_is_not_reset | Backend Integration/API | Old non transient error is not reset (report_view). |
| 146 | ner/tests/test_report_view.py::TestProjectReportViewTransientErrors::test_old_stopped_error_is_reset_to_pending_on_report_load | Backend Integration/API | Old stopped error is reset to pending on report load (report_view). |
| 147 | ner/tests/test_report_view.py::TestProjectReportViewTransientErrors::test_old_timeout_error_is_reset_to_pending_on_report_load | Backend Integration/API | Old timeout error is reset to pending on report load (report_view). |
| 148 | ner/tests/test_report_view.py::TestProjectReportViewTransientErrors::test_recent_timeout_error_remains_visible | Backend Integration/API | Recent timeout error remains visible (report_view). |
| 149 | ner/tests/test_semantic_search.py::test_search_entity_ids_empty_project | Backend Unit | Search entity ids empty project (semantic_search). |
| 150 | ner/tests/test_smq.py::TestSMQ::test_generate_smq_section_normalizes_markdown_artifacts | Backend Service/Integration | Generate smq section normalizes markdown artifacts (smq). |
| 151 | ner/tests/test_smq.py::TestSMQ::test_generate_smq_section_returns_answer_and_citations | Backend Service/Integration | Generate smq section returns answer and citations (smq). |
| 152 | ner/tests/test_smq.py::TestSMQ::test_smq_get_and_put_endpoints_roundtrip | Backend Service/Integration | Smq get and put endpoints roundtrip (smq). |
| 153 | ner/tests/test_smq.py::TestSMQ::test_smq_seed_contains_eight_sections | Backend Service/Integration | Smq seed contains eight sections (smq). |
| 154 | ner/tests/test_smq.py::TestSMQ::test_smq_template_endpoint_prefers_complete_template_over_partial_newer_template | Backend Service/Integration | Smq template endpoint prefers complete template over partial newer template (smq). |
| 155 | ner/tests/test_staleness.py::TestStaleness::test_flag_stale_report_sections_updates_done_only_and_sets_project_flag | Backend Unit | Flag stale report sections updates done only and sets project flag (staleness). |
| 156 | ner/tests/test_staleness.py::TestStaleness::test_report_section_keep_view_returns_400_if_not_stale | Backend Unit | Report section keep view returns 400 if not stale (staleness). |
| 157 | ner/tests/test_staleness.py::TestStaleness::test_report_section_keep_view_sets_done_and_preserves_text | Backend Unit | Report section keep view sets done and preserves text (staleness). |
| 158 | ner/tests/test_staleness.py::TestStaleness::test_report_staleness_view_returns_sections_and_new_entity_count | Backend Unit | Report staleness view returns sections and new entity count (staleness). |
| 159 | ner/tests/test_staleness.py::TestStaleness::test_stakeholder_table_keep_current_view_sets_flag_false | Backend Unit | Stakeholder table keep current view sets flag false (staleness). |
| 160 | ner/tests/test_views.py::TestExtractEntitiesView::test_extract_entities_defaults_to_groq_without_payload | Backend Integration/API | Extract entities defaults to groq without payload (views). |
| 161 | ner/tests/test_views.py::TestExtractEntitiesView::test_extract_entities_document_not_found | Backend Integration/API | Extract entities document not found (views). |
| 162 | ner/tests/test_views.py::TestExtractEntitiesView::test_extract_entities_groq_rate_limit | Backend Integration/API | Extract entities groq rate limit (views). |
| 163 | ner/tests/test_views.py::TestExtractEntitiesView::test_extract_entities_invalid_provider | Backend Integration/API | Extract entities invalid provider (views). |
| 164 | ner/tests/test_views.py::TestExtractEntitiesView::test_extract_entities_openai_request_payload | Backend Integration/API | Extract entities openai request payload (views). |
| 165 | ner/tests/test_views.py::TestExtractEntitiesView::test_extract_entities_replaces_previous | Backend Integration/API | Extract entities replaces previous (views). |
| 166 | ner/tests/test_views.py::TestExtractEntitiesView::test_extract_entities_success | Backend Integration/API | Extract entities success (views). |
| 167 | ner/tests/test_views.py::TestExtractEntitiesView::test_extract_entities_usage_fields_fallback_to_null | Backend Integration/API | Extract entities usage fields fallback to null (views). |
| 168 | ner/tests/test_views.py::TestExtractEntitiesView::test_extraction_entities_runs_contract_roundtrip | Backend Integration/API | Extraction entities runs contract roundtrip (views). |
| 169 | ner/tests/test_views.py::TestDocumentEntitiesView::test_get_entities_document_not_found | Backend Integration/API | Get entities document not found (views). |
| 170 | ner/tests/test_views.py::TestDocumentEntitiesView::test_get_entities_empty_document | Backend Integration/API | Get entities empty document (views). |
| 171 | ner/tests/test_views.py::TestDocumentEntitiesView::test_get_entities_success | Backend Integration/API | Get entities success (views). |
| 172 | ner/tests/test_views.py::TestGraphNodesView::test_get_graph_nodes_document_not_found | Backend Integration/API | Get graph nodes document not found (views). |
| 173 | ner/tests/test_views.py::TestGraphNodesView::test_get_graph_nodes_empty_document | Backend Integration/API | Get graph nodes empty document (views). |
| 174 | ner/tests/test_views.py::TestGraphNodesView::test_get_graph_nodes_missing_parameter | Backend Integration/API | Get graph nodes missing parameter (views). |
| 175 | ner/tests/test_views.py::TestGraphNodesView::test_get_graph_nodes_success | Backend Integration/API | Get graph nodes success (views). |
| 176 | ner/tests/test_views.py::TestDocumentRunsView::test_get_document_runs_document_not_found | Backend Integration/API | Get document runs document not found (views). |
| 177 | ner/tests/test_views.py::TestDocumentRunsView::test_get_document_runs_success | Backend Integration/API | Get document runs success (views). |
| 178 | ner/tests/test_views.py::TestExtractEntitiesRelationsView::test_extract_entities_relations_clean_slate | Backend Integration/API | Extract entities relations clean slate (views). |
| 179 | ner/tests/test_views.py::TestExtractEntitiesRelationsView::test_extract_entities_relations_document_not_found | Backend Integration/API | Extract entities relations document not found (views). |
| 180 | ner/tests/test_views.py::TestExtractEntitiesRelationsView::test_extract_entities_relations_success | Backend Integration/API | Extract entities relations success (views). |
| 181 | ner/tests/test_views.py::TestRelationsView::test_get_relations_document_not_found | Backend Integration/API | Get relations document not found (views). |
| 182 | ner/tests/test_views.py::TestRelationsView::test_get_relations_empty_document | Backend Integration/API | Get relations empty document (views). |
| 183 | ner/tests/test_views.py::TestRelationsView::test_get_relations_success | Backend Integration/API | Get relations success (views). |
| 184 | ner/tests/test_views.py::TestProjectExtractEntitiesView::test_extract_all_project_documents_when_document_id_missing | Backend Integration/API | Extract all project documents when document id missing (views). |
| 185 | ner/tests/test_views.py::TestProjectExtractEntitiesView::test_extract_cancelled_returns_partial_results | Backend Integration/API | Extract cancelled returns partial results (views). |
| 186 | ner/tests/test_views.py::TestProjectExtractEntitiesView::test_extract_single_document_with_fallback_relations | Backend Integration/API | Extract single document with fallback relations (views). |
| 187 | ner/tests/test_views.py::TestProjectExtractEntitiesView::test_project_extract_status_idle_by_default | Backend Integration/API | Project extract status idle by default (views). |
| 188 | ner/tests/test_views.py::TestProjectExtractEntitiesView::test_project_extract_stop_sets_cancel_requested | Backend Integration/API | Project extract stop sets cancel requested (views). |
| 189 | ner/tests/test_views.py::TestCrossProjectLeakageRegression::test_other_user_cannot_access_profile_for_foreign_entity | Backend Integration/API | Other user cannot access profile for foreign entity (views). |
| 190 | ner/tests/test_views.py::TestCrossProjectLeakageRegression::test_owner_can_access_profile_for_owned_entity | Backend Integration/API | Owner can access profile for owned entity (views). |
| 191 | ner/tests/test_workplan.py::TestWorkplan::test_generate_workplan_creates_structure_and_links_related_entity | Backend Service/Integration | Generate workplan creates structure and links related entity (workplan). |
| 192 | ner/tests/test_workplan.py::TestWorkplan::test_generate_workplan_falls_back_when_section_6_not_complete | Backend Service/Integration | Generate workplan falls back when section 6 not complete (workplan). |
| 193 | ner/tests/test_workplan.py::TestWorkplan::test_generate_workplan_replaces_existing_workplan | Backend Service/Integration | Generate workplan replaces existing workplan (workplan). |
| 194 | ner/tests/test_workplan.py::TestWorkplan::test_generate_workplan_retries_when_first_response_is_invalid_json | Backend Service/Integration | Generate workplan retries when first response is invalid json (workplan). |
| 195 | ner/tests/test_workplan.py::TestWorkplan::test_workplan_export_pdf_returns_file | Backend Service/Integration | Workplan export pdf returns file (workplan). |
| 196 | ner/tests/test_workplan.py::TestWorkplan::test_workplan_export_requires_generated_workplan | Backend Service/Integration | Workplan export requires generated workplan (workplan). |
| 197 | ner/tests/test_workplan.py::TestWorkplan::test_workplan_generate_view_starts_even_when_section_6_incomplete | Backend Service/Integration | Workplan generate view starts even when section 6 incomplete (workplan). |
| 198 | ner/tests/test_workplan.py::TestWorkplan::test_workplan_view_returns_components_without_prefetch_errors | Backend Service/Integration | Workplan view returns components without prefetch errors (workplan). |
| 199 | ingestion/tests/test_chunker.py::TestChunkText::test_empty_string_returns_empty_list | Backend Unit | Empty string returns empty list (chunker). |
| 200 | ingestion/tests/test_chunker.py::TestChunkText::test_whitespace_only_returns_empty_list | Backend Unit | Whitespace only returns empty list (chunker). |
| 201 | ingestion/tests/test_chunker.py::TestChunkText::test_chunks_do_not_exceed_max_tokens | Backend Unit | Chunks do not exceed max tokens (chunker). |
| 202 | ingestion/tests/test_chunker.py::TestChunkText::test_single_short_sentence_returns_one_chunk | Backend Unit | Single short sentence returns one chunk (chunker). |
| 203 | ingestion/tests/test_chunker.py::TestChunkText::test_overlap_means_adjacent_chunks_share_content | Backend Unit | Overlap means adjacent chunks share content (chunker). |
| 204 | ingestion/tests/test_embedder.py::TestEmbedChunks::test_returns_list_of_384_dim_arrays | Backend Unit | Returns list of 384 dim arrays (embedder). |
| 205 | ingestion/tests/test_embedder.py::TestEmbedChunks::test_encode_called_with_all_chunks | Backend Unit | Encode called with all chunks (embedder). |
| 206 | ingestion/tests/test_embedder.py::TestEmbedChunks::test_raises_embedding_error_when_model_is_none | Backend Unit | Raises embedding error when model is none (embedder). |
| 207 | ingestion/tests/test_embedder.py::TestEmbedChunks::test_raises_embedding_error_on_wrong_dimension | Backend Unit | Raises embedding error on wrong dimension (embedder). |
| 208 | ingestion/tests/test_embedder.py::TestEmbedChunks::test_raises_embedding_error_on_model_exception | Backend Unit | Raises embedding error on model exception (embedder). |
| 209 | ingestion/tests/test_extractor.py::TestExtractText::test_clean_text_removes_markdown_urls_and_nav_noise | Backend Unit | Clean text removes markdown urls and nav noise (extractor). |
| 210 | ingestion/tests/test_extractor.py::TestExtractText::test_clean_web_text_filters_script_and_navigation_fragments | Backend Unit | Clean web text filters script and navigation fragments (extractor). |
| 211 | ingestion/tests/test_extractor.py::TestExtractText::test_extract_txt_returns_text | Backend Unit | Extract txt returns text (extractor). |
| 212 | ingestion/tests/test_extractor.py::TestExtractText::test_extract_txt_decodes_utf8 | Backend Unit | Extract txt decodes utf8 (extractor). |
| 213 | ingestion/tests/test_extractor.py::TestExtractText::test_extract_markdown_returns_text | Backend Unit | Extract markdown returns text (extractor). |
| 214 | ingestion/tests/test_extractor.py::TestExtractText::test_extract_txt_empty_file_raises | Backend Unit | Extract txt empty file raises (extractor). |
| 215 | ingestion/tests/test_extractor.py::TestExtractText::test_extract_txt_whitespace_only_raises | Backend Unit | Extract txt whitespace only raises (extractor). |
| 216 | ingestion/tests/test_extractor.py::TestExtractText::test_extract_pdf_returns_combined_page_text | Backend Unit | Extract pdf returns combined page text (extractor). |
| 217 | ingestion/tests/test_extractor.py::TestExtractText::test_extract_pdf_no_text_raises | Backend Unit | Extract pdf no text raises (extractor). |
| 218 | ingestion/tests/test_extractor.py::TestExtractText::test_extract_docx_returns_paragraph_text | Backend Unit | Extract docx returns paragraph text (extractor). |
| 219 | ingestion/tests/test_extractor.py::TestExtractText::test_extract_docx_empty_paragraphs_raises | Backend Unit | Extract docx empty paragraphs raises (extractor). |
| 220 | ingestion/tests/test_health.py::TestHealthView::test_healthy_returns_200_with_status | Backend Unit | Healthy returns 200 with status (health). |
| 221 | ingestion/tests/test_health.py::TestHealthView::test_unhealthy_returns_503_when_db_unreachable | Backend Unit | Unhealthy returns 503 when db unreachable (health). |
| 222 | ingestion/tests/test_health.py::TestHealthView::test_response_fields_are_exactly_status_and_database | Backend Unit | Response fields are exactly status and database (health). |
| 223 | ingestion/tests/test_settings.py::TestRequiredEnvVars::test_missing_database_url_fails_with_named_error | Backend Unit | Missing database url fails with named error (settings). |
| 224 | ingestion/tests/test_settings.py::TestRequiredEnvVars::test_missing_debug_fails_with_named_error | Backend Unit | Missing debug fails with named error (settings). |
| 225 | ingestion/tests/test_settings.py::TestRequiredEnvVars::test_missing_allowed_hosts_fails_with_named_error | Backend Unit | Missing allowed hosts fails with named error (settings). |
| 226 | ingestion/tests/test_settings.py::TestRequiredEnvVars::test_all_required_vars_set_does_not_raise | Backend Unit | All required vars set does not raise (settings). |
| 227 | ner/tests/test_costing.py::test_calculate_openai_cost_gpt_5_mini | Backend Unit | Calculate openai cost gpt 5 mini (costing). |
| 228 | ner/tests/test_costing.py::test_calculate_openai_cost_gpt_5_nano | Backend Unit | Calculate openai cost gpt 5 nano (costing). |
| 229 | ner/tests/test_edge_cases.py::TestGroqClientEdgeCases::test_groq_returns_low_confidence_entities | Backend Unit | Groq returns low confidence entities (edge_cases). |
| 230 | ner/tests/test_edge_cases.py::TestGroqClientEdgeCases::test_groq_returns_empty_entity_list | Backend Unit | Groq returns empty entity list (edge_cases). |
| 231 | ner/tests/test_edge_cases.py::TestGroqClientEdgeCases::test_chunk_with_special_characters_and_emoji | Backend Unit | Chunk with special characters and emoji (edge_cases). |
| 232 | ner/tests/test_edge_cases.py::TestGroqClientEdgeCases::test_chunk_with_mixed_languages | Backend Unit | Chunk with mixed languages (edge_cases). |
| 233 | ner/tests/test_edge_cases.py::TestGroqClientEdgeCases::test_whitespace_only_text | Backend Unit | Whitespace only text (edge_cases). |
| 234 | ner/tests/test_edge_cases.py::TestGroqClientEdgeCases::test_groq_response_with_extra_fields | Backend Unit | Groq response with extra fields (edge_cases). |
| 235 | ner/tests/test_groq_client.py::TestLoadNERPrompt::test_load_prompt_from_file | Backend Unit | Load prompt from file (groq_client). |
| 236 | ner/tests/test_groq_client.py::TestLoadNERPrompt::test_load_prompt_default_when_file_missing | Backend Unit | Load prompt default when file missing (groq_client). |
| 237 | ner/tests/test_groq_client.py::TestExtractEntitiesFromChunk::test_extract_entities_success | Backend Unit | Extract entities success (groq_client). |
| 238 | ner/tests/test_groq_client.py::TestExtractEntitiesFromChunk::test_extract_entities_empty_text | Backend Unit | Extract entities empty text (groq_client). |
| 239 | ner/tests/test_groq_client.py::TestExtractEntitiesFromChunk::test_extract_entities_invalid_json | Backend Unit | Extract entities invalid json (groq_client). |
| 240 | ner/tests/test_groq_client.py::TestExtractEntitiesFromChunk::test_extract_entities_rate_limit | Backend Unit | Extract entities rate limit (groq_client). |
| 241 | ner/tests/test_groq_client.py::TestExtractEntitiesFromChunk::test_extract_entities_api_failure | Backend Unit | Extract entities api failure (groq_client). |
| 242 | ner/tests/test_openai_client.py::test_extract_entities_openai_success | Backend Unit | Extract entities openai success (openai_client). |
| 243 | ner/tests/test_openai_client.py::test_extract_entities_openai_rate_limit | Backend Unit | Extract entities openai rate limit (openai_client). |
| 244 | ner/tests/test_openai_client.py::test_extract_entities_openai_empty_content_returns_empty | Backend Unit | Extract entities openai empty content returns empty (openai_client). |
| 245 | ner/tests/test_relation_extractor.py::test_validate_relations_discard_dangling_refs | Backend Unit | Validate relations discard dangling refs (relation_extractor). |
| 246 | ner/tests/test_relation_extractor.py::test_validate_relations_discard_self_loops | Backend Unit | Validate relations discard self loops (relation_extractor). |
| 247 | ner/tests/test_relation_extractor.py::test_validate_relations_discard_low_confidence | Backend Unit | Validate relations discard low confidence (relation_extractor). |
| 248 | ner/tests/test_relation_extractor.py::test_validate_relations_clamps_confidence_range | Backend Unit | Validate relations clamps confidence range (relation_extractor). |
| 249 | ner/tests/test_relation_extractor.py::test_validate_relations_label_too_long | Backend Unit | Validate relations label too long (relation_extractor). |
| 250 | ner/tests/test_relation_extractor.py::test_validate_relations_normalizes_labels_to_uppercase | Backend Unit | Validate relations normalizes labels to uppercase (relation_extractor). |
| 251 | ner/tests/test_semantic_search.py::test_embed_query_returns_list | Backend Unit | Embed query returns list (semantic_search). |
| 252 | ner/tests/test_text_quality.py::test_normalize_llm_text_removes_markdown_artifacts_and_lists | Backend Unit | Normalize llm text removes markdown artifacts and lists (text_quality). |
| 253 | ner/tests/test_text_quality.py::test_enforce_minimum_specificity_replaces_too_short_generic_text | Backend Unit | Enforce minimum specificity replaces too short generic text (text_quality). |

## Frontend Tests

| # | Test ID | Type | Description |
|---:|---|---|---|
| 254 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\upload.test.tsx::UploadPage > renders the drop zone and step indicator | Backend Unit | UploadPage > renders the drop zone and step indicator (upload.test). |
| 255 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\upload.test.tsx::UploadPage > shows browse link in drop zone | Backend Unit | UploadPage > shows browse link in drop zone (upload.test). |
| 256 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\upload.test.tsx::UploadPage > displays selected file name | Backend Unit | UploadPage > displays selected file name (upload.test). |
| 257 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\upload.test.tsx::UploadPage > accepts markdown file selection | Backend Unit | UploadPage > accepts markdown file selection (upload.test). |
| 258 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\upload.test.tsx::UploadPage > validates unsupported file formats | Backend Unit | UploadPage > validates unsupported file formats (upload.test). |
| 259 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\upload.test.tsx::UploadPage > shows Upload Document button after file selection | Backend Unit | UploadPage > shows Upload Document button after file selection (upload.test). |
| 260 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\upload.test.tsx::UploadPage > uploads document and shows Extract button on success | Backend Unit | UploadPage > uploads document and shows Extract button on success (upload.test). |
| 261 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\upload.test.tsx::UploadPage > completes full upload→extract flow and navigates | Backend Unit | UploadPage > completes full upload→extract flow and navigates (upload.test). |
| 262 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\upload.test.tsx::UploadPage > shows error on upload failure | Backend Unit | UploadPage > shows error on upload failure (upload.test). |
| 263 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\upload.test.tsx::UploadPage > shows error on extraction failure | Backend Unit | UploadPage > shows error on extraction failure (upload.test). |
| 264 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\upload.test.tsx::UploadPage > uses selected OpenAI provider/model for extraction | Backend Unit | UploadPage > uses selected OpenAI provider/model for extraction (upload.test). |
| 265 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\upload.test.tsx::UploadPage > shows "Extract Entities + Relations" button after upload success | Backend Unit | UploadPage > shows "Extract Entities + Relations" button after upload success (upload.test). |
| 266 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\upload.test.tsx::UploadPage > shows completion summary with both entity and relation counts for joint extraction | Backend Unit | UploadPage > shows completion summary with both entity and relation counts for joint extraction (upload.test). |
| 267 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\upload.test.tsx::UploadPage > shows relation metadata in Recent Documents when available | Backend Unit | UploadPage > shows relation metadata in Recent Documents when available (upload.test). |
| 268 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\graph.test.tsx::GraphPage > renders the document ID input and Load button | Backend Unit | GraphPage > renders the document ID input and Load button (graph.test). |
| 269 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\graph.test.tsx::GraphPage > shows empty state when no document is loaded | Backend Unit | GraphPage > shows empty state when no document is loaded (graph.test). |
| 270 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\graph.test.tsx::GraphPage > loads and displays graph nodes from query param | Backend Unit | GraphPage > loads and displays graph nodes from query param (graph.test). |
| 271 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\graph.test.tsx::GraphPage > loads nodes when submitting document ID form | Backend Unit | GraphPage > loads nodes when submitting document ID form (graph.test). |
| 272 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\graph.test.tsx::GraphPage > shows error message on API failure | Backend Unit | GraphPage > shows error message on API failure (graph.test). |
| 273 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\graph.test.tsx::GraphPage > shows empty state when no nodes returned | Backend Unit | GraphPage > shows empty state when no nodes returned (graph.test). |
| 274 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\graph.test.tsx::GraphPage > shows node detail panel on node click | Backend Unit | GraphPage > shows node detail panel on node click (graph.test). |
| 275 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\graph.test.tsx::GraphPage > shows confidence filter when document is loaded | Backend Unit | GraphPage > shows confidence filter when document is loaded (graph.test). |
| 276 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\graph.test.tsx::GraphPage > renders relation edge labels when edges are returned | Backend Unit | GraphPage > renders relation edge labels when edges are returned (graph.test). |
| 277 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\graph.test.tsx::GraphPage > passes node shapes from API payload to graph component | Backend Unit | GraphPage > passes node shapes from API payload to graph component (graph.test). |
| 278 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\graph.test.tsx::GraphPage > refetches graph data with confidence threshold when slider changes | Backend Unit | GraphPage > refetches graph data with confidence threshold when slider changes (graph.test). |
| 279 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\graph.test.tsx::GraphPage > remains compatible when API returns nodes with no edges field | Backend Unit | GraphPage > remains compatible when API returns nodes with no edges field (graph.test). |
| 280 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\entities.test.tsx::GlobalEntitiesPage > renders entity list after loading | Backend Unit | GlobalEntitiesPage > renders entity list after loading (entities.test). |
| 281 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\entities.test.tsx::GlobalEntitiesPage > shows empty state when no entities found | Backend Unit | GlobalEntitiesPage > shows empty state when no entities found (entities.test). |
| 282 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\entities.test.tsx::GlobalEntitiesPage > renders entity type filter dropdown | Backend Unit | GlobalEntitiesPage > renders entity type filter dropdown (entities.test). |
| 283 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\entities.test.tsx::GlobalEntitiesPage > filters entities by type when select changes | Backend Unit | GlobalEntitiesPage > filters entities by type when select changes (entities.test). |
| 284 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\graph-visuals.test.tsx::Graph visuals encoding > passes style and scaling fields through to the graph renderer | Backend Unit | Graph visuals encoding > passes style and scaling fields through to the graph renderer (graph-visuals.test). |
| 285 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\graph-visuals.test.tsx::Graph visuals encoding > sends zoom commands from page controls | Backend Unit | Graph visuals encoding > sends zoom commands from page controls (graph-visuals.test). |
| 286 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\workspace-panel.test.tsx::Workspace context links > shows analysis links for full graph and relations table | Backend Unit | Workspace context links > shows analysis links for full graph and relations table (workspace-panel.test). |
| 287 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\graph-focus-filters.test.tsx::Graph focus/filter/search interactions > applies client-side filters and search highlighting | Backend Unit | Graph focus/filter/search interactions > applies client-side filters and search highlighting (graph-focus-filters.test). |
| 288 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\graph-focus-filters.test.tsx::Graph focus/filter/search interactions > activates and resets focus mode using shift-click and background click | Backend Unit | Graph focus/filter/search interactions > activates and resets focus mode using shift-click and background click (graph-focus-filters.test). |
| 289 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\report-section-card.test.tsx::ReportSectionCard > shows pending state and keeps regenerate available | Backend Unit | ReportSectionCard > shows pending state and keeps regenerate available (report-section-card.test). |
| 290 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\report-section-card.test.tsx::ReportSectionCard > replaces initiative placeholders in done text | Backend Unit | ReportSectionCard > replaces initiative placeholders in done text (report-section-card.test). |
| 291 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\report-section-card.test.tsx::ReportSectionCard > normalizes markdown artifacts in done text rendering | Backend Unit | ReportSectionCard > normalizes markdown artifacts in done text rendering (report-section-card.test). |
| 292 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\report-section-card.test.tsx::ReportSectionCard > passes refinement instruction when regenerating | Backend Unit | ReportSectionCard > passes refinement instruction when regenerating (report-section-card.test). |
| 293 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\entity-summary.test.tsx::Entity summary UI states > renders idle state and triggers generate/refresh actions | Backend Unit | Entity summary UI states > renders idle state and triggers generate/refresh actions (entity-summary.test). |
| 294 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\entity-summary.test.tsx::Entity summary UI states > renders loading and ready states | Backend Unit | Entity summary UI states > renders loading and ready states (entity-summary.test). |
| 295 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\pages\entity-summary.test.tsx::Entity summary UI states > renders fallback state with retry path available | Backend Unit | Entity summary UI states > renders fallback state with retry path available (entity-summary.test). |
| 296 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\lib\api.test.ts::apiClient initialisation > creates an axios instance with correct defaults | Backend Unit | ApiClient initialisation > creates an axios instance with correct defaults (api.test). |
| 297 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\lib\api.test.ts::apiClient initialisation > registers a response interceptor | Backend Unit | ApiClient initialisation > registers a response interceptor (api.test). |
| 298 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\lib\api.test.ts::error interceptor > maps 404 responses to "Resource not found" | Backend Unit | Error interceptor > maps 404 responses to "Resource not found" (api.test). |
| 299 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\lib\api.test.ts::error interceptor > maps 429 responses to rate-limit message | Backend Unit | Error interceptor > maps 429 responses to rate-limit message (api.test). |
| 300 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\lib\api.test.ts::error interceptor > maps provider-specific 429 responses to remediation message | Backend Unit | Error interceptor > maps provider-specific 429 responses to remediation message (api.test). |
| 301 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\lib\api.test.ts::error interceptor > maps 500 responses to server-error message | Backend Unit | Error interceptor > maps 500 responses to server-error message (api.test). |
| 302 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\lib\api.test.ts::error interceptor > maps network errors (no response) to network message | Backend Unit | Error interceptor > maps network errors (no response) to network message (api.test). |
| 303 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\lib\api.test.ts::uploadDocument > posts multipart form data and returns document info | Backend Unit | UploadDocument > posts multipart form data and returns document info (api.test). |
| 304 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\lib\api.test.ts::extractEntities > calls POST extract-entities and returns count | Backend Unit | ExtractEntities > calls POST extract-entities and returns count (api.test). |
| 305 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\lib\api.test.ts::extractEntities > passes provider/model options when supplied | Backend Unit | ExtractEntities > passes provider/model options when supplied (api.test). |
| 306 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\lib\api.test.ts::getEntities > fetches entities for a document | Backend Unit | GetEntities > fetches entities for a document (api.test). |
| 307 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\lib\api.test.ts::getEntities > passes optional filters | Backend Unit | GetEntities > passes optional filters (api.test). |
| 308 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\lib\api.test.ts::getGraphNodes > fetches Cytoscape nodes for a document | Backend Unit | GetGraphNodes > fetches Cytoscape nodes for a document (api.test). |
| 309 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\lib\api.test.ts::project graph + summary/profile APIs > maps enhanced project graph payload fields | Backend Unit | Project graph + summary/profile APIs > maps enhanced project graph payload fields (api.test). |
| 310 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\lib\api.test.ts::project graph + summary/profile APIs > calls entity profile endpoint | Backend Unit | Project graph + summary/profile APIs > calls entity profile endpoint (api.test). |
| 311 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\lib\api.test.ts::project graph + summary/profile APIs > calls contextual summary endpoint with refresh flag | Backend Unit | Project graph + summary/profile APIs > calls contextual summary endpoint with refresh flag (api.test). |
| 312 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\lib\api.test.ts::getDocumentRuns > fetches run history for a document | Backend Unit | GetDocumentRuns > fetches run history for a document (api.test). |
| 313 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\lib\api.test.ts::auth APIs > stores token and user on register | Backend Unit | Auth APIs > stores token and user on register (api.test). |
| 314 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\lib\api.test.ts::auth APIs > stores token and user on login | Backend Unit | Auth APIs > stores token and user on login (api.test). |
| 315 | C:\Users\ramad\dev\UNDP\stakeholder-analysis-tool\frontend\src\__tests__\lib\api.test.ts::auth APIs > clears storage on logout | Backend Unit | Auth APIs > clears storage on logout (api.test). |
