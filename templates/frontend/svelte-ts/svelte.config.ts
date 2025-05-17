import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

import type { SvelteConfig } from 'vite-plugin-svelte/config'

const config: SvelteConfig = {
  // Consult https://svelte.dev/docs#compile-time-svelte-preprocess
  // for more information about preprocessors
  preprocess: vitePreprocess(),
}

export default config
