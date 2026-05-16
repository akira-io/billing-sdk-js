import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import { generateKey } from './cipher';
import { TokenKeyring } from './keyring';

export interface KeyStoreOptions {
    keyring: TokenKeyring;
    /** Optional debug fallback path. When set, the key is mirrored to disk so
     * unsigned dev rebuilds can still decrypt previously persisted data. */
    debugFilePath?: string;
}

/** Loads or generates a 32-byte AES key, persisted in the OS keychain. */
export class KeyStore {
    constructor(private readonly opts: KeyStoreOptions) {}

    async loadOrCreate(): Promise<Uint8Array> {
        if (this.opts.debugFilePath) {
            try {
                const encoded = (await readFile(this.opts.debugFilePath, 'utf8')).trim();
                return decodeKey(encoded);
            } catch { /* fall through */ }
        }

        const encoded = await this.opts.keyring.get().catch(() => null);
        if (encoded) {
            const key = decodeKey(encoded);
            await this.writeDebugFile(encoded);
            return key;
        }

        const key = generateKey();
        const encodedNew = Buffer.from(key).toString('base64');
        await this.opts.keyring.set(encodedNew).catch(() => undefined);
        await this.writeDebugFile(encodedNew);
        return key;
    }

    private async writeDebugFile(encoded: string): Promise<void> {
        if (!this.opts.debugFilePath) return;
        await mkdir(dirname(this.opts.debugFilePath), { recursive: true });
        await writeFile(this.opts.debugFilePath, encoded, 'utf8');
    }
}

function decodeKey(encoded: string): Uint8Array {
    const bytes = new Uint8Array(Buffer.from(encoded, 'base64'));
    if (bytes.length !== 32) throw new Error('key has unexpected length');
    return bytes;
}
