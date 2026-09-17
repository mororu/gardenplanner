<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
	import { tick } from 'svelte';
	import type { PageProps } from './$types';
	import { datumKurz, datumLang } from '$lib/client/utils/date';
	import { PROTOKOLL_HOECHSTGROESSE_MB } from '$lib/sitzung';
	import { VERSAND_FEHLGESCHLAGEN } from '$lib/texte';
	import ZeichenStift from '$lib/components/ZeichenStift.svelte';
	import ZeichenWinkel from '$lib/components/ZeichenWinkel.svelte';

	/*
		/sitzungen — Traktanden für die nächste Sitzung, Protokolle der vergangenen.

		Die Bauform ist die von /wissen und /ernte: aufklappbare Formulare in
		`.zeilenform`, Live-Regionen, die **immer** im Markup stehen, und ein
		use:enhance-Rückruf, der einen Wurf abfängt. Der ausführliche Grund für
		jedes dieser Stücke steht dort; hier stehen nur die Unterschiede.

		**Zwei Formulare auf einer Seite, und darum ein Rückruf für beide.** Die
		Sperre `imFlug` gilt der ganzen Seite und nicht je Formular: zwei Versände
		gleichzeitig sind auch dann ein Fehlgriff, wenn sie verschiedene Tabellen
		treffen. Dieselbe Entscheidung wie auf `/`, wo ein Doppelgriff über zwei
		Zeilen derselbe Fehler ist wie zweimal auf dieselbe.
	*/

	const { data, form }: PageProps = $props();

	/*
		**Keine Gruppierung mehr, seit dem 2026-09-17** (Entscheid Manuel). Sie
		bündelte die Punkte nach `sitzungAm`; die Spalte ist weg, weil ein
		Traktandum an keine bestimmte Sitzung geht, sondern an die nächste. Was hier
		steht, ist **eine** Sammlung, und sie ist bei der nächsten Sitzung
		verbraucht: `Liste ziehen` schreibt sie in die Ablage und räumt sie leer.
	*/

	/**
	 * Die Rückmeldung in der höflichen Live-Region.
	 *
	 * Zwei Quellen, eine Region — wie auf `/`. Ein Ausgang aus `form` gewinnt,
	 * weil er der jüngere ist: wer nach dem Ablegen eines Protokolls ein
	 * Traktandum aufschreibt, liest den Satz zum Traktandum, auch wenn die
	 * Adresse noch `?abgelegt` trägt.
	 *
	 * Das Aufschreiben nennt den Text mit. Die Liste darunter kann lang sein und
	 * der Punkt in einer Gruppe weiter unten landen; ohne die Angabe sagte die
	 * Meldung, dass etwas geklappt hat, aber nicht was.
	 */
	const rueckmeldung = $derived.by(() => {
		if (form !== null && form.art === 'erfasst') return `${form.meldung} ${form.text}`;
		return data.abgelegt ? 'Protokoll abgelegt.' : '';
	});

	/*
		Ein Wurf in einer action kommt als `result.type === 'error'` zurück. Der
		Satz steht in derselben Live-Region wie ein Fehlschlag der action;
		einheitlich auf allen Seiten, entschieden am 2026-08-28 zu Eintrag 32 der
		zurückgestellten Arbeit.
	*/
	let versandFehler = $state('');

	/**
	 * Die Meldung an einem der drei Felder der Seite.
	 *
	 * **Drei und nicht mehr vier**: das Datumsfeld am Traktandum ist am
	 * 2026-09-17 weggefallen. Die zwei übrigen Datumssachen gehören beide zum
	 * Protokoll.
	 */
	const fehlerAm = (feld: 'text' | 'protokollDatum' | 'datei'): string =>
		form !== null && form.art === 'fehler' && form.feld === feld ? form.meldung : '';

	const fehlerAmText = $derived(fehlerAm('text'));
	const fehlerAmProtokollDatum = $derived(fehlerAm('protokollDatum'));
	const fehlerAmDatei = $derived(fehlerAm('datei'));

	/**
	 * Die Kennung der Zeile, an der eine Abweisung hängt — oder null.
	 *
	 * Das Ändern steht an **jeder** Zeile, und ein Fehlersatz ohne diese Angabe
	 * stünde an allen zugleich. Dieselbe Bauform wie `zeile` auf /verwaltung und
	 * /traenkeplan, und derselbe Weg: `abweisen` trägt sie als viertes Feld
	 * zurück.
	 */
	const fehlerZeile = $derived(
		form !== null && form.art === 'fehler' && typeof form.zeile === 'number' ? form.zeile : null
	);

	/** Die Meldung am Ändern-Feld einer bestimmten Zeile. */
	const fehlerAnZeile = (id: number): string =>
		form !== null && form.art === 'fehler' && fehlerZeile === id ? form.meldung : '';

	/*
		Jedes Formular steht offen, sobald es etwas zurückzutragen hat — und nur
		das, an dem die Abweisung hängt. Ohne JavaScript ist das der einzige Weg,
		auf dem die abgewiesene Eingabe überhaupt sichtbar wird: ein zugeklapptes
		<details> verbirgt sie, und der Fokus spränge in etwas, das niemand sieht.

		**Zwei getrennte Ausdrücke und kein gemeinsamer.** Ein `form !== null &&
		form.art === 'fehler'` an beiden klappte nach einer abgewiesenen Datei auch
		das Traktandenformular auf — und damit ein leeres Formular als Antwort auf
		einen Fehler, der woanders passiert ist.
	*/
	const traktandumOffen = $derived(fehlerAmText !== '' && fehlerZeile === null);
	const protokollOffen = $derived(fehlerAmProtokollDatum !== '' || fehlerAmDatei !== '');

	/*
		Die verworfene Eingabe reist über `eingabe` zurück — das eine freie
		Textfeld dieser Seite. Die zwei Datumsfelder brauchen keinen Platz: sie
		tragen `required`, `min` und `max`, und der Browser prüft sie selbst. Das
		Dateifeld kann keinen tragen — ein `<input type="file">` lässt sich aus
		Sicherheitsgründen nicht mit einem Wert belegen, und genau darum leitet das
		Ablegen weiter, statt zurückzugeben.
	*/
	const textWert = $derived(form !== null && form.art === 'fehler' ? form.eingabe : '');

	/** Die Meldung eines Fehlschlags, der an kein Feld gehört. */
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
	 * Nach einer Abweisung an das **erste** Feld, das nicht trägt: dort steht der
	 * Satz. Nach allem anderen an die Rückmeldung oben — das Formular klappt zu,
	 * und der Fokus hätte kein Ziel mehr.
	 *
	 * Über die Id statt über ein bind:this je Feld: vier Bindungen für einen
	 * Griff wären der teurere Weg zum selben Element.
	 */
	function fokusNach(ergebnis: ActionResult): void {
		/*
			`redirect` und `error` tragen keine Daten und **keinen Fokus**. Auf dieser
			Seite entsteht ein redirect auf zwei Wegen: nach dem Ablegen eines
			Protokolls, und wenn die Sitzung seit dem Laden der Seite fort ist. In
			beiden Fällen navigiert update() fort, und ein Griff in eine Region dieser
			Seite wäre ein Fokus auf ein Element, das es gleich nicht mehr gibt.
		*/
		if (ergebnis.type !== 'success' && ergebnis.type !== 'failure') return;

		const daten = ergebnis.data as { art?: unknown; feld?: unknown; zeile?: unknown } | undefined;
		if (typeof daten?.art === 'string' && daten.art === 'fehler') {
			const feld = typeof daten.feld === 'string' ? daten.feld : '';
			/*
				Das Ändern einer Zeile trägt `text` wie das Aufschreiben, zielt aber auf
				ein anderes Feld: die Kennung der Zeile entscheidet. Ohne diesen Zweig
				spränge der Fokus nach einer abgewiesenen Ergänzung in das leere
				Formular oben — an ein Feld, in dem nichts steht, was abgewiesen wurde.
			*/
			const zeile = typeof daten?.zeile === 'number' ? daten.zeile : null;
			if (feld === 'text' && zeile !== null) {
				document.getElementById(`aendern-text-${zeile}`)?.focus();
				return;
			}
			const ziel: Record<string, string> = {
				text: 'neu-text',
				protokollDatum: 'protokoll-sitzung',
				datei: 'protokoll-datei',
			};
			const id = ziel[feld];
			if (id !== undefined) {
				document.getElementById(id)?.focus();
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
			// Ein abgefangener Wurf steht in derselben Region wie ein Fehlschlag der
			// action; fokusNach findet ihn nur nicht, weil in `result` keine Daten
			// stehen.
			if (versandFehler !== '') {
				fehlerKasten?.focus();
				return;
			}
			fokusNach(result);
		};
	};
</script>

<svelte:head>
	<title>Protokolle und Traktanden</title>
</svelte:head>

<div class="seite">
	<h1 class="seitentitel">Protokolle und Traktanden</h1>

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

	<!--
		**Traktanden zuerst, Protokolle darunter**, und die Reihenfolge ist eine
		Aussage über die Aufmerksamkeit: was vorbereitet werden muss, steht vor
		dem, was nachgeschlagen wird. Dieselbe Haltung wie auf `/`, wo der Vorrat
		an Arbeit vor der Frage nach einer Zusage steht.

		Das <form> trägt ein **literales** action="?/aufschreiben": Gate-Regel 11
		leitet die Route aus dem Verzeichnis der Datei ab und hält den Namen gegen
		die actions der Nachbardatei. Ein dynamisches action={…} machte sie blind.
	-->
	<!--
		**Die grüne Aufforderung mit `+`**, seit dem 2026-09-17 (Entscheid Manuel) —
		dieselbe Bauform wie `+ Reifes eintragen` auf /ernte und dieselbe Rolle wie
		`+ Aufgabe` und `+ Termin planen` auf `/`. Sie stand vorher als stiller
		Zeilenform-Griff da und sah aus wie ein Abschnitt, der sich aufklappen
		lässt; sie ist aber die eine Handlung dieser Seite, die alle angeht.

		Das `+` trägt `aufklapp` — Gate-Regel 15 liest die Klasse im Markup und
		lässt nur dann zu, dass der Griff sein Dreieck verliert. Was ein `<summary>`
		zusätzlich zu `.button-primary` braucht, steht als `.button-primary--griff`
		im geteilten Stilblatt.

		**Ein Feld und kein zweites.** Das Datum der Sitzung ist weggefallen: wer
		einen Punkt aufschreibt, weiss, **dass** er an die nächste Sitzung soll, und
		nicht, wann die ist.
	-->
	<details class="zeilenform" open={traktandumOffen}>
		<summary class="button-primary button-primary--griff">
			<span class="aufklapp">+</span>
			<span>Traktandum aufschreiben</span>
		</summary>
		<form class="zeilenform__formular" method="POST" action="?/aufschreiben" use:enhance={versand}>
			<div>
				<label class="feld__beschriftung" for="neu-text">Was besprochen werden soll</label>
				<input
					class="feld"
					id="neu-text"
					name="text"
					type="text"
					required
					maxlength={data.traktandumgrenze}
					value={textWert}
					aria-invalid={fehlerAmText !== '' ? 'true' : undefined}
					aria-describedby={fehlerAmText !== '' ? 'neu-text-fehler' : undefined}
				/>
				<!--
					Der Satz steht ausserhalb des Feldes und immer im Markup, mit
					`.live:empty` aus dem Fluss, solange er leer ist — dieselbe Bauform
					wie an jeder anderen Feldmeldung des Produkts.
				-->
				<p class="fehler live" id="neu-text-fehler" role="alert" aria-live="assertive">
					{fehlerAmText}
				</p>
			</div>

			<button class="button-quiet" type="submit" disabled={imFlug}>Aufschreiben</button>
		</form>
	</details>

	<!--
		Die Liste, nach Sitzung gebündelt. Jede Gruppe trägt ihren zugänglichen
		Namen über die Marke darüber — sonst heisst sie „Liste mit 4 Einträgen",
		und auf dieser Seite stünden mehrere davon ununterscheidbar untereinander.
		Dieselbe Bauform wie die Monatsgruppen im Archiv.

		Die Id kommt aus dem Zeitstempel und nicht aus einem Zähler: sie bleibt
		damit dieselbe, wenn eine Gruppe dazukommt.
	-->
	<h2 class="abschnittstitel" id="traktanden-marke">Was ansteht</h2>
	{#if data.traktanden.length === 0}
		<!-- Der leere Zustand nennt den Grund und nicht den Zustand: `Keine Sitzung` wäre eine Behauptung über die Gartengruppe, die diese Anwendung nicht aufstellen kann. -->
		<p class="leer">Nichts aufgeschrieben.</p>
	{:else}
		<ul class="liste liste--getrennt" aria-labelledby="traktanden-marke">
			{#each data.traktanden as punkt (punkt.id)}
				{@const fehlerHier = fehlerAnZeile(punkt.id)}
				<li class="karte karte--eng">
					<!--
						`.zeile__text` bringt den Umbruch für getippten Text aus dem
						geteilten Stilblatt mit: zweihundert Zeichen ohne Leerzeichen
						liefen bei 375px sonst aus der Box.
					-->
					<p class="fliesstext zeile__text">{punkt.text}</p>
					<!--
						Name und Datum: nicht als Zuständigkeit, sondern als Herkunft —
						wer es aufgeschrieben hat und wann. Ein fehlender Name kann nur
						aus einem Eingriff von Hand an der Datenbank stammen; die Zeile
						bleibt dann trotzdem lesbar.

						**Die Angabe bleibt beim Ändern stehen und wandert nicht auf die
						ändernde Person** (Entscheid Manuel, 2026-09-17): sie sagt, wer den
						Punkt aufgebracht hat, und das bleibt wahr. Die Begründung steht an
						`traktandumAendern`.
					-->
					<p class="hinweis hinweis--ziffern">
						{punkt.name ?? 'unbekannt'} · {datumKurz(punkt.createdAt)}
					</p>
					<!--
						**Der Stift**, seit dem 2026-09-17: ein Punkt lässt sich ergänzen,
						solange er auf der Sammlung steht. Dieselbe Bauform wie an einer
						Aufgabenzeile auf `/` — Zeichen statt Wort, das Wort in
						`.nur-vorgelesen` daneben —, und dieselbe Komponente; die
						Begründung in ganzer Länge steht an $lib/components/ZeichenStift.svelte.

						`open` hängt am Ausgang des **Servers** und an dieser Zeile: ohne
						JavaScript läuft kein use:enhance-Rückruf, und ein zugeklapptes
						Formular mit einem Fehlersatz darunter wäre eine Meldung über etwas,
						das man nicht sieht.

						Das <form> trägt ein **literales** action="?/aendern" — ein
						dynamisches action={…} machte Gate-Regel 11 blind.
					-->
					<details class="aendern" open={fehlerHier !== ''}>
						<summary class="aendern__griff">
							<ZeichenStift class="aufklapp" />
							<span class="nur-vorgelesen">Ergänzen</span>
						</summary>
						<form class="aendern__formulare" method="POST" action="?/aendern" use:enhance={versand}>
							<input type="hidden" name="traktandumId" value={punkt.id} />
							<label class="nur-vorgelesen" for="aendern-text-{punkt.id}">
								Was besprochen werden soll
							</label>
							<input
								class="feld"
								id="aendern-text-{punkt.id}"
								name="text"
								type="text"
								required
								maxlength={data.traktandumgrenze}
								value={fehlerHier !== '' ? textWert : punkt.text}
								aria-invalid={fehlerHier !== '' ? 'true' : undefined}
								aria-describedby={fehlerHier !== '' ? `aendern-fehler-${punkt.id}` : undefined}
							/>
							<p
								class="fehler live"
								id="aendern-fehler-{punkt.id}"
								role="alert"
								aria-live="assertive"
							>
								{fehlerHier}
							</p>
							<button class="button-quiet button-quiet--kompakt" type="submit" disabled={imFlug}>
								Speichern
							</button>
						</form>
					</details>
				</li>
			{/each}
		</ul>

		<!--
			**Die Liste ziehen** — die Sammlung wandert als Textdatei in die Ablage
			und ist hier danach leer (Entscheid Manuel, 2026-09-17).

			`.button-quiet` und nicht `.button-primary`: der primäre Knopf dieses
			Abschnitts ist die Aufforderung darüber, und zwei gefüllte Flächen
			untereinander stritten um dieselbe Aufmerksamkeit. Der Satz daneben sagt,
			was passiert — **vorher**, denn danach ist es geschehen; einen
			Bestätigungsdialog gibt es nicht, und warum, steht an der action.

			Der Knopf steht im {:else}-Zweig: aus einer leeren Sammlung lässt sich
			nichts ziehen, und ein Knopf, der nur einen Fehlersatz erzeugen kann, ist
			eine Einladung zum Fehlgriff. Die action prüft es trotzdem — ein POST
			braucht kein Formular.
		-->
		<form class="ziehen" method="POST" action="?/ziehen" use:enhance={versand}>
			<p class="hinweis">
				Die Punkte wandern in eine Textdatei und verschwinden aus dieser Liste. Die Datei bleibt
				unten stehen.
			</p>
			<button class="button-quiet" type="submit" disabled={imFlug}>Liste ziehen</button>
		</form>
	{/if}

	<!--
		Das Ablegen. `enctype="multipart/form-data"` ist Pflicht und die eine
		Stelle, an der diese Seite von jedem anderen Formular des Produkts
		abweicht: ohne diese Angabe schickt der Browser vom Dateifeld **nur den
		Namen** und keine Bytes, und die action wiese eine Datei ab, die die Person
		sichtbar gewählt hat.
	-->
	<details class="zeilenform" open={protokollOffen}>
		<summary class="button-primary button-primary--griff">
			<span class="aufklapp">+</span>
			<span>Protokoll ablegen</span>
		</summary>
		<form
			class="zeilenform__formular"
			method="POST"
			action="?/ablegen"
			enctype="multipart/form-data"
			use:enhance={versand}
		>
			<div>
				<label class="feld__beschriftung" for="protokoll-sitzung">Datum der Sitzung</label>
				<input
					class="feld"
					id="protokoll-sitzung"
					name="sitzungAm"
					type="date"
					required
					min={data.frueheste}
					max={data.spaeteste}
					aria-invalid={fehlerAmProtokollDatum !== '' ? 'true' : undefined}
					aria-describedby={fehlerAmProtokollDatum !== '' ? 'protokoll-sitzung-fehler' : undefined}
				/>
				<p class="fehler live" id="protokoll-sitzung-fehler" role="alert" aria-live="assertive">
					{fehlerAmProtokollDatum}
				</p>
			</div>

			<div>
				<label class="feld__beschriftung" for="protokoll-datei">Das Protokoll als PDF</label>
				<!--
					`accept` ist ein Vorschlag an den Dateiwähler und keine Prüfung: es
					stellt den Filter im Dialog ein, und jeder Browser lässt ihn
					umschalten. Geprüft wird in der action, und zwar an den ersten Bytes
					der Datei — siehe istPdf in $lib/sitzung.ts.
				-->
				<input
					class="feld"
					id="protokoll-datei"
					name="datei"
					type="file"
					accept="application/pdf"
					required
					aria-invalid={fehlerAmDatei !== '' ? 'true' : undefined}
					aria-describedby={fehlerAmDatei !== '' ? 'protokoll-datei-fehler' : undefined}
				/>
				<p class="hinweis hinweis--am-feld">
					Höchstens {PROTOKOLL_HOECHSTGROESSE_MB} MB. Abgelegte Protokolle bleiben stehen.
				</p>
				<p class="fehler live" id="protokoll-datei-fehler" role="alert" aria-live="assertive">
					{fehlerAmDatei}
				</p>
			</div>

			<button class="button-quiet" type="submit" disabled={imFlug}>Ablegen</button>
		</form>
	</details>

	<!--
		**Die zwei Ablagen sind seit dem 2026-09-17 Aufklapper** (Entscheid Manuel)
		— dieselbe Bauform wie die Abschnitte auf `/` und aus demselben Grund:
		nachgeschlagen wird selten, und was selten gebraucht wird, soll nicht jedes
		Mal die halbe Seite füllen. Die Sammlung darüber bleibt offen: sie ist das,
		woran gerade gearbeitet wird.

		**Beide stehen jetzt immer da**, auch leer — die gezogenen Listen fehlten
		vorher ganz, solange nie eine gezogen war. Als offener Abschnitt war das
		richtig (ein leerer Titel ohne Inhalt ist eine Zeile ohne Aussage); als
		zugeklappter Griff ist es der Fehler: zwei Aufklapper, von denen einer
		manchmal fehlt, sind eine Seite, die je nach Datenlage anders aussieht. Der
		leere Zustand steht darum **im** Abschnitt, wie bei den Protokollen.

		**Zugeklappt geliefert**, wie die drei Abschnitte auf `/`. Die Griffe tragen
		den Titel in der Abschnittsrolle und den Winkel; die Klassen mit Zahl und
		Zeichen, die `/` an seinen Griffen hat, bleiben dort — sie tragen einen
		Zähler und ein Piktogramm, die diese Seite nicht hat, und geteilt würden sie
		zu einer Rolle, die an einer Stelle halb leer bliebe.
	-->
	<details class="abschnitt">
		<summary class="abschnitt__griff">
			<h2 class="abschnittstitel" id="listen-marke">Gezogene Traktandenlisten</h2>
			<ZeichenWinkel class="aufklapp" />
		</summary>
		<div class="abschnitt__inhalt">
			{#if data.traktandenlisten.length === 0}
				<p class="leer">Noch keine gezogen.</p>
			{:else}
				<ul class="liste liste--getrennt" aria-labelledby="listen-marke">
					{#each data.traktandenlisten as liste (liste.id)}
						<li class="karte karte--eng">
							<!--
								Ein gewöhnlicher Link und kein `download`-Attribut, aus demselben
								Grund wie bei den Protokollen darunter: die Ausgabe schickt
								`Content-Disposition: attachment`.

								**Eine eigene Route und nicht `/sitzungen/[id]`**: die Kennungen
								kommen aus zwei Tabellen und überdeckten einander — die Liste 3
								und das Protokoll 3 gibt es beide.

								resolve() ist Pflicht für interne Ziele
								(svelte/no-navigation-without-resolve).
							-->
							<a class="eintrag" href={resolve(`/sitzungen/liste/${liste.id}`)}>
								Traktandenliste vom {datumLang(liste.createdAt)}
							</a>
							<p class="hinweis hinweis--ziffern">
								{liste.name ?? 'unbekannt'} · {datumKurz(liste.createdAt)}
							</p>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</details>

	<details class="abschnitt">
		<summary class="abschnitt__griff">
			<h2 class="abschnittstitel" id="protokolle-marke">Abgelegte Protokolle</h2>
			<ZeichenWinkel class="aufklapp" />
		</summary>
		<div class="abschnitt__inhalt">
			{#if data.protokolle.length === 0}
				<p class="leer">Noch keines abgelegt.</p>
			{:else}
				<ul class="liste liste--getrennt" aria-labelledby="protokolle-marke">
					{#each data.protokolle as protokoll (protokoll.id)}
						<li class="karte karte--eng">
							<!--
								Ein gewöhnlicher Link und kein `download`-Attribut: die Ausgabe
								schickt `Content-Disposition: attachment`, und damit lädt der
								Browser die Datei ohnehin herunter. Das Attribut wäre dieselbe
								Aussage ein zweites Mal, an der Stelle, die sie nicht durchsetzt.

								resolve() ist Pflicht für interne Ziele
								(svelte/no-navigation-without-resolve).
							-->
							<a class="eintrag" href={resolve(`/sitzungen/${protokoll.id}`)}>
								Protokoll der Sitzung vom {datumLang(protokoll.sitzungAm)}
							</a>
							<p class="hinweis hinweis--ziffern">
								{protokoll.name ?? 'unbekannt'} · {datumKurz(protokoll.createdAt)}
							</p>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</details>
</div>

<style>
	/*
		Der Abstand über dem Ziehen-Formular.

		**Die einzige lokale Regel dieser Seite**, und sie ist eine Deklaration:
		alles andere kommt aus dem geteilten Stilblatt. Ohne sie klebte der Knopf an
		der letzten Karte der Sammlung, als gehörte er zu ihr — er gehört zur Liste
		als Ganzem.

		`.zeilenform__formular` daneben bringt Abstände für ein aufgeklapptes
		Formular mit; hier ist nichts aufgeklappt, und die Klasse zweckentfremdet
		hiesse, dass eine Änderung an den Aufklappern still diese Stelle trifft.
	*/
	.ziehen {
		margin-block-start: var(--space-4);
	}
</style>
