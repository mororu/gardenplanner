<script lang="ts">
	import { enhance } from '$app/forms';
	// SubmitFunction kommt aus @sveltejs/kit, nicht aus $app/forms: dort ist nur
	// enhance selbst ausgeführt, der Typ liegt im Hauptmodul.
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageProps } from './$types';
	import { VERSAND_FEHLGESCHLAGEN } from '$lib/texte';

	const { data, form }: PageProps = $props();

	/*
		Eine Sperre für die Seite, plus die zwei Riegel aus Story 1.3: `disabled`
		am Knopf ist der sichtbare und der für die Tastatur wirksame, greift aber
		erst mit dem nächsten Rendern; `cancel()` im Rückruf deckt das Fenster
		davor ab. Zwei Antippen auf einem langsamen Telefon schrieben sonst
		dieselbe Einzelaufgabe zweimal aus, und es gibt keine Löschen-Aktion, die
		das wieder aufräumte.
	*/
	let imFlug = $state(false);

	/*
		Ein Wurf in einer action, abgefangen im Rückruf unten statt an die
		Fehlergrenze weitergereicht. Eigener Zustand und nicht aus `form`
		abgeleitet: bei `result.type === 'error'` läuft update() gar nicht, `form`
		bleibt also auf dem Stand davor stehen. Der nächste Versand setzt ihn
		zurück — der neue Ausgang ist der jüngere und gewinnt.
	*/
	let versandFehler = $state('');

	/**
	 * Der Termin im Zustand der Komponente.
	 *
	 * Der Titel reist nach einem abgewiesenen Versand über `form.eingabe` zurück;
	 * für einen **zweiten** Wert hat die geteilte Form von `abweisen` keinen
	 * Platz, und sie dafür aufzuweiten wäre der teurere Handel — sie ist die eine
	 * Form für inzwischen sechs Seiten.
	 *
	 * Mit JavaScript hält dieser Zustand das Feld, und `update({ reset: false })`
	 * unten lässt es stehen. **Ohne JavaScript ist der Termin nach einer
	 * Abweisung leer**, und das ist benannt und hingenommen: das Feld trägt
	 * `required`, `min` und `max`, und diese drei prüft der Browser von sich aus,
	 * ohne JavaScript. Die zwei serverseitigen Termin-Sätze sind darum die
	 * Auffanglinie für einen gebauten POST, nicht der übliche Weg — anders als
	 * beim Titel, den ein Feld aus lauter unsichtbaren Zeichen glatt passieren
	 * lässt.
	 */
	let termin = $state('');

	/** Die Meldung am Titelfeld. */
	const fehlerAmTitel = $derived(
		form !== null && form.art === 'fehler' && form.feld === 'titel' ? form.meldung : ''
	);

	/** Die Meldung am Terminfeld. */
	const fehlerAmTermin = $derived(
		form !== null && form.art === 'fehler' && form.feld === 'termin' ? form.meldung : ''
	);

	/** Der Titel bleibt nach einem Fehlschlag stehen — auch ohne JavaScript. */
	const titelEingabe = $derived(form !== null && form.art === 'fehler' ? form.eingabe : '');

	/**
	 * Was die Live-Region zeigt: der Wurf gewinnt, sonst die Meldung des Felds,
	 * das sie trägt.
	 *
	 * **Eine** Region für beide Felder, und sie steht unter ihnen. Die Zuordnung
	 * zum Feld macht `aria-describedby` und die breitere Kante über
	 * `aria-invalid`; die Region sagt an, was der Server geantwortet hat.
	 */
	const fehlersatz = $derived(
		versandFehler !== '' ? versandFehler : fehlerAmTitel !== '' ? fehlerAmTitel : fehlerAmTermin
	);

	/**
	 * Der Rückruf ruft update() — und fängt davor den einen Fall ab, in dem er es
	 * nicht darf: einen Wurf in der action.
	 *
	 * Den Redirect erledigt use:enhance darin von selbst: das gereichte update()
	 * ist der Rückfall-Rückruf, und der ruft bei einem Ergebnis vom Typ
	 * `redirect` applyAction(), was wiederum mit invalidateAll: true auf `/`
	 * navigiert. Die load von `/` läuft damit frisch, und die eben
	 * ausgeschriebene Einzelaufgabe steht in Block 2 (AD-7).
	 *
	 * `reset: false`, damit der Termin im Feld stehenbleibt — siehe oben. Bei der
	 * Weiterleitung spielt es keine Rolle, die Komponente ist dann verlassen.
	 *
	 * **Kein Fokuswechsel danach**, wie auf /aufgabe: nach dem geglückten Versand
	 * ist diese Komponente verlassen, ein fokusNach liefe ins Leere. Die Ansage
	 * übernimmt die Live-Region auf `/`, die dort beim Ankommen mit
	 * `?ausgeschrieben` einmalig den Fokus nimmt.
	 */
	const versand: SubmitFunction = ({ cancel }) => {
		if (imFlug) {
			cancel();
			return;
		}
		imFlug = true;
		versandFehler = '';
		return async ({ update, result }) => {
			/*
				try/finally und nicht zwei Zeilen hintereinander: bricht update() ab —
				ein abgerissenes Netz, ein Fehler in applyAction —, bliebe imFlug sonst
				für immer true. Der einzige Knopf dieser Seite wäre dann dauerhaft
				disabled, und nur ein Neuladen käme da wieder heraus. Dieselbe
				Absicherung wie in aufgabe/+page.svelte, wo sie zuerst entstand.
			*/
			try {
				/*
					Ein Wurf in der action kommt als `result.type === 'error'` zurück, und
					das gereichte update() reicht ihn an applyAction weiter — die
					Fehlergrenze ersetzte dann die Seite. Statt dessen ein Satz in der
					Live-Region, die hier ohnehin steht. Der Wurf selbst bleibt unberührt:
					er hat handleError auf dem Server längst erreicht. Einheitlich auf allen
					Seiten, entschieden am 2026-08-28 zu Eintrag 32 der zurückgestellten
					Arbeit.
				*/
				if (result.type === 'error') {
					versandFehler = VERSAND_FEHLGESCHLAGEN;
				} else {
					await update({ reset: false });
				}
			} finally {
				imFlug = false;
			}
		};
	};
</script>

<svelte:head>
	<title>Einzelaufgabe</title>
</svelte:head>

<!--
	/einzelaufgabe — Titel und Termin, mehr nicht.

	Kein Feld für einen Übernehmer: wer ausschreibt, sagt nichts zu. Das
	Übernehmen ist ein eigener Vorgang auf `/` und trägt dort seine eigene
	Bestätigung — das ist der Unterschied zwischen „das muss jemand tun" und „ich
	tue es".

	Und **kein Zurück-Knopf** — eine Formularseite schliesst mit ihrer Aktion und
	leitet auf die Liste zurück; die Systemgeste des Browsers genügt.
-->
<div class="seite">
	<h1 class="seitentitel">Einzelaufgabe</h1>

	<!--
		Literales action="?/ausschreiben", nicht dynamisch: Gate-Regel 11 liest den
		Namen textuell und vergleicht ihn mit den actions der Nachbardatei.
	-->
	<form class="erfassen" method="POST" action="?/ausschreiben" use:enhance={versand}>
		<div>
			<!--
				Eine sichtbare Beschriftung und **kein** Platzhalter: ein Platzhalter
				verschwindet beim Tippen, und wer dann unterbrochen wird, weiss nicht
				mehr, was in das Feld gehört.

				Ein einzeiliges <input> und kein <textarea>: ein Titel ist ein Satz,
				kein Absatz — dieselbe Auslegung wie auf /aufgabe und dieselbe
				Längengrenze.
			-->
			<label class="feld__beschriftung" for="titel">Was ist zu tun?</label>
			<input
				class="feld"
				id="titel"
				name="titel"
				type="text"
				autocomplete="off"
				required
				maxlength={data.titelGrenze}
				value={titelEingabe}
				aria-invalid={fehlerAmTitel === '' ? undefined : 'true'}
				aria-describedby={fehlerAmTitel === '' ? undefined : 'ausschreiben-fehler'}
			/>
		</div>

		<div>
			<!--
				`min` und `max` kommen aus der load und tragen dasselbe Fenster wie die
				Prüfung in der action: ein Jahr in jede Richtung. Der Browser wehrt
				damit ohne JavaScript ab, was der Server sonst abweisen müsste — die
				zwei Sätze dort bleiben trotzdem, denn ein POST braucht kein Formular.
			-->
			<label class="feld__beschriftung" for="termin">Bis wann?</label>
			<input
				class="feld"
				id="termin"
				name="termin"
				type="date"
				required
				min={data.terminFrueheste}
				max={data.terminSpaeteste}
				bind:value={termin}
				aria-invalid={fehlerAmTermin === '' ? undefined : 'true'}
				aria-describedby={fehlerAmTermin === '' ? undefined : 'ausschreiben-fehler'}
			/>
		</div>

		<!--
			Der Satz hängt über aria-describedby an dem Feld, das ihn ausgelöst hat,
			und dessen Kante wird über aria-invalid breiter: der Zustand hängt nicht
			allein an der Farbe. Die Kante ist ausdrücklich nicht rot — Rot bleibt dem
			Zerstörenden vorbehalten (siehe src/lib/styles/bedienelemente.css).

			Und er steht **immer** im Markup, auch leer — dasselbe Hausmuster wie die
			zwei Live-Regionen auf `/`. Bedingt gerendert wäre er ein Element, das
			erst mit seinem Text in den DOM kommt, und das liest ein Screenreader in
			der Regel nicht vor. Leer nimmt er keinen Platz ein — die :empty-Regel im
			geteilten Stilblatt nimmt ihn aus dem Fluss.

			`assertive` und nicht `polite`: der Satz ist die Antwort auf einen eben
			abgeschickten Versand, und er wird von nichts anderem überholt.
		-->
		<p class="fehler live" id="ausschreiben-fehler" role="alert" aria-live="assertive">
			{fehlersatz}
		</p>

		<!-- Der einzige primäre Knopf dieser Seite. Sein Verb kehrt als Meldung
		     `Ausgeschrieben.` auf `/` wieder. -->
		<button class="button-primary" type="submit" disabled={imFlug}>Ausschreiben</button>
	</form>
</div>

<style>
	.erfassen {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
</style>
