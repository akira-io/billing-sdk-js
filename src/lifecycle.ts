import type { LicenseSnapshotPayload } from './client-types';

export type LicenseState = 'none' | 'invalid' | 'active' | 'trialing' | 'grace' | 'expired';

export function computeState(
    payload: LicenseSnapshotPayload | null | undefined,
    graceWindowMs: number,
    now: Date = new Date(),
): LicenseState {
    if (!payload) return 'none';
    if (!payload.valid_until) return 'invalid';

    const expiry = Date.parse(payload.valid_until);
    if (Number.isNaN(expiry)) return 'invalid';

    const nowMs = now.getTime();
    if (nowMs <= expiry) {
        return isTrialPayload(payload) ? 'trialing' : 'active';
    }

    const cutoff = expiry + graceWindowMs;
    if (nowMs <= cutoff) return 'grace';
    return 'expired';
}

export function trialDaysLeft(
    payload: LicenseSnapshotPayload | null | undefined,
    now: Date = new Date(),
): number {
    if (!payload || !isTrialPayload(payload)) return 0;
    const expiry = Date.parse(payload.valid_until);
    if (Number.isNaN(expiry)) return 0;
    const delta = expiry - now.getTime();
    if (delta <= 0) return 0;
    const dayMs = 24 * 60 * 60 * 1000;
    return Math.ceil(delta / dayMs);
}

function isTrialPayload(payload: LicenseSnapshotPayload): boolean {
    if (payload.features?.__trial === true) return true;
    if (payload.plan_key && payload.plan_key.endsWith(':trial')) return true;
    return false;
}
