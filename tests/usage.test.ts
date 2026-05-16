import { describe, expect, it } from 'vitest';
import { MemoryBuffer, UsageTracker } from '../src/usage';
import type { LicenseSyncUsageResponse, SignedLicense } from '../src/client-types';

function emptySigned(): SignedLicense {
    return { key_id: 'k', algorithm: 'ed25519', payload: '', signature: '', valid_until: '' };
}

describe('UsageTracker.flush', () => {
    it('sends accumulated deltas with serial and invokes onRefresh', async () => {
        const buffer = new MemoryBuffer();
        let syncedDeltas: Record<string, number> = {};
        let syncedSerial = -1;
        let refreshed = 0;

        const tracker = new UsageTracker({
            buffer,
            sync: async (deltas, serial) => {
                syncedDeltas = deltas;
                syncedSerial = serial;
                const resp: LicenseSyncUsageResponse = {
                    license: emptySigned(),
                    applied: deltas,
                    serial: serial + 1,
                };
                return resp;
            },
            serial: () => 42,
            onRefresh: () => {
                refreshed++;
            },
        });

        await tracker.track('requests_per_day', 3);
        await tracker.track('requests_per_day', 2);
        await tracker.flush();

        expect(syncedDeltas.requests_per_day).toBe(5);
        expect(syncedSerial).toBe(42);
        expect(refreshed).toBe(1);
    });

    it('skips sync when buffer is empty', async () => {
        let called = 0;
        const tracker = new UsageTracker({
            buffer: new MemoryBuffer(),
            sync: async () => {
                called++;
                return { license: emptySigned(), applied: {}, serial: 0 };
            },
        });
        await tracker.flush();
        expect(called).toBe(0);
    });

    it('restores deltas to buffer when sync errors', async () => {
        const buffer = new MemoryBuffer();
        const boom = new Error('boom');
        const tracker = new UsageTracker({
            buffer,
            sync: async () => {
                throw boom;
            },
        });

        await tracker.track('f', 4);
        await expect(tracker.flush()).rejects.toBe(boom);

        const drained = await buffer.drain();
        expect(drained.f).toBe(4);
    });
});

describe('UsageTracker.start/stop', () => {
    it('runs background flusher within interval', async () => {
        const buffer = new MemoryBuffer();
        let flushes = 0;

        const tracker = new UsageTracker({
            buffer,
            flushIntervalMs: 10,
            sync: async (deltas) => {
                flushes++;
                return { license: emptySigned(), applied: deltas, serial: 0 };
            },
        });

        await tracker.track('f', 1);
        tracker.start();

        await new Promise<void>((resolve, reject) => {
            const deadline = Date.now() + 500;
            const tick = () => {
                if (flushes > 0) return resolve();
                if (Date.now() > deadline) return reject(new Error('flusher did not run'));
                setTimeout(tick, 5);
            };
            tick();
        });

        await tracker.stop();
        expect(flushes).toBeGreaterThan(0);
    });
});
