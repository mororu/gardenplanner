<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
	import { tick } from 'svelte';
	import type { PageProps } from './$types';
	import {
		DAUERERNTE_SATZ,
		DAUERERNTE_WORT,
		ERNTESTATUS,
		ERNTETEXT,
		ERNTE_HOECHSTLAENGE,
		KULTUREN,
		KULTURLISTE,
		type Erntestatus,
	} from '$lib/ernte';
	import { VERSAND_FEHLGESCHLAGEN } from '$lib/texte';
	import { datumLang } from '$lib/client/utils/date';

	/*
		/ernte — was reif ist, in drei Stufen, dringend zuoberst.

		Die Bauform ist die von /traenkeplan und /wissen: ein aufklappbares
		Formular in einem <details>, je Zeile ein Bestätigungsschritt aus der
		Antwort des Servers, Live-Regionen, die **immer** im Markup stehen, und ein
		use:enhance-Rückruf, der einen Wurf abfängt. Der ausführliche Grund für
		jedes dieser Stücke steht dort; hier stehen nur die Unterschiede.

		**Die drei Abschnitte entstehen aus ERNTESTATUS und nicht aus drei
		geschriebenen Blöcken.** Die Reihenfolge der Stufen ist die Ordnung der
		Abfrage (siehe `rang` in queries/harvests.ts) — dreimal derselbe Block von
		Hand hiesse, dieselbe Reihenfolge ein zweites Mal zu behaupten, und die
		zwei liefen beim ersten Umsortieren auseinander.
	*/

	const { data, form }: PageProps = $props();

	/** Die Zeilen einer Stufe, in der Ordnung, in der die Abfrage sie liefert. */
	const zeilenVon = (stufe: Erntestatus) => data.stand.filter((zeile) => zeile.status === stufe);

	/** Die zwei **anderen** Stufen — die, in die eine Zeile wandern kann. */
	const andereStufen = (stufe: Erntestatus) => ERNTESTATUS.filter((andere) => andere !== stufe);

	/*
		Die Rückmeldung eines geglückten Eintragens, Umstufens oder Aberntens.

		Alle drei tragen ihren Satz fertig aus der action mit, samt Kultur und
		Zielstufe: die Liste hat drei Abschnitte, das Formular klappt nach dem
		Absenden zu, und der Fokus springt nach oben. Ohne die Angaben sagte die
		Meldung, dass etwas geklappt hat, aber nicht was und nicht wohin.
	*/
	const rueckmeldung = $derived(
		form !== null &&
			(form.art === 'eingetragen' || form.art === 'umgestuft' || form.art === 'abgeerntet')
			? form.meldung
			: ''
	);

	/**
	 * Welche Zeile gerade nach einer Bestätigung fragt — oder null.
	 *
	 * Der Wert kommt aus der Antwort des Servers und nicht aus einem Zustand im
	 * Browser: die Frage ist eine Eigenschaft der action, nicht des Geräts, und
	 * ohne JavaScript entsteht sie als vollständiges Dokument.
	 */
	const frage = $derived(form !== null && form.art === 'fragenAbernten' ? form : null);

	/*
		Ein Wurf in der action kommt als `result.type === 'error'` zurück. Der Satz
		steht in derselben Live-Region wie ein Fehlschlag der action; einheitlich
		auf allen Seiten, entschieden am 2026-08-28 zu Eintrag 32 der
		zurückgestellten Arbeit.
	*/
	let versandFehler = $state('');

	/** Die Meldung an einem der drei Felder des Formulars. */
	const fehlerAm = (feld: 'kultur' | 'ort' | 'status'): string =>
		form !== null && form.art === 'fehler' && form.feld === feld ? form.meldung : '';

	const fehlerAmKultur = $derived(fehlerAm('kultur'));
	const fehlerAmOrt = $derived(fehlerAm('ort'));
	const fehlerAmStatus = $derived(fehlerAm('status'));

	/*
		Das Formular steht offen, sobald es etwas zurückzutragen hat. Ohne
		JavaScript ist das der einzige Weg, an dem die abgewiesene Eingabe
		überhaupt sichtbar wird — ein zugeklapptes <details> verbirgt sie, und der
		Fokus spränge in etwas, das niemand sieht.
	*/
	const formularOffen = $derived(
		fehlerAmKultur !== '' || fehlerAmOrt !== '' || fehlerAmStatus !== ''
	);

	/*
		Die verworfenen Eingaben reisen über `eingabe` und `zweiteEingabe` zurück —
		die zwei freien Textfelder dieser Seite. Dieselbe Bauform wie Titel und
		Text auf /wissen, und aus demselben Grund: ohne JavaScript läuft kein
		Rückruf, und ein Wert, der nur im Browser stünde, wäre fort.
	*/
	const kulturWert = $derived(form !== null && form.art === 'fehler' ? form.eingabe : '');
	const ortWert = $derived(form !== null && form.art === 'fehler' ? form.zweiteEingabe : '');

	/**
	 * Die Meldung eines Fehlschlags, der an keine Zeile und an kein Feld gehört.
	 *
	 * Dazu zählt auch die Abweisung einer Zeilen-Aktion: sie trägt `feld: null`
	 * und sagt „lade die Liste neu". Ihr Platz wäre die Zeile — nur gibt es die
	 * gerade nicht mehr, und genau das ist ihr Inhalt.
	 */
	const fehlerOben = $derived(
		versandFehler !== ''
			? versandFehler
			: form !== null && form.art === 'fehler' && form.feld === null
				? form.meldung
				: ''
	);

	// -------------------------------------------------------------------
	// Versand: eine Sperre für die ganze Seite, plus Fokus danach
	// -------------------------------------------------------------------

	let imFlug = $state(false);
	let meldungKasten = $state<HTMLElement | null>(null);
	let fehlerKasten = $state<HTMLElement | null>(null);

	/**
	 * Setzt den Fokus dorthin, wo die Antwort steht.
	 *
	 * Nach einer Abweisung am Formular an das **erste** Feld, das nicht trägt:
	 * dort steht der Satz. Nach allem anderen an die Rückmeldung oben — die
	 * Zeile, an der gehandelt wurde, ist nach dem Abernten fort und nach dem
	 * Umstufen in einem anderen Abschnitt.
	 */
	function fokusNach(ergebnis: ActionResult): void {
		/*
			`redirect` und `error` tragen keine Daten und **keinen Fokus**. Auf dieser
			Seite entsteht kein redirect — es gibt keine Adminschranke —, aber der
			Zweig steht trotzdem: er ist die Bedingung, unter der `ergebnis.data`
			überhaupt existiert.
		*/
		if (ergebnis.type !== 'success' && ergebnis.type !== 'failure') return;

		const daten = ergebnis.data as { art?: unknown; feld?: unknown } | undefined;
		if (typeof daten?.art === 'string' && daten.art === 'fehler') {
			const feld = typeof daten.feld === 'string' ? daten.feld : '';
			if (feld !== '') {
				document.getElementById(`neu-${feld}`)?.focus();
				return;
			}
			fehlerKasten?.focus();
			return;
		}
		meldungKasten?.focus();
	}

	const versand: SubmitFunction = ({ cancel }) => {
		if (imFlug) {
			cancel();
			return;
		}
		imFlug = true;
		versandFehler = '';
		return async ({ update, result }) => {
			/*
				try/finally: bricht update() ab, bliebe imFlug sonst für immer true und
				jeder Knopf dieser Seite dauerhaft disabled. Dieselbe Absicherung wie in
				aufgabe/+page.svelte, wo sie zuerst entstand.
			*/
			try {
				if (result.type === 'error') {
					versandFehler = VERSAND_FEHLGESCHLAGEN;
				} else {
					await update();
				}
			} finally {
				imFlug = false;
			}
			// Nach dem Rendern, sonst gibt es das Ziel noch nicht.
			await tick();
			if (versandFehler !== '') {
				fehlerKasten?.focus();
				return;
			}
			fokusNach(result);
		};
	};
</script>

<svelte:head>
	<title>Ernte</title>
</svelte:head>

<div class="seite">
	<h1 class="seitentitel">Ernte</h1>

	<!--
		Die zwei Live-Regionen des Seitenkopfs. Beide stehen **immer** im Markup und
		sind über `.live:empty` aus dem Fluss genommen, solange sie leer sind —
		Retro-Posten B2: eine Region, die im selben Augenblick entsteht und ihren
		Text bekommt, wird nicht verlässlich vorgelesen.
	-->
	<p class="meldung live" bind:this={meldungKasten} role="status" aria-live="polite" tabindex="-1">
		{rueckmeldung}
	</p>
	<p class="fehler live" bind:this={fehlerKasten} role="alert" aria-live="assertive" tabindex="-1">
		{fehlerOben}
	</p>

	<p class="hinweis">
		Was reif ist, steht hier. Wer abgeerntet hat, nimmt die Zeile weg — dann weiss es die Nächste.
	</p>

	<!--
		Das <form> trägt ein **literales** action="?/eintragen": Gate-Regel 11
		leitet die Route aus dem Verzeichnis der Datei ab und hält den Namen gegen
		die actions der Nachbardatei. Ein dynamisches action={…} machte sie blind.
	-->
	<details class="zeilenform" open={formularOffen}>
		<summary class="zeilenform__griff">Reifes eintragen</summary>
		<form class="zeilenform__formular" method="POST" action="?/eintragen" use:enhance={versand}>
			<div>
				<label class="feld__beschriftung" for="neu-kultur">Was ist reif</label>
				<!--
					Ein Textfeld mit Vorschlagsliste und kein <select>: antippen wählt aus
					den zwanzig Kulturen, tippen schreibt irgendetwas. Ein Feld für einen
					Wert — die Begründung in ganzer Länge steht an KULTURLISTE in
					$lib/ernte.ts.
				-->
				<input
					class="feld"
					id="neu-kultur"
					name="kultur"
					type="text"
					list={KULTURLISTE}
					required
					maxlength={ERNTE_HOECHSTLAENGE}
					value={kulturWert}
					aria-invalid={fehlerAmKultur !== '' ? 'true' : undefined}
					aria-describedby={fehlerAmKultur !== '' ? 'neu-kultur-fehler' : undefined}
				/>
				<datalist id={KULTURLISTE}>
					{#each KULTUREN as kultur (kultur)}
						<option value={kultur}></option>
					{/each}
				</datalist>
				<!--
					Der Satz steht ausserhalb des Feldes und immer im Markup, mit
					`.live:empty` aus dem Fluss, solange er leer ist — dieselbe Bauform
					wie an jeder anderen Feldmeldung des Produkts.
				-->
				<p class="fehler live" id="neu-kultur-fehler" role="alert" aria-live="assertive">
					{fehlerAmKultur}
				</p>
			</div>

			<div>
				<label class="feld__beschriftung" for="neu-ort">Beet oder Ort</label>
				<input
					class="feld"
					id="neu-ort"
					name="ort"
					type="text"
					maxlength={ERNTE_HOECHSTLAENGE}
					value={ortWert}
					aria-invalid={fehlerAmOrt !== '' ? 'true' : undefined}
					aria-describedby={fehlerAmOrt !== '' ? 'neu-ort-fehler' : undefined}
				/>
				<!-- Kein `required`: ein Beet anzugeben ist freiwillig, und leer heisst null. -->
				<p class="hinweis hinweis--am-feld">Freiwillig.</p>
				<p class="fehler live" id="neu-ort-fehler" role="alert" aria-live="assertive">
					{fehlerAmOrt}
				</p>
			</div>

			<!--
				Der Status als drei Knöpfe und nicht als Auswahlliste: die Erklärung
				gehört zur Stufe und ist das, was sie überhaupt entscheidbar macht. In
				einem <select> stünde sie nirgends.

				Keine Vorauswahl — `required` an allen dreien, und der Browser lässt das
				Formular nicht ab, bevor eine gewählt ist. Eine vorgewählte Stufe wäre
				eine Behauptung über ein Beet, das niemand angesehen hat.
			-->
			<fieldset class="stufenwahl">
				<legend class="feld__beschriftung">Wie dringend</legend>
				{#each ERNTESTATUS as stufe (stufe)}
					<label
						class="stufenwahl__zeile"
						class:stufe--sofort={stufe === 'sofort'}
						class:stufe--stehen={stufe === 'stehen'}
						class:stufe--wachsen={stufe === 'wachsen'}
					>
						<input
							type="radio"
							id={stufe === ERNTESTATUS[0] ? 'neu-status' : undefined}
							name="status"
							value={stufe}
							required
							aria-describedby={fehlerAmStatus !== '' ? 'neu-status-fehler' : undefined}
						/>
						<span class="stufenwahl__text">
							<span class="zeile__text">{ERNTETEXT[stufe].titel}</span>
							<span class="hinweis">{ERNTETEXT[stufe].satz}</span>
						</span>
					</label>
				{/each}
			</fieldset>
			<!--
				Die Meldung steht ausserhalb des <fieldset>: ein `id` am Feld allein
				trüge sie nur an einen der drei Knöpfe, und aria-describedby zeigt von
				allen dreien hierher. `neu-status` ist zugleich das Fokusziel nach einer
				Abweisung — darum trägt der erste Knopf diese Kennung.
			-->
			<p class="fehler live" id="neu-status-fehler" role="alert" aria-live="assertive">
				{fehlerAmStatus}
			</p>

			<label class="stufenwahl__zeile">
				<input type="checkbox" name="laufend" />
				<span class="stufenwahl__text">
					<span class="zeile__text">{DAUERERNTE_WORT}</span>
					<span class="hinweis">
						Regelmässiges Pflücken erhöht den Ertrag — Bohnen, Zucchini, Gurken, Erbsen,
						Cherrytomaten. {DAUERERNTE_SATZ}
					</span>
				</span>
			</label>

			<button class="button-quiet" type="submit" disabled={imFlug}>Eintragen</button>
		</form>
	</details>

	{#if data.stand.length === 0}
		<p class="leer">Nichts reif gemeldet.</p>
	{/if}

	{#each ERNTESTATUS as stufe (stufe)}
		{@const zeilen = zeilenVon(stufe)}
		<!--
			Ein Abschnitt ohne Zeilen entsteht gar nicht. Eine leere Überschrift
			`Noch wachsen lassen` sagt nichts, was die Liste nicht schon sagt, und
			drei davon untereinander sind bei 375px der halbe Bildschirm.
		-->
		{#if zeilen.length > 0}
			<h2 class="abschnittstitel" id="stufe-{stufe}">{ERNTETEXT[stufe].titel}</h2>
			<p class="hinweis">{ERNTETEXT[stufe].satz}</p>
			<!--
				Überschrift, Satz und Liste stehen als **Geschwister** in `.seite` und
				nicht in einem <section> mit eigenem Stapel. Ein solcher Behälter
				bräuchte `display: flex; flex-direction: column; gap: var(--space-2)`
				— und damit denselben Regelkörper wie `.knoepfe` im geteilten
				Stilblatt. Gate-Regel 14 hat genau das gemeldet, und sie hat recht:
				das wäre dieselbe Rolle unter neuem Namen. Die Zuordnung von Liste und
				Überschrift trägt `aria-labelledby`, und die ist es, auf die es
				ankommt — ein <section> allein hätte sie nicht hergestellt.
			-->
			<ul
				class="liste liste--getrennt"
				class:stufe--sofort={stufe === 'sofort'}
				class:stufe--stehen={stufe === 'stehen'}
				class:stufe--wachsen={stufe === 'wachsen'}
				aria-labelledby="stufe-{stufe}"
			>
				{#each zeilen as eintrag (eintrag.id)}
					{@const fragtHier = frage !== null && frage.zeile === eintrag.id}
					<li class="karte">
						<!--
								Die Farbe der Stufe liegt als Kante an der Karte und kommt aus
								dem Abschnitt darüber. Das **Wort** steht in der Überschrift —
								kein Zustand hängt allein an der Farbe, dieselbe Regel wie bei
								überfällig auf / und unbesetzt im Tränkeplan.

								Die Kennung dieser Zeile, und der Grund, warum sie eine hat: die
								Knöpfe darunter tragen Beschriftungen, die sich über alle Zeilen
								wortgleich wiederholen — `Kann stehen`, `Abgeerntet`. Sie zeigen
								darum mit aria-labelledby auf sich selbst und dann hierher:
								`Abgeerntet Zucchini, Hochbeet 3`.
							-->
						<p class="zeile__text" id="ernte-{eintrag.id}">
							{eintrag.kultur}{#if eintrag.ort !== null}<span class="ernte__ort"
									>, {eintrag.ort}</span
								>{/if}
						</p>

						{#if eintrag.laufend}
							<p class="marke">{DAUERERNTE_WORT}</p>
							<p class="hinweis">{DAUERERNTE_SATZ}</p>
						{/if}

						<!--
								Name und Datum: nicht als Zuständigkeit, sondern als Herkunft —
								wie frisch die Angabe ist und wen man fragen kann. Ein fehlender
								Name kann nur aus einem Eingriff von Hand an der Datenbank
								stammen; die Zeile bleibt dann trotzdem lesbar.
							-->
						<p class="hinweis hinweis--ziffern">
							{eintrag.name ?? 'unbekannt'} · {datumLang(eintrag.createdAt)}
						</p>

						{#if fragtHier && frage !== null}
							<div class="ernte__frage">
								<p class="fliesstext" id="abernten-frage-{eintrag.id}">
									{frage.kultur}{#if frage.ort !== null}, {frage.ort}{/if} abräumen? Die Zeile ist dann
									für alle weg.
								</p>
								<div class="knoepfe">
									<!-- `Abbrechen` steht zuerst: die Reihenfolge im DOM ist die
										     Fokusreihenfolge, und die zusagende Handlung soll nicht die
										     erste sein. Ein Link und kein Knopf — er verwirft die Antwort
										     der action, indem er die Seite neu holt. -->
									<a class="button-quiet" href={resolve('/ernte')}>Abbrechen</a>
									<form method="POST" action="?/abernten" use:enhance={versand}>
										<input type="hidden" name="id" value={eintrag.id} />
										<input type="hidden" name="bestaetigt" value="1" />
										<button
											class="button-quiet button-quiet--zerstoerend"
											type="submit"
											aria-describedby="abernten-frage-{eintrag.id}"
											disabled={imFlug}
										>
											Abgeerntet
										</button>
									</form>
								</div>
							</div>
						{:else}
							<!--
									Umstufen zeigt die **zwei anderen** Stufen. Die eigene wäre ein
									Knopf, der nichts ändert, und bei 375px stünden drei
									nebeneinander, von denen einer nie gedrückt wird.

									Ohne Rückfrage: umstufen nimmt niemandem etwas weg und ist mit
									dem Knopf daneben zurückgenommen. Nur `Abgeerntet` fragt, weil
									es löscht.
								-->
							<div class="ernte__fuss">
								{#each andereStufen(stufe) as ziel (ziel)}
									<form method="POST" action="?/umstufen" use:enhance={versand}>
										<input type="hidden" name="id" value={eintrag.id} />
										<input type="hidden" name="status" value={ziel} />
										<button
											class="button-quiet button-quiet--kompakt"
											type="submit"
											id="umstufen-{ziel}-{eintrag.id}"
											aria-labelledby="umstufen-{ziel}-{eintrag.id} ernte-{eintrag.id}"
											disabled={imFlug}
										>
											{ERNTETEXT[ziel].kurz}
										</button>
									</form>
								{/each}
								<form class="ernte__weg" method="POST" action="?/abernten" use:enhance={versand}>
									<input type="hidden" name="id" value={eintrag.id} />
									<button
										class="button-quiet button-quiet--kompakt button-quiet--zerstoerend"
										type="submit"
										id="abernten-{eintrag.id}"
										aria-labelledby="abernten-{eintrag.id} ernte-{eintrag.id}"
										disabled={imFlug}
									>
										Abgeerntet
									</button>
								</form>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{/each}
</div>

<style>
	/*
		Die drei Stufenfarben haben seit dem 2026-09-13 **eigene** Token:
		--reif-sofort, --reif-stehen, --reif-wachsen.

		**Bis dahin liehen sie sich --danger, --warn und --accent**, und die
		Begründung dafür stand hier: drei neue Farben hätten die veröffentlichte
		Kontrasttabelle aus DESIGN.md umgeschrieben und `kontrast:selftest`
		gebrochen. Das stimmt weiterhin — es ist nur nicht mehr der teurere
		Handel. Die drei geliehenen Token sind Textfarben und an 4.5:1 gebunden;
		diese Kanten halten als Umriss eines Bedienelements 3:1. An der strengeren
		Schwelle war „kann noch stehen" auf der Breite von --border-marker
		praktisch unsichtbar, und genau das hat Manuel am 2026-09-13 bemängelt.

		Der Bedeutung nach passten sie ohnehin nur zwei von drei Mal: --danger
		heisst im Produkt „das hier zerstört etwas", und eine reife Zucchini ist
		das nicht. DESIGN.md reserviert Rot ausdrücklich für Zerstörendes.

		Die Kante ist dieselbe Marke wie „diese Woche" im Tränkeplan — derselbe
		Gedanke an zwei Orten: hier ist etwas los. Der Diensthinweis auf / trug sie
		bis zum 2026-09-13 ebenfalls und ist seither eine gefüllte Fläche.
	*/
	.stufe--sofort .karte {
		border-inline-start: var(--border-marker) solid var(--reif-sofort);
	}

	.stufe--stehen .karte {
		border-inline-start: var(--border-marker) solid var(--reif-stehen);
	}

	.stufe--wachsen .karte {
		border-inline-start: var(--border-marker) solid var(--reif-wachsen);
	}

	/*
		Derselbe Strich am Knopf im Formular — er ist dort die einzige Stelle, an
		der die Farbe der Stufe vor dem Absenden zu sehen ist.
	*/
	.stufenwahl__zeile.stufe--sofort {
		border-inline-start: var(--border-marker) solid var(--reif-sofort);
	}

	.stufenwahl__zeile.stufe--stehen {
		border-inline-start: var(--border-marker) solid var(--reif-stehen);
	}

	.stufenwahl__zeile.stufe--wachsen {
		border-inline-start: var(--border-marker) solid var(--reif-wachsen);
	}

	/*
		Der Ort in der Zeile der Kultur: Nebentext-Rolle, weil er eine Frage
		beantwortet, die sich nicht an jeder Zeile stellt — er ist freiwillig. Er
		trägt **kein** eigenes `line-height`: als Span in der Zeile darüber
		zerteilte das die Zeilenbox der Kultur. Derselbe Handgriff und dieselbe
		Begründung wie beim ISO-Jahr im Tränkeplan.
	*/
	.ernte__ort {
		color: var(--ink-secondary);
		font-family: var(--meta-font);
		font-size: var(--meta-size);
		font-weight: var(--meta-weight);
	}

	/*
		Die Knopfreihe einer Zeile. `flex-wrap`, weil bei 375px drei kompakte
		Knöpfe nebeneinander nicht sicher passen — `Wachsen lassen` ist der
		längste, und ein Umbruch ist besser als ein waagrecht laufender Kasten.
	*/
	.ernte__fuss {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}

	/*
		Das Abernten rückt ans andere Ende: es ist die zerstörende Handlung, und
		sie soll nicht neben den zwei harmlosen stehen, als wäre sie die dritte
		davon. `margin-inline-start: auto` schiebt es weg, solange die Reihe nicht
		umbricht; bricht sie, steht es in der zweiten Zeile links, und das ist der
		bessere von zwei Ausgängen.
	*/
	.ernte__weg {
		margin-inline-start: auto;
	}

	/*
		Die Rückfrage. Aufgehellte Fläche statt einer roten Kante: die Zeile
		darunter trägt schon die Farbe ihrer Stufe, und zwei Farbaussagen an
		einer Karte behaupten zwei Dinge zugleich.
	*/
	.ernte__frage {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
		border-radius: var(--radius-sm);
		background-color: var(--surface-open);
	}

	/*
		Die Stufenwahl: kein <select>, sondern drei Knöpfe mit ihrer Erklärung.
		Der Rahmen ist der eines Bedienelements — die ganze Zeile ist das
		Trefferfeld, weil das <label> den Knopf umschliesst.
	*/
	.stufenwahl {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.stufenwahl__zeile {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		min-height: var(--touch);
		padding: var(--space-2) var(--space-3);
		border: var(--border-hairline) solid var(--ink-secondary);
		border-radius: var(--radius-md);
		cursor: pointer;
	}

	.stufenwahl__text {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}
</style>
