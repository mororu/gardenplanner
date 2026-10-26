<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
	import { tick, untrack } from 'svelte';
	import type { PageProps } from './$types';
	import {
		ABERNTEN_WORT,
		DAUERERNTE_SATZ,
		DAUERERNTE_WORT,
		SICHTBARE_ERNTESTATUS,
		SOFORT_KNOPF,
		ERNTETEXT,
		ERNTE_HOECHSTLAENGE,
		KULTUREN,
		KULTURLISTE,
		ORT_VORGABE,
		nachBeetGliedern,
	} from '$lib/ernte';
	import { VERSAND_FEHLGESCHLAGEN } from '$lib/texte';
	import ZeichenKreis from '$lib/components/ZeichenKreis.svelte';
	import ZeichenKreuz from '$lib/components/ZeichenKreuz.svelte';
	import ZeichenWinkel from '$lib/components/ZeichenWinkel.svelte';
	import { datumKurz } from '$lib/client/utils/date';

	/*
		/ernte — was reif ist, **nach Beet**, und im Beet das Dringende zuerst.

		Die Bauform ist die von /traenkeplan und /wissen: ein aufklappbares
		Formular in einem <details>, je Zeile ein Bestätigungsschritt aus der
		Antwort des Servers, Live-Regionen, die **immer** im Markup stehen, und ein
		use:enhance-Rückruf, der einen Wurf abfängt. Der ausführliche Grund für
		jedes dieser Stücke steht dort; hier stehen nur die Unterschiede.

		**Gegliedert nach Beet seit dem 2026-10-26** (spec-ernte-nach-beet.md): wer
		im Garten steht, steht in einem Beet, und die Liste nach Dringlichkeit über
		den ganzen Garten musste nach dem eigenen Ort abgesucht werden. Die
		Gliederung selbst — welches Beet, welche Ordnung, welche Stufe — steht in
		`nachBeetGliedern` in $lib/ernte.ts und nicht hier; die Aufklapper folgen
		dem Tagebuch auf /wellness, die Begründung zu ihrem Zustand steht dort.
	*/

	const { data, form }: PageProps = $props();

	/** Beet > Stufe > Karte, aus dem Stand in der Ordnung der Abfrage. */
	const gliederung = $derived(nachBeetGliedern(data.stand));

	/** Wie eine Zeile vorgelesen wird: `Zucchini, Beet 3`, ohne Ort nur die Kultur. */
	const bezeichnung = (eintrag: { kultur: string; ort: string | null }): string =>
		eintrag.ort === null ? eintrag.kultur : `${eintrag.kultur}, ${eintrag.ort}`;

	/*
		Die Rückmeldung eines geglückten Eintragens, Umstufens oder Aberntens.

		Alle drei tragen ihren Satz fertig aus der action mit, samt Kultur und
		Zielstufe: die Beete sind zugeklappt, das Formular klappt nach dem
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
		**Welches Beet vom Server her offen kommt.** Alle Beete werden zugeklappt
		ausgeliefert (Entscheid Manuel, 2026-10-26; der Zähler im Kopf sagt ohne
		Aufklappen, wo etwas sofort zu ernten ist). Offen kommt allein das Beet der
		Zeile, an der die letzte Antwort hängt:

		  - die Rückfrage vor dem Abernten — sie steht an der Zeile, und ohne
		    JavaScript wäre sie in einem zugeklappten Beet unsichtbar;
		  - eine Abweisung an einer Zeile — sie trägt `zeile`, wo es die Zeile
		    noch gibt;
		  - ein geglücktes Umstufen. Das steht nicht im Wortlaut der Spec, sondern
		    in ihrer I/O-Matrix („Beet bleibt offen"): ohne JavaScript ist die
		    Antwort ein neues Dokument, und ohne diese Zeile klappte das Beet, in
		    dem eben gehandelt wurde, unter der Hand zu. Eingetragen im Spec
		    Change Log;
		  - ein geglücktes Eintragen (Review vom 2026-10-26): die neue Zeile
		    stünde sonst unsichtbar in einem zugeklappten Beet, und die Meldung
		    oben sagte nur, dass es sie gibt.

		Mit JavaScript liest das Markup diesen Wert nur beim Entstehen eines Beets
		(`istOffen` darunter); danach führt der Browser den Zustand, und `versand`
		öffnet das Beet derselben Zeile über `aufklappen` — wie auf /wellness.
	*/
	const zielZeile = $derived(
		form !== null &&
			(form.art === 'fragenAbernten' ||
				form.art === 'eingetragen' ||
				form.art === 'umgestuft' ||
				(form.art === 'fehler' && form.zeile !== null))
			? form.zeile
			: null
	);
	const enthaeltZiel = (beet: (typeof gliederung)[number]): boolean =>
		zielZeile !== null &&
		beet.stufen.some((gruppe) => gruppe.zeilen.some((zeile) => zeile.id === zielZeile));

	/*
		Der Zustand der Beete, nach dem Muster von /wellness — die Begründung in
		ganzer Länge steht dort an `anfangszustand`. Kurz: der Ausdruck an `open`
		wird beim Entstehen des Aufklappers gelesen und danach über
		`aufklappzustand` aus dem `toggle` des Elements selbst beantwortet. Reaktiv
		klappte Svelte ein Beet nach einem geglückten Umstufen unter der Hand zu,
		weil `zielZeile` wechselt. Ein Beet, das mit demselben Schlüssel neu
		entsteht (abgeerntet bis leer, dann neu eingetragen), bekommt den
		gemerkten Zustand zurück — dieselbe ausgeschriebene Grenze wie dort.
	*/
	const anfangszustand: Record<string, boolean> = {};
	const aufklappzustand = $state<Record<string, boolean>>({});
	const istOffen = (schluessel: string, anfang: () => boolean): boolean => {
		const gemerkt = aufklappzustand[schluessel];
		if (gemerkt !== undefined) return gemerkt;
		const bekannt = anfangszustand[schluessel];
		if (bekannt !== undefined) return bekannt;
		const wert = untrack(anfang);
		anfangszustand[schluessel] = wert;
		return wert;
	};
	const merken = (schluessel: string, ereignis: Event): void => {
		aufklappzustand[schluessel] = (ereignis.currentTarget as HTMLDetailsElement).open;
	};

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
	 * Umstufen unter einem anderen Zwischentitel.
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

	/**
	 * Öffnet das Beet, in dem das Element steht — auch ein von Hand
	 * zugeklapptes. Dieselbe Funktion wie auf /wellness, und aus demselben
	 * Grund: das Markup öffnet ein Beet nur beim Entstehen, und eine Rückfrage
	 * in einem eben zugeklappten Beet stünde sonst unsichtbar da.
	 */
	const aufklappen = (element: Element | null): void => {
		let behaelter = element?.closest('details') ?? null;
		while (behaelter !== null) {
			behaelter.open = true;
			behaelter = behaelter.parentElement?.closest('details') ?? null;
		}
	};

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
			/*
				Das Beet der Zeile, an der die Antwort hängt, geht auf — auch ein von
				Hand zugeklapptes oder ein eben erst entstandenes. Dieselbe Menge wie
				`zielZeile`, darum aus ihr gelesen; die Kennung `ernte-{id}` trägt die
				Karte. Gibt es die Zeile nicht mehr (Abweisung, weil schon
				abgeerntet), findet `getElementById` nichts, und es geht nichts auf.
			*/
			if (zielZeile !== null) {
				aufklappen(document.getElementById(`ernte-${zielZeile}`));
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
		**Die Legende, und warum sie zuoberst steht.**

		Die Liste darunter sagt viel in Farbe und Zeichen: ein gelber Streifen, ein
		grüner, ein Kreis aus zwei Pfeilen, ein X. Wer die Seite zum ersten Mal
		öffnet, schlägt hier nach — wer sie zum zwanzigsten Mal öffnet, liest nur
		noch die Farbe. Seit dem 2026-10-26 steht an der Karte weder das Wort der
		Dauerernte (es wird vorgelesen) noch das Wort `Abgeerntet` (das X trägt es
		als Namen); beide Zeichen sind hier erklärt (spec-ernte-nach-beet.md).

		**Zugeklappt ausgeliefert.** Hier steht kein Vorrat an Arbeit, sondern eine
		Auskunft, die man einmal braucht und dann nicht mehr. Aufgeklappt schöbe
		sie die Liste, um die es geht, aus dem Bild.

		**Die Stufen entstehen aus SICHTBARE_ERNTESTATUS** — dieselbe Quelle wie die
		Stufenwahl im Formular. Bis zum 2026-10-26 kam jede Stufe dazu, für die
		gerade Zeilen dastanden, damit das Grün von `Noch wachsen lassen` erklärt
		war; seit jene Zeilen unter `Langsam ernten` erscheinen, gibt es keine
		dritte Farbe mehr.

		Jede Zeile zeigt, was sie erklärt: derselbe Streifen, dieselbe Karte,
		dasselbe Zeichen wie in der Liste.
	-->
	<details class="abschnitt">
		<summary class="abschnitt__griff">
			<h2 class="abschnittstitel" id="legende-marke">So liest du die Liste</h2>
			<ZeichenWinkel class="aufklapp" />
		</summary>
		<div class="abschnitt__inhalt">
			<ul class="liste liste--getrennt" aria-labelledby="legende-marke">
				{#each SICHTBARE_ERNTESTATUS as stufe (stufe)}
					<!--
						data-stufe sagt dem Sichtlauf, dass die Kante links eine
						Zustandsmarke ist und nicht der Umriss eines Bedienelements — siehe
						den Tokenblock in src/app.html.
					-->
					<li
						class="karte"
						class:stufe--sofort={stufe === 'sofort'}
						class:stufe--stehen={stufe === 'stehen'}
						data-stufe={stufe}
					>
						<p class="zeile__text">{ERNTETEXT[stufe].titel}</p>
						<p class="hinweis">{ERNTETEXT[stufe].satz}</p>
					</li>
				{/each}
				<li class="karte">
					<!--
						Schwarzes Zeichen, Wort daneben. An der Karte darunter steht seit dem
						2026-10-26 nur das Zeichen, das Wort ist `.nur-vorgelesen` — hier
						steht beides, und das ist der Zweck der Zeile.
					-->
					<p class="zeile__text zeichenwort"><ZeichenKreis />{DAUERERNTE_WORT}</p>
					<p class="hinweis">
						Regelmässiges Pflücken erhöht den Ertrag. Z. B. Bohnen, Zucchini, Gurken, Erbsen,
						Cherrytomaten. {DAUERERNTE_SATZ}
					</p>
				</li>
				<li class="karte">
					<!-- Das X in seiner Farbe, mit dem Wort, das es an der Karte vorliest. -->
					<p class="zeile__text zeichenwort">
						<span class="legende__kreuz"><ZeichenKreuz /></span>{ABERNTEN_WORT}
					</p>
					<p class="hinweis">Nimmt die Zeile für alle weg. Vorher fragt die Seite nach.</p>
				</li>
			</ul>
		</div>
	</details>

	<!--
		Das <form> trägt ein **literales** action="?/eintragen": Gate-Regel 11
		leitet die Route aus dem Verzeichnis der Datei ab und hält den Namen gegen
		die actions der Nachbardatei. Ein dynamisches action={…} machte sie blind.
	-->
	<details class="zeilenform" open={formularOffen}>
		<!--
			**Der Griff sieht aus wie die Aufforderungen auf `/`** — gefülltes Grün,
			ein `+` davor (Entscheid Manuel, 2026-09-16). Er ist die einzige Handlung
			dieser Seite, und als leiser Text in Akzentfarbe stand er neben der
			Legende darüber wie eine zweite Überschrift.

			**`.button-primary` und keine zweite Regel mit demselben Rumpf:** Fläche,
			Kante, Radius, Trefferfeld und Schrift kommen unverändert aus der geteilten
			Klasse — eine eigene Regel wäre der Zwilling, auf den Gate-Regel 14
			anschlägt. Dazu kommt allein, was ein `<summary>` extra braucht.

			**Das `+` trägt `aufklapp`.** Es ist das Zeichen, das hier an der Stelle des
			Dreiecks steht: `.button-primary` bringt ein `display` mit, und damit ist
			der Marker fort. Gate-Regel 15 lässt das genau dann durch, wenn im Markup
			desselben `<summary>` ein solches Zeichen steht — ohne das `+` fällt der
			Lauf. Dasselbe `+` sagt auf `/` an drei Knöpfen `hier kommt etwas dazu`.
		-->
		<summary class="button-primary button-primary--griff">
			<span class="aufklapp">+</span>
			<span>Reifes eintragen</span>
		</summary>
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
					value={ortWert === '' ? ORT_VORGABE : ortWert}
					aria-invalid={fehlerAmOrt !== '' ? 'true' : undefined}
					aria-describedby={fehlerAmOrt !== '' ? 'neu-ort-fehler' : undefined}
				/>
				<!--
					Kein `required`: ein Beet anzugeben ist freiwillig, und leer heisst
					null — seit dem 2026-09-17 auch dann, wenn die Vorgabe `Beet `
					unangetastet zurückkommt. Die Begründung steht an ORT_VORGABE und an
					ortPruefen in $lib/ernte.ts.
				-->
				<p class="hinweis hinweis--am-feld">Freiwillig — Nummer dazu, oder ganz überschreiben.</p>
				<p class="fehler live" id="neu-ort-fehler" role="alert" aria-live="assertive">
					{fehlerAmOrt}
				</p>
			</div>

			<!--
				Der Status als Knöpfe und nicht als Auswahlliste: die Erklärung
				gehört zur Stufe und ist das, was sie überhaupt entscheidbar macht. In
				einem <select> stünde sie nirgends.

				Keine Vorauswahl — `required` an jedem, und der Browser lässt das
				Formular nicht ab, bevor eine gewählt ist. Eine vorgewählte Stufe wäre
				eine Behauptung über ein Beet, das niemand angesehen hat.
			-->
			<fieldset class="stufenwahl">
				<legend class="feld__beschriftung">Wie dringend</legend>
				{#each SICHTBARE_ERNTESTATUS as stufe (stufe)}
					<!--
						data-stufe sagt dem Sichtlauf, dass die Kante links eine
						Zustandsmarke ist und nicht der Umriss dieses Bedienelements —
						siehe den Tokenblock in src/app.html.
					-->
					<!--
						Nur die zwei angebotenen Klassen: die Schleife läuft über
						SICHTBARE_ERNTESTATUS, und ein `stufe === 'wachsen'` wäre ein
						Vergleich, der nie zutrifft — svelte-check meldet ihn als solchen.
						Seit dem 2026-10-26 gilt das für die ganze Seite: eine Zeile auf
						`wachsen` erscheint in der Liste als `stehen`.
					-->
					<label
						class="stufenwahl__zeile"
						class:stufe--sofort={stufe === 'sofort'}
						class:stufe--stehen={stufe === 'stehen'}
						data-stufe={stufe}
					>
						<input
							type="radio"
							id={stufe === SICHTBARE_ERNTESTATUS[0] ? 'neu-status' : undefined}
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
				trüge sie nur an einen der Knöpfe, und aria-describedby zeigt von
				allen hierher. `neu-status` ist zugleich das Fokusziel nach einer
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
						Regelmässiges Pflücken erhöht den Ertrag. Z. B. Bohnen, Zucchini, Gurken, Erbsen,
						Cherrytomaten. {DAUERERNTE_SATZ}
					</span>
				</span>
			</label>

			<button class="button-quiet" type="submit" disabled={imFlug}>Eintragen</button>
		</form>
	</details>

	<!--
		**Die Liste, nach Beet gegliedert** (spec-ernte-nach-beet.md, 2026-10-26):
		Beet > Stufe > Karte, wie das Tagebuch auf /wellness.

		**Ein `section` mit eigener Überschrift und kein Aufklapper mehr.** Die
		Liste stand vom 2026-09-16 an in einem offen ausgelieferten `<details>`;
		jetzt ist jedes Beet ein Aufklapper, und ein Aufklapper um alle Aufklapper
		wäre ein Griff mehr ohne eigene Aussage. Der Titel bleibt die Frage, die
		die Liste beantwortet.

		**Die Beete kommen zugeklappt** — eine Abweichung von AD-14, entschieden
		von Manuel am 2026-10-26 und im Spec Change Log festgehalten. Was AD-14
		schützt, trägt der Zähler im Kopf jedes Beets: `1 sofort · 2 langsam` sagt
		ohne Aufklappen, wo etwas sofort zu ernten ist. Gewöhnlicher Nebentext,
		nicht fett und ohne Farbpunkt — die Farbe gehört an die Kante der Karte.

		**Die Gliederung der Überschriften:** `<h1>` Seite, `<h2>` Liste, `<h3>`
		Beet, `<h4>` Stufe. Der Zwischentitel trägt das **Wort** der Stufe, und
		an ihm hängt die Ausnahme für das kräftige Gelb an der Kante (siehe den
		Tokenblock in src/app.html und die Wache `jede Erntestufe steht als Wort
		neben ihrer Kante`). Die Liste der Karten hängt über aria-labelledby daran.

		Die Kennungen tragen **die Stelle** des Beets und nicht seinen Namen: der
		Ort ist getippter Text, und eine Kennung aus Leerzeichen und Umlauten wäre
		keine.

		Der leere Zustand steht **mit** darin: `Es gibt nichts zu ernten.` ist die
		Antwort auf dieselbe Frage.
	-->
	<section class="beetliste" aria-labelledby="ernteliste-marke">
		<h2 class="abschnittstitel" id="ernteliste-marke">Was gibt es aktuell zu ernten?</h2>
		{#if data.stand.length === 0}
			<p class="leer">Es gibt nichts zu ernten.</p>
		{/if}

		{#each gliederung as beet, beetstelle (beet.schluessel)}
			<details
				class="abschnitt"
				open={istOffen(beet.schluessel, () => enthaeltZiel(beet))}
				ontoggle={(ereignis) => merken(beet.schluessel, ereignis)}
			>
				<summary class="abschnitt__griff">
					<h3 class="abschnittstitel beet__name" id="beet-{beetstelle}">
						{beet.ort ?? 'Ohne Beet'}
					</h3>
					<span class="hinweis beet__zaehler">{beet.zaehler}</span>
					<ZeichenWinkel class="aufklapp" />
				</summary>
				<div class="abschnitt__inhalt">
					{#each beet.stufen as gruppe (gruppe.stufe)}
						{@const marke = `beet-${beetstelle}-${gruppe.stufe}`}
						<h4 class="marke" id={marke}>{ERNTETEXT[gruppe.stufe].kurz}</h4>
						<ul class="liste liste--getrennt" aria-labelledby={marke}>
							{#each gruppe.zeilen as eintrag (eintrag.id)}
								{@const fragtHier = frage !== null && frage.zeile === eintrag.id}
								<!--
									Die Farbe der Stufe liegt als Kante an der Karte, das **Wort** steht
									im Zwischentitel darüber — kein Zustand hängt allein an der Farbe.
									Eine Zeile auf `wachsen` steht hier als `stehen`: `gruppe.stufe`
									ist die angezeigte Stufe und nicht die gespeicherte.
								-->
								<li
									class="karte"
									id="ernte-{eintrag.id}"
									class:stufe--sofort={gruppe.stufe === 'sofort'}
									class:stufe--stehen={gruppe.stufe === 'stehen'}
									data-stufe={gruppe.stufe}
								>
									<div class="ernte__zeile">
										<!--
											**Einzeilig**: die Kultur, bei Dauerernte das Kreiszeichen mit
											vorgelesenem Wort, darunter klein Name und Datum — das Datum
											immer, weil es sagt, wie frisch die Angabe ist. Der Satz `Alle
											zwei bis drei Tage durchgehen.` steht seit dem 2026-10-26 nur
											noch in der Legende. Ein fehlender Name kann nur aus einem
											Eingriff von Hand an der Datenbank stammen; die Zeile bleibt
											dann trotzdem lesbar.
										-->
										<div class="ernte__text">
											<p class="zeile__text zeichenwort">
												{eintrag.kultur}{#if eintrag.laufend}<ZeichenKreis /><span
														class="nur-vorgelesen">{DAUERERNTE_WORT}</span
													>{/if}
											</p>
											<p class="hinweis hinweis--ziffern">
												{eintrag.name ?? 'unbekannt'} · {datumKurz(eintrag.createdAt)}
											</p>
										</div>
										{#if !fragtHier}
											<!--
												**Die Knöpfe sehen 32px gross aus, ihr Trefferfeld bleibt 44px**
												(`.knopf-klein` unten). Sie tragen ihren Namen selbst, mit Kultur
												und Ort: an zwanzig Karten hiessen sie sonst zwanzigmal gleich.

												`Sofort` nur an einer langsamen Karte — Umstufen geht seit dem
												2026-09-17 nur nach vorn (Entscheid Manuel), und an einer Zeile
												auf `sofort` bleibt allein das X. Ohne Rückfrage: Umstufen nimmt
												nichts weg, die Zeile wechselt den Zwischentitel und steht weiter
												da. Der Umriss ist der gewöhnliche, das Gelb liegt nur als Kante
												links — als Umriss hielte es die 3:1 aus NFR9 nicht (Spec Change
												Log). Die Kante ist eine Zustandsmarke und trägt darum data-stufe.

												Das X fragt nach, weil es löscht; die Rückfrage steht dann an
												seiner Stelle.
											-->
											<div class="ernte__knoepfe">
												{#if gruppe.stufe === 'stehen'}
													<form method="POST" action="?/umstufen" use:enhance={versand}>
														<input type="hidden" name="id" value={eintrag.id} />
														<input type="hidden" name="status" value="sofort" />
														<button
															class="button-quiet button-quiet--kompakt knopf-klein stufe--sofort"
															type="submit"
															data-stufe="sofort"
															aria-label="{ERNTETEXT.sofort.kurz} {bezeichnung(eintrag)}"
															disabled={imFlug}
														>
															{SOFORT_KNOPF}
														</button>
													</form>
												{/if}
												<form method="POST" action="?/abernten" use:enhance={versand}>
													<input type="hidden" name="id" value={eintrag.id} />
													<button
														class="button-quiet button-quiet--kompakt button-quiet--zerstoerend knopf-klein knopf-klein--zeichen"
														type="submit"
														aria-label="{ABERNTEN_WORT} {bezeichnung(eintrag)}"
														disabled={imFlug}
													>
														<ZeichenKreuz />
													</button>
												</form>
											</div>
										{/if}
									</div>

									{#if fragtHier && frage !== null}
										<div class="ernte__frage">
											<p class="fliesstext" id="abernten-frage-{eintrag.id}">
												{frage.kultur}{#if frage.ort !== null}, {frage.ort}{/if} abräumen? Die Zeile ist
												dann für alle weg.
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
														{ABERNTEN_WORT}
													</button>
												</form>
											</div>
										</div>
									{/if}
								</li>
							{/each}
						</ul>
					{/each}
				</div>
			</details>
		{/each}
	</section>
</div>

<style>
	/*
		Die zwei Stufenfarben haben eigene Token: --reif-sofort (Gelb) und
		--reif-stehen (Grün), seit dem 2026-10-26 in dieser Zuordnung. Bis dahin
		war `sofort` rot und eine dritte Stufe grün; Rot trägt seither keine
		Erntestufe mehr, sondern auf dieser Seite allein das X zum Abernten
		(spec-ernte-nach-beet.md). Die Begründung der Token und die Messwerte
		stehen im Tokenblock in src/app.html.

		Die Kante ist dieselbe Marke wie „diese Woche" im Tränkeplan — derselbe
		Gedanke an zwei Orten: hier ist etwas los.
	*/
	/*
		Was ein `<summary>` zusätzlich zu `.button-primary` braucht, steht seit dem
		2026-09-17 im geteilten Stilblatt als `.button-primary--griff`: /sitzungen
		trägt dieselbe Aufforderung, und die zweite Kopie derselben zwei
		Deklarationen wäre Retro-Posten D1. Die Begründung samt Safari-Fall steht
		dort.
	*/

	/*
		Die Stufenwahl: kein <select>, sondern Knöpfe mit ihrer Erklärung. Der
		Rahmen ist der eines Bedienelements — die ganze Zeile ist das Trefferfeld,
		weil das <label> den Knopf umschliesst.
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

	/*
		**Eine Regel je Stufe, für jeden Träger.** Die Kante liegt an der Karte in
		der Liste, an der Karte der Legende, an der Zeile der Stufenwahl und am
		Knopf `Sofort` — bis zum 2026-10-26 waren das zwei Regeln je Stufe, eine
		für die Karte unter einer Liste mit Stufenklasse und eine für die
		Stufenwahl. Jetzt trägt jedes dieser Elemente die Klasse selbst.

		**Nach `.stufenwahl__zeile`**, und das ist Absicht: beide setzen die Kante
		mit derselben Spezifität, und die spätere gewinnt.
	*/
	.stufe--sofort {
		border-inline-start: var(--border-marker) solid var(--reif-sofort);
	}

	.stufe--stehen {
		border-inline-start: var(--border-marker) solid var(--reif-stehen);
	}

	/*
		Die Zeile der Legende, die das X erklärt: Anordnung aus `.zeichenwort`, das
		Wort in Tinte wie jede andere Zeile der Legende, und **nur das Zeichen** im
		Rot des Zerstörenden — so, wie es an der Karte steht. Bis zum Review vom
		2026-10-26 färbte die Regel die ganze Zeile rot.

		Das Rot muss gegen `.zeichenwort .zeichen` aus dem geteilten Blatt gewinnen,
		das ein Zeichen neben seinem Wort bewusst in Tinte setzt; der Selektor hier
		ist um die Klasse des Behälters spezifischer. `:global`, weil das SVG aus
		einer anderen Komponente kommt und den Gültigkeitsbereich dieser Seite
		nicht trägt.
	*/
	.legende__kreuz {
		display: inline-flex;
	}

	.legende__kreuz :global(.zeichen) {
		color: var(--danger);
	}

	/*
		Der Abstand zwischen den Beeten — derselbe wie im Tagebuch auf /wellness
		(`.tagebuch` dort). Nicht ins geteilte Stilblatt gezogen: derselbe
		Regelkörper steht mit dieser Regel in sechs Komponentenregeln (gezählt am
		2026-10-26 über alle .svelte unter src/ nach genau diesen drei
		Deklarationen), und Gate-Regel 14 schlug beim Versuch mit vier Meldungen
		an. Die Zusammenlegung ist ein eigener Posten.
	*/
	.beetliste {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	/*
		Der Zähler im Kopf eines Beets steht gleich neben dem Namen; der Winkel
		bleibt rechts aussen. `.abschnitt__griff` verteilt seine Kinder über
		`space-between`, und ohne diese Zeile stünde der Zähler in der Mitte.
	*/
	.beet__zaehler {
		flex: 0 0 auto;
		margin-inline-end: auto;
	}

	/*
		**Ein langer Ort ohne Leerzeichen bricht, statt den Zähler zu quetschen**
		(Review vom 2026-10-26). Der Titel gibt nach (`min-width: 0`, sonst weicht
		ein Flexkind nicht unter seine Inhaltsbreite zurück), der Zähler daneben
		nicht (`flex: 0 0 auto` oben). `overflow-wrap: anywhere` aus demselben
		Grund wie an `.zeile__text` im geteilten Blatt: nur `anywhere` zieht die
		Trennstelle in die Breitenrechnung des Flexbehälters. Die Klasse
		`.zeile__text` selbst trägt der Titel nicht — sie ist die Rolle einer
		Zeile in einer Liste, nicht die einer Überschrift.
	*/
	.beet__name {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	/*
		Die Karte als eine Zeile: Text links, Knöpfe rechts. Der Text gibt nach
		(`min-width: 0` am Kind), die Knöpfe nicht — eine lange Kultur bricht um,
		statt sie aus der Karte zu schieben.
	*/
	.ernte__zeile {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.ernte__text {
		flex: 1 1 auto;
		min-width: 0;
	}

	/*
		Der Abstand zwischen `Sofort` und dem X ist so gross wie die zwei
		unsichtbaren Ränder der Trefferfelder zusammen: so berühren sie sich, ohne
		sich zu überlappen, und ein Tipp zwischen beide trifft keinen falschen.
	*/
	.ernte__knoepfe {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		gap: calc(var(--touch) - var(--knopf-klein));
	}

	/*
		**Klein sichtbar, gross zu treffen** (spec-ernte-nach-beet.md): der Knopf
		zeigt --knopf-klein (32px), und ein unsichtbares Pseudoelement legt das
		Trefferfeld auf --touch (44px) — dieselbe Trennung wie beim Kästchen der
		Aufgabenzeile. Gerechnet wird ab der Innenkante, an der ein absolut
		gesetztes Pseudoelement ansetzt: darum zieht die Rechnung die Kante noch
		einmal ab. Gemessen wird das Trefferfeld in `smoke:sicht` mit
		`elementFromPoint` an den Rändern, nicht an der Grösse des Knopfs.
	*/
	.knopf-klein {
		position: relative;
		min-width: var(--knopf-klein);
		min-height: var(--knopf-klein);
		padding-block: 0;
	}

	.knopf-klein::before {
		position: absolute;
		inset: calc((var(--knopf-klein) - var(--touch)) / 2 - var(--border-hairline));
		content: '';
	}

	/* Der Knopf, der nur ein Zeichen trägt, ist quadratisch. */
	.knopf-klein--zeichen {
		padding-inline: 0;
	}

	/*
		Die Rückfrage. Aufgehellte Fläche statt einer roten Kante: die Karte trägt
		schon die Farbe ihrer Stufe, und zwei Farbaussagen an einer Karte
		behaupten zwei Dinge zugleich.
	*/
	.ernte__frage {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
		border-radius: var(--radius-sm);
		background-color: var(--surface-open);
	}
</style>
