# Core migration evidence

The initial DGP Core slice deliberately retains interpretation behavior proven by the legacy Digital Service Engine while accepting only the canonical DGP v1 contract.

| Concern | Legacy evidence | DGP Core decision |
| --- | --- | --- |
| Filter lineage | `src/core/visibility.ts`, tag-relation tests | Retain root/self traversal and make malformed cycles terminate deterministically. |
| Field visibility | `src/core/visibility.ts`, visibility tests | Retain lineage-bound fields, active-filter direct rules, closest-trigger precedence, equal-depth exclusion, and tag ordering. |
| Recursive options | `src/core/options.ts`, visibility tests | Retain recursive discovery and ancestor-preserving filtering. |
| Option effects | `src/core/visibility.ts`, selection tests | Retain forced visibility and option narrowing; ignore selected triggers outside the active lineage. |
| Capability inheritance | `src/core/normalise.ts`, normalization tests | Retain ancestor precedence but calculate values and origins without rewriting the canonical definition. |
| Service bindings | `src/core/fallback.ts`, order snapshot tests | Retain filter, button-field, and recursive option bindings while excluding non-button field services. |
| Fallback registrations | `src/core/fallback.ts`, fallback tests | Retain node-first/global registration order and deduplication. Eligibility, rates, charges, and final selection remain backend concerns. |
| Value effects | editor and ordering-flow tests | Expose ordered declarations only. Applying or clearing customer state belongs to DGP Ordering. |

Not migrated into Core: legacy normalization, validation diagnostics, React and editor code, JavaScript execution, customer state, utility calculations, rate policy, fallback eligibility, order construction, and fulfillment.
