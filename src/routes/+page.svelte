<script lang="ts">
	import { enhance } from '$app/forms';
	// SubmitFunction kommt aus @sveltejs/kit, nicht aus $app/forms: dort ist nur
	// enhance selbst ausgeführt, der Typ liegt im Hauptmodul.
	import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();

	/*
		Welche Zeilen in **dieser Sitzung** abgehakt wurden.

		Die sichtbare Erledigt-Darstellung hängt an diesem Zustand und **nicht** am
		`checked` des DOM-Kästchens. Das ist die zweite von zwei unabhängigen
		Sicherungen für die eine Zusage dieser Story — die Zeile bleibt an ihrem
		Platz stehen:

		  1. Der Rückruf unten ruft update({ reset: false, invalidateAll: false }).
		     Beide Vorgaben von use:enhance sind `true`, und beide würden die Zeile
		     wegnehmen: invalidateAll lädt die Liste neu (und die abgehakte Aufgabe
		     ist dann keine offene mehr), reset ruft form.reset() und setzte das
		     Kästchen auf seinen serverseitig gerenderten Zustand zurück, also auf
		     leer.
		  2. Selbst wenn eine dieser Vorgaben je zurückkäme, entscheidet dieser
		     Zustand über die Darstellung. Eine einzige Sicherung wäre eine stille
		     Zusage: sie stünde in einem Argument, das jemand beim nächsten
		     Anfassen als Rauschen entfernt.

		Der Zustand lebt nur so lange wie die Komponente. Ein Neuladen ist ein GET,
		und die abgehakte Zeile ist dann fort — für alle.
	*/
	let erledigt = $state<number[]>([]);

	/*
		Eine Sperre für die ganze Seite, plus die zwei Riegel aus Story 1.3:
		`disabled` am Kästchen ist der sichtbare und der für die Tastatur
		wirksame, greift aber erst mit dem nächsten Rendern; `cancel()` im Rückruf
		deckt das Fenster davor ab. Seitenweit und nicht je Zeile, weil bei einer
		Handvoll Aufgaben ein Doppelgriff über zwei Zeilen derselbe Fehler ist wie
		zweimal auf dieselbe.
	*/
	let imFlug = $state(false);

	/**
	 * Die Rückmeldung im Perfekt desselben Verbs, für die höfliche Live-Region.
	 *
	 * Zwei Quellen, eine Region. Ein Ausgang aus `form` gewinnt, weil er der
	 * jüngere ist: wer nach dem Ablegen abhakt, liest `Abgehakt. …` und nicht
	 * mehr die Bestätigung des Ablegens — die Adresse trägt `?abgelegt` dann zwar
	 * noch, aber sie beschreibt nicht mehr das Letzte, was geschehen ist.
	 */
	const rueckmeldung = $derived.by(() => {
		if (form === null) return data.abgelegt ? 'Abgelegt.' : '';
		if (form.art === 'abgehakt' || form.art === 'wiederGeoeffnet') {
			return `${form.meldung} ${form.text}`;
		}
		return '';
	});

	/** Der eine Satz für alle vier nicht ansprechbaren Zustände. */
	const fehlerOben = $derived(form !== null && form.art === 'fehler' ? form.meldung : '');

	let meldungKasten = $state<HTMLElement | null>(null);

	/*
		Der Fokus wird **genau einmal** geholt, und dieses Flag ist der Grund, dass
		es dabei bleibt. Es ist bewusst kein $state: gelesen wird es untracked,
		und es soll kein Rendern auslösen.
	*/
	let fokusGeholt = false;

	/**
	 * Beim Ankommen mit `?abgelegt` nimmt die Live-Region einmalig den Fokus.
	 *
	 * Eine Live-Region sagt nur **Änderungen** an. Nach dem Ablegen ist `/` eine
	 * frisch gemountete Route: `Abgelegt.` steht von Anfang an im Markup und
	 * bliebe ohne diesen Griff stumm. Das ist derselbe Grund, aus dem Story 1.3
	 * nach `aufnehmen` den Fokus setzt.
	 *
	 * Und ausdrücklich **nicht** nach dem Abhaken: dort bleibt der Daumen auf dem
	 * Kästchen, und ein Sprung liesse den nächsten Griff die falsche Zeile
	 * treffen. `form !== null` ist genau diese Grenze — nach einem Versand ist
	 * die Eigenschaft gesetzt, beim Ankommen ist sie null.
	 *
	 * `meldungKasten === null` steht **vor** dem Setzen des Flags und nicht als
	 * `?.` danach: ein Durchlauf ohne gebundenes Element verbrauchte sonst das
	 * Einmal-Flag, der Fokus würde nie geholt, und `Abgelegt.` bliebe stumm —
	 * ein stiller Ausfall, den niemand sieht.
	 */
	$effect(() => {
		if (fokusGeholt || !data.abgelegt || form !== null || meldungKasten === null) return;
		fokusGeholt = true;
		meldungKasten.focus();
	});

	/**
	 * Der `art`-Diskriminator eines Ausgangs.
	 *
	 * Aus `result` und nicht aus `form` — im Rückruf ist die Eigenschaft von
	 * aussen noch die alte. Dasselbe Muster wie fokusNach in
	 * ../verwaltung/+page.svelte.
	 */
	function artVon(ergebnis: ActionResult): string {
		const daten =
			ergebnis.type === 'success' || ergebnis.type === 'failure'
				? (ergebnis.data as { art?: unknown } | undefined)
				: undefined;
		return typeof daten?.art === 'string' ? daten.art : '';
	}

	/** Übernimmt den Ausgang in den Sitzungszustand. Gibt zurück, ob er sich änderte. */
	function zustandUebernehmen(ergebnis: ActionResult, id: number): boolean {
		const art = artVon(ergebnis);
		if (art === 'abgehakt' && !erledigt.includes(id)) {
			erledigt.push(id);
			return true;
		}
		if (art === 'wiederGeoeffnet' && erledigt.includes(id)) {
			erledigt = erledigt.filter((abgehakt) => abgehakt !== id);
			return true;
		}
		return false;
	}

	/**
	 * Zieht das Kästchen auf den Zustand zurück.
	 *
	 * Gebraucht genau dann, wenn der Zustand **gleich** geblieben ist: ein
	 * abgewiesener oder ein abgebrochener Versand lässt das Kästchen im DOM
	 * umgeschaltet stehen, während die Aufgabe unverändert ist. Ohne diese Zeile
	 * zeigte die Zeile einen Haken, den der Server nicht kennt — genau die Lüge,
	 * die diese Story vermeiden will. Beim geglückten Versand wechselt statt
	 * dessen der if-Zweig, und das Kästchen entsteht neu im richtigen Zustand.
	 */
	function kaestchenNachZustand(formular: HTMLFormElement, id: number): void {
		const kaestchen = formular.querySelector('input[type="checkbox"]');
		if (kaestchen instanceof HTMLInputElement) {
			kaestchen.checked = erledigt.includes(id);
		}
	}

	/**
	 * Der Rückruf je Zeile. Die Id kommt aus der Closure, damit der Zustand
	 * ohne Umweg über den DOM getroffen wird.
	 *
	 * **Kein Fokuswechsel danach**, anders als in Story 1.3: der Daumen bleibt
	 * auf dem Kästchen, und ein Sprung liesse den nächsten Griff die falsche
	 * Zeile treffen. Die Live-Region sagt den Ausgang an, ohne den Fokus zu
	 * holen.
	 */
	function versandFuer(id: number): SubmitFunction {
		return ({ cancel, formElement }) => {
			if (imFlug) {
				cancel();
				kaestchenNachZustand(formElement, id);
				return;
			}
			imFlug = true;
			return async ({ update, result }) => {
				// Beide Vorgaben ausdrücklich aus: siehe die Begründung an `erledigt`.
				await update({ reset: false, invalidateAll: false });
				const gewechselt = zustandUebernehmen(result, id);
				imFlug = false;
				if (!gewechselt) kaestchenNachZustand(formElement, id);
			};
		};
	}

	/**
	 * Ein Antippen des Kästchens schickt sein Formular ab. Genau eine
	 * Interaktion: kein Knopf daneben, keine Rückfrage.
	 */
	function abschicken(ereignis: Event & { currentTarget: HTMLInputElement }): void {
		ereignis.currentTarget.form?.requestSubmit();
	}
</script>

<svelte:head>
	<title>Aufgaben</title>
</svelte:head>

<div class="seite">
	<h1 class="seitentitel">Aufgaben</h1>

	<!--
		Die zwei Live-Regionen stehen **immer** im Markup, auch leer: ein Element,
		das erst mit seinem Text in den DOM kommt, liest ein Screenreader in der
		Regel nicht vor. Leer nehmen beide keinen Platz ein — die :empty-Regel
		unten nimmt sie aus dem Fluss, statt sie mit display: none aus dem Baum zu
		werfen.

		Der Fokus wird hier in **einem** Fall geholt und in allen anderen nicht:

		  - beim Ankommen von /aufgabe mit `?abgelegt`, weil die Seite dann frisch
		    gemountet ist und eine Live-Region nur Änderungen ansagt — darum trägt
		    die Meldungsregion ein tabindex="-1" (siehe den Effekt oben);
		  - **nicht** nach dem Abhaken und nicht nach dem Wieder-Öffnen: dort
		    bleibt der Daumen auf dem Kästchen, und ein Sprung liesse den nächsten
		    Griff die falsche Zeile treffen.

		Die Fehlerregion holt den Fokus nie: sie meldet einen Ausgang eines
		Versands, und der Daumen soll auch dann bleiben, wo er ist.
	-->
	<p class="meldung live" role="status" aria-live="polite" tabindex="-1" bind:this={meldungKasten}>
		{rueckmeldung}
	</p>
	<p class="fehler live" role="alert" aria-live="assertive">{fehlerOben}</p>

	<!--
		Die Startseite führt genau drei Blöcke in dieser Reihenfolge (AD-14):

		  Block 1 — Diensthinweis: „Diese Woche bist du am Tränken", nur vorhanden,
		            wenn die betrachtende Person Dienst hat. Kommt mit Epic 3
		            (duty_weeks) und rendert hier nichts.
		  Block 2 — freie Einzelaufgaben zum Übernehmen. Kommt mit Epic 3
		            (signup_tasks) und rendert hier nichts.
		  Block 3 — der offene Pool. Diesen füllt diese Story.

		Die Reihenfolge steht jetzt, obwohl zwei Drittel leer sind: sie ist eine
		Entscheidung über die Aufmerksamkeit im Garten und keine Folge davon, in
		welcher Reihenfolge die Stories gebaut wurden.
	-->

	<h2 class="marke" id="offen-marke">Offen</h2>
	{#if data.aufgaben.length === 0}
		<!-- Der leere Zustand sagt, was gilt — der Erfassen-Knopf steht unter dem
		     {#if}, also auch hier darunter. -->
		<p class="leer">Nichts offen.</p>
	{:else}
		<ul class="liste" aria-labelledby="offen-marke">
			{#each data.aufgaben as aufgabe (aufgabe.id)}
				{@const istErledigt = erledigt.includes(aufgabe.id)}
				<li class="zeile" class:zeile--erledigt={istErledigt}>
					<!--
						Zwei getrennte Formulare mit **literalem** action, bedingt
						gerendert — nicht ein Formular mit wechselndem Ziel. Gate-Regel 11
						liest action="?/name" textuell und vergleicht mit den actions der
						Nachbardatei; ein dynamisches action={…} würde sie blind machen.

						Das Kästchen ist ein echtes <input type="checkbox">, kein <div> mit
						Klick-Handler, und trägt **kein** <label for>: ein Label schaltet
						sein Bedienelement, und damit wäre der Aufgabentext antippbar — im
						Beet der Weg zur versehentlich erledigten Aufgabe. Die Beschriftung
						entsteht über aria-labelledby auf dem Kästchen, das auf den
						sichtbaren Text **und** ein verborgenes Verb zeigt: der Screenreader
						liest „<Aufgabentext>, erledigen" mit der Rolle Kontrollkästchen,
						und der Text bleibt ein toter <span>.
					-->
					{#if istErledigt}
						<form
							class="zeile__form"
							method="POST"
							action="?/wiederOeffnen"
							use:enhance={versandFuer(aufgabe.id)}
						>
							<input type="hidden" name="aufgabeId" value={aufgabe.id} />
							<span class="treffer">
								<input
									class="kaestchen"
									type="checkbox"
									checked
									disabled={imFlug}
									aria-labelledby="aufgabe-{aufgabe.id} verb-{aufgabe.id}"
									onchange={abschicken}
								/>
								<span class="haken" aria-hidden="true"></span>
							</span>
							<span class="nur-vorgelesen" id="verb-{aufgabe.id}">, wieder öffnen</span>
						</form>
					{:else}
						<form
							class="zeile__form"
							method="POST"
							action="?/abhaken"
							use:enhance={versandFuer(aufgabe.id)}
						>
							<input type="hidden" name="aufgabeId" value={aufgabe.id} />
							<span class="treffer">
								<input
									class="kaestchen"
									type="checkbox"
									disabled={imFlug}
									aria-labelledby="aufgabe-{aufgabe.id} verb-{aufgabe.id}"
									onchange={abschicken}
								/>
								<span class="haken" aria-hidden="true"></span>
							</span>
							<span class="nur-vorgelesen" id="verb-{aufgabe.id}">, erledigen</span>
						</form>
					{/if}
					<span class="zeile__text" id="aufgabe-{aufgabe.id}">{aufgabe.text}</span>
				</li>
			{/each}
		</ul>
	{/if}

	<!--
		Der Erfassen-Knopf steht **hinter** dem {#if}/{:else} und damit in beiden
		Zuständen unter dem Pool — auch unter `Nichts offen.`.

		Ein <a> und kein <button>: er navigiert nur, er tut nichts. .button-primary
		trägt text-decoration: none und appearance: none und wirkt darum auch auf
		einem Anker. resolve() ist für interne Ziele Pflicht
		(svelte/no-navigation-without-resolve).

		Der einzige primäre Knopf dieser Seite: die Kästchen sind Kästchen, und es
		gibt daneben keinen zweiten Knopf.
	-->
	<a class="button-primary" href={resolve('/aufgabe')}>+ Aufgabe</a>
</div>

<style>
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

	/*
		Die Abschnittsmarke in der label-Rolle: 12px, Grossbuchstaben über
		text-transform. Im Markup steht `Offen` und nicht `OFFEN` — ein
		Screenreader liest Grossbuchstaben mancher Stimmen buchstabierend vor, und
		die Grossschreibung ist eine Gestaltungsaussage, keine des Textes.

		Zugleich über aria-labelledby der zugängliche Name der Liste: sie heisst
		dann „Offen" und nicht „Liste mit 4 Einträgen".
	*/
	.marke {
		margin: 0;
		color: var(--ink-secondary);
		font-family: var(--label-font);
		font-size: var(--label-size);
		font-weight: var(--label-weight);
		line-height: var(--label-line);
		letter-spacing: var(--label-tracking);
		text-transform: uppercase;
	}

	.leer {
		margin: 0;
		color: var(--ink-secondary);
		font-family: var(--body-font);
		font-size: var(--body-size);
		font-weight: var(--body-weight);
		line-height: var(--body-line);
	}

	.meldung {
		margin: 0;
		color: var(--accent);
		font-family: var(--body-font);
		font-size: var(--body-size);
		font-weight: var(--body-weight);
		line-height: var(--body-line);
	}

	/*
		Der Fehlersatz ist keine Farbaussage: er steht als Satz da und trägt darum
		die gewöhnliche Textfarbe. Rot ist in dieser Anwendung dem zerstörenden
		Knopf vorbehalten.
	*/
	.fehler {
		margin: 0;
		color: var(--ink-primary);
		font-family: var(--body-font);
		font-size: var(--body-size);
		font-weight: var(--body-weight);
		line-height: var(--body-line);
	}

	/*
		Eine leere Live-Region bleibt im Baum und verlässt nur den Fluss. Mit
		display: none wäre sie für einen Teil der Hilfsmittel gar nicht vorhanden
		und die Ansage fiele wieder aus.
	*/
	.live:empty {
		position: absolute;
		block-size: 0;
		inline-size: 0;
		overflow: hidden;
	}

	.liste {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/*
		Kästchen links, Text rechts. Trennung zur nächsten Zeile durch Haarlinie
		oben; die erste hat keine.

		flex-start und nicht center: ein zweizeiliger Aufgabentext soll oben am
		Kästchen beginnen und nicht um dessen Mitte herum stehen.
	*/
	.zeile {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		min-height: var(--touch);
		padding: var(--space-3) 0;
		border-top: var(--border-hairline) solid var(--hairline);
	}

	.zeile:first-child {
		border-top: 0;
	}

	/* Das Formular ist nur der Träger des Kästchens und nimmt keine Breite. */
	.zeile__form {
		display: flex;
		flex: none;
	}

	/*
		Das Trefferfeld: 44px gross, obwohl das Kästchen 22px zeigt.

		Die negativen Aussenabstände ziehen die Differenz wieder heraus, sodass die
		Zeilenhöhe **nicht** wächst — sonst wäre jede Zeile 44px plus Innenabstand
		hoch und die Liste doppelt so lang. Nach links greift das Feld in den
		Seitenrand (--gutter, 16px) hinein: der Daumen findet dort mehr Fläche, und
		das Kästchen selbst bleibt am linken Rand der Spalte ausgerichtet.
	*/
	.treffer {
		position: relative;
		display: flex;
		flex: none;
		align-items: center;
		justify-content: center;
		inline-size: var(--touch);
		block-size: var(--touch);
		margin-block: calc((var(--touch) - var(--task-box)) / -2);
		margin-inline-start: calc((var(--touch) - var(--task-box)) / -2);
	}

	/*
		22px sichtbar, 2px Umriss im Akzent, Radius sm — fast eckig, damit ein
		Kästchen als Kästchen erkennbar bleibt (DESIGN.md, task-box).

		appearance: none, weil der Browser sonst Umriss, Radius und Farbe selbst
		malt, und zwar in Systemfarben, die dieser Rahmen nirgends kennt.
	*/
	.kaestchen {
		flex: none;
		inline-size: var(--task-box);
		block-size: var(--task-box);
		margin: 0;
		border: var(--border-active) solid var(--accent);
		border-radius: var(--radius-sm);
		background-color: transparent;
		appearance: none;
		cursor: pointer;
	}

	.kaestchen:checked {
		background-color: var(--accent);
	}

	/*
		Der Haken als eigenes Element und nicht als ::after auf dem Kästchen:
		Pseudoelemente auf einem <input> sind nicht überall verlässlich, und ein
		Haken, der bei einem Teil der Gruppe fehlt, nimmt dem gefüllten Kästchen
		die halbe Aussage.

		Zwei Kanten in --accent-ink, um 45 Grad gedreht — das ist der Haken. Die
		Verschiebung um -55% statt -50% hebt ihn optisch in die Mitte des
		gedrehten Kastens.
	*/
	.haken {
		position: absolute;
		inset-block-start: 50%;
		inset-inline-start: 50%;
		inline-size: var(--space-1);
		block-size: var(--space-2);
		border-inline-end: var(--border-active) solid var(--accent-ink);
		border-block-end: var(--border-active) solid var(--accent-ink);
		opacity: 0;
		transform: translate(-50%, -55%) rotate(45deg);
		pointer-events: none;
	}

	.kaestchen:checked + .haken {
		opacity: 1;
	}

	.zeile__text {
		color: var(--ink-primary);
		font-family: var(--task-font);
		font-size: var(--task-size);
		font-weight: var(--task-weight);
		line-height: var(--task-line);
	}

	/*
		Erledigt heisst **drei** Dinge auf einmal: Durchstreichung, gefülltes
		Kästchen mit Haken und gedämpfte Schrift. Kein Zustand hängt allein an der
		Farbe — die Dämpfung ist die letzte der drei und nie die einzige.
	*/
	.zeile--erledigt .zeile__text {
		color: var(--ink-secondary);
		text-decoration: line-through;
	}

	/*
		Sichtbar für einen Screenreader, unsichtbar auf dem Schirm.

		position: absolute nimmt das Element aus dem Fluss, clip-path schneidet es
		weg. **Nicht** display: none und nicht visibility: hidden — beides nähme es
		auch aus dem Zugänglichkeitsbaum, und damit fiele die Hälfte der
		Beschriftung des Kästchens aus.

		Kein white-space: nowrap, wie es die üblichen Fassungen dieser Klasse
		tragen. Gate-Regel 1 sucht CSS-Farbnamen als ganze Wörter und liest das
		`white` in `white-space` als Farbe — gemessen, nicht vermutet. Die
		Zeile bräuchte es hier ohnehin nicht: das Element ist aus dem Fluss
		genommen und weggeschnitten, ein Umbruch darin ist folgenlos.
	*/
	.nur-vorgelesen {
		position: absolute;
		clip-path: inset(50%);
	}

	/*
		Die **einzige** Animation der Anwendung.

		Gekapselt in no-preference und nicht umgekehrt: damit ist die Abwesenheit
		von Bewegung der Standardfall, und Bewegung die Ausnahme, die ausdrücklich
		eingeschaltet wird. Die umgekehrte Schreibweise — Übergang immer, in
		`reduce` wieder abschalten — hat dasselbe Ergebnis, aber jede künftige
		Animation müsste daran denken. Diese ist die Vorlage.

		Die Dauer kommt aus --duration-quick (140ms). Ein rohes 140ms an dieser
		Stelle weist Gate-Regel 1 ab.
	*/
	@media (prefers-reduced-motion: no-preference) {
		.kaestchen,
		.haken,
		.zeile__text {
			transition-property: background-color, border-color, color, opacity;
			transition-duration: var(--duration-quick);
		}
	}
</style>
