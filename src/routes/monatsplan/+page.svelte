<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	// SubmitFunction kommt aus @sveltejs/kit, nicht aus $app/forms: dort ist nur
	// enhance selbst ausgeführt, der Typ liegt im Hauptmodul.
	import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
	import { PLAN_HOECHSTZAHL, zeilenErkennen } from '$lib/aufgabentext';
	import { datumLang } from '$lib/client/utils/date';
	import { tagesendeInUnixSekunden } from '$lib/zeit';
	import { DATUM_FEHLT, FRIST_AUSSERHALB, VERSAND_FEHLGESCHLAGEN } from '$lib/texte';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();

	/*
		**Zwei Schritte, eine Route, kein Server-Rundgang dazwischen.**

		AD-9 bindet jede Änderung an **Domänendaten** an eine form action. Schritt
		1 → 2 ändert nichts: er zerlegt einen Text, den die Person gerade selbst
		getippt hat. Ein Rundgang dafür kostete eine Roundtrip-Latenz pro `×`,
		brauchte eine zweite action oder eine zweite Route, und der Server müsste
		den Zwischenstand irgendwo halten. Der Zähler unter dem Textfeld muss
		ohnehin bei jedem Tastendruck stimmen — damit ist die Zerlegung im Browser
		gesetzt, und der Prüfschritt bekommt sie geschenkt.
	*/
	let schritt = $state(1);

	/*
		Das gemeinsame Fälligkeitsdatum des ganzen Stapels, als `JJJJ-MM-TT`.

		Die Vorgabe aus der load ist ausdrücklich nur die **Saat**: sobald die
		Person das Feld anfasst, gehört der Wert ihr, und ein späteres Nachziehen
		aus `data` überschriebe ihre Eingabe. Genau davor warnt Svelte mit
		state_referenced_locally, und genau das ist hier gewollt — die Warnung ist
		darum benannt abgeschaltet und nicht durch ein $derived ersetzt, das das
		Feld unbedienbar machte.
	*/
	// svelte-ignore state_referenced_locally
	let faelligBis = $state(data.faelligBisVorgabe);

	/** Der ganze Plan in **einem** Feld — eine Aufgabe pro Zeile. */
	let planText = $state('');

	/*
		Eine Sperre für die Seite, plus die zwei Riegel aus den Stories 1.3 bis
		1.5: `disabled` am Knopf ist der sichtbare und der für die Tastatur
		wirksame, greift aber erst mit dem nächsten Rendern; `cancel()` im Rückruf
		deckt das Fenster davor ab. Zwei Antippen auf einem langsamen Telefon
		legten sonst zwei ganze Stapel an, und es gibt keine Löschen-Aktion, die
		das wieder aufräumte.
	*/
	let imFlug = $state(false);

	/*
		Die Zeilen des Prüfschritts, jede mit einer eigenen Kennung.

		Die Kennung und nicht der Zeilenindex trägt das `{#each}`-Schlüssel: zwei
		Zeilen dürfen wortgleich sein (`Tunnel lüften` für zwei Tunnel), und beim
		Entfernen rutschen alle Indizes danach um eins — ein Schlüssel über den
		Index liesse Svelte die falsche Zeile wiederverwenden.

		Die Liste entsteht beim Wechsel nach Schritt 2 **neu** aus dem Textfeld.
		Genau daran hängt die Zusage von `Zurück zum Text`: die entfernten Zeilen
		sind danach wieder da, weil der Text die Quelle ist und diese Liste nur
		seine Abschrift.
	*/
	let zeilenListe = $state<{ id: number; text: string }[]>([]);

	/** Die erkannten Zeilen des Textfelds — dieselbe Funktion, die der Server benutzt. */
	const erkannt = $derived(zeilenErkennen(planText));

	/** `1 Aufgabe` oder `24 Aufgaben` — die Beugung steht einmal und nicht dreimal. */
	function aufgabenZahl(anzahl: number): string {
		return `${anzahl} ${anzahl === 1 ? 'Aufgabe' : 'Aufgaben'}`;
	}

	/** Mehr Zeilen, als ein Monatsplan tragen darf — **dieselbe** Grenze wie die action. */
	const zuVieleZeilen = $derived(erkannt.length > PLAN_HOECHSTZAHL);

	/**
	 * Die mitlaufende Zählung unter dem Textfeld.
	 *
	 * Sie ist ausdrücklich **keine** Live-Region: sie ändert sich bei jedem
	 * Tastendruck, und ein Screenreader spräche dann bei jedem Buchstaben. Sie
	 * hängt statt dessen über aria-describedby am Feld — sonst begegnete ihr, wer
	 * mit einem Screenreader durch das Formular geht, nirgends.
	 *
	 * Bei zu vielen Zeilen sagt sie es **statt** nur den Knopf zu sperren: ein
	 * gesperrter Knopf ohne Satz ist eine Sackgasse ohne Auskunft.
	 */
	const zaehlung = $derived.by(() => {
		if (zuVieleZeilen) {
			return `${erkannt.length} Zeilen erkannt — höchstens ${PLAN_HOECHSTZAHL} Aufgaben auf einmal.`;
		}
		return erkannt.length === 0
			? 'Keine Aufgabe erkannt'
			: `${aufgabenZahl(erkannt.length)} erkannt`;
	});

	/** Das Fälligkeitsdatum in Unix-Sekunden, oder null bei einem untauglichen Feldwert. */
	const faelligAm = $derived(tagesendeInUnixSekunden(faelligBis));

	/** Dasselbe Datum in Alltagssprache, oder leer. */
	const faelligLang = $derived(faelligAm === null ? '' : datumLang(faelligAm));

	/**
	 * Liegt das Datum im Fenster, das die zwei Grenzen aus der load aufspannen?
	 *
	 * **Verglichen wird auf den Zeichenketten**, nicht auf Zeitpunkten, und das
	 * ist kein Kniff: `JJJJ-MM-TT` sortiert als Text genau wie als Datum, und die
	 * zwei Grenzen sind buchstäblich dieselben zwei Werte, die unten als `min` und
	 * `max` am Feld stehen. Diese Zeile sagt damit nichts anderes, als was der
	 * Browser selbst schon weiss — sie macht es nur hörbar. Eine zweite Uhr im
	 * Browser wäre der Fehler: sie liefe gegen die des Servers, und die Grenze
	 * spränge beim Hydrieren.
	 *
	 * Die Instanz bleibt die action; sie rechnet aus derselben Konstante noch
	 * einmal, an ihrer eigenen Uhr.
	 */
	const datumImFenster = $derived(
		faelligBis >= data.faelligBisFrueheste && faelligBis <= data.faelligBisSpaeteste
	);

	/**
	 * Der Satz unter dem Datumsfeld. Leer, solange das Datum taugt.
	 *
	 * Das `required` und das `min`/`max` am Feld sind wirkungslos, weil Schritt 1
	 * kein `<form>` ist und es nichts gibt, was die Bedingungsprüfung des Browsers
	 * auslöste. Wer das Feld leert, käme ohne diesen Satz bis in den Prüfschritt
	 * und läse dort `24 Aufgaben, fällig bis ` — einen Satz, der mitten in einer
	 * Präposition endet — über einem freigeschalteten Knopf, den erst der Server
	 * abwiese.
	 *
	 * **Zwei Zustände, zwei Sätze**, wortgleich mit den zwei Sätzen der action:
	 * kein brauchbarer Tag, oder ein Tag ausser Reichweite. Die Reihenfolge ist
	 * dieselbe wie dort — erst die Form, dann die Reichweite —, denn ein leeres
	 * Feld liegt auch ausserhalb des Fensters, und `Prüfe die Jahreszahl` wäre
	 * darauf die falsche Auskunft.
	 */
	const datumHinweis = $derived.by(() => {
		if (faelligAm === null) return DATUM_FEHLT;
		if (!datumImFenster) return FRIST_AUSSERHALB;
		return '';
	});

	/**
	 * Warum `Weiter` gesperrt ist — **vier** Gründe, und jeder trägt daneben
	 * seinen Satz: keine Zeile, zu viele Zeilen, kein brauchbares Datum, ein
	 * Datum ausser Reichweite. Alle vier prüft der Server noch einmal; hier
	 * werden sie nur früher gesagt.
	 *
	 * Der vierte ist seit dem Fenster an `Fällig bis` dabei, und er verdient
	 * seinen Platz genau hier: wer sich in der Jahreszahl vertippt, hätte sonst
	 * vierzig Zeilen durch den Prüfschritt getragen, um am Server abgewiesen zu
	 * werden.
	 */
	const weiterGesperrt = $derived(
		erkannt.length === 0 || zuVieleZeilen || faelligAm === null || !datumImFenster
	);

	/**
	 * Der Zwischentext über der Prüfliste.
	 *
	 * Drei Zweige, damit der Satz nie mitten in einer Präposition endet und nie
	 * `0 Aufgaben, fällig bis …` über einem gesperrten Knopf steht.
	 */
	const zwischentext = $derived.by(() => {
		if (zeilenListe.length === 0) return 'Keine Aufgabe mehr übrig.';
		const anzahl = aufgabenZahl(zeilenListe.length);
		return faelligLang === ''
			? `${anzahl}, noch ohne Frist`
			: `${anzahl}, fällig bis ${faelligLang}`;
	});

	/** Das Verb mit der Zahl auf dem einzigen primären Knopf des Prüfschritts. */
	const ablegenText = $derived(`${aufgabenZahl(zeilenListe.length)} ablegen`);

	/**
	 * Die Zeilen, wie sie das versteckte Feld an den Server gibt: durch
	 * Zeilenumbrüche getrennt, also genau in der Form, die zeilenErkennen dort
	 * wieder zerlegt. Ein zweites Format wäre eine zweite Wahrheit.
	 */
	const zeilenFeldwert = $derived(zeilenListe.map((zeile) => zeile.text).join('\n'));

	/*
		Ist der Ausgang des letzten Versands quittiert?

		`form` ist eine Eigenschaft und lässt sich nicht zurücksetzen; ohne dieses
		Flag wäre der Fehlersatz unlöschbar. Er stünde dann als `role="alert"` über
		einem Inhalt, den die Person längst korrigiert hat: abweisen lassen, mit
		`Zurück zum Text` zurückgehen, Zeile kürzen, `Weiter` — und der alte Satz
		steht immer noch da. Ein Alarm, der nicht mehr gilt, kostet den nächsten
		seine Glaubwürdigkeit.

		Quittiert wird bei jedem Schritt**wechsel von Hand** und bei jeder Änderung
		an einem der beiden Felder. **Nicht** beim Rücksprung aus dem
		use:enhance-Rückruf: der trägt den Satz gerade erst herein.

		Vor jedem Versand geht das Flag wieder auf false, damit der nächste Ausgang
		sichtbar wird.
	*/
	let quittiert = $state(false);

	/** Der Ausgang der action, solange er nicht quittiert ist. */
	const fehlschlag = $derived(!quittiert && form !== null && form.art === 'fehler' ? form : null);

	/** Der Satz der abgewiesenen action. Eine Region für beide Felder. */
	/*
		Ein Wurf in einer action, abgefangen im Rückruf unten statt an die
		Fehlergrenze weitergereicht. Eigener Zustand und nicht aus `form`
		abgeleitet: bei `result.type === 'error'` läuft update() gar nicht, `form`
		bleibt also auf dem Stand davor stehen. Der nächste Versand setzt ihn
		zurück — der neue Ausgang ist der jüngere und gewinnt.
	*/
	let versandFehler = $state('');

	const fehler = $derived(
		versandFehler !== '' ? versandFehler : fehlschlag === null ? '' : fehlschlag.meldung
	);

	/** Gehört der Satz an das Datumsfeld? Dann wird dessen Kante breiter. */
	const fehlerAmDatum = $derived(fehlschlag !== null && fehlschlag.feld === 'datum');

	/**
	 * Gehört er an das Textfeld? Ohne diese Zuordnung markierte eine Abweisung
	 * wegen der Zeilen **nichts** — der Rückruf springt bei jeder Abweisung nach
	 * Schritt 1 zurück, dort ist das Feld sichtbar, und die Kante ist der Hinweis,
	 * **wo**, während der Satz die Auskunft ist, **was**.
	 */
	const fehlerAnZeilen = $derived(fehlschlag !== null && fehlschlag.feld === 'zeilen');

	/**
	 * Was das Datumsfeld beschreibt: sein eigener Hinweis, der Fehlersatz, beides
	 * oder nichts. Ein aria-describedby auf ein leeres Element wäre eine
	 * Beschreibung, die nichts sagt.
	 */
	const datumBeschreibung = $derived(
		[datumHinweis === '' ? '' : 'plan-datum-hinweis', fehlerAmDatum ? 'plan-fehler' : '']
			.filter((teil) => teil !== '')
			.join(' ')
	);

	/** Dasselbe für das Textfeld: der Zähler steht **immer** dabei. */
	const zeilenBeschreibung = $derived(fehlerAnZeilen ? 'plan-zaehler plan-fehler' : 'plan-zaehler');

	/** Nimmt den Ausgang des letzten Versands aus der Anzeige. */
	function quittieren(): void {
		quittiert = true;
	}

	let titelKasten = $state<HTMLElement | null>(null);

	/**
	 * Wechselt den Schritt und holt den Fokus auf die Überschrift.
	 *
	 * Ohne den Fokusgriff bliebe der Wechsel für einen Screenreader stumm: es
	 * gibt keine Navigation, die etwas ansagte, und der Fokus stünde auf einem
	 * Knopf, den es nach dem Wechsel nicht mehr gibt — von dort fällt er auf den
	 * Seitenrumpf, und die Person weiss nicht, wo sie ist. Die Überschrift trägt
	 * dafür ein `tabindex="-1"`: ohne das ist focus() an einem `<h1>` ein stiller
	 * Leerlauf.
	 *
	 * `await tick()` steht davor, weil die Überschrift ihren neuen Text erst nach
	 * dem nächsten Rendern trägt — vorher fokussierte der Griff `Monatsplan
	 * ablegen` und sagte den Wechsel gerade nicht an.
	 *
	 * In **beide** Richtungen, aus demselben Grund: `Zurück zum Text` ist
	 * derselbe Schrittwechsel mit demselben verschwindenden Knopf.
	 */
	async function schrittWechseln(nach: number): Promise<void> {
		schritt = nach;
		await tick();
		titelKasten?.focus();
	}

	/**
	 * Schritt 1 → 2. Die Prüfliste entsteht hier **neu** aus dem Textfeld.
	 *
	 * Kein `<form>` und kein Versand: es entstehen keine Domänendaten, und ohne
	 * JavaScript tut dieser Knopf ausdrücklich nichts (siehe README.md, benannt
	 * akzeptierte Risiken). Die Ausfallrichtung ist die richtige — es entsteht
	 * **nichts**, und die Person merkt es sofort.
	 */
	function weiter(): void {
		quittieren();
		zeilenListe = erkannt.map((text, index) => ({ id: index, text }));
		void schrittWechseln(2);
	}

	/** Schritt 2 → 1. Das Textfeld ist unverändert, die entfernten Zeilen sind wieder da. */
	function zurueck(): void {
		quittieren();
		void schrittWechseln(1);
	}

	/**
	 * Entfernt eine Zeile aus der Prüfliste. **Kein Bearbeiten** — wer ändern
	 * will, geht mit `Zurück zum Text` an die eine Stelle, an der das geht. Ein
	 * Editor pro Zeile frässe die Ersparnis wieder auf, um die es dieser Story
	 * geht.
	 *
	 * **Der Knopf zerstört sich beim Drücken selbst**, und danach hat der Fokus
	 * kein Zuhause mehr: er fällt auf den Seitenrumpf, und wer mit der Tastatur
	 * oder einem Screenreader vier Zeilen hintereinander entfernen will, muss sich
	 * jedes Mal neu durch die Seite hangeln. Das ist derselbe Stolperer, den
	 * schrittWechseln für den Schrittwechsel schon abfängt.
	 *
	 * Der Fokus geht darum an das `×` der Zeile, die an dieselbe Stelle
	 * nachgerückt ist — beim Entfernen der letzten an das der vorherigen, und
	 * wenn gar keine mehr übrig ist an die Überschrift, unter der dann der leere
	 * Zustand mit dem Weg hinaus steht.
	 */
	async function entfernen(id: number): Promise<void> {
		const stelle = zeilenListe.findIndex((zeile) => zeile.id === id);
		zeilenListe = zeilenListe.filter((zeile) => zeile.id !== id);
		await tick();
		const nachfolger = zeilenListe[stelle] ?? zeilenListe[stelle - 1];
		if (nachfolger === undefined) {
			titelKasten?.focus();
			return;
		}
		document.getElementById(`plan-entfernen-${nachfolger.id}`)?.focus();
	}

	/**
	 * Das `feld` eines Ausgangs.
	 *
	 * Aus `result` und nicht aus `form` — im Rückruf ist die Eigenschaft von
	 * aussen noch die alte. Dasselbe Muster wie artVon in ../+page.svelte.
	 */
	function feldVon(ergebnis: ActionResult): string {
		const daten =
			ergebnis.type === 'failure' ? (ergebnis.data as { feld?: unknown } | undefined) : undefined;
		return typeof daten?.feld === 'string' ? daten.feld : '';
	}

	/**
	 * Der Versand des Stapels.
	 *
	 * Den Redirect erledigt use:enhance im gereichten update() von selbst: der
	 * Rückfall-Rückruf ruft bei einem Ergebnis vom Typ `redirect` applyAction(),
	 * was mit invalidateAll: true auf `/` navigiert. Die load von `/` läuft damit
	 * frisch, und die eben abgelegten Aufgaben stehen in der Liste (AD-7).
	 *
	 * `reset: false`, weil ein form.reset() die zwei versteckten Felder auf ihren
	 * serverseitig gerenderten Stand zurückzöge — nach einem abgewiesenen Versand
	 * wäre der Stapel dann ein anderer als der, den die Person auf dem Schirm hat.
	 *
	 * Eine Abweisung am **Datum** führt zurück in Schritt 1: dort steht das
	 * Datumsfeld, und ein Satz über ein Feld, das man nicht sieht, ist eine
	 * Auskunft ohne Handlung.
	 */
	const versand: SubmitFunction = ({ cancel }) => {
		if (imFlug) {
			cancel();
			return;
		}
		imFlug = true;
		// Der nächste Ausgang soll sichtbar werden, auch wenn er wortgleich mit dem
		// eben quittierten ist.
		quittiert = false;
		versandFehler = '';
		return async ({ update, result }) => {
			/*
				try/finally und nicht zwei Zeilen hintereinander: bricht update()
				ab — ein abgerissenes Netz, ein Fehler in applyAction —, bliebe
				imFlug sonst für immer true und der Knopf dauerhaft disabled. Nur
				ein Neuladen käme da wieder heraus, und der ganze getippte Plan
				wäre fort. Retro-Posten B1 aus Epic 1.
			*/
			try {
				/*
					Ein Wurf in der action kommt als `result.type === 'error'` zurück, und
					das gereichte update() reicht ihn an applyAction weiter — die
					Fehlergrenze ersetzte dann die Seite. Statt dessen ein Satz in der
					Live-Region, die hier ohnehin steht. Der Wurf selbst bleibt unberührt:
					er hat handleError auf dem Server längst erreicht. Einheitlich auf allen
					vier Seiten, entschieden am 2026-08-28 zu Eintrag 32 der
					zurückgestellten Arbeit.
				*/
				if (result.type === 'error') {
					versandFehler = VERSAND_FEHLGESCHLAGEN;
				} else {
					await update({ reset: false });
				}
			} finally {
				imFlug = false;
			}
			// Ein abgefangener Wurf trägt kein Feld — feldVon gibt dann undefined, der
			// Schritt bleibt stehen, und der Satz steht ohnehin über beiden.
			if (feldVon(result) === 'datum') void schrittWechseln(1);
		};
	};
</script>

<svelte:head>
	<title>Monatsplan</title>
</svelte:head>

<!--
	/monatsplan — der ganze Monatsplan in einem Zug.

	Ein Textfeld für den ganzen Plan und **kein Feld pro Aufgabe**: das ist die
	Abnahmebedingung dieser Story (NFR3). Wer vierzig Mal ein Feld füllt, absendet
	und zurücknavigiert, verliert den Vergleich mit der Papierliste sofort — und
	tut es dann nicht.

	Kein Zurück-Pfeil in der Seitenchrome: eine Formularseite schliesst mit ihrer
	Aktion und leitet auf die Liste zurück; die Systemgeste des Browsers genügt.
	`Zurück zum Text` ist etwas anderes — es wechselt den Schritt, es verlässt die
	Seite nicht.
-->
<div class="seite">
	<!--
		Genau ein h1, und sein Text benennt den Schritt. Das `tabindex="-1"` sieht
		an einer Überschrift wie ein Versehen aus: ohne es ist der Fokusgriff in
		schrittWechseln ein stiller Leerlauf, und der Wechsel bliebe stumm.
	-->
	<h1 class="seitentitel" tabindex="-1" bind:this={titelKasten}>
		{schritt === 1 ? 'Monatsplan ablegen' : 'Prüfen'}
	</h1>

	<!--
		Der Fehlersatz steht **immer** im Markup, auch leer, und über beiden
		Schritten. Bedingt gerendert wäre er ein Element, das erst mit seinem Text
		in den DOM kommt, und das liest ein Screenreader in der Regel nicht vor:
		mit use:enhance gibt es keine Navigation, die den Fehlschlag ansagte. Leer
		nimmt er keinen Platz ein — die :empty-Regel unten nimmt ihn aus dem Fluss,
		statt ihn mit display: none aus dem Baum zu werfen.

		`assertive` und nicht `polite`: der Satz ist die Antwort auf einen eben
		abgeschickten Versand, und er wird von nichts anderem überholt.
	-->
	<p class="fehler live" id="plan-fehler" role="alert" aria-live="assertive">{fehler}</p>

	{#if schritt === 1}
		<div class="schreiben">
			<div>
				<!--
					Eine sichtbare Beschriftung und **kein** Platzhalter: ein Platzhalter
					verschwindet beim Tippen, und wer dann unterbrochen wird, weiss nicht
					mehr, was in das Feld gehört.

					`required` steht mit, greift hier aber **nicht**: Schritt 1 ist kein
					`<form>`, und es gibt nichts, was die Bedingungsprüfung des Browsers
					auslöste. Was wirklich trägt, ist die Sperre an `Weiter` und der Satz
					darunter. Vorbelegt ist das Feld mit dem Monatsende — eine Planaufgabe
					ohne Frist wäre von einer vor Ort erfassten nicht mehr zu
					unterscheiden, und die Monatsplan-Ausnahme aus Story 2.2 fiele still
					aus.

					`min` und `max` spannen das Fenster von einem Jahr in jede Richtung
					auf. Sie greifen wie das `required` nicht als Bedingungsprüfung, aber
					sie tun etwas, was kein Satz kann: der Kalender des Browsers springt
					gar nicht erst über die Grenze hinaus. Getippt werden kann ein Jahr
					daneben trotzdem — dafür stehen die Sperre an `Weiter` und, als
					Instanz, die zweite Prüfung in der action.
				-->
				<label class="feld__beschriftung" for="faellig-bis">Fällig bis</label>
				<input
					class="feld"
					id="faellig-bis"
					type="date"
					required
					min={data.faelligBisFrueheste}
					max={data.faelligBisSpaeteste}
					bind:value={faelligBis}
					oninput={quittieren}
					aria-invalid={fehlerAmDatum || faelligAm === null || !datumImFenster ? 'true' : undefined}
					aria-describedby={datumBeschreibung === '' ? undefined : datumBeschreibung}
				/>
				<!--
					Der Satz zum Datumsfeld, immer im Markup und leer, solange das Datum
					taugt — dieselbe Bauform wie die Live-Region oben, aber **ohne**
					aria-live: er beschreibt einen Zustand des Feldes und ist keine
					Antwort auf einen Versand.
				-->
				<p class="hinweis hinweis--am-feld live" id="plan-datum-hinweis">{datumHinweis}</p>
			</div>
			<div>
				<label class="feld__beschriftung" for="plan-zeilen">Eine Aufgabe pro Zeile</label>
				<!--
					**Ein** Feld für den ganzen Plan, einfügbar aus Notiz oder Chat.
					Kein „Zeile hinzufügen"-Knopf, kein Editor pro Zeile.
				-->
				<textarea
					class="feld textfeld"
					id="plan-zeilen"
					bind:value={planText}
					oninput={quittieren}
					aria-invalid={fehlerAnZeilen ? 'true' : undefined}
					aria-describedby={zeilenBeschreibung}></textarea>
				<!--
					Die Zählung in der meta-Rolle und ausdrücklich **keine**
					Live-Region: sie ändert sich bei jedem Tastendruck und spräche
					dann bei jedem Buchstaben. Sie hängt statt dessen über
					aria-describedby am Feld darüber — sonst begegnete ihr, wer mit
					einem Screenreader durch das Formular geht, nirgends.

					Sie trägt dieselbe geteilte Nebentext-Klasse wie der Satz am
					Datumsfeld: beide sind Nebentext zu dem Feld darüber und keine
					Handlung. Ihre eigene Klasse `.zaehler` war bis zum 2026-08-29 die
					dritte Kopie derselben fünf meta-Eigenschaften; ihre Kennung
					`plan-zaehler` trägt die Identität und bleibt.
				-->
				<p class="hinweis hinweis--am-feld" id="plan-zaehler">{zaehlung}</p>
			</div>
			<!--
				Der einzige primäre Knopf dieses Schritts. `type="button"`, weil hier
				kein Formular steht: ohne JavaScript tut er nichts, und es entsteht
				nichts — die richtige Ausfallrichtung, im `<noscript>` unten benannt.

				Gesperrt aus drei Gründen, und jeder steht als Satz daneben: keine
				Zeile, zu viele Zeilen, kein brauchbares Datum. Ein gesperrter Knopf
				ohne Satz wäre eine Sackgasse ohne Auskunft.
			-->
			<button class="button-primary" type="button" disabled={weiterGesperrt} onclick={weiter}
				>Weiter</button
			>
		</div>
	{:else}
		<!--
			Schritt 2 **ist** das Formular. Literales action="?/ablegen", nicht
			dynamisch: Gate-Regel 11 liest den Namen textuell und vergleicht ihn mit
			den actions der Nachbardatei.
		-->
		<form class="pruefen" method="POST" action="?/ablegen" use:enhance={versand}>
			<p class="zwischentext">{zwischentext}</p>

			<!--
				Die erkannten Zeilen als Liste, jede mit einem `×` zum Entfernen —
				**kein Eingabefeld je Zeile**. Der Schritt existiert, weil beim
				Einfügen aus einem Chat Zeilen mitkommen, die keine Aufgaben sind.
			-->
			<ol class="liste">
				{#each zeilenListe as zeile (zeile.id)}
					<li class="zeile">
						<span class="zeile__text" id="plan-zeile-{zeile.id}">{zeile.text}</span>
						<!--
							Ein echtes <button type="button"> und kein <span> mit
							Klick-Handler: nur ein Knopf ist mit der Tastatur erreichbar und
							meldet sich einem Screenreader als Knopf. Sein zugänglicher Name
							entsteht über aria-labelledby aus dem sichtbaren Zeilentext
							**und** einem verborgenen Verb — dasselbe Muster wie das Kästchen
							auf `/`. Der Screenreader liest „<Zeilentext>, entfernen".

							Die eigene Kennung am Knopf ist kein Zierat: an ihr hängt der
							Fokusgriff in entfernen.
						-->
						<button
							class="entfernen"
							type="button"
							id="plan-entfernen-{zeile.id}"
							disabled={imFlug}
							aria-labelledby="plan-zeile-{zeile.id} plan-verb-{zeile.id}"
							onclick={() => entfernen(zeile.id)}>×</button
						>
						<span class="nur-vorgelesen" id="plan-verb-{zeile.id}">, entfernen</span>
					</li>
				{/each}
			</ol>

			<!--
				Der leere Zustand des Prüfschritts, im Ton von `Nichts offen.`: er sagt,
				was gilt, **und** wo der Weg hinaus ist. Ohne ihn stünde hier ein
				gesperrter Knopf über einer leeren Liste, und niemand sagte, dass
				`Zurück zum Text` das Einzige ist, was noch geht. Der Fokus steht in
				diesem Moment auf der Überschrift darüber (siehe entfernen).
			-->
			{#if zeilenListe.length === 0}
				<p class="leer">Mit „Zurück zum Text" kommst du wieder an deinen Plan.</p>
			{/if}

			<!--
				Die zwei versteckten Felder tragen, was Schritt 1 im Browser gesammelt
				hat. `zeilen` ist der Stapel in genau der Form, die zeilenErkennen auf
				dem Server wieder zerlegt; `faelligBis` gilt für den **ganzen** Stapel
				und nicht je Zeile.
			-->
			<input type="hidden" name="faelligBis" value={faelligBis} />
			<input type="hidden" name="zeilen" value={zeilenFeldwert} />

			<!-- Der einzige primäre Knopf dieses Schritts: Verb und Zahl. Sein Verb
			     kehrt als Meldung `N Aufgaben abgelegt.` auf `/` wieder. -->
			<button class="button-primary" type="submit" disabled={imFlug || zeilenListe.length === 0}
				>{ablegenText}</button
			>
			<button class="button-quiet" type="button" disabled={imFlug} onclick={zurueck}
				>Zurück zum Text</button
			>
		</form>
	{/if}

	<!--
		Die ehrliche Hälfte der Zusage. Die sichere ist gebaut — ohne JavaScript
		tut `Weiter` nichts und es entsteht **nichts** —, aber ohne diesen Satz
		tippte jemand vierzig Zeilen, drückte einen Knopf und stünde ratlos da.
		`/mehr` bietet den Eintrag seit dieser Story allen an, also trifft es auch
		jemanden, der nie hier war.

		Kein Anker auf `/aufgabe`: die Navigationsleiste am unteren Rand führt schon
		dorthin, und ein zweiter Weg in der Seitenmitte wäre der Zurück-Link, den
		diese Seite ausdrücklich nicht hat.
	-->
	<noscript>
		<p class="ohne-js">
			Diese Seite braucht JavaScript. Ohne JavaScript tut „Weiter" nichts, und es entsteht keine
			Aufgabe. Einzelne Aufgaben erfasst du über „Aufgaben" unten und den Knopf „+ Aufgabe" — das
			geht auch ohne JavaScript.
		</p>
	</noscript>
</div>

<style>
	.schreiben,
	.pruefen {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	/*
		Das Textfeld der Massen-Eingabe. .feld aus bedienelemente.css deckt Fläche,
		Kante, Radius und die task-Rolle (16px, unter denen iOS beim Fokus
		hineinzoomt) schon vollständig ab — hier bleiben genau zwei Dinge:

		  - die Mindesthöhe aus dem Token, damit man beim Schreiben einer
		    Monatsliste nicht in einem Schlitz tippt (DESIGN.md, textarea-bulk);
		  - resize: vertical, weil ein waagerechtes Ziehen die einspaltige Seite
		    sprengte, ein senkrechtes aber genau das ist, was jemand mit vierzig
		    Zeilen will.
	*/
	.textfeld {
		min-height: var(--textarea-bulk-min-height);
		resize: vertical;
	}

	/*
		Der leere Zustand des Prüfschritts, im Ton von `Nichts offen.` auf `/`: er
		sagt, was gilt, und nennt den Weg hinaus.
	*/
	.leer {
		margin: 0;
		color: var(--ink-secondary);
		font-family: var(--body-font);
		font-size: var(--body-size);
		font-weight: var(--body-weight);
		line-height: var(--body-line);
	}

	/*
		Der Satz für den Fall ohne JavaScript. Als Karte und nicht als blosser
		Absatz: er ist die einzige Auskunft auf einer Seite, deren Bedienelemente
		dann alle wirkungslos sind, und muss sich von ihnen absetzen. Dieselbe
		Fläche, Kante und Rundung wie ein Zeilenziel auf `/mehr`.
	*/
	.ohne-js {
		margin: 0;
		padding: var(--space-3);
		border: var(--border-hairline) solid var(--hairline);
		border-radius: var(--radius-md);
		background-color: var(--surface-raised);
		color: var(--ink-primary);
		font-family: var(--body-font);
		font-size: var(--body-size);
		font-weight: var(--body-weight);
		line-height: var(--body-line);
	}

	.zwischentext {
		margin: 0;
		color: var(--ink-secondary);
		font-family: var(--meta-font);
		font-size: var(--meta-size);
		font-weight: var(--meta-weight);
		line-height: var(--meta-line);
	}

	.liste {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/*
		Text links, `×` rechts. Trennung zur nächsten Zeile durch Haarlinie oben;
		die erste hat keine. Dieselbe Form wie die Aufgabenzeile auf `/`, damit
		beim Prüfen schon aussieht, was gleich entsteht.
	*/
	.zeile {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		min-height: var(--touch);
		padding: var(--space-2) 0;
		border-top: var(--border-hairline) solid var(--hairline);
	}

	.zeile:first-child {
		border-top: 0;
	}

	.zeile__text {
		flex: 1 1 auto;
		padding-top: var(--space-2);
		color: var(--ink-primary);
		font-family: var(--task-font);
		font-size: var(--task-size);
		font-weight: var(--task-weight);
		line-height: var(--task-line);
	}

	/*
		Das Trefferfeld ist volle --touch gross, obwohl nur ein Kreuz darin steht:
		der Daumen im Garten braucht die Fläche. Der negative Aussenabstand nach
		rechts greift in den Seitenrand (--gutter) hinein, damit das Kreuz optisch
		am Spaltenrand bleibt und die Zeile nicht breiter wird.

		Durchsichtig und ohne Kante: es ist keine Handlung, die Aufmerksamkeit
		verdient — der Akzent bleibt dem primären Knopf. Und **nicht rot**: eine
		Zeile aus dem Entwurf zu nehmen zerstört nichts.
	*/
	.entfernen {
		display: flex;
		flex: none;
		align-items: center;
		justify-content: center;
		inline-size: var(--touch);
		block-size: var(--touch);
		margin: 0;
		margin-inline-end: calc(var(--gutter) / -2);
		padding: 0;
		border: 0;
		background-color: transparent;
		color: var(--ink-secondary);
		font-family: var(--body-font);
		font-size: var(--section-size);
		line-height: var(--section-line);
		cursor: pointer;
		appearance: none;
	}

	.entfernen:disabled {
		color: var(--hairline);
		cursor: default;
	}

	/*
		Sichtbar für einen Screenreader, unsichtbar auf dem Schirm.

		position: absolute nimmt das Element aus dem Fluss, clip-path schneidet es
		weg. **Nicht** display: none und nicht visibility: hidden — beides nähme es
		auch aus dem Zugänglichkeitsbaum, und damit fiele die Hälfte der
		Beschriftung des Knopfs aus.

		Kein white-space: nowrap: Gate-Regel 1 sucht CSS-Farbnamen als ganze Wörter
		und liest das `white` in `white-space` als Farbe. Die Zeile bräuchte es hier
		ohnehin nicht.
	*/
	.nur-vorgelesen {
		position: absolute;
		clip-path: inset(50%);
	}
</style>
