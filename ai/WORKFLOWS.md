# BadShuffle — Workflows

## Quote Workflow

**Inquiry → Quote → Approval → Order → Fulfillment**

1. **Inquiry / Lead**  
   Lead created (manual or import). Optionally link to a quote later (quote_id on lead, lead_id on quote).

2. **Quote (draft)**  
   Create quote; add client/venue info; add line items (inventory + custom). Some items can be “hidden from quote” (internal only). Set tax rate, quote notes. Status = draft.

3. **Send to client**  
   Staff clicks “Send to Client”; chooses email template, edits subject/body, sends. Server sets status = sent, generates public_token if missing, sends email via SMTP (if configured), logs message. Client receives link: `/quote/public/:token`.

4. **Client view / approve**  
   Client opens public link; sees read-only quote (and contract if present). Can print/save PDF. “Approve this Quote” → POST approve-by-token → status = approved. Contract can be signed on same page (signature + name).

5. **Order**  
   No separate order entity. **Approved quote = order.** Staff uses quote detail for fulfillment; no pull sheet or order state machine in the app.

6. **Fulfillment**  
   Not modeled in code. Conceptually: order confirmed → pull sheet → warehouse pull → load truck → delivery/setup → return/reconciliation. **Pull sheets and warehouse/delivery steps are not implemented.**

---

## Operations Workflow (Conceptual Only)

**Order confirmed → Pull sheet → Warehouse pull → Load truck → Delivery/setup → Return/reconciliation**

- **Order confirmed:** In BadShuffle this is “quote status = approved”.
- **Pull sheet:** Not implemented. No pull sheet generation, no table, no UI.
- **Warehouse pull / load / delivery / return:** Not implemented. No state, no routes, no inventory reservation or return tracking.

Logistics in the app is only: items with category containing “logistics” are grouped in quote totals and in export (delivery/pickup section). No workflow steps.

---

## Supporting Flows

- **Contract:** Staff edits contract body (or from template) on quote Contract tab. Client sees contract on public page; can sign (checkbox + name). Contract logs record body changes.
- **Billing:** Staff adds payments (and refunds) on quote Payments tab. Billing page shows global billing history. No invoice generation in app.
- **Messages:** Outbound send logs to messages; IMAP poll (if configured) fetches replies and links to quote; Messages page shows thread.
- **Presence:** Client reports current path on route change; GET presence shows who’s online (for sidebar “team” section).
