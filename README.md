# DGP Core

DGP Core is the framework-neutral interpreter for Digital Goods Protocol product definitions. It resolves product context, visibility, relationships, selections, service bindings, capabilities, and fallback behavior into deterministic runtime state.

DGP Core does not render interfaces, implement editorial workflows, or execute fulfillment. DGP Ordering handles customer orchestration, DGP Workspace supplies reusable editorial infrastructure, and the DGP SDK defines backend execution.

## Responsibilities

- Product-definition normalization
- Graph and relationship traversal
- Context and visibility resolution
- Option and value effects
- Service binding and capability resolution
- Framework-neutral fallback resolution
- Stable query and extension contracts

## Ecosystem

- [DGP Spec](https://github.com/elqora/dgp-spec) owns canonical contracts.
- [DGP Validation](https://github.com/elqora/dgp-validation) validates definitions for ingestion and publication.
- [DGP Ordering](https://github.com/elqora/dgp-ordering) orchestrates customer ordering flows.
- [DGP Workspace](https://github.com/elqora/dgp-workspace) provides reusable editorial infrastructure.
- [DGP Studio](https://github.com/elqora/dgp-studio) provides visual authoring, testing, and publication UX.
- [DGP SDK](https://github.com/elqora/dgp-sdk) defines backend handler and fulfillment contracts.
- [Digital Service Engine](https://github.com/timeax/digital-service-engine) is the legacy migration source and behavioral reference.

## Status

Repository scaffold only. Core extraction and migration will be planned separately.

## License

GPL-3.0.
