<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { tick } from 'svelte';
	import type { PageProps } from './$types';
	import { VERSAND_FEHLGESCHLAGEN } from '$lib/texte';

	/*
		/wissen/[id] — ein Blatt, und das Formular, es zu ändern.

		Dieselbe Bauform wie die Liste nebenan, mit zwei Unterschieden: die Felder
		sind mit dem bestehenden Stand vorbelegt, und es gibt eine Erfolgsmeldung —
		hier landet sowohl `?angelegt` von der Liste als auch `?geaendert` von
		dieser Seite selbst.
	*/

	const { data, form }: PageProps = $props();

	/*
		Die Rückmeldung, die eine Weiterleitung überlebt hat. Zwei Verben im
		Perfekt, je einer Herkunft: `Angelegt.` kommt vom Anlegen auf /wissen,
		`Geändert.` vom Ändern hier. Beide stehen in derselben Region, weil sie
		dieselbe Frage beantworten — hat es geklappt.

		Nie beide zugleich: die zwei Parameter kommen aus zwei verschiedenen
		Weiterleitungen. Steht wider Erwarten doch beides in der Adresse, gewinnt
		das Anlegen, weil es das seltenere und das grössere Ereignis ist.

		**Eine Abweisung löscht die Rückmeldung**, und das war ein Befund des
		Reviews zu dieser Story. Der Weg dorthin: wer gerade ein Blatt angelegt
		hat, steht auf `/wissen/<id>?angelegt` und liest `Angelegt.`; klappt er
		dann `Ändern` auf und schickt ohne Titel ab, hält `use:enhance` die
		Adresse fest, `data.angelegt` bleibt wahr — und der Erfolgssatz stünde
		neben dem Fehlersatz. Zwei Meldungen über zwei verschiedene Vorgänge, von
		denen die obere von einem spricht, der vorbei ist.

		Nur mit JavaScript erreichbar: ohne läuft der POST gegen
		`/wissen/<id>?/aendern`, und dort steht kein `?angelegt`.
	*/
	const rueckmeldung = $derived(
		form !== null ? '' : data.angelegt ? 'Angelegt.' : data.geaendert ? 'Geändert.' : ''
	);

	/*
		Ein Wurf in der action kommt als `result.type === 'error'` zurück — derselbe
		Weg wie auf allen anderen Seiten.
	*/
	let versandFehler = $state('');

	/** Die Meldung am Titelfeld. */
	const fehlerAmTitel = $derived(
		form !== null && form.art === 'fehler' && form.feld === 'titel' ? form.meldung : ''
	);

	/** Die Meldung am Textfeld. */
	const fehlerAmText = $derived(
		form !== null && form.art === 'fehler' && form.feld === 'text' ? form.meldung : ''
	);

	/** Die Meldung eines Fehlschlags, der an kein Feld gehört. */
	const fehlerOben = $derived(
		versandFehler !== ''
			? versandFehler
			: form !== null && form.art === 'fehler' && form.feld === null
				? form.meldung
				: ''
	);

	/** Vom Server entschieden, wie auf der Liste: ohne JavaScript klappt nichts nach. */
	const abgewiesen = $derived(form !== null && form.art === 'fehler');

	/*
		Die Feldwerte. Nach einer Abweisung der **verworfene** Stand aus der Antwort,
		sonst der **gespeicherte** aus der load.

		Das ist der Unterschied zum Anlegen und der Grund für die zwei Ausdrücke:
		wer ändert, findet die Felder gefüllt vor, und eine Abweisung darf diesen
		Stand nicht durch den alten ersetzen — sonst wäre die eigene, gerade
		getippte Fassung fort, und zwar ohne dass es jemand merkte.
	*/
	const titelWert = $derived(
		form !== null && form.art === 'fehler' ? form.eingabe : data.blatt.titel
	);
	const textWert = $derived(
		form !== null && form.art === 'fehler' ? form.zweiteEingabe : data.blatt.text
	);

	let imFlug = $state(false);
	let meldungKasten = $state<HTMLElement | null>(null);
	let fehlerKasten = $state<HTMLElement | null>(null);

	const versand: SubmitFunction = ({ cancel }) => {
		if (imFlug) {
			cancel();
			return;
		}
		imFlug = true;
		versandFehler = '';
		return async ({ update, result }) => {
			// try/finally wie überall: bricht update() ab, bliebe der Knopf sonst
			// dauerhaft disabled.
			try {
				if (result.type === 'error') {
					versandFehler = VERSAND_FEHLGESCHLAGEN;
				} else {
					await update();
				}
			} finally {
				imFlug = false;
			}
			await tick();
			if (versandFehler !== '') {
				fehlerKasten?.focus();
				return;
			}
			if (result.type === 'failure') {
				const daten = result.data as { feld?: unknown } | undefined;
				const feld = typeof daten?.feld === 'string' ? daten.feld : null;
				if (feld === 'titel' || feld === 'text') {
					document.getElementById(`aendern-${feld}`)?.focus();
					return;
				}
				fehlerKasten?.focus();
				return;
			}
			/*
				Ein geglücktes Ändern leitet auf dieselbe Adresse mit `?geaendert`
				weiter. Das Formular klappt dabei zu, und der Fokus hätte an ihm kein
				Ziel mehr — er geht darum an die Rückmeldung, wie auf /dienstplan.
			*/
			meldungKasten?.focus();
		};
	};
</script>

<svelte:head>
	<title>{data.blatt.titel}</title>
</svelte:head>

<div class="seite">
	<!--
		Der Titel des Blatts ist der Titel der Seite. `.zeile__text` bringt den
		Umbruch für getippten Text mit: zweihundert Zeichen ohne Leerzeichen liefen
		bei 375px sonst aus der Box.
	-->
	<h1 class="seitentitel zeile__text">{data.blatt.titel}</h1>

	<!--
		Die zwei Live-Regionen des Seitenkopfs. Beide stehen **immer** im Markup und
		sind über `.live:empty` aus dem Fluss genommen, solange sie leer sind —
		Retro-Posten B2.
	-->
	<p class="meldung live" bind:this={meldungKasten} role="status" aria-live="polite" tabindex="-1">
		{rueckmeldung}
	</p>
	<p class="fehler live" bind:this={fehlerKasten} role="alert" aria-live="assertive" tabindex="-1">
		{fehlerOben}
	</p>

	<!--
		Der Freitext. **Als Ausdruck und nie über die rohe HTML-Direktive** — der
		Text kommt aus einem Formular, und Svelte setzt ihn escaped; Markup darin
		erscheint als Zeichen und nicht als Auszeichnung. Die Absätze trägt
		`white-space: pre-wrap` im Stilblock darunter, nicht ein Zerlegen in
		Absatz-Elemente: das Zerlegen wäre eine zweite Auslegung derselben Umbrüche
		neben der Faltung in $lib/blatttext.ts, und die zwei liefen auseinander.
	-->
	<p class="blatt__text">{data.blatt.text}</p>

	<!--
		Das Ändern. Dieselbe geteilte `.zeilenform` wie das Anlegen nebenan — vierte
		Wurfstelle nach /verwaltung, /dienstplan und /wissen. Literales
		action="?/aendern" wegen Gate-Regel 11.

		**Die Id steht in keinem versteckten Feld.** Sie kommt aus dem Pfad, den die
		action über `params` liest; ein Feld daneben wäre eine zweite Wahrheit
		darüber, welches Blatt gemeint ist.
	-->
	<details class="zeilenform" open={abgewiesen}>
		<summary class="zeilenform__griff">Ändern</summary>
		<form class="zeilenform__formular" method="POST" action="?/aendern" use:enhance={versand}>
			<div>
				<label class="feld__beschriftung" for="aendern-titel">Titel</label>
				<input
					class="feld"
					id="aendern-titel"
					name="titel"
					type="text"
					required
					maxlength={data.titelGrenze}
					value={titelWert}
					aria-invalid={fehlerAmTitel !== '' ? 'true' : undefined}
					aria-describedby={fehlerAmTitel !== '' ? 'aendern-titel-fehler' : undefined}
				/>
				<p class="fehler live" id="aendern-titel-fehler" role="alert" aria-live="assertive">
					{fehlerAmTitel}
				</p>
			</div>
			<div>
				<label class="feld__beschriftung" for="aendern-text">Text</label>
				<!--
					**Der führende Umbruch ist Pflicht und kein Tippfehler.** Ein HTML-Parser
					verwirft den ersten Zeilenumbruch direkt nach dem Textfeld-Starttag. Ohne
					den zusätzlichen käme ein zurückgetragener Text, der mit einer Leerzeile
					beginnt, um genau diese Zeile gekürzt zurück — und der ganze Grund für
					`zweiteEingabe` lautet, dass nichts verlorengeht. Der gespeicherte Stand
					ist davon nicht betroffen, weil `blatttextFalten` aussen trimmt; die
					**rohe** Eingabe nach einer Abweisung ist es. Zwei Reviewer haben die
					Stelle unabhängig gefunden.
				-->
				<textarea
					class="feld textfeld"
					id="aendern-text"
					name="text"
					required
					maxlength={data.textGrenze}
					aria-invalid={fehlerAmText !== '' ? 'true' : undefined}
					aria-describedby={fehlerAmText !== '' ? 'aendern-text-fehler' : undefined}
					>{'\n' + textWert}</textarea
				>
				<p class="fehler live" id="aendern-text-fehler" role="alert" aria-live="assertive">
					{fehlerAmText}
				</p>
			</div>
			<button class="button-quiet" type="submit" disabled={imFlug}>Ablegen</button>
		</form>
	</details>

	<!--
		Der Weg zurück zur Liste. **Kein Zurück-Pfeil in der Titelleiste** — die
		Systemgeste des Browsers genügt, und die Leiste unten führt ohnehin nach
		/wissen. Dieser Satz steht trotzdem: wer über den Link aus dem Anlegen hier
		gelandet ist, hat noch keine Liste gesehen.
	-->
	<p class="hinweis">
		<a href={resolve('/wissen')}>Alle Blätter</a>
	</p>
</div>

<style>
	/*
		Der Freitext eines Blatts.

		`pre-wrap` ist die ganze Formatierungszusage der Story: Absätze und
		Zeilenumbrüche bleiben, wie sie getippt wurden, und alles andere bleibt
		Fliesstext, der bei 375px umbricht. `pre` ohne `-wrap` würde nicht
		umbrechen und die Seite waagerecht sprengen.

		`overflow-wrap: anywhere` für den Fall, den `pre-wrap` allein nicht löst:
		ein Wort ohne Trennstelle — eine lange Adresse, ein lateinischer
		Pflanzenname mit Bindestrichen ohne Leerzeichen — liefe sonst über die
		Kante hinaus.

		**Bleibt lokal und geht nicht ins geteilte Blatt**, und das ist gemessen:
		es hat genau einen Leser, und Gate-Regel 14 verlangt für jede Klasse dort
		mindestens einen Benutzer, nicht umgekehrt. Der Regelkörper ist ausserdem
		keiner geteilten Regel gleich — `.fliesstext` setzt weder `white-space`
		noch `overflow-wrap`.
	*/
	.blatt__text {
		margin: 0;
		color: var(--ink-primary);
		font-family: var(--body-font);
		font-size: var(--body-size);
		font-weight: var(--body-weight);
		line-height: var(--body-line);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
