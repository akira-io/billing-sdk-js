/**
 * Thin wrapper around `keytar` for desktop apps. Consumers install `keytar` as
 * an optional dependency; this module dynamically imports it so server-side
 * bundles never see it.
 */
export interface TokenKeyringOptions {
    service: string;
    account: string;
}

type Keytar = {
    getPassword: (service: string, account: string) => Promise<string | null>;
    setPassword: (service: string, account: string, password: string) => Promise<void>;
    deletePassword: (service: string, account: string) => Promise<boolean>;
};

async function loadKeytar(): Promise<Keytar> {
    // Use Function constructor so tsup/typescript don't try to resolve the
    // optional module at build time. Consumers add `keytar` as a peer/optional
    // dependency.
    const dyn = new Function('m', 'return import(m)') as (m: string) => Promise<unknown>;
    const mod = (await dyn('keytar').catch(() => null)) as { default?: Keytar } | null;
    if (!mod) throw new Error('TokenKeyring: install `keytar` to use the desktop keyring helper.');
    return mod.default ?? (mod as unknown as Keytar);
}

export class TokenKeyring {
    private readonly service: string;
    private readonly account: string;

    constructor(opts: TokenKeyringOptions) {
        this.service = opts.service;
        this.account = opts.account;
    }

    async get(): Promise<string | null> {
        const k = await loadKeytar();
        return k.getPassword(this.service, this.account);
    }

    async set(value: string): Promise<void> {
        const k = await loadKeytar();
        await k.setPassword(this.service, this.account, value);
    }

    async delete(): Promise<void> {
        const k = await loadKeytar();
        await k.deletePassword(this.service, this.account);
    }
}
