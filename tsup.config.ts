import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        client: 'src/client.ts',
        pricing: 'src/pricing.ts',
        downloads: 'src/downloads.ts',
        checkout: 'src/checkout.ts',
        helpers: 'src/helpers.ts',
        license: 'src/license.ts',
        oauth: 'src/oauth.ts',
        loopback: 'src/loopback.ts',
        desktop: 'src/desktop/index.ts',
        'desktop-react': 'src/desktop/react.ts',
        'desktop-vue': 'src/desktop/vue.ts',
        react: 'src/react.ts',
        vue: 'src/vue.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    splitting: false,
    target: 'es2022',
    external: ['react', 'vue'],
});
