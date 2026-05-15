import type { AssetPlatform, IssuedDownload, ReleaseChannel } from './types';

export type DownloadConfig = {
    baseUrl: string;
    product: string;
    channel: ReleaseChannel;
    platform: AssetPlatform;
    /** Optional UTM + landing tracking. */
    query?: Record<string, string | undefined>;
    /** Delay before firing the completion beacon, ms. Default 1500. */
    beaconDelayMs?: number;
    fetcher?: typeof fetch;
};

export function downloadUrl(config: Pick<DownloadConfig, 'baseUrl' | 'product' | 'channel' | 'platform' | 'query'>): string {
    const base = config.baseUrl.replace(/\/$/, '');
    const path = `/api/v1/downloads/${config.product}/${config.channel}/${config.platform}`;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(config.query ?? {})) {
        if (v !== undefined && v !== '') params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `${base}${path}?${qs}` : `${base}${path}`;
}

/**
 * Issues a download via the billing API and returns the signed asset URL +
 * beacon URL without redirecting. Useful when you want full control of the
 * UX (e.g. fetch then trigger your own `<a download>` flow).
 */
export async function issueDownload(config: DownloadConfig): Promise<IssuedDownload> {
    const f = config.fetcher ?? globalThis.fetch;
    if (!f) {
        throw new Error('No fetch implementation available. Pass a fetcher in config or use Node 18+.');
    }

    const url = downloadUrl(config);
    const res = await f(url, { headers: { Accept: 'application/json' } });

    if (!res.ok) {
        throw new Error(`download issue failed: HTTP ${res.status}`);
    }

    return (await res.json()) as IssuedDownload;
}

/**
 * Fires the completion beacon for an issued download. Uses
 * `navigator.sendBeacon` when available (survives page navigation), falls
 * back to `fetch` with `keepalive: true`. Safe to call at unload time.
 */
export function sendCompletionBeacon(beaconUrl: string): void {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(beaconUrl);
        return;
    }

    if (typeof fetch !== 'undefined') {
        void fetch(beaconUrl, { method: 'POST', keepalive: true }).catch(() => {});
    }
}

/**
 * One-shot helper for landing-page download CTAs: fetches a signed URL,
 * navigates the current tab to the asset, then schedules the completion
 * beacon. The function resolves once the navigation has been triggered.
 */
export async function triggerDownload(config: DownloadConfig): Promise<IssuedDownload> {
    const issued = await issueDownload(config);
    const delay = config.beaconDelayMs ?? 1500;

    if (typeof window !== 'undefined') {
        window.location.href = issued.signedUrl;
        setTimeout(() => sendCompletionBeacon(issued.beaconUrl), delay);
    }

    return issued;
}
