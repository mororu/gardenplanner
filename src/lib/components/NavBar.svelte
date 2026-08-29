<script lang="ts">
	import { page } from '$app/state';

	// Vier Ziele mit Wort statt Symbol. Unbebaut ist noch /wissen; bis dahin
	// führt es auf die Fehlerseite mit `Diese Seite gibt es nicht.` /mehr steht
	// seit Story 1.3, /dienstplan seit Story 3.1.
	const ziele = [
		{ href: '/', beschriftung: 'Aufgaben' },
		{ href: '/dienstplan', beschriftung: 'Dienstplan' },
		{ href: '/wissen', beschriftung: 'Wissen' },
		{ href: '/mehr', beschriftung: 'Mehr' },
	];

	/*
	 * Vergleich an der Segmentgrenze, nicht mit nacktem startsWith: sonst wäre
	 * unter /wissenschaft das Ziel /wissen als aktiv markiert. '/' trifft nur
	 * sich selbst, weil startsWith('/') auf jeden Pfad zutrifft.
	 */
	const istAktiv = (href: string): boolean => {
		const pfad = page.url.pathname;
		return pfad === href || (href !== '/' && pfad.startsWith(`${href}/`));
	};
</script>

<nav class="nav-bar" aria-label="Hauptnavigation">
	<ul class="nav-bar__liste">
		<!--
			Ausnahme mit Ansage und mit engster Reichweite.

			Der Grund ist **nicht**, dass Routen fehlen — das war die frühere
			Begründung und sie stimmte schon damals nicht ganz. Der href kommt hier
			aus einer Variablen, und durch eine Variable sieht
			svelte/no-navigation-without-resolve nicht hindurch: sie verlangt einen
			resolve()-Aufruf an der Stelle des Attributwerts. Die Ziele stehen als
			Liste, damit Beschriftung und Aktiv-Vergleich einmal geschrieben sind;
			der Preis ist diese Ausnahme, genau für diesen each-Block und danach
			sofort wieder eingeschaltet. Für jede andere Stelle bleibt die Regel
			scharf — siehe src/routes/mehr/+page.svelte, wo ein literales
			resolve('/verwaltung') steht.
		-->
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
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
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</ul>
</nav>

<style>
	/*
		Bis 37.5rem liegt die Leiste fest am unteren Rand und damit ausserhalb des
		Flusses; ab 37.5rem steht sie im Fluss direkt unter der Titelleiste, wo sie
		in der Reihenfolge des DOM erscheint. Es wird nichts per order umsortiert —
		ein order auf einem fixierten Element wäre ohnehin wirkungslos und würde
		nur Sicht- und Tastaturreihenfolge auseinandertreiben.
	*/
	.nav-bar {
		position: fixed;
		inset-inline: 0;
		bottom: 0;
		/* Über dem Inhalt, damit gescrollter Text nicht durch die Leiste läuft */
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
		/* Trefferfeld: --navbar-height ist die Höhe der Leiste und liegt über dem
		   44px-Boden. box-sizing: border-box rechnet die Kante mit hinein. */
		min-height: var(--navbar-height);
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
