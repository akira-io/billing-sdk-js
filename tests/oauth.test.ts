import { describe, expect, it } from 'vitest';
import { buildOauthInitUrl, generateOauthState, generatePkceChallenge } from '../src/oauth';

describe('generatePkceChallenge', () => {
    it('produces verifier and S256 challenge that match', async () => {
        const { verifier, challenge, method } = await generatePkceChallenge();
        expect(method).toBe('S256');
        expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);

        const expected = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
        const bytes = new Uint8Array(expected);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        const recomputed = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        expect(challenge).toBe(recomputed);
    });
});

describe('generateOauthState', () => {
    it('produces a url-safe base64 string', () => {
        const state = generateOauthState();
        expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(state.length).toBeGreaterThan(16);
    });

    it('returns different values across calls', () => {
        const a = generateOauthState();
        const b = generateOauthState();
        expect(a).not.toBe(b);
    });
});

describe('buildOauthInitUrl', () => {
    it('encodes product + redirect + PKCE params', () => {
        const url = buildOauthInitUrl({
            baseUrl: 'https://billing.akira.io/',
            provider: 'google',
            product: 'maintainer',
            redirectUri: 'http://127.0.0.1:53000/cb',
            codeChallenge: 'abc',
            state: 'csrf-1',
        });
        expect(url.startsWith('https://billing.akira.io/auth/google?')).toBe(true);
        const params = new URL(url).searchParams;
        expect(params.get('product')).toBe('maintainer');
        expect(params.get('redirect_uri')).toBe('http://127.0.0.1:53000/cb');
        expect(params.get('code_challenge')).toBe('abc');
        expect(params.get('code_challenge_method')).toBe('S256');
        expect(params.get('state')).toBe('csrf-1');
    });

    it('omits state when not provided', () => {
        const url = buildOauthInitUrl({
            baseUrl: 'https://billing.akira.io',
            provider: 'github',
            product: 'maintainer',
            redirectUri: 'http://127.0.0.1:1/cb',
            codeChallenge: 'xyz',
        });
        expect(new URL(url).searchParams.has('state')).toBe(false);
    });

    it('respects plain challenge method', () => {
        const url = buildOauthInitUrl({
            baseUrl: 'https://billing.akira.io',
            provider: 'google',
            product: 'm',
            redirectUri: 'http://127.0.0.1:1/cb',
            codeChallenge: 'xyz',
            codeChallengeMethod: 'plain',
        });
        expect(new URL(url).searchParams.get('code_challenge_method')).toBe('plain');
    });
});
