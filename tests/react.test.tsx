import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePricing, useDownload } from '../src/react';

const pricingPayload = {
    product: 'unified-dev',
    name: 'Unified Dev',
    description: null,
    beta_active: false,
    plans: [
        {
            key: 'pro_monthly',
            name: 'Pro',
            description: null,
            amount: 1500,
            currency: 'eur',
            billing_interval: 'month',
            trial_period_days: 0,
            features: [],
        },
    ],
};

function PricingProbe({ baseUrl }: { baseUrl: string }) {
    const fetcher = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(pricingPayload), { status: 200 }));
    const { data, isLoading } = usePricing({
        baseUrl,
        productKey: 'unified-dev',
        fetcher: fetcher as unknown as typeof fetch,
    });

    if (isLoading) return <span>loading</span>;
    return <span>{data?.tiers[0]?.key ?? 'none'}</span>;
}

describe('usePricing', () => {
    it('resolves to the transformed payload', async () => {
        render(<PricingProbe baseUrl="https://billing.test" />);

        await waitFor(() => expect(screen.queryByText('loading')).toBeNull());
        expect(screen.getByText('pro')).toBeTruthy();
    });
});

function DownloadProbe() {
    const fetcher = vi.fn().mockResolvedValue(
        new Response(
            JSON.stringify({
                eventId: 'e1',
                product: 'unified-dev',
                version: '0.9.0',
                channel: 'stable',
                os: 'macos',
                arch: 'arm64',
                format: 'dmg',
                signedUrl: 'https://cdn.test/x.dmg',
                expiresAt: '2026-05-15T01:00:00Z',
                beaconUrl: 'https://billing.test/beacon',
            }),
            { status: 200 },
        ),
    );
    const { trigger, isPending } = useDownload({
        baseUrl: 'https://billing.test',
        product: 'unified-dev',
        channel: 'stable',
        platform: 'macos-arm64',
        fetcher: fetcher as unknown as typeof fetch,
    });
    return (
        <button type="button" onClick={() => void trigger()}>
            {isPending ? 'pending' : 'idle'}
        </button>
    );
}

describe('useDownload', () => {
    it('toggles pending while triggering', async () => {
        render(<DownloadProbe />);
        const btn = screen.getByText('idle');
        await act(async () => {
            btn.click();
        });
        expect(screen.queryByText('idle')).toBeTruthy();
    });
});
