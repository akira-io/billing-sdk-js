import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { BillingClient } from './client';
import type { OauthExchangeResponse, OauthProvider } from './client-types';
import { buildOauthInitUrl, generateOauthState, generatePkceChallenge } from './oauth';

const SUCCESS_HTML = `<!doctype html><meta charset=utf-8><title>Sign in complete</title><style>body{font-family:-apple-system,system-ui,sans-serif;background:#08080b;color:#e6e6ec;display:grid;place-items:center;height:100vh;margin:0}</style><h1>You can close this tab.</h1>`;

export interface LoopbackLoginOptions {
    provider: OauthProvider;
    product: string;
    /** Caller-controlled browser opener. Receives the OAuth init URL. */
    openBrowser: (url: string) => void | Promise<void>;
    /** Wall-clock timeout for the callback (default: 300 s). */
    timeoutMs?: number;
}

export interface LoopbackOutcome {
    exchange: OauthExchangeResponse;
}

/**
 * Desktop loopback PKCE OAuth flow for Node-based consumers.
 *
 * Binds a transient HTTP server on `127.0.0.1`, opens the system browser, waits
 * for the provider redirect, exchanges the code for an access token through the
 * SDK and stores it on the supplied client.
 */
export async function loopbackLogin(
    client: BillingClient,
    opts: LoopbackLoginOptions,
): Promise<LoopbackOutcome> {
    const pkce = await generatePkceChallenge();
    const state = generateOauthState();

    const { port, server, callback } = await listenForCallback(opts.timeoutMs ?? 300_000);

    const redirectUri = `http://127.0.0.1:${port}/cb`;
    const authUrl = buildOauthInitUrl({
        baseUrl: client.getBaseUrl(),
        provider: opts.provider,
        product: opts.product,
        redirectUri,
        codeChallenge: pkce.challenge,
        codeChallengeMethod: pkce.method,
        state,
    });

    try {
        await opts.openBrowser(authUrl);
    } catch (e) {
        server.close();
        throw new Error(`loopback: open browser failed — ${(e as Error).message}`);
    }

    let result: { code: string; state: string };
    try {
        result = await callback;
    } finally {
        server.close();
    }

    if (result.state !== state) {
        throw new Error('loopback: oauth state mismatch');
    }

    const exchange = await client.exchangeOauthCode({
        code: result.code,
        code_verifier: pkce.verifier,
    });

    return { exchange };
}

interface ListenResult {
    port: number;
    server: ReturnType<typeof createServer>;
    callback: Promise<{ code: string; state: string }>;
}

async function listenForCallback(timeoutMs: number): Promise<ListenResult> {
    return new Promise((resolve, reject) => {
        const server = createServer();

        const callback = new Promise<{ code: string; state: string }>((res, rej) => {
            const timer = setTimeout(() => {
                rej(new Error('loopback: callback timed out'));
                server.close();
            }, timeoutMs);

            server.once('error', (e) => {
                clearTimeout(timer);
                rej(e);
            });

            server.on('request', (req: IncomingMessage, resp: ServerResponse) => {
                try {
                    const reqUrl = new URL(req.url ?? '/', 'http://127.0.0.1');
                    const code = reqUrl.searchParams.get('code');
                    const state = reqUrl.searchParams.get('state');

                    resp.writeHead(200, {
                        'Content-Type': 'text/html; charset=utf-8',
                        'Connection': 'close',
                    });
                    resp.end(SUCCESS_HTML);

                    if (!code) return rej(new Error('loopback: callback missing code'));
                    if (!state) return rej(new Error('loopback: callback missing state'));

                    clearTimeout(timer);
                    res({ code, state });
                } catch (e) {
                    clearTimeout(timer);
                    rej(e as Error);
                }
            });
        });

        server.listen(0, '127.0.0.1', () => {
            const addr = server.address() as AddressInfo;
            resolve({ port: addr.port, server, callback });
        });

        server.once('error', reject);
    });
}
