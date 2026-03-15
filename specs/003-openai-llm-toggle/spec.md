# Feature Specification: Multi-LLM NER Selection

**Feature Branch**: `003-openai-llm-toggle`  
**Created**: 2026-03-14  
**Status**: Draft  
**Input**: User description: "Create a frontend option to use OpenAI LLM instead of Groq for NER, allow model selection between gpt-5-mini and gpt-5-nano, track tokens and cost, and support multiple extractions per document with LLM history"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose LLM for extraction (Priority: P1)

As an analyst running entity extraction, I can choose which LLM provider and model to use before starting NER so I can trade off extraction quality and cost.

**Why this priority**: Model/provider choice is the core business request and directly controls extraction quality outcomes.

**Independent Test**: Can be fully tested by running extraction from the frontend with each supported option and confirming extraction completes with unchanged output structure.

**Acceptance Scenarios**:

1. **Given** a document ready for NER, **When** the analyst selects Groq and starts extraction, **Then** extraction runs with Groq behavior unchanged from current baseline.
2. **Given** a document ready for NER, **When** the analyst selects OpenAI with `gpt-5-mini` and starts extraction, **Then** extraction completes and returns the same output structure currently used by Groq.
3. **Given** a document ready for NER, **When** the analyst selects OpenAI with `gpt-5-nano` and starts extraction, **Then** extraction completes and returns the same output structure currently used by Groq.

---

### User Story 2 - View usage and cost transparency (Priority: P2)

As an analyst, I can see which LLM was used, how many tokens were consumed, and the resulting cost so I can monitor spend per extraction.

**Why this priority**: Cost visibility is required for model governance and practical model selection decisions.

**Independent Test**: Can be tested by running one extraction per OpenAI model and verifying provider, model, token counts, and computed costs are displayed using the defined pricing.

**Acceptance Scenarios**:

1. **Given** an extraction just completed, **When** usage data is available, **Then** the UI displays provider, model, input tokens, cached input tokens (if any), output tokens, and total cost for that extraction.
2. **Given** OpenAI extraction usage values are available, **When** the cost is displayed, **Then** the total is calculated with these per-1M-token rates: `gpt-5-mini` input `$0.25`, cached input `$0.025`, output `$2.00`; `gpt-5-nano` input `$0.05`, cached input `$0.005`, output `$0.40`.
3. **Given** usage metadata is unavailable from the provider, **When** results are shown, **Then** extraction succeeds and the UI clearly marks unavailable usage/cost values without blocking the workflow.

---

### User Story 3 - Track multiple runs per document (Priority: P3)

As an analyst, I can run NER multiple times on the same uploaded document with different LLM selections and see which LLMs were used so I can compare outcomes over time.

**Why this priority**: Comparative extraction across models is explicitly requested and enables quality/cost evaluation per document.

**Independent Test**: Can be tested by running at least three extractions on one document using different LLM selections and confirming the document history records each run distinctly.

**Acceptance Scenarios**:

1. **Given** a previously uploaded document, **When** the analyst starts a new extraction with a different LLM selection, **Then** the system creates a new extraction record instead of overwriting prior results.
2. **Given** a document with multiple extraction runs, **When** the analyst views document details, **Then** the UI lists all LLMs/models used for that document and identifies which run each result came from.

### Edge Cases

- User selects OpenAI in the UI but required OpenAI credentials are missing or invalid at runtime.
- User switches model/provider selection between runs on the same document and expects prior runs to remain intact.
- Token usage returns zero or partial fields (for example, no cached input tokens) and cost calculation still needs deterministic behavior.
- A previously supported Groq flow is used after OpenAI runs and must remain behaviorally consistent with current output format.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a frontend control to choose the LLM provider for each NER execution, with at least `Groq` and `OpenAI` options.
- **FR-002**: When `OpenAI` is selected, the system MUST provide model choices `gpt-5-mini` and `gpt-5-nano`.
- **FR-003**: The system MUST preserve existing Groq-based NER behavior and output structure when Groq is selected.
- **FR-004**: For OpenAI-based NER, the system MUST return extraction output in the same shape currently expected by Groq-based downstream consumers.
- **FR-005**: The system MUST capture and associate with each extraction run: selected provider, selected model, token usage fields (input, cached input when available, output), and computed monetary cost.
- **FR-006**: The system MUST compute and display OpenAI extraction cost using the provided pricing table per 1,000,000 tokens:
  - `gpt-5-mini`: input `$0.25`, cached input `$0.025`, output `$2.00`
  - `gpt-5-nano`: input `$0.05`, cached input `$0.005`, output `$0.40`
- **FR-007**: The frontend MUST display, for each extraction result, the LLM provider/model used, token counts, and total cost in a visible location tied to that run.
- **FR-008**: The system MUST allow the same document to undergo multiple NER runs and MUST keep each run as a separate result record.
- **FR-009**: For each document, the frontend MUST show the list of LLM provider/model combinations used across all recorded extraction runs.
- **FR-010**: If usage or pricing inputs are unavailable for a completed run, the system MUST keep extraction results available and mark the corresponding token/cost fields as unavailable rather than failing the run.
- **FR-011**: The default selection for users who do not explicitly change options MUST keep current behavior (Groq path) to avoid unexpected workflow changes.
- **FR-012**: The system MUST ensure users can intentionally toggle LLM choice on the frontend before submitting each extraction run.

### Key Entities *(include if feature involves data)*

- **Extraction Run**: A single NER execution event for a document. Includes run timestamp, provider, model, extraction output, status, token usage, and run cost.
- **Usage Metrics**: Token accounting associated with one extraction run, including input tokens, cached input tokens, output tokens, and calculation readiness state.
- **Document Extraction History**: Collection of extraction runs associated with one document, preserving ordering and allowing users to identify which LLM/model generated each run.

### Assumptions

- Both provider credentials (Groq and OpenAI) are supplied in environment configuration by operators.
- OpenAI usage responses provide enough token information to calculate cost in most successful runs.
- Cost display is informational for users and does not represent billing settlement.
- Existing document upload and NER trigger flows remain unchanged except for added model/provider selection and usage display.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of NER runs initiated from the frontend record and display which LLM provider/model was used.
- **SC-002**: At least 95% of successful OpenAI extraction runs display complete token usage and computed total cost within 5 seconds after results are shown.
- **SC-003**: 100% of sampled documents with multiple NER runs retain all historical runs without overwriting previous run results.
- **SC-004**: In acceptance testing, analysts can complete one extraction with Groq, one with `gpt-5-mini`, and one with `gpt-5-nano` on the same document with no required change to downstream result consumption.
- **SC-005**: In user validation sessions, at least 90% of participants can correctly identify the LLM used and estimated cost for a selected run without additional guidance.
