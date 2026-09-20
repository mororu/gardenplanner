<script lang="ts">
	import { resolve } from '$app/paths';
	import ZeichenBlatt from '$lib/components/ZeichenBlatt.svelte';
	import ZeichenWinkel from '$lib/components/ZeichenWinkel.svelte';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();
</script>

<!--
	Die sechs Zeichen der Einträge — 24er-Raster, Strich in `currentColor`, keine
	Füllung, `aria-hidden`. **Fünf sind Ausschnitte, das Blatt ist eine
	Komponente**, und der Unterschied ist der einzige, der hier zählt: die fünf
	stehen genau einmal, an dieser Seite, und eine Datei je Zeichen wäre fünf
	Dateien für fünf Pfade. Das Blatt hat seit dem 2026-09-20 einen zweiten Leser
	— die Zeile mit Pfeil auf `/` — und ist darum nach
	$lib/components/ZeichenBlatt.svelte gezogen. So ist es dem Stift am
	2026-09-17 ergangen, und es ist der Weg, den der Absatz darüber beschreibt. Wer eines an einem zweiten Ort braucht, zieht es dann heraus — so ist
	es dem Stift am 2026-09-17 ergangen.

	**Sie tragen keine Aussage.** Die steht als Wort daneben, und DESIGN.md
	verlangt genau das: bei zwanzig Leuten mit sehr unterschiedlicher Vertrautheit
	ist ein Wort verlässlicher als ein Piktogramm. Was die Zeichen leisten, ist
	das Wiederfinden beim Blättern — sechs Zeilen, die ohne sie gleich aussehen.

	Die Auswahl ist Manuels (2026-09-17), getroffen an einem Blatt mit je zwei
	Entwürfen je Eintrag: Kalenderblatt, aufgeschlagenes Buch, Dokument, Kiste,
	Schlüssel. Die verworfenen Zweitentwürfe sind benannt, damit niemand sie ein
	zweites Mal vorschlägt: ein Ablage-Pfeil für den Monatsplan (liest sich als
	`herunterladen`, und Herunterladen gibt es auf /sitzungen wirklich), ein
	geschlossenes Buch mit Lesezeichen für Wissen (Wissen wird nachgeschlagen,
	nicht aufbewahrt), zwei Sprechblasen für die Protokolle (die Seite besteht aus
	Dateien, nicht aus Gesprächen) und Schieberegler für die Verwaltung (heissen
	`Einstellungen`, und die gibt es dort nicht).

	**Das Blatt der Wellnessbehandlung ist am 2026-09-19 dazugekommen und als
	einziges nicht von Manuel gewählt** — das steht seit dem Umzug an der
	Komponente selbst, zusammen mit den zwei verworfenen Entwürfen.
-->
{#snippet zeichenKalender()}
	<svg
		class="zeichen zeichen--gross"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<rect x="3.5" y="5.5" width="17" height="15" rx="2" />
		<path d="M3.5 10.5h17" />
		<path d="M8 3.5v4" />
		<path d="M16 3.5v4" />
		<path d="M8 14.5h3" />
		<path d="M8 17.5h8" />
	</svg>
{/snippet}

{#snippet zeichenBuch()}
	<svg
		class="zeichen zeichen--gross"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path
			d="M12 7.5C10 5.8 7.5 5.2 4 5.5v12c3.5-.3 6 .3 8 2 2-1.7 4.5-2.3 8-2v-12c-3.5-.3-6 .3-8 2Z"
		/>
		<path d="M12 7.5v12" />
	</svg>
{/snippet}

{#snippet zeichenDokument()}
	<svg
		class="zeichen zeichen--gross"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M6 3.5h8l4.5 4.5v12.5H6Z" />
		<path d="M14 3.5v4.5h4.5" />
		<path d="M9 12.5h6" />
		<path d="M9 16h6" />
	</svg>
{/snippet}

{#snippet zeichenKiste()}
	<svg
		class="zeichen zeichen--gross"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<rect x="2.5" y="4.5" width="19" height="5" rx="1" />
		<path d="M4.5 9.5v10a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-10" />
		<path d="M9.5 13.5h5" />
	</svg>
{/snippet}

{#snippet zeichenSchluessel()}
	<svg
		class="zeichen zeichen--gross"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<circle cx="7.5" cy="8.5" r="4" />
		<path d="M10.3 11.3 20 21" />
		<path d="M17.5 18.5l2-2" />
		<path d="M15 16l2-2" />
	</svg>
{/snippet}

<svelte:head>
	<title>Mehr</title>
</svelte:head>

<!--
	Mehr — die seltenen Handlungen. Seit Story 2.1 steht darunter **immer**
	mindestens ein Eintrag: `Monatsplan ablegen` gilt allen, denn die planende
	Person wechselt monatlich und ist nicht die Adminperson. Seit dem 2026-09-13
	steht `Wissen` darunter, seit dem 2026-09-17 `Protokolle und Traktanden` und
	`Archiv`; `Verwaltung` steht für Adminpersonen zuunterst.

	Damit ist die Liste nie mehr leer, und der frühere {:else}-Zweig mit
	`Nichts zu verwalten.` ist weggefallen — ein toter Zweig, der beim nächsten
	Lesen erklärt werden müsste.

	**Die zwei Einträge zur Einzelaufgabe sind am 2026-09-13 weggefallen**, und
	das ist die Rücknahme einer Begründung, die nicht mehr stimmte. Sie standen
	hier, weil dies der Weg sein sollte, der **immer** besteht: Block 2 auf der
	Startseite führte auch dorthin, fehlte aber ganz, sobald keine Einzelaufgabe
	frei war. Seit dem 2026-09-11 ist das nicht mehr so — der Abschnitt steht auch
	leer da, und `+ Einzelaufgabe` und `Alle Einzelaufgaben` liegen ausserhalb
	seines {#if}. Damit waren die Einträge hier nicht mehr der sichere Weg,
	sondern der zweite, und ein Ziel an zwei Orten ist eine Frage mehr für jeden,
	der es sucht.

	**Die Begründung ist stehengeblieben, nachdem ihre Voraussetzung fiel** — die
	häufigste Fehlerklasse dieses Projekts, hier einmal nicht am Code, sondern am
	Kommentar. Wer den nächsten Eintrag von hier nimmt, prüft zuerst, ob sein
	anderer Weg wirklich **immer** da ist, und nicht bloss meistens.
-->
<div class="seite">
	<h1 class="seitentitel">Mehr</h1>
	<p class="fliesstext fliesstext--gedaempft">Angemeldet als {data.name}</p>

	<ul class="liste liste--getrennt">
		<li>
			<!-- resolve() ist Pflicht für interne Ziele (svelte/no-navigation-without-resolve) -->
			<a class="eintrag" href={resolve('/monatsplan')}>
				{@render zeichenKalender()}Monatsplan ablegen<ZeichenWinkel class="eintrag__weiter" />
			</a>
		</li>
		<li>
			<!--
				`Wellnessbehandlung` steht seit dem 2026-09-19 hier und nicht in der
				Leiste, nach demselben Massstab wie die Einträge darunter: wie oft man
				hingeht. Sie ist damit der Grenzfall dieser Seite — in der Saison wird
				alle ein bis zwei Wochen etwas ausgebracht, und damit häufiger als alles
				andere hier, aber seltener als der Gang durch den Garten, der `Ernte` in
				der Leiste hält.

				**Der zweite Platz und nicht der erste**: `Monatsplan ablegen` bleibt
				oben, weil es der etablierte Einstieg dieser Seite ist und eine
				Umsortierung von vier Zeilen mehr kostet, als die genauere Rangfolge
				wert wäre.

				Damit ist dies der **einzige** Weg dorthin — wie bei `Wissen` darunter.
			-->
			<!-- resolve() ist Pflicht für interne Ziele (svelte/no-navigation-without-resolve) -->
			<a class="eintrag" href={resolve('/wellness')}>
				<ZeichenBlatt class="zeichen--gross" />Wellnessbehandlung<ZeichenWinkel
					class="eintrag__weiter"
				/>
			</a>
		</li>
		<li>
			<!--
				`Wissen` steht seit dem 2026-09-13 hier und nicht mehr in der Leiste:
				`Ernte` hat dort seinen Platz genommen. Der Massstab ist, wie oft man
				hingeht — ein Blatt schlägt man ein paar Mal im Jahr nach, was reif ist,
				sieht man in der Saison bei jedem Gang durch den Garten nach. Die
				Begründung in ganzer Länge steht in $lib/components/NavBar.svelte.

				Damit ist dies der **einzige** Weg zu den Blättern, und das ist der
				Unterschied zu den zwei Einträgen darüber: `Alle Einzelaufgaben` hat in
				Block 2 auf `/` einen zweiten, der nur manchmal da ist.
			-->
			<!-- resolve() ist Pflicht für interne Ziele (svelte/no-navigation-without-resolve) -->
			<a class="eintrag" href={resolve('/wissen')}
				>{@render zeichenBuch()}Wissen<ZeichenWinkel class="eintrag__weiter" /></a
			>
		</li>
		<li>
			<!--
				`Protokolle und Traktanden` steht seit dem 2026-09-17 hier und nicht in
				der Leiste, nach demselben Massstab wie `Wissen` darüber: wie oft man
				hingeht. Eine Gartengruppe trifft sich ein paar Mal im Jahr; wer eine
				Sitzung vorbereitet, sucht den Weg dann und findet ihn hier.

				Damit ist dies der **einzige** Weg dorthin — wie bei `Wissen` und anders
				als bei `Alle Termine`, das in Block 2 auf `/` einen zweiten hat, der nur
				manchmal da ist.
			-->
			<!-- resolve() ist Pflicht für interne Ziele (svelte/no-navigation-without-resolve) -->
			<a class="eintrag" href={resolve('/sitzungen')}>
				{@render zeichenDokument()}Protokolle und Traktanden<ZeichenWinkel
					class="eintrag__weiter"
				/>
			</a>
		</li>
		<li>
			<!--
				`Archiv` steht seit dem 2026-09-17 hier und nicht in der Leiste, nach
				demselben Massstab wie `Wissen` darüber: wie oft man hingeht. Was reif
				ist, sieht man in der Saison bei jedem Gang durch den Garten nach; was
				im letzten Monat getan wurde, schlägt die planende Person einmal im
				Monat nach, wenn sie den Monatsplan schreibt.

				Damit ist dies der **einzige** Weg ins Archiv — wie bei `Wissen` und
				anders als bei `Alle Termine`, das in Block 2 auf `/` einen zweiten hat,
				der nur manchmal da ist.
			-->
			<!-- resolve() ist Pflicht für interne Ziele (svelte/no-navigation-without-resolve) -->
			<a class="eintrag" href={resolve('/archiv')}
				>{@render zeichenKiste()}Archiv<ZeichenWinkel class="eintrag__weiter" /></a
			>
		</li>
		{#if data.istAdmin}
			<li>
				<!--
					Für Nicht-Admins fehlt dieser Eintrag **ganz**: kein ausgegrauter
					Punkt, keine Erklärung, warum er nicht anklickbar ist. Für jemanden
					ohne Adminrechte soll die Verwaltung nicht existieren, nicht verboten
					sein — und `Monatsplan ablegen` darüber verrät nicht, dass es mehr
					gäbe.
				-->
				<a class="eintrag" href={resolve('/verwaltung')}
					>{@render zeichenSchluessel()}Verwaltung<ZeichenWinkel class="eintrag__weiter" /></a
				>
			</li>
		{/if}
	</ul>
</div>

<style>
	/*
		Ein Zeilenziel, kein Knopf: es führt weiter, es tut nichts. Trefferfeld
		über die ganze Zeile, weil hier — anders als beim Kästchen einer
		Aufgabenzeile — ein Fehlgriff nichts verändert.
	*/
</style>
