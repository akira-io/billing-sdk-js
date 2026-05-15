import { describe, expect, it } from 'vitest';
import { checkoutUrl } from '../src/checkout';

describe('checkoutUrl', () => {
    it('builds the subscribe path', () => {
        expect(checkoutUrl('https://billing.test', 'unified-dev', 'pro_monthly')).toBe(
            'https://billing.test/subscribe/unified-dev/pro_monthly',
        );
    });

    it('strips trailing slash from base', () => {
        expect(checkoutUrl('https://billing.test/', 'unified-dev', 'pro_yearly')).toBe(
            'https://billing.test/subscribe/unified-dev/pro_yearly',
        );
    });
});
