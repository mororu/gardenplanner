import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		// Bewusst adapter-node, nie adapter-auto: das Ziel ist ein eigener VPS.
		adapter: adapter({
			// Ausgabeverzeichnis des Node-Baus
			out: 'build',
			// Statische Dateien vorkomprimieren (gzip + brotli), damit nginx sie direkt ausliefert
			precompress: true,
		}),

		// $lib zeigt auf src/lib
		alias: {
			$lib: 'src/lib',
		},
	},

	vitePlugin: {
		// Runes global erzwingen. filename ist bei virtuellen Modulen undefined,
		// darum explizit gegen undefined prüfen — sonst wirft der Aufruf.
		dynamicCompileOptions: ({ filename }) =>
			filename !== undefined && filename.includes('node_modules') ? undefined : { runes: true },
	},
};

export default config;
