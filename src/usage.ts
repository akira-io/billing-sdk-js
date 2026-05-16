import type { LicenseSyncUsageResponse } from './client-types';

export interface UsageBuffer {
    add(feature: string, delta: number): Promise<void> | void;
    drain(): Promise<Record<string, number>> | Record<string, number>;
    restore(deltas: Record<string, number>): Promise<void> | void;
}

export class MemoryBuffer implements UsageBuffer {
    private state: Record<string, number> = {};

    add(feature: string, delta: number): void {
        if (delta === 0) return;
        this.state[feature] = (this.state[feature] ?? 0) + delta;
    }

    drain(): Record<string, number> {
        const out = this.state;
        this.state = {};
        return out;
    }

    restore(deltas: Record<string, number>): void {
        for (const [k, v] of Object.entries(deltas)) {
            this.state[k] = (this.state[k] ?? 0) + v;
        }
    }
}

export type SyncUsageFn = (
    deltas: Record<string, number>,
    serial: number,
) => Promise<LicenseSyncUsageResponse>;

export type SerialProviderFn = () => Promise<number> | number;
export type RefreshHandlerFn = (resp: LicenseSyncUsageResponse) => Promise<void> | void;

export interface UsageTrackerOptions {
    buffer: UsageBuffer;
    sync: SyncUsageFn;
    serial?: SerialProviderFn;
    onRefresh?: RefreshHandlerFn;
    flushIntervalMs?: number;
}

const DEFAULT_FLUSH_INTERVAL_MS = 5 * 60 * 1000;

export class UsageTracker {
    private readonly buffer: UsageBuffer;
    private readonly sync: SyncUsageFn;
    private readonly serial?: SerialProviderFn;
    private readonly onRefresh?: RefreshHandlerFn;
    private readonly flushIntervalMs: number;
    private timer: ReturnType<typeof setInterval> | null = null;
    private running = false;

    constructor(opts: UsageTrackerOptions) {
        if (!opts.buffer) throw new Error('billing: tracker requires buffer');
        if (!opts.sync) throw new Error('billing: tracker requires sync');
        this.buffer = opts.buffer;
        this.sync = opts.sync;
        if (opts.serial !== undefined) this.serial = opts.serial;
        if (opts.onRefresh !== undefined) this.onRefresh = opts.onRefresh;
        this.flushIntervalMs =
            opts.flushIntervalMs && opts.flushIntervalMs > 0
                ? opts.flushIntervalMs
                : DEFAULT_FLUSH_INTERVAL_MS;
    }

    async track(feature: string, delta: number): Promise<void> {
        if (delta === 0) return;
        await this.buffer.add(feature, delta);
    }

    async flush(): Promise<void> {
        const deltas = await this.buffer.drain();
        if (!deltas || Object.keys(deltas).length === 0) return;

        let serial = 0;
        if (this.serial) {
            try {
                serial = await this.serial();
            } catch (err) {
                await this.buffer.restore(deltas);
                throw err;
            }
        }

        let resp: LicenseSyncUsageResponse;
        try {
            resp = await this.sync(deltas, serial);
        } catch (err) {
            await this.buffer.restore(deltas);
            throw err;
        }

        if (this.onRefresh && resp) {
            await this.onRefresh(resp);
        }
    }

    start(): void {
        if (this.running) return;
        this.running = true;
        this.timer = setInterval(() => {
            void this.flush().catch(() => {
                /* swallow; next tick retries via restored buffer */
            });
        }, this.flushIntervalMs);
    }

    async stop(): Promise<void> {
        if (!this.running) return;
        this.running = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        await this.flush();
    }
}
