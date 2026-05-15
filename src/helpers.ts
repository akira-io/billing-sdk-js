import { checkoutUrl } from './checkout';
import { formatPrice } from './pricing';
import type { PricingTier, TierMeta } from './types';

export type IntervalKey = 'monthly' | 'yearly' | 'oneTime';

export type CtaProps = {
    label: string;
    href: string | null;
    disabled: boolean;
    monthlyHref: string | null;
    yearlyHref: string | null;
    oneTimeHref: string | null;
};

export type CtaOptions = {
    billingBaseUrl: string;
    productKey: string;
    tierMeta?: TierMeta;
    interval?: IntervalKey;
    freeLabel?: string;
    subscribeLabel?: string;
    buyLabel?: string;
    comingSoonLabel?: string;
};

export function isFreeTier(tier: PricingTier): boolean {
    return tier.monthly?.amount === 0 && tier.yearly === null && tier.oneTime === null;
}

export function isOneTimeTier(tier: PricingTier): boolean {
    return tier.oneTime !== null && tier.monthly === null;
}

export function hasYearly(tier: PricingTier): boolean {
    return tier.yearly !== null && tier.monthly !== null;
}

/**
 * Resolves all CTA fields for a tier — label, primary href, per-interval
 * hrefs (so a UI toggle can hot-swap without re-deriving), and disabled
 * state for coming-soon plans. Replaces hand-rolled if/else trees in
 * landing pages.
 */
export function getCtaProps(tier: PricingTier, opts: CtaOptions): CtaProps {
    const meta = opts.tierMeta;
    const monthlyHref = tier.monthly
        ? checkoutUrl(opts.billingBaseUrl, opts.productKey, tier.monthly.planKey)
        : null;
    const yearlyHref = tier.yearly
        ? checkoutUrl(opts.billingBaseUrl, opts.productKey, tier.yearly.planKey)
        : null;
    const oneTimeHref = tier.oneTime
        ? checkoutUrl(opts.billingBaseUrl, opts.productKey, tier.oneTime.planKey)
        : null;

    if (tier.isComingSoon) {
        return {
            label: opts.comingSoonLabel ?? 'Coming soon',
            href: null,
            disabled: true,
            monthlyHref,
            yearlyHref,
            oneTimeHref,
        };
    }

    if (meta?.ctaHref) {
        return {
            label: meta.ctaLabel ?? 'Get started',
            href: meta.ctaHref,
            disabled: false,
            monthlyHref,
            yearlyHref,
            oneTimeHref,
        };
    }

    let primary: string | null;
    let defaultLabel: string;

    if (isFreeTier(tier)) {
        primary = null;
        defaultLabel = opts.freeLabel ?? 'Get started';
    } else if (isOneTimeTier(tier)) {
        primary = oneTimeHref;
        defaultLabel = opts.buyLabel ?? 'Buy';
    } else {
        primary = opts.interval === 'yearly' ? yearlyHref ?? monthlyHref : monthlyHref;
        defaultLabel = opts.subscribeLabel ?? 'Subscribe';
    }

    return {
        label: meta?.ctaLabel ?? defaultLabel,
        href: primary,
        disabled: false,
        monthlyHref,
        yearlyHref,
        oneTimeHref,
    };
}

export type FormattedPrice = {
    amount: string;
    suffix: string;
    raw: { amount: number; currency: string } | null;
    note?: string;
};

/**
 * Returns the price + suffix to render for a tier given the active
 * interval. Falls back gracefully: a tier with only monthly always
 * shows monthly; a free tier shows €0; a one-time tier shows the amount
 * with a 'one-time' suffix.
 */
export function getActivePrice(tier: PricingTier, interval: IntervalKey): FormattedPrice {
    if (interval === 'yearly' && tier.yearly) {
        return {
            amount: formatPrice(tier.yearly.amount, tier.yearly.currency),
            suffix: '/year',
            raw: { amount: tier.yearly.amount, currency: tier.yearly.currency },
            note: tier.yearly.monthsFree > 0 ? `${tier.yearly.monthsFree} months free` : undefined,
        };
    }

    if (interval === 'oneTime' && tier.oneTime) {
        return {
            amount: formatPrice(tier.oneTime.amount, tier.oneTime.currency),
            suffix: ' one-time',
            raw: { amount: tier.oneTime.amount, currency: tier.oneTime.currency },
        };
    }

    if (tier.monthly) {
        return {
            amount: formatPrice(tier.monthly.amount, tier.monthly.currency),
            suffix: '/month',
            raw: { amount: tier.monthly.amount, currency: tier.monthly.currency },
        };
    }

    if (tier.oneTime) {
        return {
            amount: formatPrice(tier.oneTime.amount, tier.oneTime.currency),
            suffix: ' one-time',
            raw: { amount: tier.oneTime.amount, currency: tier.oneTime.currency },
        };
    }

    return { amount: '—', suffix: '', raw: null };
}

/**
 * Picks the natural default interval for a list of tiers: 'yearly' if
 * any tier has a yearly option, else 'monthly'. Useful as the initial
 * state for a billing-interval toggle.
 */
export function defaultInterval(tiers: PricingTier[]): IntervalKey {
    if (tiers.some(hasYearly)) return 'monthly';
    if (tiers.every((t) => t.monthly === null && t.oneTime !== null)) return 'oneTime';
    return 'monthly';
}
