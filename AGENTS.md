# Agent guidance: DGP Core

Read and follow `../AGENTS.md` before working in this repository.

## Role

This repository is the deterministic, framework-neutral interpreter for canonical DGP `ProductDefinition` documents. It resolves and queries context, visibility, relationships, service bindings, capabilities, option effects, and fallback behavior.

## Dependencies

- May depend on sibling `dgp-spec` only.
- Must not depend on Validation, Ordering, the Form Palette adapter, Workspace, Studio, React, React Flow, or a host application.
- Never create a reverse or circular dependency to a consumer package.

## Boundaries

- Accept canonical v1 definitions only. Do not normalize legacy definitions or expose legacy aliases, adapters, deprecated fields, or compatibility modes.
- Consume generated Spec bindings and preserve canonical `snake_case` serialization at wire boundaries.
- Resolve definitions without rendering or authoring them.
- Provide pure primitives that Validation, Ordering, and Workspace may consume.
- Do not execute JavaScript expressions, calculate ordering utilities, construct `OrderSnapshot`, or validate customer input.
- Do not own publication diagnostics, editorial state, final pricing, charges, fulfillment, or visual fallback editing.
- Use `capabilities`; exclude `flags`, root capability booleans, and `estimates`.
- Treat `meta` as opaque host-defined data and never assign `{raw, derived}` universal meaning.

## Authority

Spec owns shared representation; SDK owns backend domain semantics; the legacy engine supplies interpretation evidence to retain or improve. Core owns deterministic interpretation within its boundary and must never redefine a shared contract locally.

Ratified means the versioned plain TypeScript contract, required JSON fixtures, rationale, and stable status are merged into `dgp-spec/main`; generated JSON Schemas must also be current once tooling exists. Released means that ratified Spec version is tagged and published. Core may implement a ratified unreleased contract, but a stable Core release requires the corresponding released Spec version.

## Change workflow and operations

- Implement Core only after the relevant Spec contract is ratified; align Core alongside SDK conformance before dependent Validation, Ordering, or Workspace changes.
- Commit and release this repository independently.
- This repository has no implementation manifest or operational commands yet. Do not invent install, test, lint, type-check, build, or generation commands.
- When its toolchain is introduced, document all real commands, supported runtimes, generated-output policy, completion criteria, and mechanical checks for forbidden dependencies, React imports, legacy fields, and generated-binding drift.

## References

- Spec authority: sibling `../dgp-spec`.
- Shared-contract guide: sibling `../dgp-spec/CONTRACTS.md`.
- Backend evidence: sibling `../dgp-sdk`.
- Legacy interpretation evidence: `D:\Projects\GitHub\digital-service-ui-builder\src\core`.
- Studio source evidence: `D:\Projects\GitHub\service-builder`; destination: sibling `../dgp-studio`.
- Siblings: `../dgp-validation`, `../dgp-ordering`, `../dgp-ordering-form-palette`, `../dgp-workspace`, and `../dgp-studio`.

This repository remains GPL-3.0-only. Future manifests and source headers must use that exact SPDX identifier.
