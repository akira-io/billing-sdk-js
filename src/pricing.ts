import type {
    BillingInterval,
    PricingFeature,
    PricingPayload,
    PricingTier,
    TierMeta,
} from './types';

export type FetchPricingConfig = {
    baseUrl: string;
    productKey: string;
    tierMeta?: Record<string, TierMeta>;
    yearlyMonthsFree?: number;
    /** Override the global fetch (e.g. Node 18+ or custom retry). */
    fetcher?: typeof fetch;
};

type ApiFeature = {
    key: string;
    name: string;
    description: string | null;
};

type ApiPlan = {
    key: string;
    name: string;
    description: string | null;
    amount: number | null;
    currency: string | null;
    billing_interval: BillingInterval | null;
    trial_period_days: number;
    is_coming_soon?: boolean;
    features: ApiFeature[];
};

type ApiPayload = {
    product: string;
    name: string;
    description: string | null;
    beta_active: boolean;
    plans: ApiPlan[];
};

const INTERVAL_SUFFIXES = ['_monthly', '_yearly', '_month', '_year', '_one_time'];

function tierKeyFromPlanKey(planKey: string): string {
    for (const suf of INTERVAL_SUFFIXES) {
        if (planKey.endsWith(suf)) {
            return planKey.slice(0, -suf.length);
        }
    }
    return planKey;
}

function titleCase(s: string): string {
    return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function emptyPayload(productKey: string): PricingPayload {
    return { product: productKey, betaActive: false, tiers: [] };
}

function shapeFromApi(payload: ApiPayload, config: FetchPricingConfig): PricingPayload {
    const meta = config.tierMeta ?? {};
    const monthsFree = config.yearlyMonthsFree ?? 2;
    const tiersMap = new Map<string, PricingTier>();

    for (const plan of payload.plans) {
        const tierKey = tierKeyFromPlanKey(plan.key);
        const m = meta[tierKey];

        if (!tiersMap.has(tierKey)) {
            tiersMap.set(tierKey, {
                key: tierKey,
                name: m?.label ?? titleCase(tierKey),
                tagline: m?.tagline ?? plan.description ?? '',
                highlighted: m?.highlighted ?? false,
                monthly: null,
                yearly: null,
                oneTime: null,
                isComingSoon: false,
                features: plan.features.map(
                    (f): PricingFeature => ({ key: f.key, name: f.name, description: f.description }),
                ),
            });
        }

        const tier = tiersMap.get(tierKey)!;

        if (plan.is_coming_soon === true) {
            tier.isComingSoon = true;
        }

        if (tier.features.length === 0 && plan.features.length > 0) {
            tier.features = plan.features.map((f) => ({ key: f.key, name: f.name, description: f.description }));
        }

        if (plan.billing_interval === 'month' && plan.amount !== null && plan.currency !== null) {
            tier.monthly = { amount: plan.amount, currency: plan.currency, planKey: plan.key };
            continue;
        }

        if (plan.billing_interval === 'year' && plan.amount !== null && plan.currency !== null) {
            tier.yearly = { amount: plan.amount, currency: plan.currency, monthsFree, planKey: plan.key };
            continue;
        }

        if (plan.billing_interval === null) {
            const amount = plan.amount ?? 0;
            const currency = plan.currency ?? 'eur';
            if (amount === 0) {
                tier.monthly = { amount: 0, currency, planKey: plan.key };
            } else {
                tier.oneTime = { amount, currency, planKey: plan.key };
            }
        }
    }

    const tiers = Array.from(tiersMap.values()).sort((a, b) => {
        const oa = meta[a.key]?.order ?? 999;
        const ob = meta[b.key]?.order ?? 999;
        return oa - ob;
    });

    return {
        product: payload.product,
        betaActive: payload.beta_active,
        tiers,
    };
}

export async function fetchPricing(config: FetchPricingConfig): Promise<PricingPayload> {
    const base = config.baseUrl?.replace(/\/$/, '');
    if (!base) return emptyPayload(config.productKey);

    const f = config.fetcher ?? globalThis.fetch;
    if (!f) {
        throw new Error('No fetch implementation available. Pass a fetcher in config or use Node 18+.');
    }

    try {
        const res = await f(`${base}/api/v1/products/${config.productKey}/plans`, {
            headers: { Accept: 'application/json' },
        });
        if (!res.ok) return emptyPayload(config.productKey);
        const data = (await res.json()) as ApiPayload;
        return shapeFromApi(data, config);
    } catch {
        return emptyPayload(config.productKey);
    }
}

export function formatPrice(amountInCents: number, currency: string): string {
    const symbol = currency.toLowerCase() === 'eur' ? '€' : currency.toUpperCase() + ' ';
    const major = (amountInCents / 100).toFixed(amountInCents % 100 === 0 ? 0 : 2);
    return `${symbol}${major}`;
}

export type { PricingFeature, PricingPayload, PricingTier, TierMeta };
