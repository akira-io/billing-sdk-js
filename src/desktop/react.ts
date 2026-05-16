import { useEffect, useMemo, useState } from 'react';

import type { AuthController, AuthStatusState } from './use-auth';

export interface UseDesktopAuthResult {
    status: AuthStatusState;
    bootstrap: () => Promise<void>;
    refresh: () => Promise<void>;
    requestOtp: (email: string, deviceFp?: string) => Promise<void>;
    verifyOtp: (email: string, code: string, deviceFp?: string) => Promise<void>;
    oauthLogin: (provider: string) => Promise<void>;
    logout: () => Promise<void>;
}

export function useDesktopAuth(controller: AuthController): UseDesktopAuthResult {
    const [status, setStatus] = useState<AuthStatusState>(controller.snapshot());

    useEffect(() => controller.subscribe(setStatus), [controller]);

    return useMemo<UseDesktopAuthResult>(() => ({
        status,
        bootstrap: () => controller.bootstrap(),
        refresh: () => controller.refresh(),
        requestOtp: (email, deviceFp) => controller.requestOtp(email, deviceFp),
        verifyOtp: async (email, code, deviceFp) => { await controller.verifyOtp(email, code, deviceFp); },
        oauthLogin: async (provider) => { await controller.oauthLogin(provider); },
        logout: () => controller.logout(),
    }), [controller, status]);
}
