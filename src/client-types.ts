export interface OtpRequestPayload {
    email: string;
    device_fp?: string;
    platform?: string;
    app_version?: string;
}

export interface OtpVerifyPayload {
    email: string;
    code: string;
    device_fp?: string;
}

export interface OtpCustomer {
    id: string;
    email: string;
}

export interface OtpVerifyResponse {
    access_token: string;
    customer: OtpCustomer;
}

export interface Customer {
    id: string;
    email: string;
    name: string | null;
    trial_ends_at: string | null;
    plan: string | null;
}

export interface LicenseCheckPayload {
    product: string;
    feature: string;
}

export interface LicenseCheckResponse {
    allowed: boolean;
    product: string;
    plan: string | null;
    feature: string;
    source: string | null;
}

export interface LicenseActivatePayload {
    product: string;
    device_type: string;
    platform?: string;
    device_name?: string;
    app_version?: string;
    fingerprint: string;
}

export interface LicenseRefreshPayload {
    product: string;
    fingerprint: string;
}

export interface SignedLicense {
    key_id: string;
    algorithm: string;
    payload: string;
    signature: string;
    valid_until: string;
}

export interface ActivatedDevice {
    id: string;
    type: string;
    slots_used: number;
    slots_limit: number | null;
}

export interface LicenseActivateResponse {
    allowed: boolean;
    product: string;
    plan: string;
    features: Record<string, boolean>;
    device: ActivatedDevice;
    license: SignedLicense;
}

export interface EntitlementCustomer {
    id: string;
    email: string;
    name: string | null;
}

export interface EntitlementsResponse {
    customer: EntitlementCustomer;
    entitlements: unknown;
    devices: unknown;
}

export interface BillingPortalResponse {
    url: string;
}

export interface LicensePublicKey {
    key_id: string;
    algorithm: string;
    public_key_base64: string;
}

export interface LicensePublicKeysResponse {
    keys: LicensePublicKey[];
    active_key_id: string | null;
}

export interface UsagePayload {
    product: string;
    feature: string;
    date: string;
    device_fp: string;
    action: 'check' | 'increment';
    count?: number;
    platform?: string;
    device_type?: string;
    app_version?: string;
}

export interface UsageResponse {
    count: number;
    limit: number | null;
    period?: string;
    allowed: boolean;
}

export type LicensingMode = 'offline_snapshot' | 'online_realtime';

export type UsageFeatureState =
    | { type: 'bool'; enabled: boolean }
    | {
          type: 'counter';
          allowance: number;
          period: 'daily' | 'weekly' | 'monthly' | 'yearly';
          period_start: string;
          period_end: string;
          consumed_at_issue: number;
      };

export interface LicenseSnapshotPayload {
    v?: number;
    key_id: string;
    customer_id: string;
    product_key: string;
    plan_key: string;
    licensing_mode?: LicensingMode;
    features: Record<string, boolean>;
    usage?: Record<string, UsageFeatureState>;
    fingerprint_hash: string;
    serial?: number;
    issued_at: string;
    valid_until: string;
    paid_up_until?: string | null;
    fallback_release_date?: string | null;
    updates_window_days?: number | null;
    offline_grace_days?: number | null;
}

export interface LicenseSyncUsagePayload {
    product: string;
    fingerprint: string;
    serial: number;
    deltas: Record<string, number>;
}

export interface LicenseSyncUsageResponse {
    license: SignedLicense;
    applied: Record<string, number>;
    serial: number;
}

export type OauthProvider = 'google' | 'github' | 'apple' | 'microsoft' | 'gitlab' | 'bitbucket';

export interface OauthProviderInfo {
    provider: OauthProvider;
    label: string;
    scopes: string[];
}

export interface OauthProvidersResponse {
    product: string;
    providers: OauthProviderInfo[];
}

export interface OauthExchangePayload {
    code: string;
    code_verifier: string;
}

export interface OauthExchangeResponse {
    access_token: string;
    token_type: string;
    customer: {
        id: string;
        product_id: string;
    };
}

export interface PkceChallenge {
    verifier: string;
    challenge: string;
    method: 'S256';
}

export interface BuildOauthInitUrlOptions {
    baseUrl: string;
    provider: OauthProvider;
    product: string;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod?: 'S256' | 'plain';
    state?: string;
}
