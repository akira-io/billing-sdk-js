import { spawn } from 'node:child_process';

/** Launch the system default browser. Node-only. */
export function openBrowser(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
        let cmd: string;
        let args: string[];
        switch (process.platform) {
            case 'darwin':
                cmd = 'open';
                args = [url];
                break;
            case 'win32':
                cmd = 'rundll32';
                args = ['url.dll,FileProtocolHandler', url];
                break;
            default:
                cmd = 'xdg-open';
                args = [url];
        }
        const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
        child.once('error', reject);
        child.unref();
        resolve();
    });
}
