# DGP Core

DGP Core is the complete framework-neutral product engine for canonical Digital Goods Protocol product definitions. It provides pure interpretation primitives and a stateful `ProductBuilder` facade for canonical authoring normalization, indexing, graph projection, visibility, relationships, services, fallbacks, and deterministic save preparation.

DGP Core does not render interfaces, implement editorial workflows, or execute fulfillment. DGP Ordering handles customer orchestration, DGP Workspace supplies reusable editorial infrastructure, and the DGP SDK defines backend execution.

## Responsibilities

- Deterministic product indexing
- Canonical authoring normalization and save cleanup
- Stateful Builder replacement with index/interpreter refresh
- Framework-neutral graph projection
- Cycle-safe graph, lineage, and relationship traversal
- Context and visibility resolution
- Recursive option traversal and selected-trigger effect resolution
- Service binding and capability resolution
- Node-first, then global fallback-candidate resolution
- Catalog service filtering and fallback eligibility evidence
- A composed, reusable product interpreter

Core accepts canonical v1 definitions only. `normalizeProductDefinition` is an authoring-boundary operation that fills canonical collection defaults, normalizes bindings and authored ordering, and never recognizes legacy aliases. Published inputs must still be validated rather than silently repaired. Core does not own publication diagnostics, editorial history, customer validation, expression execution, utility calculation, final pricing, charges, or operational fallback selection.

## Install

Node.js 22 or newer is required.

```sh
npm install @elqora/dgp-core @elqora/dgp-spec
```

## Usage

```ts
import { ProductBuilder, createProductInterpreter } from "@elqora/dgp-core";

const product = createProductInterpreter(definition);
const context = product.resolveContext("checkout", selectedTriggerIds);

context?.visibility.fieldIds;
context?.capabilities.values;

const builder = new ProductBuilder(definition);
builder.tree();
builder.cleanedDefinition();
```

Public functions are pure with respect to the supplied definition. Returned collections are newly allocated unless explicitly documented as canonical source nodes.

## Interpretation rules

- Filter lineage is returned root-first and traversal terminates safely if a malformed cycle is encountered.
- Fields bound to the active filter or an ancestor are visible. Only the active filter's direct `includes` and `excludes` apply.
- Selected field-button and option triggers apply only when their owning field belongs to the active lineage.
- A nearer trigger overrides an ancestor trigger; at equal depth, exclusion wins.
- `order_for_tags` pins visible fields first without introducing hidden fields.
- Ancestor capability requirements take precedence over conflicting descendant declarations, and their origin filter is reported without modifying the document.
- Option effects may reveal a field and narrow its recursively indexed options. Value effects are returned as declarations for Ordering to apply.
- The active filter is the first implicit value-effect trigger; ancestor filters are context only, followed by selected button and option triggers in selection order.
- Fallback registrations are listed node-first and then by the primary service's global list, with duplicates and self-references removed. Backend policy still decides operational eligibility.

## Development

```sh
npm install
npm run lint
npm run typecheck
npm test
npm run check:boundaries
npm run build
npm run check
```

`npm run check` is the repository completion command. It runs linting, strict type checking, tests, dependency/source boundary checks, and the distributable build. Build output in `dist/` is generated and is not committed.

## Ecosystem

- [DGP Spec](https://github.com/elqora/dgp-spec) owns canonical contracts.
- [DGP Validation](https://github.com/elqora/dgp-validation) validates definitions for ingestion and publication.
- [DGP Ordering](https://github.com/elqora/dgp-ordering) orchestrates customer ordering flows.
- [DGP Ordering Form Palette](https://github.com/elqora/dgp-ordering-form-palette) provides the optional Form Palette integration.
- [DGP Workspace](https://github.com/elqora/dgp-workspace) provides reusable editorial infrastructure.
- [DGP Studio](https://github.com/elqora/dgp-studio) provides visual authoring, testing, and publication UX.
- [DGP SDK](https://github.com/elqora/dgp-sdk) defines backend handler and fulfillment contracts.
- [Digital Service Engine](https://github.com/timeax/digital-service-engine) is the legacy migration source and behavioral reference.

## Status

The complete canonical v1 Core migration is implemented against the ratified, unreleased `@elqora/dgp-spec` 1.4 contract. Package 1.1 is unreleased.

## License

GPL-3.0-only.
