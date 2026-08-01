# Agent guidance: DGP Core

Read and follow `../AGENTS.md` before working in this repository.

## Role

This repository is the framework-neutral product-definition interpreter. Its behavior must be deterministic and portable across UI and server-adjacent consumers.

## Dependencies

- May depend on sibling `dgp-spec`.
- Must not depend on `dgp-validation`, `dgp-ordering`, `dgp-workspace`, React, React Flow, or a host application.

## Boundaries

- Resolve and query definitions; do not render them.
- Provide primitives that validation, ordering, and workspace packages can consume.
- Mirror SDK service and capability definitions. Do not introduce `estimates`, canonical `flags`, or a replacement pricing model.
- Treat `meta` as host-defined `Record<string, any>`.

## References

- Legacy core source: `D:\Projects\GitHub\digital-service-ui-builder\src\core` and related framework-neutral utilities.
- Backend authority: `D:\Projects\GitHub\elqora\dgp-sdk` and sibling `dgp-sdk`.
- Sibling repositories: `dgp-spec`, `dgp-validation`, `dgp-ordering`, and `dgp-workspace`.
