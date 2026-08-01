# Agent guidance: DGP Core

Read and follow `../AGENTS.md` before working in this repository.

## Role

This repository is the framework-neutral product-definition interpreter. Its behavior must be deterministic and portable across UI and server-adjacent consumers.

## Dependencies

- May depend on sibling `dgp-spec`.
- Must not depend on `dgp-validation`, `dgp-ordering`, `dgp-workspace`, React, React Flow, Studio, or a host application.

## Boundaries

- Resolve and query definitions; do not render or author them.
- Provide primitives that validation, ordering, and workspace packages can consume.
- Do not execute quantity expressions, customer-field validation expressions, or other ordering behavior.
- Do not own publication diagnostics, editorial workflows, backend fulfillment, or visual fallback editing.
- Mirror SDK service and capability definitions. Do not introduce `estimates`, canonical `flags`, or a replacement pricing model.
- Treat `meta` as host-defined `Record<string, any>`.

## References

- Legacy core source: `D:\Projects\GitHub\digital-service-ui-builder\src\core` and related framework-neutral utilities. Extract only interpretation behavior that belongs to Core.
- Backend authority: sibling `../dgp-sdk` at `D:\Projects\GitHub\elqora\digital-goods-protocol\dgp-sdk`.
- Studio destination: sibling `../dgp-studio`; code and history migration source: `D:\Projects\GitHub\service-builder`.
- Sibling repositories: `../dgp-spec`, `../dgp-validation`, `../dgp-ordering`, `../dgp-workspace`, and `../dgp-studio`.
