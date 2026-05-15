import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { usePricing } from '../src/vue';

const pricingPayload = {
    product: 'unified-dev',
    name: 'Unified Dev',
    description: null,
    beta_active: false,
    plans: [
        {
            key: 'pro_monthly',
            name: 'Pro',
            description: null,
            amount: 1500,
            currency: 'eur',
            billing_interval: 'month',
            trial_period_days: 0,
            features: [],
        },
    ],
};

describe('usePricing (vue)', () => {
    it('resolves to the transformed payload', async () => {
        const fetcher = vi
            .fn()
            .mockResolvedValue(new Response(JSON.stringify(pricingPayload), { status: 200 }));

        const Component = defineComponent({
            setup() {
                const { data, isLoading } = usePricing(() => ({
                    baseUrl: 'https://billing.test',
                    productKey: 'unified-dev',
                    fetcher: fetcher as unknown as typeof fetch,
                }));
                return () => h('span', isLoading.value ? 'loading' : data.value?.tiers[0]?.key ?? 'none');
            },
        });

        const wrapper = mount(Component);
        await nextTick();
        await new Promise((r) => setTimeout(r, 0));
        await nextTick();
        expect(wrapper.text()).toBe('pro');
    });
});
