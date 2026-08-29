<script lang="ts">
	import { page } from '$app/state';

	/*
	 * Vier Ziele mit Wort statt Symbol. Unbebaut ist noch /wissen; bis dahin
	 * führt es auf die Fehlerseite mit `Diese Seite gibt es nicht.` /mehr steht
	 * seit Story 1.3, /dienstplan seit Story 3.1.
	 *
	 * Die Zahl der **Ziele** bleibt bei vier: Story 3.2 legt zwei Routen an, aber
	 * keine davon ist ein Ort, den man mehrmals in der Woche aufsucht. Eine
	 * fünfte Beschriftung in einer Leiste, die bei 375px vier trägt, wäre der
	 * teurere Handel.
	 *
	 * **`gehoertDazu` nennt die Routen, die zu einem Ziel gehören, ohne unter
	 * dessen Pfad zu liegen.** Das ist keine Bequemlichkeit, sondern die Antwort
	 * auf eine Frage, die dieses Projekt seit Story 1.5 offen mit sich trug
	 * (Eintrag 28 der zurückgestellten Arbeit): auf /aufgabe, /monatsplan und
	 * /verwaltung war **kein** Eintrag markiert, und die ganze Erfassung lief
	 * ohne Ortsangabe. Mit /dienstplan als echtem Ziel und den zwei Routen aus
	 * Story 3.2 sind es fünf solche Seiten statt zwei.
	 *
	 * Zugeordnet wird nach dem **Weg dorthin**, nicht nach dem Thema: /aufgabe
	 * wird vom Knopf `+ Aufgabe` unter dem Pool erreicht und gehört darum zu `/`;
	 * /monatsplan, /verwaltung, /einzelaufgabe und /einzelaufgaben stehen als
	 * Einträge auf /mehr. Wer die Leiste liest, soll dort stehen sehen, woher er
	 * kam.
	 *
	 * **Die Seite `/einzelaufgaben` hängt an `Mehr`**, obwohl Block 2 auf `/` auch
	 * dorthin führt. Der Weg, der **immer** besteht, ist der Eintrag auf /mehr: der
	 * Block auf `/` fehlt ganz, sobald keine Einzelaufgabe frei ist. Eine
	 * Zuordnung an `/` hiesse, dass die Leiste je nach Datenlage etwas anderes
	 * behauptet.
	 *
	 * **Die zwei neuen Pfade unterscheiden sich um einen Buchstaben** —
	 * `/einzelaufgabe` und `/einzelaufgaben`. `trifft` unten vergleicht auf Gleichheit oder an der
	 * Segmentgrenze, und keiner der beiden Vergleiche trifft den Nachbarn: für
	 * `/einzelaufgaben` ist `/einzelaufgabe` weder gleich noch ein Präfix mit
	 * folgendem Schrägstrich. scripts/smoke-zugang.ts hält zusätzlich fest, dass
	 * jede Route zu **genau einem** Eintrag gehört und nicht bloss zu mindestens
	 * einem.
	 *
	 * Eine Formularroute, die zu **keinem** Ziel gehört, gibt es nicht und soll
	 * es nicht geben: eine Seite, die man erreicht, ohne dass die Leiste etwas
	 * sagt, ist eine Sackgasse ohne Ortsangabe. Wer eine Route anlegt, trägt sie
	 * hier ein — scripts/smoke-zugang.ts hält die Liste gegen die Routen im Baum.
	 */
	const ziele = [
		{ href: '/', beschriftung: 'Aufgaben', gehoertDazu: ['/aufgabe'] },
		{ href: '/dienstplan', beschriftung: 'Dienstplan', gehoertDazu: [] },
		{ href: '/wissen', beschriftung: 'Wissen', gehoertDazu: [] },
		{
			href: '/mehr',
			beschriftung: 'Mehr',
			gehoertDazu: ['/monatsplan', '/verwaltung', '/einzelaufgabe', '/einzelaufgaben'],
		},
	];

	type Ziel = (typeof ziele)[number];

	/*
	 * Vergleich an der Segmentgrenze, nicht mit nacktem startsWith: sonst wäre
	 * unter /wissenschaft das Ziel /wissen als aktiv markiert. '/' trifft nur
	 * sich selbst, weil startsWith('/') auf jeden Pfad zutrifft.
	 */
	const trifft = (pfad: string, href: string): boolean =>
		pfad === href || (href !== '/' && pfad.startsWith(`${href}/`));

	/** Steht die angezeigte Seite **selbst** hinter diesem Eintrag? */
	const istDieseSeite = (ziel: Ziel): boolean => trifft(page.url.pathname, ziel.href);

	/** Gehört sie zu seinem Abschnitt — auch wenn sie woanders liegt? */
	const istAktiv = (ziel: Ziel): boolean =>
		istDieseSeite(ziel) || ziel.gehoertDazu.some((route) => trifft(page.url.pathname, route));

	/*
	 * **Zwei Werte, weil es zwei Aussagen sind.** `aria-current="page"` heisst
	 * „das hier ist die angezeigte Seite" — auf /aufgabe wäre das über den
	 * Eintrag `Aufgaben` eine Falschaussage, die angezeigte Seite ist eine
	 * andere. `aria-current="true"` heisst „das hier ist der laufende Eintrag"
	 * und ist genau die schwächere Aussage, die dort stimmt.
	 *
	 * Sichtbar sind beide Zustände derselbe: die Markierung sagt, wo man ist,
	 * und für das Auge ist „auf dieser Seite" und „in diesem Abschnitt" hier
	 * dasselbe. Ein dritter Zustand wäre eine Unterscheidung ohne Handlung.
	 */
	const aktivMarke = (ziel: Ziel): 'page' | 'true' | undefined => {
		if (istDieseSeite(ziel)) return 'page';
		return istAktiv(ziel) ? 'true' : undefined;
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
					class:nav-bar__ziel--aktiv={istAktiv(ziel)}
					href={ziel.href}
					aria-current={aktivMarke(ziel)}
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
