# Quote Assistant Plan

Updated: 2026-03-31

Update: 2026-04-01

## What landed

BadShuffle now has a first internal quote assistant foundation instead of a single isolated AI suggestion flow.

Implemented in this pass:

- server-side quote assistant service with a read-only tool registry
- provider abstraction with OpenAI synthesis when configured and deterministic fallback when not configured
- persistent quote-scoped assistant transcripts in `quote_agent_messages`
- new authenticated API endpoints:
  - `GET /api/ai/quotes/:id/assistant`
  - `POST /api/ai/quotes/:id/assistant`
- shared item recommendation service used by both the existing suggest flow and the new quote assistant
- new Quote Detail `Assistant` tab in the client UI
- follow-up pass:
  - richer quote visibility for the assistant, including line items, quantities, stock counts, and visible-item snapshots
  - better recommendation prompt inputs (sections, quote context, categories, stock)
  - improved assistant UX with quote-context summary cards and visible item chips
  - dedicated assistant history clear endpoint and UI action

## Tool registry in the current implementation

The assistant currently reasons over these read-only BadShuffle-native tools:

- `quote_overview`
- `quote_financials`
- `inventory_pressure`
- `activity_digest`
- `item_recommendations`
- `client_follow_up_draft`

This is intentionally product-native. The assistant is not a general-purpose shell agent and does not execute arbitrary tools.

## Why this path

The goal was to take the reusable ideas from agent-harness systems without importing their runtime shape into BadShuffle.

That means:

- keep BadShuffle as the product shell
- keep the assistant domain-scoped and permission-aware
- use deterministic internal tools as the source of truth
- make the LLM layer optional instead of foundational

## Constraints in the current implementation

- the assistant is read-only
- it does not execute mutations such as sending emails, editing quotes, or changing fulfillment state
- the provider abstraction is ready for multiple providers, but OpenAI is the only live adapter currently wired because that is the only installed SDK in the server package today
- assistant configuration uses defaults / stored settings keys if present, but there is not yet a Settings UI surface for the assistant-specific provider/model keys

## Recommended next steps

Priority order:

1. Add assistant-specific Settings UI for:
   - `ai_agent_provider`
   - `ai_agent_model`
   - `ai_agent_enabled`

2. Expand the tool registry with higher-value operational tools:
   - quote availability/conflict summary
   - fulfillment readiness summary
   - quote message digest
   - lead history / prior client relationship summary
   - public quote health / expiration / unsigned-change audit

3. Add safe action-draft flows before action execution:
   - draft message to client
   - draft internal fulfillment note
   - draft quote revision checklist

4. Add “operator memory” around quotes:
   - assistant bookmarks / saved prompts
   - pinned assistant summaries per quote
   - one-click “refresh summary” message

5. Consider a broader project assistant after the quote path proves useful:
   - inventory page assistant
   - lead triage assistant
   - fulfillment assistant

## Explicit non-goals

These were intentionally not done in this pass:

- importing an external agent harness runtime into the product
- adding Python or Rust as a runtime dependency for BadShuffle
- giving the assistant arbitrary shell, file, or network tool access
- letting the assistant perform writes without a product-specific approval layer
