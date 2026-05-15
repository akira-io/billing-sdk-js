# @akira-io/billing-js

TypeScript client for the [Akira Billing API](https://github.com/akira-foundation/billing).
Two surfaces:

- **Storefront helpers** (`/pricing`, `/downloads`, `/checkout`, `/react`, `/vue`) — browser-safe,
  no secret required. For landing pages, marketing sites, and SPAs that only call
  unauthenticated endpoints.
- **`BillingClient`** (`/client`) — full HMAC-signed client mirroring the
  [Go](https://github.com/akira-io/billing-sdk-go) and
  [Rust](https://github.com/akira-io/billing-sdk-rust) SDKs. For trusted runtimes that hold a
  `productSecret`: Node servers, Next.js route handlers, Cloudflare Workers, Deno, Bun,
  CLI scripts, controlled webviews. **Never ship the secret to a browser bundle.**

Zero runtime dependencies. Dual ESM + CJS. Tree-shakeable per-module entry points.

## BillingClient (`/client`)

Runtime-agnostic class. Works anywhere `fetch` and `crypto.subtle` exist (Node 18+,
Bun, Deno, Cloudflare Workers, every modern serverless runtime). Reads the secret
from your environment, never from `import.meta.env` exposed to a browser bundle.

### Serverless route handler — instantiate per request

```ts
import { BillingClient } from '@akira-io/billing-js/client';

// app/api/login/route.ts (Next.js route handler — also fits Vercel, Netlify, CF Workers)
export async function POST(req: Request) {
    const client = new BillingClient({
        baseUrl: process.env.AKIRA_BILLING_URL!,
        productSlug: 'unified-dev',
        productSecret: process.env.AKIRA_BILLING_SECRET!,
    });
    const { email, code } = await req.json();
    const result = await client.verifyOtp({ email, code });
    // store result.access_token in a session cookie
    return Response.json(result);
}
```

### Long-lived server — instantiate once, reuse

```ts
import { BillingClient } from '@akira-io/billing-js/client';
import express from 'express';

const billing = new BillingClient({
    baseUrl: process.env.AKIRA_BILLING_URL!,
    productSlug: 'unified-dev',
    productSecret: process.env.AKIRA_BILLING_SECRET!,
});

const app = express();
app.post('/login', async (req, res) => {
    const result = await billing.verifyOtp(req.body);
    res.json(result);
});
```

### Per-customer token

After OTP verify the SDK stores the bearer on the instance. For follow-up
authenticated calls, either reuse the same client or call `setCustomerToken`:

```ts
client.setCustomerToken(req.cookies.akira_token);
const me = await client.customerMe();
const features = await client.entitlements();
```

### Available methods

| Method | Endpoint |
|---|---|
| `requestOtp(payload)` | `POST /api/auth/customer/otp/request` |
| `verifyOtp(payload)` | `POST /api/auth/customer/otp/verify` (auto-sets bearer) |
| `customerMe()` | `GET /api/me` |
| `licenseCheck(payload)` | `POST /api/licenses/check` |
| `licenseActivate(payload)` | `POST /api/licenses/activate` |
| `licenseRefresh(payload)` | `POST /api/licenses/refresh` |
| `entitlements()` | `GET /api/me/entitlements` |
| `billingPortal(returnUrl)` | `GET /api/billing/portal` |
| `trackUsage(payload)` | `POST /api/me/usage` |
| `publicLicenseKeys()` | `GET /api/v1/license-keys/public` (no HMAC) |

### Errors

Non-2xx responses throw `BillingApiError` with `status` and `code` fields populated
from the server error payload.

```ts
import { BillingApiError } from '@akira-io/billing-js/client';

try {
    await client.licenseActivate({ ... });
} catch (error) {
    if (error instanceof BillingApiError && error.code === 'no_active_plan') {
        // redirect to upgrade
    }
    throw error;
}
```

### Custom fetch

Pass `fetcher` to override `globalThis.fetch` (custom retry, observability, etc):

```ts
new BillingClient({ baseUrl, productSlug, productSecret, fetcher: myFetch });
```


## Install

```bash
pnpm add @akira-io/billing-js
# or
npm install @akira-io/billing-js
```

## Pricing

```ts
import { fetchPricing, formatPrice } from '@akira-io/billing-js/pricing';

const pricing = await fetchPricing({
    baseUrl: 'https://billing.akira.foundation',
    productKey: 'unified-dev',
    tierMeta: {
        free: { tagline: 'Local dev', highlighted: false, label: 'Free', order: 10, ctaLabel: 'Download' },
        pro:  { tagline: 'Unlimited runs', highlighted: true,  label: 'Pro',  order: 20, ctaLabel: 'Subscribe' },
    },
});

pricing.tiers.forEach((tier) => {
    const monthly = tier.monthly ? formatPrice(tier.monthly.amount, tier.monthly.currency) : '€0';
    console.log(`${tier.name}: ${monthly}/month`);
});
```

The shape of `PricingTier` mirrors what landing pages render: separate `monthly`, `yearly`,
and `oneTime` slots with the originating `planKey` so you can build a checkout URL from it.

## Downloads

```ts
import { triggerDownload } from '@akira-io/billing-js/downloads';

document.querySelector('#download-arm')!.addEventListener('click', () =>
    triggerDownload({
        baseUrl: 'https://billing.akira.foundation',
        product: 'unified-dev',
        channel: 'stable',
        platform: 'macos-arm64',
        query: { utm_source: 'landing' },
    }),
);
```

`triggerDownload`:

1. Calls `GET /api/v1/downloads/{product}/{channel}/{platform}` with `Accept: application/json`.
2. Navigates the current tab to the returned signed URL.
3. Schedules `navigator.sendBeacon` against the returned `beaconUrl` after a short delay so
   the backend can mark the event as completed.

Need more control? `issueDownload` returns the payload without redirecting; `downloadUrl`
just builds the endpoint URL; `sendCompletionBeacon` ships the beacon on its own.

## Checkout

```ts
import { checkoutUrl } from '@akira-io/billing-js/checkout';

const url = checkoutUrl('https://billing.akira.foundation', 'unified-dev', 'pro_monthly');
// → https://billing.akira.foundation/subscribe/unified-dev/pro_monthly
```

The billing app handles the rest (guest Stripe Checkout session, redirect, webhook).

## React hooks (`/react`)

```tsx
import { usePricing, useDownload } from '@akira-io/billing-js/react';
import { formatPrice } from '@akira-io/billing-js/pricing';

function Pricing() {
    const { data, isLoading, refresh } = usePricing({
        baseUrl: 'https://billing.akira.foundation',
        productKey: 'unified-dev',
    });

    if (isLoading) return <Skeleton />;

    return data?.tiers.map((tier) => (
        <Card key={tier.key}>
            <h3>{tier.name}</h3>
            {tier.monthly && <p>{formatPrice(tier.monthly.amount, tier.monthly.currency)}/mo</p>}
            <ul>{tier.features.map((f) => <li key={f.key}>{f.name}</li>)}</ul>
        </Card>
    ));
}

function DownloadButton() {
    const { trigger, isPending } = useDownload({
        baseUrl: 'https://billing.akira.foundation',
        product: 'unified-dev',
        channel: 'stable',
        platform: 'macos-arm64',
    });
    return <button disabled={isPending} onClick={trigger}>{isPending ? 'Starting…' : 'Download'}</button>;
}
```

## Vue composables (`/vue`)

```vue
<script setup lang="ts">
import { usePricing, useDownload } from '@akira-io/billing-js/vue';
import { formatPrice } from '@akira-io/billing-js/pricing';

const { data, isLoading } = usePricing(() => ({
    baseUrl: 'https://billing.akira.foundation',
    productKey: 'unified-dev',
}));

const { trigger, isPending } = useDownload(() => ({
    baseUrl: 'https://billing.akira.foundation',
    product: 'unified-dev',
    channel: 'stable',
    platform: 'macos-arm64',
}));
</script>

<template>
    <div v-if="isLoading">Loading…</div>
    <div v-else v-for="tier in data?.tiers ?? []" :key="tier.key">
        <h3>{{ tier.name }}</h3>
        <p v-if="tier.monthly">{{ formatPrice(tier.monthly.amount, tier.monthly.currency) }}/mo</p>
    </div>
    <button :disabled="isPending" @click="trigger">{{ isPending ? 'Starting…' : 'Download' }}</button>
</template>
```

React and Vue are listed as **optional peer dependencies** — install only the
one your app needs. The core modules (`/pricing`, `/downloads`, `/checkout`)
have no framework dependency.

## Bundled types

```ts
import type {
    PricingPayload,
    PricingTier,
    PricingFeature,
    TierMeta,
    IssuedDownload,
    ReleaseChannel,
    AssetPlatform,
} from '@akira-io/billing-js';
```

## Development

```bash
pnpm install
pnpm test
pnpm build
```

## License

MIT.
