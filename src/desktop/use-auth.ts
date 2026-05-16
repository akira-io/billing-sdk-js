import type { BillingClient } from '../client';
import type { Customer, OauthExchangeResponse } from '../client-types';
import type { LoopbackOutcome } from '../loopback';
import type { SessionStore } from './session';

export type AuthStatusState =
    | { state: 'loading' }
    | { state: 'guest' }
    | { state: 'authenticated'; customer: Customer; licensed: boolean };

export interface AuthControllerOptions {
    client: BillingClient;
    session: SessionStore;
    product: string;
    feature?: string;
    /** Loopback flow used by `oauthLogin`. */
    loopbackLogin: (provider: string) => Promise<LoopbackOutcome>;
    /** Override the runtime license check (e.g. cache, custom feature key). */
    checkLicense?: (client: BillingClient) => Promise<boolean>;
}

export class AuthController {
    private listeners = new Set<(s: AuthStatusState) => void>();
    private current: AuthStatusState = { state: 'loading' };

    constructor(private readonly opts: AuthControllerOptions) {}

    subscribe(listener: (s: AuthStatusState) => void): () => void {
        this.listeners.add(listener);
        listener(this.current);
        return () => this.listeners.delete(listener);
    }

    snapshot(): AuthStatusState {
        return this.current;
    }

    private emit(next: AuthStatusState): void {
        this.current = next;
        this.listeners.forEach((l) => l(next));
    }

    async bootstrap(): Promise<void> {
        await this.opts.session.hydrate(this.opts.client);
        await this.refresh();
    }

    async refresh(): Promise<void> {
        if (!(await this.opts.session.hasToken())) {
            this.emit({ state: 'guest' });
            return;
        }
        try {
            const customer = await this.opts.client.customerMe();
            const licensed = this.opts.checkLicense
                ? await this.opts.checkLicense(this.opts.client)
                : await this.runDefaultLicenseCheck();
            this.emit({ state: 'authenticated', customer, licensed });
        } catch (e) {
            if ((e as { status?: number }).status === 401) {
                await this.opts.session.clear(this.opts.client);
                this.emit({ state: 'guest' });
                return;
            }
            throw e;
        }
    }

    private async runDefaultLicenseCheck(): Promise<boolean> {
        try {
            const resp = await this.opts.client.licenseCheck({
                product: this.opts.product,
                feature: this.opts.feature ?? 'general',
            });
            return resp.allowed;
        } catch {
            return false;
        }
    }

    async requestOtp(email: string, deviceFp?: string): Promise<void> {
        await this.opts.client.requestOtp({ email, device_fp: deviceFp ?? '' });
    }

    async verifyOtp(email: string, code: string, deviceFp?: string): Promise<Customer> {
        const resp = await this.opts.client.verifyOtp({
            email,
            code,
            device_fp: deviceFp ?? '',
        });
        await this.opts.session.persist(this.opts.client, resp.access_token);
        await this.refresh();
        return (await this.opts.client.customerMe());
    }

    async oauthLogin(provider: string): Promise<OauthExchangeResponse> {
        const outcome = await this.opts.loopbackLogin(provider);
        await this.opts.session.persist(this.opts.client, outcome.exchange.access_token);
        await this.refresh();
        return outcome.exchange;
    }

    async logout(): Promise<void> {
        await this.opts.session.clear(this.opts.client);
        this.emit({ state: 'guest' });
    }
}
