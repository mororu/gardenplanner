<script lang="ts">
	import { enhance } from '$app/forms';
	// SubmitFunction kommt aus @sveltejs/kit, nicht aus $app/forms: dort ist nur
	// enhance selbst ausgeführt, der Typ liegt im Hauptmodul.
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageProps } from './$types';

	const { form }: PageProps = $props();

	/*
		Eine Sperre für die Seite, plus die zwei Riegel aus Story 1.3: `disabled`
		am Knopf ist der sichtbare und der für die Tastatur wirksame, greift aber
		erst mit dem nächsten Rendern; `cancel()` im Rückruf deckt das Fenster
		davor ab. Zwei Antippen auf einem langsamen Telefon legten sonst zwei
		gleichlautende Aufgaben an, und es gibt keine Löschen-Aktion, die das
		wieder aufräumte.
	*/
	let imFlug = $state(false);

	/** Die Meldung am Feld. Sie ist die einzige, die diese Seite selbst zeigt. */
	const fehlerAmText = $derived(form !== null && form.art === 'fehler' ? form.meldung : '');

	/** Die Eingabe bleibt nach einem Fehlschlag stehen. */
	const eingabe = $derived(form !== null && form.art === 'fehler' ? form.eingabe : '');

	/**
	 * Der Rückruf ruft **nur** update().
	 *
	 * Den Redirect erledigt use:enhance darin von selbst: das gereichte update()
	 * ist der Rückfall-Rückruf, und der ruft bei einem Ergebnis vom Typ
	 * `redirect` applyAction(), was wiederum mit invalidateAll: true auf `/`
	 * navigiert. Die load von `/` läuft damit frisch, und die eben abgelegte
	 * Aufgabe steht in der Liste (AD-7). Ein eigenes applyAction wäre eine
	 * Verdopplung.
	 *
	 * **Kein Fokuswechsel danach**, anders als in Story 1.3: nach dem geglückten
	 * Versand ist diese Komponente verlassen, ein fokusNach liefe ins Leere. Die
	 * Ansage übernimmt die Live-Region auf `/`, die dort beim Ankommen mit
	 * `?abgelegt` einmalig den Fokus nimmt.
	 */
	const versand: SubmitFunction = ({ cancel }) => {
		if (imFlug) {
			cancel();
			return;
		}
		imFlug = true;
		return async ({ update }) => {
			/*
				try/finally und nicht zwei Zeilen hintereinander: bricht update()
				ab — ein abgerissenes Netz, ein Fehler in applyAction —, bliebe
				imFlug sonst für immer true. Der einzige Knopf dieser Seite wäre
				dann dauerhaft disabled, und nur ein Neuladen käme da wieder
				heraus. Auf einer Seite mit genau einem Knopf ist das der
				Unterschied zwischen einer verlorenen Eingabe und einer toten
				Seite.
			*/
			try {
				await update();
			} finally {
				imFlug = false;
			}
		};
	};
</script>

<svelte:head>
	<title>Aufgabe</title>
</svelte:head>

<!--
	/aufgabe — ein Feld, ein Knopf, keine Wahl.

	Kein Fälligkeitsdatum, keine Kategorie, kein Beet, keine Priorität, kein
	Zuständiger, kein zweites Feld: wer im Beet steht, tippt einen Satz und ist
	fertig. Und **kein Zurück-Knopf** — eine Formularseite schliesst mit ihrer
	Aktion und leitet auf die Liste zurück; die Systemgeste des Browsers genügt.
-->
<div class="seite">
	<h1 class="seitentitel">Aufgabe</h1>

	<!--
		Literales action="?/ablegen", nicht dynamisch: Gate-Regel 11 liest den
		Namen textuell und vergleicht ihn mit den actions der Nachbardatei.

		Ein einzeiliges <input> und kein <textarea>: eine Aufgabe ist ein Satz,
		kein Absatz, und die Eingabetaste legt sie ab — im Garten, mit
		Handschuhen, ist das ein Griff weniger. Das mehrzeilige Feld gehört zur
		Massen-Eingabe einer späteren Story.
	-->
	<form class="erfassen" method="POST" action="?/ablegen" use:enhance={versand}>
		<div>
			<!--
				Eine sichtbare Beschriftung und **kein** Platzhalter: ein Platzhalter
				verschwindet beim Tippen, und wer dann unterbrochen wird, weiss nicht
				mehr, was in das Feld gehört.
			-->
			<label class="feld__beschriftung" for="text">Was ist zu tun?</label>
			<input
				class="feld"
				id="text"
				name="text"
				type="text"
				autocomplete="off"
				required
				maxlength="200"
				value={eingabe}
				aria-invalid={fehlerAmText === '' ? undefined : 'true'}
				aria-describedby={fehlerAmText === '' ? undefined : 'text-fehler'}
			/>
		</div>
		<!--
			Der Satz hängt über aria-describedby am Feld, und die Feldkante wird
			über aria-invalid breiter: der Zustand hängt nicht allein an der Farbe.
			Die Kante ist ausdrücklich nicht rot — Rot bleibt dem Zerstörenden
			vorbehalten (siehe src/lib/styles/bedienelemente.css).

			Und er steht **immer** im Markup, auch leer — dasselbe Hausmuster wie
			die zwei Live-Regionen auf `/`. Bedingt gerendert wäre er ein Element,
			das erst mit seinem Text in den DOM kommt, und das liest ein
			Screenreader in der Regel nicht vor: mit use:enhance gibt es keine
			Navigation, die den Fehlschlag ansagte, und der Fokus bleibt am Knopf.
			Leer nimmt er keinen Platz ein — die :empty-Regel unten nimmt ihn aus
			dem Fluss, statt ihn mit display: none aus dem Baum zu werfen.

			`assertive` und nicht `polite`: der Satz ist die Antwort auf einen
			eben abgeschickten Versand, und er wird von nichts anderem überholt.
		-->
		<p class="fehler live" id="text-fehler" role="alert" aria-live="assertive">{fehlerAmText}</p>
		<!-- Der einzige primäre Knopf dieser Seite. Sein Verb kehrt als Meldung
		     `Abgelegt.` auf `/` wieder. -->
		<button class="button-primary" type="submit" disabled={imFlug}>Ablegen</button>
	</form>
</div>

<style>
	/*
		.seite und .seitentitel stehen pro Seite und nicht global: sie sind die
		Seitenform, kein Bedienelement, und eine dritte Kopie ist billiger als ein
		Stilblatt, das jede Seite mitzieht.
	*/
	.seite {
		display: flex;
		flex-direction: column;
		/* Abstand zwischen Geschwistern über gap, nie über Aussenabstände */
		gap: var(--space-4);
	}

	/* Genau ein h1 pro Seite, und nur dieses trägt die display-Rolle */
	.seitentitel {
		margin: 0;
		color: var(--ink-primary);
		font-family: var(--display-font);
		font-size: var(--display-size);
		font-weight: var(--display-weight);
		line-height: var(--display-line);
		letter-spacing: var(--display-tracking);
	}

	.erfassen {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	/*
		Eine leere Live-Region bleibt im Baum und verlässt nur den Fluss. Mit
		display: none wäre sie für einen Teil der Hilfsmittel gar nicht vorhanden
		und die Ansage fiele wieder aus. Wortgleich mit der Regel auf `/`.
	*/
	.live:empty {
		position: absolute;
		block-size: 0;
		inline-size: 0;
		overflow: hidden;
	}

	/*
		Der Fehlersatz ist keine Farbaussage: er steht als Satz da und trägt darum
		die gewöhnliche Textfarbe.
	*/
	.fehler {
		margin: 0;
		color: var(--ink-primary);
		font-family: var(--body-font);
		font-size: var(--body-size);
		font-weight: var(--body-weight);
		line-height: var(--body-line);
	}
</style>
