export type ReleaseChannel = 'stable' | 'beta' | 'nightly';

export type AssetPlatform = 'macos-arm64' | 'macos-x86_64' | 'linux-x86_64' | 'windows-x86_64';

export type BillingInterval = 'day' | 'week' | 'month' | 'year';

export type PricingFeature = {
    key: string;
    name: string;
    description: string | null;
};

export type PricingTier = {
    key: string;
    name: string;
    tagline: string;
    monthly: { amount: number; currency: string; planKey: string } | null;
    yearly: { amount: number; currency: string; monthsFree: number; planKey: string } | null;
    oneTime: { amount: number; currency: string; planKey: string } | null;
    features: PricingFeature[];
    highlighted: boolean;
    isComingSoon: boolean;
};

export type PricingPayload = {
    product: string;
    tiers: PricingTier[];
    betaActive: boolean;
};

export type TierMeta = {
    tagline: string;
    highlighted: boolean;
    label?: string;
    order: number;
    ctaLabel?: string;
    ctaHref?: string;
};

export type IssuedDownload = {
    eventId: string;
    product: string;
    version: string;
    channel: string;
    os: string;
    arch: string;
    format: string;
    signedUrl: string;
    expiresAt: string;
    beaconUrl: string;
};
