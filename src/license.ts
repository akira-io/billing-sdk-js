import type {
    LicenseSnapshotPayload,
    SignedLicense,
    UsageFeatureState,
} from './client-types';

export interface DecodedLicense {
    raw: SignedLicense;
    payload: LicenseSnapshotPayload;
}

function base64Decode(input: string): Uint8Array<ArrayBuffer> {
    const bin = atob(input);
    const buf = new ArrayBuffer(bin.length);
    const out = new Uint8Array(buf);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

export function decodeLicense(signed: SignedLicense): DecodedLicense {
    const payloadJson = new TextDecoder().decode(base64Decode(signed.payload));
    const payload = JSON.parse(payloadJson) as LicenseSnapshotPayload;
    return { raw: signed, payload };
}

export async function verifyLicense(signed: SignedLicense, publicKeyBase64: string): Promise<boolean> {
    if (signed.algorithm !== 'ed25519') return false;

    const subtle = globalThis.crypto?.subtle;
    if (!subtle) throw new Error('crypto.subtle not available; cannot verify license');

    const payloadBytes = base64Decode(signed.payload);
    const signatureBytes = base64Decode(signed.signature);
    const publicKeyBytes = base64Decode(publicKeyBase64);

    const key = await subtle.importKey(
        'raw',
        publicKeyBytes,
        { name: 'Ed25519' } as AlgorithmIdentifier,
        false,
        ['verify'],
    );

    return subtle.verify({ name: 'Ed25519' } as AlgorithmIdentifier, key, signatureBytes, payloadBytes);
}

export function computeRemaining(
    payload: LicenseSnapshotPayload,
    feature: string,
    consumedLocal = 0,
): number | null {
    const state = payload.usage?.[feature];
    if (!state) return null;
    if (state.type === 'bool') return state.enabled ? Number.POSITIVE_INFINITY : 0;
    return Math.max(0, state.allowance - state.consumed_at_issue - consumedLocal);
}

export function isUnlimited(state: UsageFeatureState | undefined): boolean {
    if (!state) return false;
    if (state.type === 'bool') return state.enabled;
    return state.allowance === 0;
}

export function isExpired(payload: LicenseSnapshotPayload, now: Date = new Date()): boolean {
    return new Date(payload.valid_until).getTime() < now.getTime();
}

export function isInGrace(
    payload: LicenseSnapshotPayload,
    graceSeconds: number,
    now: Date = new Date(),
): boolean {
    const expiry = new Date(payload.valid_until).getTime();
    return now.getTime() <= expiry + graceSeconds * 1000;
}

export function canUseUpdate(payload: LicenseSnapshotPayload, releaseDate: string | Date): boolean {
    const release = releaseDate instanceof Date ? releaseDate : new Date(releaseDate);

    const paidUpMs = payload.paid_up_until ? new Date(payload.paid_up_until).getTime() : null;
    const fallbackMs = payload.fallback_release_date
        ? new Date(payload.fallback_release_date).getTime()
        : null;

    if (paidUpMs === null && fallbackMs === null) return true;

    const effective = Math.max(paidUpMs ?? -Infinity, fallbackMs ?? -Infinity);
    const windowMs = (payload.updates_window_days ?? 0) * 86_400_000;
    return release.getTime() <= effective + windowMs;
}

export function periodResetAt(payload: LicenseSnapshotPayload, feature: string): Date | null {
    const state = payload.usage?.[feature];
    if (!state || state.type !== 'counter') return null;
    return new Date(state.period_end);
}
