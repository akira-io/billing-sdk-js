export function checkoutUrl(baseUrl: string, productKey: string, planKey: string): string {
    return `${baseUrl.replace(/\/$/, '')}/subscribe/${productKey}/${planKey}`;
}
