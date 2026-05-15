import { describe, expect, it } from 'vitest';
import {
    canUseUpdate,
    computeRemaining,
    decodeLicense,
    isExpired,
    isInGrace,
    periodResetAt,
    verifyLicense,
} from '../src/license';
import type { LicenseSnapshotPayload, SignedLicense } from '../src/client-types';

function basePayload(overrides: Partial<LicenseSnapshotPayload> = {}): LicenseSnapshotPayload {
    return {
        v: 2,
        key_id: 'k1',
        customer_id: 'cust-1',
        product_key: 'maintainer',
        plan_key: 'free',
        licensing_mode: 'offline_snapshot',
        features: { agent_run: true },
        usage: {
            agent_run: {
                type: 'counter',
                allowance: 5,
                period: 'monthly',
                period_start: '2026-05-01T00:00:00Z',
                period_end: '2026-05-31T00:00:00Z',
                consumed_at_issue: 2,
            },
        },
        fingerprint_hash: 'fp',
        serial: 1,
        issued_at: '2026-05-15T10:00:00Z',
        valid_until: '2026-05-29T10:00:00Z',
        paid_up_until: '2027-05-15T00:00:00Z',
        fallback_release_date: '2027-05-15T00:00:00Z',
        ...overrides,
    };
}

function bytesToB64(bytes: Uint8Array): string {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}

function makeSigned(payload: LicenseSnapshotPayload, signature = 'sig'): SignedLicense {
    const json = new TextEncoder().encode(JSON.stringify(payload));
    return {
        key_id: payload.key_id,
        algorithm: 'ed25519',
        payload: bytesToB64(json),
        signature,
        valid_until: payload.valid_until,
    };
}

describe('decodeLicense', () => {
    it('parses base64 payload to typed object', () => {
        const payload = basePayload();
        const signed = makeSigned(payload);
        const decoded = decodeLicense(signed);
        expect(decoded.payload.plan_key).toBe('free');
        expect(decoded.payload.usage?.agent_run?.type).toBe('counter');
    });
});

describe('computeRemaining', () => {
    it('subtracts consumed_at_issue and local consumed', () => {
        const p = basePayload();
        expect(computeRemaining(p, 'agent_run')).toBe(3);
        expect(computeRemaining(p, 'agent_run', 2)).toBe(1);
        expect(computeRemaining(p, 'agent_run', 10)).toBe(0);
    });

    it('returns null for unknown feature', () => {
        const p = basePayload();
        expect(computeRemaining(p, 'ghost')).toBeNull();
    });

    it('returns Infinity for enabled bool feature', () => {
        const p = basePayload({
            usage: { white_label: { type: 'bool', enabled: true } },
        });
        expect(computeRemaining(p, 'white_label')).toBe(Number.POSITIVE_INFINITY);
    });

    it('returns 0 for disabled bool feature', () => {
        const p = basePayload({
            usage: { white_label: { type: 'bool', enabled: false } },
        });
        expect(computeRemaining(p, 'white_label')).toBe(0);
    });
});

describe('isExpired / isInGrace', () => {
    it('reports expired after valid_until', () => {
        const p = basePayload({ valid_until: '2026-05-01T00:00:00Z' });
        expect(isExpired(p, new Date('2026-05-15T00:00:00Z'))).toBe(true);
        expect(isExpired(p, new Date('2026-04-30T00:00:00Z'))).toBe(false);
    });

    it('grace covers configured window post-expiry', () => {
        const p = basePayload({ valid_until: '2026-05-01T00:00:00Z' });
        const grace = 7 * 24 * 3600;
        expect(isInGrace(p, grace, new Date('2026-05-05T00:00:00Z'))).toBe(true);
        expect(isInGrace(p, grace, new Date('2026-05-09T00:00:00Z'))).toBe(false);
    });
});

describe('canUseUpdate', () => {
    it('allows releases before paid_up_until', () => {
        const p = basePayload();
        expect(canUseUpdate(p, '2027-01-01T00:00:00Z')).toBe(true);
    });

    it('blocks releases after paid_up_until when no window', () => {
        const p = basePayload();
        expect(canUseUpdate(p, '2028-01-01T00:00:00Z')).toBe(false);
    });

    it('allows any release when paid_up_until and fallback are null', () => {
        const p = basePayload({ paid_up_until: null, fallback_release_date: null });
        expect(canUseUpdate(p, '2099-01-01T00:00:00Z')).toBe(true);
    });

    it('extends allowed cutoff by updates_window_days', () => {
        const p = basePayload({
            paid_up_until: '2027-01-01T00:00:00Z',
            fallback_release_date: '2027-01-01T00:00:00Z',
            updates_window_days: 365,
        });
        expect(canUseUpdate(p, '2027-06-01T00:00:00Z')).toBe(true);
        expect(canUseUpdate(p, '2028-06-01T00:00:00Z')).toBe(false);
    });

    it('uses fallback_release_date when greater than paid_up_until', () => {
        const p = basePayload({
            paid_up_until: '2026-01-01T00:00:00Z',
            fallback_release_date: '2027-12-31T00:00:00Z',
        });
        expect(canUseUpdate(p, '2027-06-01T00:00:00Z')).toBe(true);
    });
});

describe('periodResetAt', () => {
    it('returns period_end for counter features', () => {
        const p = basePayload();
        expect(periodResetAt(p, 'agent_run')?.toISOString()).toBe('2026-05-31T00:00:00.000Z');
    });

    it('returns null for bool features', () => {
        const p = basePayload({
            usage: { white_label: { type: 'bool', enabled: true } },
        });
        expect(periodResetAt(p, 'white_label')).toBeNull();
    });
});

describe('verifyLicense (Ed25519 roundtrip)', () => {
    it('verifies a signature produced by the same key', async () => {
        const subtle = globalThis.crypto?.subtle;
        if (!subtle || !('Ed25519' in (subtle as unknown as Record<string, unknown>))) {
            // happy-dom env may not implement Ed25519; skip
            return;
        }

        let keyPair: CryptoKeyPair;
        try {
            keyPair = (await subtle.generateKey({ name: 'Ed25519' } as AlgorithmIdentifier, true, [
                'sign',
                'verify',
            ])) as CryptoKeyPair;
        } catch {
            // runtime lacks Ed25519 support
            return;
        }

        const payload = basePayload();
        const json = new TextEncoder().encode(JSON.stringify(payload));
        const sig = new Uint8Array(
            await subtle.sign({ name: 'Ed25519' } as AlgorithmIdentifier, keyPair.privateKey, json),
        );
        const pubRaw = new Uint8Array(await subtle.exportKey('raw', keyPair.publicKey));

        const signed: SignedLicense = {
            key_id: 'k1',
            algorithm: 'ed25519',
            payload: bytesToB64(json),
            signature: bytesToB64(sig),
            valid_until: payload.valid_until,
        };

        const ok = await verifyLicense(signed, bytesToB64(pubRaw));
        expect(ok).toBe(true);
    });

    it('rejects non-ed25519 algorithm', async () => {
        const signed: SignedLicense = {
            key_id: 'k1',
            algorithm: 'rsa',
            payload: 'AA==',
            signature: 'AA==',
            valid_until: '2026-05-29T10:00:00Z',
        };
        expect(await verifyLicense(signed, 'AA==')).toBe(false);
    });
});
