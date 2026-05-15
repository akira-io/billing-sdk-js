import { describe, expect, it } from 'vitest';
import { defaultInterval, getActivePrice, getCtaProps, isFreeTier, isOneTimeTier } from '../src/helpers';
import type { PricingTier } from '../src/types';

function tier(partial: Partial<PricingTier>): PricingTier {
    return {
        key: 'pro',
        name: 'Pro',
        tagline: '',
        monthly: null,
        yearly: null,
        oneTime: null,
        features: [],
        highlighted: false,
        isComingSoon: false,
        ...partial,
    };
}

describe('isFreeTier', () => {
    it('detects zero-amount monthly with no yearly/oneTime', () => {
        expect(isFreeTier(tier({ monthly: { amount: 0, currency: 'eur', planKey: 'free' } }))).toBe(true);
    });

    it('rejects paid tiers', () => {
        expect(isFreeTier(tier({ monthly: { amount: 1500, currency: 'eur', planKey: 'pro_monthly' } }))).toBe(false);
    });
});

describe('isOneTimeTier', () => {
    it('detects lifetime-style plans', () => {
        expect(isOneTimeTier(tier({ oneTime: { amount: 25000, currency: 'eur', planKey: 'lifetime' } }))).toBe(true);
    });
});

describe('getCtaProps', () => {
    const baseOpts = { billingBaseUrl: 'https://billing.test', productKey: 'unified-dev' };

    it('returns disabled coming-soon CTA', () => {
        const cta = getCtaProps(tier({ isComingSoon: true, monthly: { amount: 1500, currency: 'eur', planKey: 'pro_monthly' } }), baseOpts);
        expect(cta.disabled).toBe(true);
        expect(cta.href).toBeNull();
    });

    it('honors explicit ctaHref in tierMeta', () => {
        const cta = getCtaProps(
            tier({ monthly: { amount: 0, currency: 'eur', planKey: 'free' } }),
            { ...baseOpts, tierMeta: { tagline: '', highlighted: false, order: 10, ctaHref: '/#download', ctaLabel: 'Download' } },
        );
        expect(cta.href).toBe('/#download');
        expect(cta.label).toBe('Download');
    });

    it('routes paid tiers to the yearly URL when interval is yearly', () => {
        const t = tier({
            monthly: { amount: 1500, currency: 'eur', planKey: 'pro_monthly' },
            yearly: { amount: 15000, currency: 'eur', monthsFree: 2, planKey: 'pro_yearly' },
        });
        const cta = getCtaProps(t, { ...baseOpts, interval: 'yearly' });
        expect(cta.href).toBe('https://billing.test/subscribe/unified-dev/pro_yearly');
        expect(cta.label).toBe('Subscribe');
    });

    it('routes lifetime tiers to the one-time URL', () => {
        const t = tier({ oneTime: { amount: 25000, currency: 'eur', planKey: 'lifetime' } });
        const cta = getCtaProps(t, baseOpts);
        expect(cta.href).toBe('https://billing.test/subscribe/unified-dev/lifetime');
        expect(cta.label).toBe('Buy');
    });
});

describe('getActivePrice', () => {
    it('picks yearly when active and present', () => {
        const t = tier({
            monthly: { amount: 1500, currency: 'eur', planKey: 'pro_monthly' },
            yearly: { amount: 15000, currency: 'eur', monthsFree: 2, planKey: 'pro_yearly' },
        });
        const p = getActivePrice(t, 'yearly');
        expect(p.amount).toBe('€150');
        expect(p.suffix).toBe('/year');
        expect(p.note).toBe('2 months free');
    });

    it('falls back to monthly when yearly absent', () => {
        const t = tier({ monthly: { amount: 1500, currency: 'eur', planKey: 'pro_monthly' } });
        const p = getActivePrice(t, 'yearly');
        expect(p.suffix).toBe('/month');
    });

    it('returns one-time formatting for lifetime tiers', () => {
        const t = tier({ oneTime: { amount: 25000, currency: 'eur', planKey: 'lifetime' } });
        const p = getActivePrice(t, 'monthly');
        expect(p.amount).toBe('€250');
        expect(p.suffix).toBe(' one-time');
    });
});

describe('defaultInterval', () => {
    it('returns monthly when any tier has yearly', () => {
        expect(
            defaultInterval([
                tier({
                    monthly: { amount: 1500, currency: 'eur', planKey: 'pro_monthly' },
                    yearly: { amount: 15000, currency: 'eur', monthsFree: 2, planKey: 'pro_yearly' },
                }),
            ]),
        ).toBe('monthly');
    });
});
