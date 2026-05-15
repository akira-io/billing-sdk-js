import type { BuildOauthInitUrlOptions, PkceChallenge } from './client-types';

function bytesToUrlSafeBase64(bytes: Uint8Array): string {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] as number);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomBytes(length: number): Uint8Array {
    const buf = new Uint8Array(length);
    globalThis.crypto.getRandomValues(buf);
    return buf;
}

export async function generatePkceChallenge(): Promise<PkceChallenge> {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) throw new Error('crypto.subtle not available; cannot generate PKCE challenge');

    const verifier = bytesToUrlSafeBase64(randomBytes(48));
    const hash = await subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = bytesToUrlSafeBase64(new Uint8Array(hash));

    return { verifier, challenge, method: 'S256' };
}

export function generateOauthState(): string {
    return bytesToUrlSafeBase64(randomBytes(24));
}

export function buildOauthInitUrl(opts: BuildOauthInitUrlOptions): string {
    const base = opts.baseUrl.replace(/\/$/, '');
    const params = new URLSearchParams({
        product: opts.product,
        redirect_uri: opts.redirectUri,
        code_challenge: opts.codeChallenge,
        code_challenge_method: opts.codeChallengeMethod ?? 'S256',
    });
    if (opts.state) params.set('state', opts.state);

    return `${base}/auth/${opts.provider}?${params.toString()}`;
}
