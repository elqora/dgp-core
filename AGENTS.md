# Agent guidance: DGP Core

Read and follow `../AGENTS.md` before working in this repository.

## Role

This repository is the complete deterministic, framework-neutral product engine for canonical DGP `ProductDefinition` documents. It provides pure interpretation primitives and a canonical stateful Builder facade over definition state, normalization, indexing, graph projection, save preparation, context, visibility, relationships, service bindings, capabilities, effects, and fallbacks.

## Dependencies

- May depend on sibling `dgp-spec` only.
- Must not depend on Validation, Ordering, the Form Palette adapter, Workspace, Studio, React, React Flow, or a host application.
- Never create a reverse or circular dependency to a consumer package.

## Boundaries

- Accept canonical v1 definitions only. Do not normalize legacy definitions or expose legacy aliases, adapters, deprecated fields, or compatibility modes. This prohibition does not remove canonical authoring normalization.
- Consume generated Spec bindings and preserve canonical `snake_case` serialization at wire boundaries.
- Supply framework-neutral authoring engine primitives without rendering UI or owning editorial sessions, history, persistence, or collaboration.
- Provide pure primitives plus a canonical stateful Builder facade that Validation, Ordering, and Workspace may consume.
- The Builder must hold and replace canonical definition state, build and refresh `ProductIndex`, expose node identity and lookup, project framework-neutral graph snapshots, compose existing resolvers, and prepare deterministic canonical save output.
- Apply canonical normalization at authoring boundaries only. Preserve canonical defaults, deduplicated collections and bindings, root/filter invariants, recursive options, validation declarations, notices, fallbacks, effects, and cleanup. Externally supplied published definitions remain strictly validated and must not be silently repaired.
- Resolve derived capability or constraint state without writing it into canonical definitions where ratified, while preserving effective values and origin behavior.
- Treat `ProductIndex` as the evolved legacy `NodeMap`. Preserve actual-ID lookup, recursive-option ownership, deterministic identity, and trigger resolution while retaining lineage, descendants, relationship, and binding queries.
- Do not execute JavaScript expressions, calculate ordering utilities, construct `OrderSnapshot`, or validate customer input.
- Do not own publication diagnostics, editorial history, final pricing, charges, fulfillment, or visual fallback editing. Legacy `Builder.errors()` behavior is composed by Workspace through Validation; Core must not import Validation.
- Use `capabilities`; exclude `flags`, root capability booleans, and `estimates`.
- Treat `meta` as opaque host-defined data and never assign `{raw, derived}` universal meaning.

## Authority

Spec owns shared representation; SDK owns backend domain semantics; the legacy engine supplies proven interpretation behavior that Core must preserve by default. Core owns deterministic interpretation within its boundary and must never redefine a shared contract locally.

Ratified means the versioned plain TypeScript contract, required JSON fixtures, rationale, and stable status are merged into `dgp-spec/main`; generated JSON Schemas must also be current once tooling exists. Released means that ratified Spec version is tagged and published. Core may implement a ratified unreleased contract, but a stable Core release requires the corresponding released Spec version.

## Migration completeness

- Exhaustively inventory the legacy Builder, normalizer, NodeMap, context, lineage, relationships, visibility, recursive options, effects, capabilities, graph projection, save cleanup, service bindings, service filtering, and fallback interpretation in `MIGRATION.md`.
- Accepting canonical v1 definitions removes legacy aliases and compatibility coercion; it does not permit omission of canonical normalization, Builder behavior, graph projection, save preparation, or interpretation.
- Preserve observable interpretation outcomes by default. Internal algorithms may improve, but redesign or retirement requires explicit recorded user approval.
- Port or replace every applicable Builder, normalizer, NodeMap, conflicting-trigger, recursive-option, malformed-graph, cleanup, and contextual test. Cross-package tests must prove the replacement of `Builder.errors()` through Workspace and Validation.
- Mark unimplemented behavior as **pending migration**. Do not call Core migration-complete or publish another stable release based only on pure APIs, compilation, boundary checks, or a happy-path suite.

## Change workflow and operations

- Implement Core only after the relevant Spec contract is ratified; align Core alongside SDK conformance before dependent Validation, Ordering, or Workspace changes.
- Commit and release this repository independently.
- Supported runtime: Node.js 22 or newer; package manager: npm.
- Install dependencies with `npm install`.
- Run tests with `npm test`, lint with `npm run lint`, strict type checking with `npm run typecheck`, boundary enforcement with `npm run check:boundaries`, and the distributable build with `npm run build`.
- `npm run check` is the repository verification command and must pass before a commit or release; it is not by itself evidence of migration completeness.
- `dist/` is generated by the TypeScript build and is not committed. This package owns no generated protocol binding; it consumes the released Spec package directly.
- Boundary enforcement must continue to reject runtime dependencies other than Spec, independently authored canonical contracts, React/consumer imports, and forbidden legacy fields.

## References

- Spec authority: sibling `../dgp-spec`.
- Shared-contract guide: sibling `../dgp-spec/CONTRACTS.md`.
- Backend evidence: sibling `../dgp-sdk`.
- Legacy interpretation evidence: `D:\Projects\GitHub\digital-service-ui-builder\src\core`, especially `builder.ts`, `normalise.ts`, `node-map.ts`, and their tests.
- Studio source evidence: `D:\Projects\GitHub\service-builder`; destination: sibling `../dgp-studio`.
- Siblings: `../dgp-validation`, `../dgp-ordering`, `../dgp-ordering-form-palette`, `../dgp-workspace`, and `../dgp-studio`.

This repository remains GPL-3.0-only. Future manifests and source headers must use that exact SPDX identifier.
