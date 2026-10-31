# Idea activity chat history: product research

- Date: 2026-10-31
- Scope: private Idea board → request details → Activity → corresponding agent-run disclosure.
- Method: current implementation and owner brief review, primary-source pattern research, implementation-oriented acceptance review. This is expert research; no user study was conducted.

## User goals and current evidence

The streamer needs to understand what was asked, what the model returned and which attempt produced an outcome before deciding whether to trust, retry or review work. This supports request-to-recognition and recovery without sending another provider request.

`IdeaActivityTab.vue` currently renders timeline events and one native disclosure per job. Its body contains only logs. `use-idea-drawer.ts` projects stage, provider and status but omits captured inputs, answers, model and timestamps. `AgentJob` has no conversation field, so historical transcripts cannot be truthfully reconstructed. A current project prompt or current request body is not evidence of a past dispatch. `design/traceability.json` has no requirement entries; acceptance belongs to focused behavioral tests and this task record rather than invented IDs.

## Research and decisions

| Perspective | Finding and source | Increment decision |
| --- | --- | --- |
| Operator attention and information architecture | GOV.UK recommends details for supplementary content and clear descriptive summaries, while keeping routinely necessary information visible. [Details guidance](https://design-system.service.gov.uk/components/details/) | Preserve per-run disclosures in Activity. Keep stage, status, provider/model and time visible. Show prompt and response together inside the affected attempt; keep extended instructions and diagnostics subordinate. |
| Accessibility | WAI's disclosure pattern specifies a focusable control, expanded state and Enter/Space interaction. [WAI disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Use native `details`/`summary`, an explicit chevron, visible focus and textual status. Preserve browser semantics instead of a menu or custom accordion. |
| Long-form reading | Long unbroken strings can break narrow or zoomed layouts. [W3C technique C33](https://www.w3.org/WAI/WCAG22/Techniques/css/C33) | Preserve line breaks and wrap prompt/response text. Keep it selectable and contained in the drawer. Check narrow leaves and long strings. |
| AI transparency and calibrated trust | Microsoft's human-AI guidelines emphasize relevant information, capability limits and explaining system behavior. [Research guidelines](https://www.microsoft.com/en-us/research/articles/guidelines-for-human-ai-interaction-eighteen-best-practices-for-human-centered-ai-design/) | Label the actual prompt and returned response, separate them from execution logs, and distinguish simulation from provider execution. Do not present an answer as proof of successful validation or implementation. |
| Provenance and reliability | NIST describes provenance as origin/history evidence and discusses model/content attribution and creation times. [Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) | Capture at dispatch and response boundaries against the job ID; retain immutable captured inputs across edits/reload, preserve retries separately and display capture timestamps. Missing evidence stays explicitly unavailable. |
| Privacy and output handling | OWASP identifies both inputs and model outputs as trust boundaries and recommends restricting sensitive-data exposure. [Sensitive information disclosure](https://genai.owasp.org/llmrisk2023-24/llm06-sensitive-information-disclosure/) | Store transcript evidence in the existing private job journal, exclude it from public projections and structured diagnostics, render escaped plain text and avoid executable Markdown/HTML. Never expose credentials or native environment/configuration. |
| Maintainability and performance | The repository owns canonical state in application services and keeps Vue scripts declarative. | Add a typed optional conversation contract with bounded fields and explicit truncation. Keep presentation projection in TypeScript and reuse existing drawer/disclosure styling. Old data remains compatible. |

These are design inferences from the cited principles applied to this product, not requirements asserted by the sources themselves.

## Acceptance cases

1. After a real dispatched job, opening its existing Activity disclosure shows its captured instructions, prompt and returned answer, along with captured provider/model and time. Because the prompt is durably captured before dispatch, its label and explanatory copy must not treat capture as proof of provider delivery.
2. Changing project instructions, the request or workflow later does not rewrite that attempt's evidence. A retry has its own disclosure and payload.
3. Reload retains captured text. Merely opening, expanding or reading history performs no writes, dispatch, retry or status transition.
4. A running job can show captured input before a response. Failed/cancelled jobs retain available evidence without claiming success; missing output is named plainly.
5. An older job with no capture says history was not recorded. It never substitutes today's prompt or idea result.
6. Demo jobs explicitly say Simulation and label their input/output as simulated; no LLM contact is implied.
7. Bounded evidence reports truncation, and any unavailable or partial content is distinguishable from a complete response.
8. HTML-like text, Markdown and long unbroken strings remain literal, selectable and wrapped. Keyboard disclosure and visible focus work in the actual Obsidian host.
9. A different idea's attempts and private prompt/response text never appear in this idea or public viewer exports.
10. External MCP clients identify supplied context and submitted output without claiming to capture the external conversation or know its model. Provider coverage describes the initial exchange; it never claims intermediate tool turns or hidden reasoning.
11. Claude and Codex response captures redact recognizable credentials using the existing transport privacy filter and explain this change in the reading view. Dispatch and semantic validation remain unchanged; the filter does not promise exhaustive secret detection.
12. Recorded workflow reasoning effort accompanies captured model provenance. Missing/default values and external/simulated runs do not infer effort from current settings. Codex records visible agent output, excluding transport tool events and hidden reasoning.

## Prioritized improvement and polishing plan

1. **Evidence integrity:** failing application tests, typed optional persisted conversation, capture at provider boundaries, bounded text with explicit truncation, private storage/public exclusion, failure and reload behavior.
2. **Reading path:** failing mounted UI tests, per-run prompt/response presentation, capture provenance, honest legacy/waiting/failed/simulated states and separate diagnostics.
3. **Qualification:** focused tests, full repository gates, UI quality/gallery, dedicated native Obsidian interaction/screenshot evidence, and independent review of ownership, privacy and provider coverage.
4. **Polish:** inspect wide/narrow and theme captures once together; fix hierarchy, wrapping, focus, disclosure affordance and misleading copy in one batch, then confirm. Record residual limits and real command results in the parent delivery plan and PR.

Search, transcript export/copy, retention settings, replay, new provider execution and a standalone chat workspace are not needed for this request's reading goal. They should be separate product decisions if later requested.
