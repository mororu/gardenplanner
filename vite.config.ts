import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

// Kein vite-plugin-pwa: die Installierbarkeit hängt allein an
// static/manifest.webmanifest und den Icons. Ein Service Worker, der nichts
// cachen darf, wäre toter Ballast — und ein Datencache würde Erledigtes als
// offen zeigen.
export default defineConfig(({ mode }) => {
	// Variablen aus .env in process.env legen, damit serverseitiger Code sie
	// im Dev-Modus zur SSR-Laufzeit über process.env liest.
	//
	// Nur füllen, nie überschreiben: ein Wert aus der Aufrufzeile muss gewinnen.
	// Mit einem pauschalen Object.assign hätte
	//   SESSION_SECRET=… npm run dev
	// stillschweigend den Wert aus .env benutzt — und damit wäre jede Prüfung
	// einer Fehlkonfiguration von Hand wertlos.
	const env = loadEnv(mode, process.cwd(), '');
	for (const [name, wert] of Object.entries(env)) {
		process.env[name] ??= wert;
	}

	return {
		plugins: [sveltekit()],
	};
});
