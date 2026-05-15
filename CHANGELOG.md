# Changelog

All notable changes to `@akira-io/billing-js` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.5] — 2026-05-15

### Changed

- Republish under a fresh tag after fixing the publish workflow to
  use node 22 + npm 11+, which is the minimum that implements the
  OIDC PUT exchange against npmjs.com. No code changes.

[0.1.5]: https://github.com/akira-io/billing-sdk-js/releases/tag/v0.1.5

## [0.1.4] — 2026-05-15

### Changed

- Republish of 0.1.3 contents. The 0.1.3 tag never reached npm due
  to CI plumbing issues (missing eslint deps + OIDC config). No
  code or API changes.

[0.1.4]: https://github.com/akira-io/billing-sdk-js/releases/tag/v0.1.4

## [0.1.3] — 2026-05-15

### Added

- New `license` subpath export with helpers for `offline_snapshot`
  products: `decodeLicense`, `verifyLicense` (Ed25519 via Web Crypto),
  `computeRemaining`, `isExpired`, `isInGrace`, `canUseUpdate`,
  `periodResetAt`.
- `BillingClient.licenseSyncUsage()` POST /api/licenses/sync-usage to
  apply local usage deltas and receive a re-signed snapshot.
- `UsagePayload.count?: number` for variable-count realtime tracking
  (e.g. AI token usage).
- Types: `LicensingMode`, `UsageFeatureState`, `LicenseSnapshotPayload`,
  `LicenseSyncUsagePayload`, `LicenseSyncUsageResponse`.

[0.1.3]: https://github.com/akira-io/billing-sdk-js/releases/tag/v0.1.3

## [0.1.2] — 2026-05-15

### Added

- `UsagePayload` carries optional `platform`, `device_type`, and
  `app_version` so the server can record device metadata alongside
  the usage counter. Authenticated and anonymous endpoints both
  accept the new fields.

[0.1.2]: https://github.com/akira-io/billing-sdk-js/releases/tag/v0.1.2

## [0.1.1] — 2026-05-15

### Added

- `BillingClient.trackAnonymousUsage(payload)` — `POST /api/v1/usage/anonymous`.
  HMAC-only endpoint (no bearer) for metering devices that have not yet
  authenticated. The server applies the limits defined on the product's
  `anonymous_plan`.

[0.1.1]: https://github.com/akira-io/billing-sdk-js/releases/tag/v0.1.1

## [0.1.0] — 2026-05-15

First public release. Ships two surfaces.

### Storefront helpers (browser-safe)

- `fetchPricing`, `formatPrice` — pull a typed `PricingPayload` from
  `/api/v1/products/{key}/plans` and turn it into render-ready tiers.
- `downloadUrl`, `issueDownload`, `sendCompletionBeacon`, `triggerDownload` —
  fetch a signed asset URL, navigate to it, fire the completion beacon.
- `checkoutUrl` — build a deep link into the hosted subscribe flow.
- React hooks (`/react`) and Vue composables (`/vue`) — `usePricing`,
  `useDownload`. Both frameworks are optional peer dependencies.
- Shared helpers (`/helpers`) — `defaultInterval`, `getActivePrice`,
  `getCtaProps`, `hasYearly`, `isFreeTier`, `isOneTimeTier`.

### `BillingClient` (`/client`)

Runtime-agnostic HMAC-signed client for trusted environments (Node, Bun,
Deno, Cloudflare Workers, Next.js route handlers, scripts). Mirrors the
Go and Rust SDKs:

- OTP login: `requestOtp`, `verifyOtp` (auto-stores the bearer).
- Customer profile: `customerMe`.
- License lifecycle: `licenseCheck`, `licenseActivate`, `licenseRefresh`.
- Entitlements: `entitlements`.
- Billing portal: `billingPortal`.
- Usage tracking: `trackUsage` with `check` / `increment` actions.
- Public verification keys: `publicLicenseKeys` (unauthenticated).

HMAC signatures run through `crypto.subtle`, so the client works in any
runtime that ships fetch + Web Crypto. The `productSecret` must come from
the environment and must never reach a browser bundle.

Errors throw `BillingApiError` with `status` and `code` fields populated
from the server payload.

### Tooling

- Dual ESM + CJS builds via tsup. Tree-shakeable per-module entry points.
- TypeScript declarations generated alongside JS.
- npm `Trusted Publishers` workflow via GitHub OIDC — no long-lived
  `NPM_TOKEN` stored on the repository.
- Automated `provenance` flag on every CI publish.

[0.1.0]: https://github.com/akira-io/billing-sdk-js/releases/tag/v0.1.0
