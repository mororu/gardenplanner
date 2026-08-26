<script lang="ts">
	import { page } from '$app/state';

	// Vier Ziele mit Wort statt Symbol. /dienstplan, /wissen und /mehr entstehen
	// in späteren Stories; bis dahin führen sie auf die Standardfehlerseite.
	const ziele = [
		{ href: '/', beschriftung: 'Aufgaben' },
		{ href: '/dienstplan', beschriftung: 'Dienstplan' },
		{ href: '/wissen', beschriftung: 'Wissen' },
		{ href: '/mehr', beschriftung: 'Mehr' },
	];

	const istAktiv = (href: string): boolean =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

<!--
	Ausnahme mit Ansage: /dienstplan, /wissen und /mehr entstehen erst in späteren
	Stories. resolve() kennt diese Routen noch nicht und würde im Typcheck brechen,
	darum ist die Regel genau in dieser Datei ausgesetzt — für jede andere Datei
	bleibt sie scharf. Sobald die Routen stehen, gehört der Aufruf hierher zurück.
-->
<!-- eslint-disable svelte/no-navigation-without-resolve -->
<nav class="nav-bar" aria-label="Hauptnavigation">
	<ul class="nav-bar__liste">
		{#each ziele as ziel (ziel.href)}
			<li class="nav-bar__eintrag">
				<a
					class="nav-bar__ziel"
					class:nav-bar__ziel--aktiv={istAktiv(ziel.href)}
					href={ziel.href}
					aria-current={istAktiv(ziel.href) ? 'page' : undefined}
				>
					{ziel.beschriftung}
				</a>
			</li>
		{/each}
	</ul>
</nav>

<style>
	/*
		Bis 37.5rem liegt die Leiste fest am unteren Rand und damit ausserhalb des
		Flusses; ab 37.5rem steht sie im Fluss direkt unter der Titelleiste, wo sie
		in der Reihenfolge des DOM erscheint. Es wird nichts per order umsortiert,
		darum folgt die Tastaturreihenfolge in beiden Zuständen der Leserichtung.
	*/
	.nav-bar {
		position: fixed;
		inset-inline: 0;
		bottom: 0;
		z-index: 10;
		background-color: var(--surface-raised);
		border-top: var(--border-hairline) solid var(--hairline);
		padding-bottom: env(safe-area-inset-bottom, 0px);
	}

	.nav-bar__liste {
		display: flex;
		/* Beschriftungen auf demselben Mass wie der Inhalt */
		max-width: var(--measure);
		margin: 0 auto;
		padding: 0;
		list-style: none;
	}

	.nav-bar__eintrag {
		display: flex;
		flex: 1 1 0;
	}

	.nav-bar__ziel {
		display: flex;
		flex: 1 1 auto;
		align-items: center;
		justify-content: center;
		/* Trefferfeld mindestens 44px hoch */
		min-height: var(--touch);
		padding: var(--space-2) var(--space-1);
		/* Die Kante liegt immer, damit das aktive Ziel die Zeile nicht verschiebt */
		border-top: var(--border-active) solid transparent;
		color: var(--ink-secondary);
		font-family: var(--meta-font);
		font-size: var(--meta-size);
		font-weight: var(--meta-weight);
		line-height: var(--meta-line);
		text-decoration: none;
	}

	/* Der Zustand hängt nicht allein an der Farbe: Akzent und 2px-Kante zusammen */
	.nav-bar__ziel--aktiv {
		border-top-color: var(--accent);
		color: var(--accent);
	}

	@media (min-width: 37.5rem) {
		.nav-bar {
			position: static;
			border-top: 0;
			border-bottom: var(--border-hairline) solid var(--hairline);
			padding-bottom: 0;
		}

		.nav-bar__ziel {
			border-top: 0;
			border-bottom: var(--border-active) solid transparent;
		}

		.nav-bar__ziel--aktiv {
			border-bottom-color: var(--accent);
		}
	}
</style>
