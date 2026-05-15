# @akira-io/billing-js

TypeScript client for the [Akira Billing API](https://github.com/akira-foundation/billing).
Built for landing pages and SPAs: pricing fetch + transform, download click + beacon
completion, checkout URL helper. Sister SDKs: [`billing-sdk-go`](https://github.com/akira-io/billing-sdk-go), [`billing-sdk-rust`](https://github.com/akira-io/billing-sdk-rust).

Zero runtime dependencies. Dual ESM + CJS. Tree-shakeable per-module entry points.

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
