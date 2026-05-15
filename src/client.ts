import {
    HEADER_NONCE,
    HEADER_PRODUCT,
    HEADER_SIGNATURE,
    HEADER_TIMESTAMP,
    canonical,
    newNonce,
    sign,
} from './signature';
import type {
    BillingPortalResponse,
    Customer,
    EntitlementsResponse,
    LicenseActivatePayload,
    LicenseActivateResponse,
    LicenseCheckPayload,
    LicenseCheckResponse,
    LicensePublicKeysResponse,
    LicenseRefreshPayload,
    LicenseSyncUsagePayload,
    LicenseSyncUsageResponse,
    OtpRequestPayload,
    OtpVerifyPayload,
    OtpVerifyResponse,
    UsagePayload,
    UsageResponse,
} from './client-types';

export interface BillingClientConfig {
    baseUrl: string;
    productSlug: string;
    productSecret: string;
    customerToken?: string;
    fetcher?: typeof fetch;
}

export class BillingApiError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string) {
        super(`billing api ${status}: ${code}`);
        this.status = status;
        this.code = code;
    }
}

export class BillingClient {
    private readonly baseUrl: string;
    private readonly productSlug: string;
    private readonly productSecret: string;
    private customerToken: string | undefined;
    private readonly fetcher: typeof fetch;

    constructor(config: BillingClientConfig) {
        this.baseUrl = config.baseUrl.replace(/\/$/, '');
        this.productSlug = config.productSlug;
        this.productSecret = config.productSecret;
        this.customerToken = config.customerToken;
        this.fetcher = config.fetcher ?? globalThis.fetch;
        if (!this.fetcher) {
            throw new Error('No fetch implementation available. Pass `fetcher` or use a runtime with global fetch.');
        }
    }

    setCustomerToken(token: string): void {
        this.customerToken = token;
    }

    async requestOtp(payload: OtpRequestPayload): Promise<void> {
        await this.signed('POST', '/api/auth/customer/otp/request', payload);
    }

    async verifyOtp(payload: OtpVerifyPayload): Promise<OtpVerifyResponse> {
        const res = await this.signed<OtpVerifyResponse>('POST', '/api/auth/customer/otp/verify', payload);
        this.setCustomerToken(res.access_token);
        return res;
    }

    async customerMe(): Promise<Customer> {
        return this.signed<Customer>('GET', '/api/me');
    }

    async licenseCheck(payload: LicenseCheckPayload): Promise<LicenseCheckResponse> {
        return this.signed<LicenseCheckResponse>('POST', '/api/licenses/check', payload);
    }

    async licenseActivate(payload: LicenseActivatePayload): Promise<LicenseActivateResponse> {
        return this.signed<LicenseActivateResponse>('POST', '/api/licenses/activate', payload);
    }

    async licenseRefresh(payload: LicenseRefreshPayload): Promise<LicenseActivateResponse> {
        return this.signed<LicenseActivateResponse>('POST', '/api/licenses/refresh', payload);
    }

    async licenseSyncUsage(payload: LicenseSyncUsagePayload): Promise<LicenseSyncUsageResponse> {
        return this.signed<LicenseSyncUsageResponse>('POST', '/api/licenses/sync-usage', payload);
    }

    async entitlements(): Promise<EntitlementsResponse> {
        return this.signed<EntitlementsResponse>('GET', '/api/me/entitlements');
    }

    async billingPortal(returnUrl: string): Promise<BillingPortalResponse> {
        const path = `/api/billing/portal?return_url=${encodeURIComponent(returnUrl)}`;
        return this.signed<BillingPortalResponse>('GET', path);
    }

    async trackUsage(payload: UsagePayload): Promise<UsageResponse> {
        return this.signed<UsageResponse>('POST', '/api/me/usage', payload);
    }

    async trackAnonymousUsage(payload: UsagePayload): Promise<UsageResponse> {
        return this.signed<UsageResponse>('POST', '/api/v1/usage/anonymous', payload);
    }

    async publicLicenseKeys(): Promise<LicensePublicKeysResponse> {
        return this.unsigned<LicensePublicKeysResponse>('GET', '/api/v1/license-keys/public');
    }

    private async signed<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
        const bodyBytes = body === undefined ? new Uint8Array() : new TextEncoder().encode(JSON.stringify(body));
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = newNonce();
        const canonicalString = await canonical(this.productSlug, timestamp, nonce, method, path, bodyBytes);
        const signature = await sign(this.productSecret, canonicalString);

        const headers: Record<string, string> = {
            Accept: 'application/json',
            [HEADER_PRODUCT]: this.productSlug,
            [HEADER_TIMESTAMP]: String(timestamp),
            [HEADER_NONCE]: nonce,
            [HEADER_SIGNATURE]: signature,
        };
        if (bodyBytes.length > 0) headers['Content-Type'] = 'application/json';
        if (this.customerToken) headers.Authorization = `Bearer ${this.customerToken}`;

        const res = await this.fetcher(`${this.baseUrl}${path}`, {
            method,
            headers,
            body: bodyBytes.length > 0 ? bodyBytes : undefined,
        });

        return this.parseResponse<T>(res);
    }

    private async unsigned<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
        const headers: Record<string, string> = { Accept: 'application/json' };
        let bodyInit: BodyInit | undefined;
        if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
            bodyInit = JSON.stringify(body);
        }

        const res = await this.fetcher(`${this.baseUrl}${path}`, { method, headers, body: bodyInit });
        return this.parseResponse<T>(res);
    }

    private async parseResponse<T>(res: Response): Promise<T> {
        if (!res.ok) {
            let code: string;
            try {
                const parsed = (await res.json()) as { error?: string };
                code = parsed?.error ?? '';
            } catch {
                try {
                    code = await res.text();
                } catch {
                    code = '';
                }
            }
            throw new BillingApiError(res.status, code);
        }

        if (res.status === 204) {
            return undefined as T;
        }

        return (await res.json()) as T;
    }
}
