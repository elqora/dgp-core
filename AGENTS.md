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

Ratified `dgp-spec` contracts control Core behavior. Use `dgp-sdk` only as evidence for backend concerns not yet ratified. A local Core type must never redefine the protocol.

## References

- Spec authority: sibling `../dgp-spec`.
- Backend evidence: sibling `../dgp-sdk`.
- Legacy interpretation evidence: `D:\Projects\GitHub\digital-service-ui-builder\src\core`.
- Studio source evidence: `D:\Projects\GitHub\service-builder`; destination: sibling `../dgp-studio`.
- Siblings: `../dgp-validation`, `../dgp-ordering`, `../dgp-ordering-form-palette`, `../dgp-workspace`, and `../dgp-studio`.

This repository remains GPL-3.0.
