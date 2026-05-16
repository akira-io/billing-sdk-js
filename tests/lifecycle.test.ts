import { describe, expect, it } from 'vitest';
import { computeState, trialDaysLeft } from '../src/lifecycle';
import type { LicenseSnapshotPayload } from '../src/client-types';

const NOW = new Date('2026-01-10T12:00:00Z');
const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

function payload(overrides: Partial<LicenseSnapshotPayload> = {}): LicenseSnapshotPayload {
    return {
        key_id: 'k1',
        customer_id: 'c1',
        product_key: 'p',
        plan_key: 'pro_monthly',
        features: {},
        fingerprint_hash: 'fp',
        issued_at: '2026-01-01T00:00:00Z',
        valid_until: '2026-01-12T12:00:00Z',
        ...overrides,
    };
}

function offset(hours: number): string {
    return new Date(NOW.getTime() + hours * 60 * 60 * 1000).toISOString();
}

describe('computeState', () => {
    it('returns none for null/undefined payload', () => {
        expect(computeState(null, GRACE_MS, NOW)).toBe('none');
        expect(computeState(undefined, GRACE_MS, NOW)).toBe('none');
    });

    it('returns invalid for empty valid_until', () => {
        expect(computeState(payload({ valid_until: '' }), GRACE_MS, NOW)).toBe('invalid');
    });

    it('returns active for future expiry on regular plan', () => {
        expect(computeState(payload({ valid_until: offset(48) }), GRACE_MS, NOW)).toBe('active');
    });

    it('returns trialing when plan_key ends with :trial', () => {
        const p = payload({ valid_until: offset(48), plan_key: 'pro:trial' });
        expect(computeState(p, GRACE_MS, NOW)).toBe('trialing');
    });

    it('returns trialing when features.__trial is true', () => {
        const p = payload({ valid_until: offset(48), features: { __trial: true } });
        expect(computeState(p, GRACE_MS, NOW)).toBe('trialing');
    });

    it('returns grace within window past expiry', () => {
        expect(computeState(payload({ valid_until: offset(-24) }), GRACE_MS, NOW)).toBe('grace');
    });

    it('returns expired beyond grace window', () => {
        expect(computeState(payload({ valid_until: offset(-30 * 24) }), GRACE_MS, NOW)).toBe(
            'expired',
        );
    });
});

describe('trialDaysLeft', () => {
    it('returns ceil of remaining days for a trial', () => {
        const p = payload({ valid_until: offset(72), plan_key: 'pro:trial' });
        expect(trialDaysLeft(p, NOW)).toBe(3);
    });

    it('returns 0 for nullish payload', () => {
        expect(trialDaysLeft(null, NOW)).toBe(0);
    });

    it('returns 0 for non-trial license', () => {
        const p = payload({ valid_until: offset(72) });
        expect(trialDaysLeft(p, NOW)).toBe(0);
    });

    it('returns 0 when expiry is past', () => {
        const p = payload({ valid_until: offset(-1), plan_key: 'pro:trial' });
        expect(trialDaysLeft(p, NOW)).toBe(0);
    });
});
