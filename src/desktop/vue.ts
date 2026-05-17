import { computed, onBeforeUnmount, ref, type ComputedRef, type Ref } from 'vue';

import type { AuthController, AuthStatusState } from './use-auth';

export interface UseDesktopAuthResult {
    status: Ref<AuthStatusState>;
    bootstrap: () => Promise<void>;
    refresh: () => Promise<void>;
    requestOtp: (email: string, deviceFp?: string) => Promise<void>;
    verifyOtp: (email: string, code: string, deviceFp?: string) => Promise<void>;
    oauthLogin: (provider: string) => Promise<void>;
    logout: () => Promise<void>;
}

export function useDesktopAuth(controller: AuthController): UseDesktopAuthResult {
    const status = ref<AuthStatusState>(controller.snapshot());
    const unsubscribe = controller.subscribe((next) => {
        status.value = next;
    });
    onBeforeUnmount(() => unsubscribe());

    return {
        status,
        bootstrap: () => controller.bootstrap(),
        refresh: () => controller.refresh(),
        requestOtp: (email, deviceFp) => controller.requestOtp(email, deviceFp),
        verifyOtp: async (email, code, deviceFp) => { await controller.verifyOtp(email, code, deviceFp); },
        oauthLogin: async (provider) => { await controller.oauthLogin(provider); },
        logout: () => controller.logout(),
    };
}

export function useFeatures(controller: AuthController): ComputedRef<string[]> {
    const status = ref<AuthStatusState>(controller.snapshot());
    const unsubscribe = controller.subscribe((next) => {
        status.value = next;
    });
    onBeforeUnmount(() => unsubscribe());
    return computed(() => (status.value.state === 'authenticated' ? status.value.features : []));
}

export function useFeature(controller: AuthController, key: string): ComputedRef<boolean> {
    const features = useFeatures(controller);
    return computed(() => features.value.includes(key));
}
