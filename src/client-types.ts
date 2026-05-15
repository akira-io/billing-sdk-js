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
}

export interface UsageResponse {
    count: number;
    limit: number | null;
    allowed: boolean;
}
