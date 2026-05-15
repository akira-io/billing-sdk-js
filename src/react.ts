import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchPricing, type FetchPricingConfig } from './pricing';
import { triggerDownload, type DownloadConfig } from './downloads';
import { defaultInterval, type IntervalKey } from './helpers';
import type { IssuedDownload, PricingPayload, PricingTier } from './types';

export type UsePricingResult = {
    data: PricingPayload | null;
    error: Error | null;
    isLoading: boolean;
    refresh: () => void;
};

/**
 * Fetches pricing for a product on mount (and whenever productKey/baseUrl
 * changes). Returns loading + error state plus a manual refresh callback.
 */
export function usePricing(config: FetchPricingConfig): UsePricingResult {
    const [data, setData] = useState<PricingPayload | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        let alive = true;
        setIsLoading(true);
        setError(null);

        fetchPricing(config)
            .then((p) => {
                if (alive) setData(p);
            })
            .catch((e: unknown) => {
                if (alive) setError(e instanceof Error ? e : new Error(String(e)));
            })
            .finally(() => {
                if (alive) setIsLoading(false);
            });

        return () => {
            alive = false;
        };
    }, [config.baseUrl, config.productKey, config.yearlyMonthsFree, tick]);

    const refresh = useCallback(() => setTick((t) => t + 1), []);

    return { data, error, isLoading, refresh };
}

export type UseBillingIntervalResult = {
    interval: IntervalKey;
    setInterval: (next: IntervalKey) => void;
    toggle: () => void;
};

/**
 * Local state for a monthly/yearly billing toggle. Default is derived
 * from the tier list (yearly when any tier has one, else monthly).
 */
export function useBillingInterval(tiers: PricingTier[] | null | undefined): UseBillingIntervalResult {
    const initial = useMemo(() => defaultInterval(tiers ?? []), [tiers]);
    const [interval, setInterval] = useState<IntervalKey>(initial);

    useEffect(() => {
        setInterval(initial);
    }, [initial]);

    const toggle = useCallback(
        () => setInterval((cur) => (cur === 'monthly' ? 'yearly' : 'monthly')),
        [],
    );

    return { interval, setInterval, toggle };
}

export type UseDownloadResult = {
    trigger: () => Promise<void>;
    isPending: boolean;
    error: Error | null;
    lastIssued: IssuedDownload | null;
};

/**
 * Returns a memoized download trigger plus pending/error state for the
 * click handler. Wraps triggerDownload() under the hood.
 */
export function useDownload(config: DownloadConfig): UseDownloadResult {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [lastIssued, setLastIssued] = useState<IssuedDownload | null>(null);

    const trigger = useCallback(async () => {
        setIsPending(true);
        setError(null);
        try {
            const issued = await triggerDownload(config);
            setLastIssued(issued);
        } catch (e: unknown) {
            setError(e instanceof Error ? e : new Error(String(e)));
        } finally {
            setIsPending(false);
        }
    }, [
        config.baseUrl,
        config.product,
        config.channel,
        config.platform,
        config.beaconDelayMs,
        JSON.stringify(config.query ?? {}),
    ]);

    return { trigger, isPending, error, lastIssued };
}
