import { webcrypto } from 'node:crypto';

const NONCE_LEN = 12;

/** AES-256-GCM string encryption keyed by a 32-byte secret. */
export class TokenCipher {
    private readonly key: CryptoKey | Promise<CryptoKey>;

    constructor(key: Uint8Array) {
        if (key.length !== 32) throw new Error('TokenCipher: key must be 32 bytes');
        this.key = webcrypto.subtle.importKey('raw', key as unknown as ArrayBuffer, 'AES-GCM', false, ['encrypt', 'decrypt']);
    }

    async encrypt(plaintext: string): Promise<string> {
        const key = await this.key;
        const nonce = webcrypto.getRandomValues(new Uint8Array(NONCE_LEN));
        const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, new TextEncoder().encode(plaintext)));
        const combined = new Uint8Array(NONCE_LEN + ct.length);
        combined.set(nonce, 0);
        combined.set(ct, NONCE_LEN);
        return Buffer.from(combined).toString('base64');
    }

    async decrypt(encoded: string): Promise<string> {
        const bytes = new Uint8Array(Buffer.from(encoded, 'base64'));
        if (bytes.length <= NONCE_LEN) throw new Error('ciphertext too short');
        const nonce = bytes.slice(0, NONCE_LEN);
        const ct = bytes.slice(NONCE_LEN);
        const key = await this.key;
        const pt = new Uint8Array(await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ct as unknown as ArrayBuffer));
        return new TextDecoder().decode(pt);
    }
}

export function generateKey(): Uint8Array {
    return webcrypto.getRandomValues(new Uint8Array(32));
}
