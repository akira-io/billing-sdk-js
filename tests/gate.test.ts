import { describe, expect, it } from 'vitest';
import { Gate, GateDeniedError, isGateDenied } from '../src/gate';
import type { LicenseSnapshotPayload, SignedLicense } from '../src/client-types';

const NOW = new Date('2026-01-10T12:00:00Z');
const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

function signed(): SignedLicense {
    return {
        key_id: 'k1',
        algorithm: 'ed25519',
        payload: '',
        signature: '',
        valid_until: '',
    };
}

function makePayload(validUntilMs: number): LicenseSnapshotPayload {
    return {
        key_id: 'k1',
        customer_id: 'c1',
        product_key: 'p',
        plan_key: 'pro_monthly',
        valid_until: new Date(validUntilMs).toISOString(),
        features: {
            mock_server: true,
            requests_per_day: true,
            locked_feature: false,
        },
        usage: {
            mock_server: { type: 'bool', enabled: true },
            locked_feature: { type: 'bool', enabled: false },
            requests_per_day: {
                type: 'counter',
                allowance: 200,
                period: 'daily',
                period_start: '2026-01-10T00:00:00Z',
                period_end: '2026-01-11T00:00:00Z',
                consumed_at_issue: 50,
            },
        },
        fingerprint_hash: 'fp',
        issued_at: '2026-01-09T00:00:00Z',
    };
}

function makeGate(payload: LicenseSnapshotPayload | null) {
    return new Gate({
        loader: async () => (payload ? { license: signed(), payload } : null),
        localConsumption: (feature) => (feature === 'requests_per_day' ? 25 : 0),
        graceWindowMs: GRACE_MS,
        now: () => NOW,
    });
}

describe('Gate.check', () => {
    it('allows enabled bool feature as unlimited', async () => {
        const gate = makeGate(makePayload(NOW.getTime() + 24 * 3600 * 1000));
        const access = await gate.check('mock_server');
        expect(access.allowed).toBe(true);
        expect(access.unlimited).toBe(true);
    });

    it('returns remaining for counter feature', async () => {
        const gate = makeGate(makePayload(NOW.getTime() + 24 * 3600 * 1000));
        const access = await gate.check('requests_per_day');
        expect(access.allowed).toBe(true);
        expect(access.remaining).toBe(125);
    });

    it('denies disabled features with feature_disabled', async () => {
        const gate = makeGate(makePayload(NOW.getTime() + 24 * 3600 * 1000));
        const access = await gate.check('locked_feature');
        expect(access.allowed).toBe(false);
        expect(access.reason).toBe('feature_disabled');
    });

    it('denies when license is expired', async () => {
        const gate = makeGate(makePayload(NOW.getTime() - 30 * 24 * 3600 * 1000));
        const access = await gate.check('mock_server');
        expect(access.allowed).toBe(false);
        expect(access.state).toBe('expired');
    });

    it('returns no_license when loader returns null', async () => {
        const gate = new Gate({ loader: async () => null });
        const access = await gate.check('mock_server');
        expect(access.allowed).toBe(false);
        expect(access.reason).toBe('no_license');
    });
});

describe('Gate.require', () => {
    it('throws GateDeniedError when access is denied', async () => {
        const gate = makeGate(makePayload(NOW.getTime() + 24 * 3600 * 1000));
        await expect(gate.require('locked_feature')).rejects.toBeInstanceOf(GateDeniedError);
        try {
            await gate.require('locked_feature');
        } catch (err) {
            expect(isGateDenied(err)).toBe(true);
            if (isGateDenied(err)) {
                expect(err.access.reason).toBe('feature_disabled');
            }
        }
    });
});
