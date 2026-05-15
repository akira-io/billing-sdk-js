import { describe, expect, it } from 'vitest';
import { fetchPricing, formatPrice } from '../src/pricing';

const payload = {
    product: 'unified-dev',
    name: 'Unified Dev',
    description: 'Toolchain',
    beta_active: false,
    plans: [
        {
            key: 'free',
            name: 'Free',
            description: null,
            amount: 0,
            currency: null,
            billing_interval: null,
            trial_period_days: 0,
            features: [],
        },
        {
            key: 'pro_monthly',
            name: 'Pro · Monthly',
            description: null,
            amount: 1500,
            currency: 'eur',
            billing_interval: 'month',
            trial_period_days: 14,
            features: [{ key: 'a', name: 'A', description: null }],
        },
        {
            key: 'pro_yearly',
            name: 'Pro · Yearly',
            description: null,
            amount: 15000,
            currency: 'eur',
            billing_interval: 'year',
            trial_period_days: 14,
            features: [{ key: 'a', name: 'A', description: null }],
        },
    ],
};

function mockFetch(body: unknown, ok = true) {
    return async () =>
        new Response(JSON.stringify(body), {
            status: ok ? 200 : 500,
            headers: { 'content-type': 'application/json' },
        });
}

describe('fetchPricing', () => {
    it('groups plans into tiers by stripped suffix', async () => {
        const result = await fetchPricing({
            baseUrl: 'https://billing.test',
            productKey: 'unified-dev',
            fetcher: mockFetch(payload) as unknown as typeof fetch,
        });

        const keys = result.tiers.map((t) => t.key);
        expect(keys).toContain('free');
        expect(keys).toContain('pro');
    });

    it('places monthly and yearly amounts on the pro tier', async () => {
        const result = await fetchPricing({
            baseUrl: 'https://billing.test',
            productKey: 'unified-dev',
            fetcher: mockFetch(payload) as unknown as typeof fetch,
        });

        const pro = result.tiers.find((t) => t.key === 'pro');
        expect(pro?.monthly?.amount).toBe(1500);
        expect(pro?.yearly?.amount).toBe(15000);
        expect(pro?.yearly?.monthsFree).toBe(2);
    });

    it('returns empty payload when baseUrl is missing', async () => {
        const result = await fetchPricing({
            baseUrl: '',
            productKey: 'unified-dev',
        });

        expect(result.tiers).toEqual([]);
    });

    it('returns empty payload on non-2xx', async () => {
        const result = await fetchPricing({
            baseUrl: 'https://billing.test',
            productKey: 'unified-dev',
            fetcher: mockFetch({}, false) as unknown as typeof fetch,
        });

        expect(result.tiers).toEqual([]);
    });
});

describe('formatPrice', () => {
    it('uses € for EUR and trims integer cents', () => {
        expect(formatPrice(1500, 'eur')).toBe('€15');
    });

    it('shows decimals when cents are non-zero', () => {
        expect(formatPrice(250, 'eur')).toBe('€2.50');
    });

    it('falls back to currency code for unknown currencies', () => {
        expect(formatPrice(1500, 'brl')).toBe('BRL 15');
    });
});
