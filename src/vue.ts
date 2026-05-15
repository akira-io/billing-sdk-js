import { onUnmounted, ref, watchEffect, type Ref } from 'vue';
import { fetchPricing, type FetchPricingConfig } from './pricing';
import { triggerDownload, type DownloadConfig } from './downloads';
import type { IssuedDownload, PricingPayload } from './types';

export type UsePricingComposable = {
    data: Ref<PricingPayload | null>;
    error: Ref<Error | null>;
    isLoading: Ref<boolean>;
    refresh: () => void;
};

/**
 * Reactive pricing fetcher. Re-runs when the source config changes; expose
 * loading/error refs and a manual refresh trigger.
 */
export function usePricing(getConfig: () => FetchPricingConfig): UsePricingComposable {
    const data = ref<PricingPayload | null>(null);
    const error = ref<Error | null>(null);
    const isLoading = ref(true);
    let alive = true;
    let cycle = 0;

    function run() {
        const config = getConfig();
        const current = ++cycle;
        isLoading.value = true;
        error.value = null;

        fetchPricing(config)
            .then((p) => {
                if (alive && current === cycle) data.value = p;
            })
            .catch((e: unknown) => {
                if (alive && current === cycle) error.value = e instanceof Error ? e : new Error(String(e));
            })
            .finally(() => {
                if (alive && current === cycle) isLoading.value = false;
            });
    }

    watchEffect(run);

    onUnmounted(() => {
        alive = false;
    });

    return { data, error, isLoading, refresh: run };
}

export type UseDownloadComposable = {
    trigger: () => Promise<void>;
    isPending: Ref<boolean>;
    error: Ref<Error | null>;
    lastIssued: Ref<IssuedDownload | null>;
};

export function useDownload(getConfig: () => DownloadConfig): UseDownloadComposable {
    const isPending = ref(false);
    const error = ref<Error | null>(null);
    const lastIssued = ref<IssuedDownload | null>(null);

    async function trigger() {
        isPending.value = true;
        error.value = null;
        try {
            const issued = await triggerDownload(getConfig());
            lastIssued.value = issued;
        } catch (e: unknown) {
            error.value = e instanceof Error ? e : new Error(String(e));
        } finally {
            isPending.value = false;
        }
    }

    return { trigger, isPending, error, lastIssued };
}
