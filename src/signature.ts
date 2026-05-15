export const HEADER_PRODUCT = 'X-Akira-Product';
export const HEADER_TIMESTAMP = 'X-Akira-Timestamp';
export const HEADER_NONCE = 'X-Akira-Nonce';
export const HEADER_SIGNATURE = 'X-Akira-Signature';

async function sha256Hex(bytes: Uint8Array): Promise<string> {
    const digest = await getSubtle().digest('SHA-256', bytes as BufferSource);
    return bufferToHex(new Uint8Array(digest));
}

function getSubtle(): SubtleCrypto {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
        throw new Error('Web Crypto SubtleCrypto API is not available in this runtime.');
    }
    return subtle;
}

function bufferToHex(buffer: Uint8Array): string {
    let out = '';
    for (const byte of buffer) {
        out += byte.toString(16).padStart(2, '0');
    }
    return out;
}

export function newNonce(): string {
    const buf = new Uint8Array(16);
    if (globalThis.crypto?.getRandomValues) {
        globalThis.crypto.getRandomValues(buf);
    } else {
        for (let i = 0; i < buf.length; i += 1) {
            buf[i] = Math.floor(Math.random() * 256);
        }
    }
    return bufferToHex(buf);
}

export async function canonical(
    productSlug: string,
    timestamp: number,
    nonce: string,
    method: string,
    path: string,
    body: Uint8Array,
): Promise<string> {
    const bodyHash = await sha256Hex(body);
    return `${productSlug}\n${timestamp}\n${nonce}\n${method.toUpperCase()}\n${path}\n${bodyHash}`;
}

export async function sign(productSecret: string, canonicalString: string): Promise<string> {
    const subtle = getSubtle();
    const keyData = new TextEncoder().encode(productSecret) as BufferSource;
    const key = await subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const sig = await subtle.sign('HMAC', key, new TextEncoder().encode(canonicalString) as BufferSource);
    return bufferToHex(new Uint8Array(sig));
}
