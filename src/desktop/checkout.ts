/** Build the public checkout URL for a product on the billing site. */
export function checkoutUrl(baseUrl: string, product: string): string {
    return `${baseUrl.replace(/\/$/, '')}/plans?product=${encodeURIComponent(product)}`;
}
