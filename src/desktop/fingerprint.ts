import { createHash } from 'node:crypto';
import { hostname, platform } from 'node:os';

export interface DeviceFingerprint {
    fingerprint: string;
    platform: string;
    app_version: string;
}

async function machineId(): Promise<string> {
    const dyn = new Function('m', 'return import(m)') as (m: string) => Promise<unknown>;
    try {
        const mod = (await dyn('node-machine-id').catch(() => null)) as { machineIdSync?: (orig?: boolean) => string } | null;
        if (mod?.machineIdSync) return mod.machineIdSync(true);
    } catch {
        // fallthrough
    }
    return hostname();
}

export async function deviceFingerprint(appVersion: string): Promise<DeviceFingerprint> {
    const id = await machineId();
    const plat = platform();
    const hash = createHash('sha256');
    hash.update(id);
    hash.update('::');
    hash.update(plat);
    hash.update('::');
    hash.update(appVersion);
    return {
        fingerprint: hash.digest('hex'),
        platform: plat,
        app_version: appVersion,
    };
}
