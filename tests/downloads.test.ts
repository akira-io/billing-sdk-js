import { describe, expect, it, vi } from 'vitest';
import { downloadUrl, issueDownload, sendCompletionBeacon, triggerDownload } from '../src/downloads';

const issued = {
    eventId: 'evt-1',
    product: 'unified-dev',
    version: '0.9.0',
    channel: 'stable',
    os: 'macos',
    arch: 'arm64',
    format: 'dmg',
    signedUrl: 'https://cdn.example.test/unified_dev_0.9.0_arm64.dmg?sig=abc',
    expiresAt: '2026-05-15T01:00:00Z',
    beaconUrl: 'https://billing.test/api/v1/downloads/events/evt-1/complete?sig=xyz',
};

describe('downloadUrl', () => {
    it('builds the asset endpoint URL', () => {
        expect(
            downloadUrl({
                baseUrl: 'https://billing.test',
                product: 'unified-dev',
                channel: 'stable',
                platform: 'macos-arm64',
            }),
        ).toBe('https://billing.test/api/v1/downloads/unified-dev/stable/macos-arm64');
    });

    it('appends UTM query when provided', () => {
        const url = downloadUrl({
            baseUrl: 'https://billing.test',
            product: 'unified-dev',
            channel: 'stable',
            platform: 'macos-arm64',
            query: { utm_source: 'twitter', utm_medium: undefined, utm_campaign: '' },
        });
        expect(url).toContain('utm_source=twitter');
        expect(url).not.toContain('utm_medium');
        expect(url).not.toContain('utm_campaign');
    });
});

describe('issueDownload', () => {
    it('returns the IssuedDownload payload', async () => {
        const fetcher = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(issued), { status: 200, headers: { 'content-type': 'application/json' } }),
        );

        const result = await issueDownload({
            baseUrl: 'https://billing.test',
            product: 'unified-dev',
            channel: 'stable',
            platform: 'macos-arm64',
            fetcher: fetcher as unknown as typeof fetch,
        });

        expect(result.eventId).toBe('evt-1');
        expect(fetcher).toHaveBeenCalledOnce();
    });

    it('throws on non-2xx', async () => {
        const fetcher = vi.fn().mockResolvedValue(new Response('nope', { status: 500 }));
        await expect(
            issueDownload({
                baseUrl: 'https://billing.test',
                product: 'unified-dev',
                channel: 'stable',
                platform: 'macos-arm64',
                fetcher: fetcher as unknown as typeof fetch,
            }),
        ).rejects.toThrow(/HTTP 500/);
    });
});

describe('sendCompletionBeacon', () => {
    it('prefers navigator.sendBeacon when available', () => {
        const beacon = vi.fn().mockReturnValue(true);
        vi.stubGlobal('navigator', { sendBeacon: beacon });
        sendCompletionBeacon('https://billing.test/x');
        expect(beacon).toHaveBeenCalledWith('https://billing.test/x');
        vi.unstubAllGlobals();
    });
});

describe('triggerDownload', () => {
    it('issues, redirects, and schedules a beacon', async () => {
        vi.useFakeTimers();
        const fetcher = vi.fn().mockResolvedValue(
            new Response(JSON.stringify(issued), { status: 200, headers: { 'content-type': 'application/json' } }),
        );
        const beacon = vi.fn().mockReturnValue(true);
        const windowStub = { location: { href: '' } };
        vi.stubGlobal('window', windowStub);
        vi.stubGlobal('navigator', { sendBeacon: beacon });

        const result = await triggerDownload({
            baseUrl: 'https://billing.test',
            product: 'unified-dev',
            channel: 'stable',
            platform: 'macos-arm64',
            beaconDelayMs: 100,
            fetcher: fetcher as unknown as typeof fetch,
        });

        expect(result.signedUrl).toBe(issued.signedUrl);
        expect(windowStub.location.href).toBe(issued.signedUrl);

        vi.advanceTimersByTime(150);
        expect(beacon).toHaveBeenCalledWith(issued.beaconUrl);

        vi.unstubAllGlobals();
        vi.useRealTimers();
    });
});
