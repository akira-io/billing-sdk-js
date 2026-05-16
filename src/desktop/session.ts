import { BillingClient } from '../client';
import { TokenKeyring } from './keyring';

export class SessionStore {
    constructor(private readonly keyring: TokenKeyring) {}

    async hydrate(client: BillingClient): Promise<boolean> {
        const token = await this.keyring.get();
        if (!token) return false;
        client.setCustomerToken(token);
        return true;
    }

    async persist(client: BillingClient, token: string): Promise<void> {
        await this.keyring.set(token);
        client.setCustomerToken(token);
    }

    async clear(client: BillingClient): Promise<void> {
        await this.keyring.delete();
        client.setCustomerToken('');
    }

    async hasToken(): Promise<boolean> {
        const v = await this.keyring.get();
        return !!v;
    }
}
