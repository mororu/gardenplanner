import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	// Variablen aus .env in process.env legen, damit serverseitiger Code sie
	// im Dev-Modus zur SSR-Laufzeit über process.env liest.
	const env = loadEnv(mode, process.cwd(), '');
	Object.assign(process.env, env);

	return {
		plugins: [sveltekit()],
	};
});
