<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
	import { tick } from 'svelte';
	import type { PageProps } from './$types';
	import { datumLang } from '$lib/client/utils/date';
	import { PROTOKOLL_HOECHSTGROESSE_MB } from '$lib/sitzung';
	import { VERSAND_FEHLGESCHLAGEN } from '$lib/texte';
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
		Die Traktanden nach Sitzung gebündelt.

		**Die Gruppen entstehen hier und nicht in der load**, aus demselben Grund
		wie im Archiv nebenan: der Datumstext ist Text für die Anzeige, und die
		eine Stelle, die einen Zeitstempel in Text verwandelt, ist
		$lib/client/utils/date.

		**Ein Durchlauf und kein Sortieren.** Die Liste kommt aufsteigend nach
		`sitzungAm` aus der Abfrage, und damit stehen die Punkte einer Sitzung
		zwangsläufig beieinander: es genügt, die laufende Gruppe weiterzuführen,
		solange das Datum dasselbe bleibt. Das ist die eine Stelle, an der diese
		Komponente sich auf die Ordnung der Abfrage verlässt, und darum steht es
		hier ausgeschrieben — wer dort das `asc` herausnimmt, bekommt dieselbe
		Sitzung mehrfach.

		Gruppiert wird über den **Zeitstempel** und nicht über den gerenderten
		Satz: zwei Sitzungen desselben Tages gibt es nicht, aber ein Datumstext ist
		eine Anzeigeentscheidung, und eine Gruppierung, die daran hinge, liefe beim
		nächsten Formatwechsel still anders.
	*/
	const gruppen = $derived.by(() => {
		const liste: { sitzungAm: number; punkte: typeof data.traktanden }[] = [];
		for (const punkt of data.traktanden) {
			const laufende = liste.at(-1);
			if (laufende !== undefined && laufende.sitzungAm === punkt.sitzungAm) {
				laufende.punkte.push(punkt);
			} else {
				liste.push({ sitzungAm: punkt.sitzungAm, punkte: [punkt] });
			}
		}
		return liste;
	});

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

	/** Die Meldung an einem der vier Felder der Seite. */
	const fehlerAm = (feld: 'text' | 'sitzungAm' | 'protokollDatum' | 'datei'): string =>
		form !== null && form.art === 'fehler' && form.feld === feld ? form.meldung : '';

	const fehlerAmText = $derived(fehlerAm('text'));
	const fehlerAmDatum = $derived(fehlerAm('sitzungAm'));
	const fehlerAmProtokollDatum = $derived(fehlerAm('protokollDatum'));
	const fehlerAmDatei = $derived(fehlerAm('datei'));

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
	const traktandumOffen = $derived(fehlerAmText !== '' || fehlerAmDatum !== '');
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

		const daten = ergebnis.data as { art?: unknown; feld?: unknown } | undefined;
		if (typeof daten?.art === 'string' && daten.art === 'fehler') {
			const feld = typeof daten.feld === 'string' ? daten.feld : '';
			const ziel: Record<string, string> = {
				text: 'neu-text',
				sitzungAm: 'neu-sitzung',
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
	<details class="zeilenform" open={traktandumOffen}>
		<summary class="zeilenform__griff">
			<span>Traktandum aufschreiben</span>
			<ZeichenWinkel class="aufklapp" />
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

			<div>
				<label class="feld__beschriftung" for="neu-sitzung">Datum der Sitzung</label>
				<!--
					`min` und `max` kommen aus derselben Rechnung wie auf /einzelaufgabe
					und /monatsplan — ein Jahr in jede Richtung. Der Browser fängt damit
					ab, was sonst erst die action abwiese; die action prüft es trotzdem,
					weil ein POST kein Feld braucht.
				-->
				<input
					class="feld"
					id="neu-sitzung"
					name="sitzungAm"
					type="date"
					required
					min={data.frueheste}
					max={data.spaeteste}
					aria-invalid={fehlerAmDatum !== '' ? 'true' : undefined}
					aria-describedby={fehlerAmDatum !== '' ? 'neu-sitzung-fehler' : undefined}
				/>
				<p class="fehler live" id="neu-sitzung-fehler" role="alert" aria-live="assertive">
					{fehlerAmDatum}
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
	{#if gruppen.length === 0}
		<!-- Der leere Zustand nennt den Grund und nicht den Zustand: `Keine Sitzung` wäre eine Behauptung über die Gartengruppe, die diese Anwendung nicht aufstellen kann. -->
		<p class="leer">Nichts aufgeschrieben.</p>
	{:else}
		{#each gruppen as gruppe (gruppe.sitzungAm)}
			{@const marke = `sitzung-${gruppe.sitzungAm}`}
			<h3 class="abschnittstitel" id={marke}>Sitzung vom {datumLang(gruppe.sitzungAm)}</h3>
			<ul class="liste liste--getrennt" aria-labelledby={marke}>
				{#each gruppe.punkte as punkt (punkt.id)}
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
						-->
						<p class="hinweis hinweis--ziffern">
							{punkt.name ?? 'unbekannt'} · {datumLang(punkt.createdAt)}
						</p>
					</li>
				{/each}
			</ul>
		{/each}
	{/if}

	<!--
		Das Ablegen. `enctype="multipart/form-data"` ist Pflicht und die eine
		Stelle, an der diese Seite von jedem anderen Formular des Produkts
		abweicht: ohne diese Angabe schickt der Browser vom Dateifeld **nur den
		Namen** und keine Bytes, und die action wiese eine Datei ab, die die Person
		sichtbar gewählt hat.
	-->
	<details class="zeilenform" open={protokollOffen}>
		<summary class="zeilenform__griff">
			<span>Protokoll ablegen</span>
			<ZeichenWinkel class="aufklapp" />
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

	<h2 class="abschnittstitel" id="protokolle-marke">Abgelegte Protokolle</h2>
	{#if data.protokolle.length === 0}
		<p class="leer">Noch keines abgelegt.</p>
	{:else}
		<ul class="liste liste--getrennt" aria-labelledby="protokolle-marke">
			{#each data.protokolle as protokoll (protokoll.id)}
				<li class="karte karte--eng">
					<!--
						Ein gewöhnlicher Link und kein `download`-Attribut: die Ausgabe
						schickt `Content-Disposition: attachment`, und damit lädt der Browser
						die Datei ohnehin herunter. Das Attribut wäre dieselbe Aussage ein
						zweites Mal, an der Stelle, die sie nicht durchsetzt.

						resolve() ist Pflicht für interne Ziele
						(svelte/no-navigation-without-resolve).
					-->
					<a class="eintrag" href={resolve(`/sitzungen/${protokoll.id}`)}>
						Protokoll der Sitzung vom {datumLang(protokoll.sitzungAm)}
					</a>
					<p class="hinweis hinweis--ziffern">
						{protokoll.name ?? 'unbekannt'} · {datumLang(protokoll.createdAt)}
					</p>
				</li>
			{/each}
		</ul>
	{/if}
</div>
