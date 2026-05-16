import type { LicenseSnapshotPayload, SignedLicense } from './client-types';
import { computeRemaining } from './license';
import { computeState, type LicenseState } from './lifecycle';

export interface LoadedLicense {
    license: SignedLicense;
    payload: LicenseSnapshotPayload;
}

export type LicenseLoader = () => Promise<LoadedLicense | null>;
export type LocalConsumptionFn = (feature: string) => Promise<number> | number;

export interface GateOptions {
    loader: LicenseLoader;
    localConsumption?: LocalConsumptionFn;
    graceWindowMs?: number;
    now?: () => Date;
}

export interface FeatureAccess {
    feature: string;
    allowed: boolean;
    hasFeature: boolean;
    unlimited: boolean;
    remaining: number;
    reason: string;
    plan: string;
    state: LicenseState;
}

export class GateDeniedError extends Error {
    readonly access: FeatureAccess;

    constructor(access: FeatureAccess) {
        super(`billing: feature "${access.feature}" denied (${access.reason})`);
        this.name = 'GateDeniedError';
        this.access = access;
    }
}

export function isGateDenied(err: unknown): err is GateDeniedError {
    return err instanceof GateDeniedError;
}

export class Gate {
    private readonly loader: LicenseLoader;
    private readonly localConsumption: LocalConsumptionFn;
    private readonly graceWindowMs: number;
    private readonly now: () => Date;
    private inflight: Promise<FeatureAccess> | null = null;

    constructor(opts: GateOptions) {
        if (!opts.loader) throw new Error('billing: Gate requires loader');
        this.loader = opts.loader;
        this.localConsumption = opts.localConsumption ?? (() => 0);
        this.graceWindowMs = opts.graceWindowMs ?? 0;
        this.now = opts.now ?? (() => new Date());
    }

    async check(feature: string): Promise<FeatureAccess> {
        const prev = this.inflight;
        const run = (async () => {
            if (prev) {
                try {
                    await prev;
                } catch {
                    /* prior failure does not block current call */
                }
            }
            return this.evaluate(feature);
        })();
        this.inflight = run.catch(() => ({}) as FeatureAccess) as Promise<FeatureAccess>;
        return run;
    }

    async require(feature: string): Promise<FeatureAccess> {
        const access = await this.check(feature);
        if (!access.allowed) throw new GateDeniedError(access);
        return access;
    }

    private async evaluate(feature: string): Promise<FeatureAccess> {
        const access: FeatureAccess = {
            feature,
            allowed: false,
            hasFeature: false,
            unlimited: false,
            remaining: 0,
            reason: '',
            plan: '',
            state: 'none',
        };

        let loaded: LoadedLicense | null;
        try {
            loaded = await this.loader();
        } catch (err) {
            access.reason = 'verify_failed';
            throw Object.assign(err instanceof Error ? err : new Error(String(err)), { access });
        }

        if (!loaded) {
            access.reason = 'no_license';
            return access;
        }

        const { payload } = loaded;
        access.plan = payload.plan_key;
        access.state = computeState(payload, this.graceWindowMs, this.now());

        if (access.state === 'expired' || access.state === 'invalid') {
            access.reason = `license_${access.state}`;
            return access;
        }

        const featureFlag = payload.features?.[feature];
        if (featureFlag !== undefined) {
            access.hasFeature = featureFlag;
            if (!featureFlag) {
                access.reason = 'feature_disabled';
                return access;
            }
        }

        let consumed: number;
        try {
            consumed = await this.localConsumption(feature);
        } catch (err) {
            access.reason = 'local_consumption_failed';
            throw Object.assign(err instanceof Error ? err : new Error(String(err)), { access });
        }

        const remaining = computeRemaining(payload, feature, consumed);
        if (remaining === null) {
            if (access.hasFeature) {
                access.allowed = true;
                access.unlimited = true;
                return access;
            }
            access.reason = 'feature_missing';
            return access;
        }

        if (remaining === Number.POSITIVE_INFINITY) {
            access.unlimited = true;
            access.hasFeature = true;
            access.allowed = true;
            return access;
        }

        access.remaining = remaining;
        if (remaining > 0) {
            access.allowed = true;
            access.hasFeature = true;
            return access;
        }

        access.reason = 'limit_reached';
        return access;
    }
}
