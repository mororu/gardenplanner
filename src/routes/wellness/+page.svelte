<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { tick } from 'svelte';
	import type { PageProps } from './$types';
	import { datumKurz } from '$lib/client/utils/date';
	/*
		ERNTE_HOECHSTLAENGE und ORT_VORGABE für das **Ortsfeld** — dieselbe Grenze
		und dieselbe Vorbelegung wie auf /ernte, und aus demselben Grund, aus dem
		die Route sich `ortPruefen` von dort holt: es ist derselbe Garten und
		dasselbe Beet. Der Name liest sich hier schief, und das ist der Preis, den
		die geteilte Stelle kostet — die Alternative wäre eine zweite Zahl, die beim
		ersten Nachdenken von der ersten wegliefe.
	*/
	import { ERNTE_HOECHSTLAENGE, ORT_VORGABE } from '$lib/ernte';
	import { VERSAND_FEHLGESCHLAGEN } from '$lib/texte';
	import {
		INTERVALL_HOECHST,
		MITTEL,
		MITTELLISTE,
		MITTEL_HOECHSTLAENGE,
		letzteJeStelle,
		tageBisWieder,
	} from '$lib/wellness';
	import { tageZurueck } from '$lib/zeit';

	/*
		/wellness — was zur Stärkung ausgebracht wurde, und was wieder ansteht.

		Zwei Listen aus **einer** Quelle: `data.tagebuch`. Oben die Zeilen, deren
		Wiederholung abgelaufen ist, unten alles. Die Auswahl steht in
		$lib/wellness.ts und nicht hier — eine Seite, die selbst entscheidet, was
		fällig ist, wäre die zweite Fassung jener Regel.

		Die Bauform ist die von /ernte: ein aufklappbares <details> für das
		Formular, dessen `open` am Fehlschlag hängt, zwei Live-Regionen im Kopf und
		eine Rückfrage an der Zeile, die gelöscht werden soll. Der ausführliche
		Grund für jedes dieser Stücke steht dort; hier stehen nur die Unterschiede.
	*/

	const { data, form }: PageProps = $props();

	/**
	 * Was wieder ansteht: je Stelle die jüngste Anwendung, und davon die, deren
	 * Wiederholung abgelaufen ist.
	 *
	 * **Gegen `data.jetzt` und nicht gegen die Uhr des Geräts.** Die Seite wird
	 * auf dem Server gerendert und im Browser hydriert; ein `Date.now()` hier
	 * ergäbe zwei verschiedene Sekunden und über Mitternacht zwei verschiedene
	 * Listen — Svelte meldete einen Hydrierungsunterschied, und der Garten sähe
	 * je nach Gerät etwas anderes.
	 *
	 * `offen` reist gleich mit: die Zahl steht an der Zeile, und sie ein zweites
	 * Mal auszurechnen hiesse, dieselbe Rechnung an zwei Stellen zu führen.
	 */
	const anstehend = $derived(
		letzteJeStelle(data.tagebuch)
			.map((zeile) => ({
				zeile,
				offen: tageBisWieder(tageZurueck(zeile.angewendetAm, data.jetzt), zeile.intervallTage),
			}))
			.filter(
				(eintrag): eintrag is { zeile: (typeof data.tagebuch)[number]; offen: number } =>
					// Der Stichtag zählt mit — siehe istWiederDran in $lib/wellness.ts.
					// Die Bedingung steht hier als `<= 0` und nicht über jene Funktion,
					// weil `offen` schon gerechnet ist und ein zweiter Aufruf dieselbe
					// Rechnung noch einmal führte.
					eintrag.offen !== null && eintrag.offen <= 0
			)
	);

	/**
	 * Wie lange eine Behandlung schon ansteht, als Satz.
	 *
	 * `0` heisst heute — und `heute` ist ein Wort und keine Zahl, weil `seit 0
	 * Tagen` niemand sagt. Darunter zählt es in Tagen; `gestern` bekommt keinen
	 * eigenen Fall, weil `seit 1 Tag` an dieser Stelle richtig und unauffällig
	 * ist.
	 */
	const seitWann = (offen: number): string =>
		offen === 0 ? 'heute dran' : `seit ${-offen} ${-offen === 1 ? 'Tag' : 'Tagen'} dran`;

	/**
	 * Wie lange eine Anwendung zurückliegt, als Satz an der Tagebuchzeile.
	 *
	 * Neben dem Datum und nicht statt dessen: das Datum sagt, **wann**, und diese
	 * Angabe sagt, **wie lange her** — die Frage, die im Garten wirklich gestellt
	 * wird. Eine negative Zahl kann nur aus einem Eingriff von Hand an der
	 * Datenbank stammen (siehe tageZurueck in $lib/zeit.ts); sie steht dann als
	 * solche da, statt auf `heute` abgeschnitten zu werden.
	 */
	const vorWann = (tage: number): string =>
		tage === 0 ? 'heute' : tage === 1 ? 'gestern' : `vor ${tage} Tagen`;

	/** Die Rückfrage vor dem Wegnehmen, wenn die action sie gestellt hat. */
	const frage = $derived(form !== null && form.art === 'fragenWegnehmen' ? form : null);

	/*
		Ein Wurf in der action kommt als `result.type === 'error'` zurück. Der Satz
		steht in derselben Live-Region wie ein Fehlschlag der action; einheitlich
		auf allen Seiten, entschieden am 2026-08-28 zu Eintrag 32 der
		zurückgestellten Arbeit.
	*/
	let versandFehler = $state('');

	/** Die Meldung an einem der vier Felder des Formulars. */
	const fehlerAm = (feld: 'mittel' | 'ort' | 'datum' | 'intervall'): string =>
		form !== null && form.art === 'fehler' && form.feld === feld ? form.meldung : '';

	const fehlerAmMittel = $derived(fehlerAm('mittel'));
	const fehlerAmOrt = $derived(fehlerAm('ort'));
	const fehlerAmDatum = $derived(fehlerAm('datum'));
	const fehlerAmIntervall = $derived(fehlerAm('intervall'));

	/*
		Das Formular steht offen, sobald es etwas zurückzutragen hat — vom Server
		entschieden, nicht von einem Client-Zustand. Ohne JavaScript läuft kein
		use:enhance-Rückruf, und ein zugeklapptes Formular mit einem Fehlersatz
		darunter wäre eine Meldung über etwas, das man nicht sieht.
	*/
	const formularOffen = $derived(
		fehlerAmMittel !== '' || fehlerAmOrt !== '' || fehlerAmDatum !== '' || fehlerAmIntervall !== ''
	);

	/*
		Die verworfenen Eingaben, serverseitig zurückgetragen — das Mittel über
		`eingabe`, der Ort über `zweiteEingabe`.

		**Datum und Wiederholung reisen nicht zurück**, und das ist benannt statt
		übersehen: `abweisen` trägt zwei Texte zurück und soll keinen dritten Platz
		bekommen (die Begründung steht dort). Das Datum fällt auf `heute` zurück und
		damit auf den Wert, der in neun von zehn Fällen ohnehin darin stand; die
		Wiederholung kostet höchstens drei neu getippte Ziffern.
	*/
	const mittelWert = $derived(form !== null && form.art === 'fehler' ? form.eingabe : '');
	const ortWert = $derived(
		form !== null && form.art === 'fehler' ? form.zweiteEingabe : ORT_VORGABE
	);

	/**
	 * Die Meldung eines Fehlschlags, der an keine Zeile und an kein Feld gehört.
	 *
	 * Dazu zählt die Abweisung einer Zeilen-Aktion: sie trägt `feld: null` und
	 * sagt „lade die Seite neu". Ihr Platz wäre die Zeile — nur gibt es die gerade
	 * nicht mehr, und genau das ist ihr Inhalt.
	 */
	const fehlerOben = $derived(
		versandFehler !== ''
			? versandFehler
			: form !== null && form.art === 'fehler' && form.feld === null
				? form.meldung
				: ''
	);

	/** Der Satz nach einer geglückten Handlung — drei actions, eine Region. */
	const meldungOben = $derived(
		form !== null &&
			(form.art === 'eingetragen' || form.art === 'wiederholt' || form.art === 'weggenommen')
			? form.meldung
			: ''
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
			/*
				try/finally: bricht update() ab, bliebe imFlug sonst für immer true und
				jeder Knopf dauerhaft disabled. Dieselbe Absicherung wie in
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
			if (result.type === 'failure') {
				const daten = result.data as { feld?: unknown } | undefined;
				const feld = typeof daten?.feld === 'string' ? daten.feld : null;
				if (feld === 'mittel' || feld === 'ort' || feld === 'datum' || feld === 'intervall') {
					document.getElementById(`neu-${feld}`)?.focus();
					return;
				}
				fehlerKasten?.focus();
				return;
			}
			/*
				Eine Rückfrage bekommt **keinen** Fokussprung nach oben: sie steht an
				der Zeile, und der Blick soll dort bleiben. Dieselbe Entscheidung wie
				beim Abernten auf /ernte.
			*/
			if (form !== null && form.art === 'fragenWegnehmen') return;
			meldungKasten?.focus();
		};
	};
</script>

<svelte:head>
	<title>Wellnessbehandlung</title>
</svelte:head>

<div class="seite">
	<h1 class="seitentitel">Wellnessbehandlung</h1>

	<!--
		Zwei Live-Regionen, beide **immer** im Markup und über `.live:empty` aus dem
		Fluss genommen, solange sie leer sind — Retro-Posten B2: eine Region, die im
		selben Augenblick entsteht und ihren Text bekommt, wird nicht verlässlich
		vorgelesen.
	-->
	<p class="fehler live" bind:this={fehlerKasten} role="alert" aria-live="assertive" tabindex="-1">
		{fehlerOben}
	</p>
	<p class="meldung live" bind:this={meldungKasten} role="status" aria-live="polite" tabindex="-1">
		{meldungOben}
	</p>

	<p class="hinweis">
		Jauche, Brühen und alles andere, was die Pflanzen stärkt. Anders als beim Erntestand bleibt hier
		jede Zeile stehen — diese Mittel wirken nur in Wiederholung, und ohne „wann zuletzt" lässt sich
		„wann wieder" nicht sagen. Die Rezepte stehen unter Wissen.
	</p>

	{#if anstehend.length > 0}
		<!--
			Zuerst das, was etwas verlangt. Der Abschnitt fehlt ganz, wenn nichts
			ansteht — ein leerer Kasten mit `Nichts fällig.` wäre eine Zeile, die
			jeden Tag dasteht und an den meisten nichts sagt.

			Die Liste trägt einen zugänglichen Namen über die Marke, sonst heisst sie
			„Liste mit 3 Einträgen". Dieselbe Bauform wie `Offen` auf `/`.
		-->
		<h2 class="marke" id="anstehend-marke">Steht wieder an</h2>
		<ul class="liste liste--getrennt" aria-labelledby="anstehend-marke">
			{#each anstehend as { zeile, offen } (zeile.id)}
				<li class="karte karte--eng">
					<p class="zeile__text">
						{zeile.mittel}{#if zeile.ort !== null}, {zeile.ort}{/if}
					</p>
					<p class="hinweis hinweis--ziffern">
						{seitWann(offen)} · zuletzt {vorWann(tageZurueck(zeile.angewendetAm, data.jetzt))}
					</p>
					<!--
						Der Griff schreibt die Zeile auf heute fort: Mittel, Ort und
						Wiederholung kommen aus ihr, das Datum ist heute. Ohne Rückfrage —
						er nimmt nichts weg, und ein Fehlgriff ist mit `Wegnehmen` an der
						frischen Zeile in einem Schritt zurückgenommen.

						Das <form> trägt ein **literales** action="?/wiederholen":
						Gate-Regel 11 leitet die Route aus dem Verzeichnis der Datei ab und
						hält den Namen gegen die actions der Nachbardatei. Ein dynamisches
						action={…} machte sie blind.
					-->
					<form method="POST" action="?/wiederholen" use:enhance={versand}>
						<input type="hidden" name="id" value={zeile.id} />
						<button class="button-quiet" type="submit" disabled={imFlug}> Heute gemacht </button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}

	<!--
		Das Eintragen. Ein <details> und keine eigene Seite: nachsehen und eintragen
		sind dieselbe Bewegung. Die Bauform ist die geteilte `.zeilenform`.

		Das `+` trägt `aufklapp` — `.button-primary` bringt ein `display` mit, und
		damit ist der Marker des <summary> fort. Gate-Regel 15 lässt das genau dann
		durch, wenn im Markup desselben <summary> ein solches Zeichen steht.
	-->
	<details class="zeilenform" open={formularOffen}>
		<summary class="button-primary button-primary--griff">
			<span class="aufklapp">+</span>
			<span>Behandlung eintragen</span>
		</summary>
		<form class="zeilenform__formular" method="POST" action="?/eintragen" use:enhance={versand}>
			<div>
				<label class="feld__beschriftung" for="neu-mittel">Womit</label>
				<!--
					Ein Textfeld mit Vorschlagsliste und kein <select>: antippen wählt aus
					den elf Mitteln, tippen schreibt irgendetwas. Ein Feld für einen Wert
					— die Begründung in ganzer Länge steht an MITTELLISTE in
					$lib/wellness.ts.
				-->
				<input
					class="feld"
					id="neu-mittel"
					name="mittel"
					type="text"
					list={MITTELLISTE}
					required
					maxlength={MITTEL_HOECHSTLAENGE}
					value={mittelWert}
					aria-invalid={fehlerAmMittel !== '' ? 'true' : undefined}
					aria-describedby={fehlerAmMittel !== '' ? 'neu-mittel-fehler' : undefined}
				/>
				<datalist id={MITTELLISTE}>
					{#each MITTEL as mittel (mittel)}
						<option value={mittel}></option>
					{/each}
				</datalist>
				<p class="fehler live" id="neu-mittel-fehler" role="alert" aria-live="assertive">
					{fehlerAmMittel}
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
					aria-describedby="neu-ort-hinweis{fehlerAmOrt !== '' ? ' neu-ort-fehler' : ''}"
				/>
				<!--
					Der Ort zählt für die Wiederholung mit, und das gehört ans Feld: wer
					`Beet 7` schreibt, bekommt die Mahnung für Beet 7 und nicht für den
					Garten. Die Begründung in ganzer Länge steht an `stelle` in
					$lib/wellness.ts.
				-->
				<p class="hinweis hinweis--am-feld" id="neu-ort-hinweis">
					Darf leer bleiben — dann gilt die Behandlung für den ganzen Garten.
				</p>
				<p class="fehler live" id="neu-ort-fehler" role="alert" aria-live="assertive">
					{fehlerAmOrt}
				</p>
			</div>

			<div>
				<label class="feld__beschriftung" for="neu-datum">Wann</label>
				<!--
					`min` und `max` kommen vom **Server** (rueckschaufenster): sonst
					rechnete der Server in UTC und das Gerät in der Ortszeit, und um 00:30
					stünden zwei verschiedene Grenzen im Feld. Vorbelegt mit heute, weil
					in neun von zehn Fällen eingetragen wird, was gerade getan wurde.

					Was das Feld zusagt, prüft die action noch einmal — ein POST braucht
					kein Formular.
				-->
				<input
					class="feld"
					id="neu-datum"
					name="datum"
					type="date"
					required
					min={data.frueheste}
					max={data.spaeteste}
					value={data.heute}
					aria-invalid={fehlerAmDatum !== '' ? 'true' : undefined}
					aria-describedby={fehlerAmDatum !== '' ? 'neu-datum-fehler' : undefined}
				/>
				<p class="fehler live" id="neu-datum-fehler" role="alert" aria-live="assertive">
					{fehlerAmDatum}
				</p>
			</div>

			<div>
				<label class="feld__beschriftung" for="neu-intervall">Wieder in … Tagen</label>
				<!--
					**Darf leer bleiben, und leer ist der Normalfall** — Kompost
					wiederholt sich nach Jahreszeit und nicht nach Tagen. Eine Zeile ohne
					Wiederholung steht nur im Tagebuch und mahnt nie.

					`inputmode="numeric"` holt auf dem Telefon die Zifferntastatur.
					`type="number"` wäre der andere Weg und bringt Pfeilchen mit, die bei
					einem Wert zwischen 7 und 21 niemand einzeln antippt.
				-->
				<input
					class="feld"
					id="neu-intervall"
					name="intervall"
					type="text"
					inputmode="numeric"
					maxlength={String(INTERVALL_HOECHST).length}
					aria-invalid={fehlerAmIntervall !== '' ? 'true' : undefined}
					aria-describedby="neu-intervall-hinweis{fehlerAmIntervall !== ''
						? ' neu-intervall-fehler'
						: ''}"
				/>
				<p class="hinweis hinweis--am-feld" id="neu-intervall-hinweis">
					Darf leer bleiben. Schachtelhalm etwa alle 14 Tage, Jauche alle 21.
				</p>
				<p class="fehler live" id="neu-intervall-fehler" role="alert" aria-live="assertive">
					{fehlerAmIntervall}
				</p>
			</div>

			<button class="button-primary" type="submit" disabled={imFlug}>Eintragen</button>
		</form>
	</details>

	{#if data.tagebuch.length === 0}
		<!-- Der leere Zustand sagt, was gilt; der Weg heraus steht darüber. -->
		<p class="leer">Noch nichts eingetragen.</p>
	{:else}
		<h2 class="marke" id="tagebuch-marke">Tagebuch</h2>
		<ul class="liste liste--getrennt" aria-labelledby="tagebuch-marke">
			{#each data.tagebuch as eintrag (eintrag.id)}
				{@const fragtHier = frage !== null && frage.zeile === eintrag.id}
				<li class="karte karte--eng">
					<p class="zeile__text">
						{eintrag.mittel}{#if eintrag.ort !== null}, {eintrag.ort}{/if}
					</p>
					<!--
						Name und Datum: nicht als Zuständigkeit, sondern als Herkunft — wann
						es war und wen man fragen kann. Ein fehlender Name kann nur aus
						einem Eingriff von Hand an der Datenbank stammen; die Zeile bleibt
						dann trotzdem lesbar.

						`angewendet_am` und nicht `created_at`: gefragt ist der Tag der
						Behandlung, nicht der des Eintragens.
					-->
					<p class="hinweis hinweis--ziffern">
						{datumKurz(eintrag.angewendetAm)} · {vorWann(
							tageZurueck(eintrag.angewendetAm, data.jetzt)
						)} · {eintrag.name ?? 'unbekannt'}
					</p>
					{#if eintrag.intervallTage !== null}
						<p class="hinweis">Wiederholt sich alle {eintrag.intervallTage} Tage.</p>
					{/if}

					{#if fragtHier && frage !== null}
						<div class="bestaetigung">
							<p class="bestaetigung__text" id="wegnehmen-frage-{eintrag.id}">
								Den Eintrag zu {frage.mittel}{#if frage.ort !== null}, {frage.ort}{/if} wegnehmen? Die
								Behandlung hat stattgefunden — weg ist nur die Auskunft darüber.
							</p>
							<div class="knoepfe">
								<!-- `Abbrechen` steht zuerst: die Reihenfolge im DOM ist die
								     Fokusreihenfolge, und die zusagende Handlung soll nicht die
								     erste sein. Ein Link und kein Knopf — er verwirft die Antwort
								     der action, indem er die Seite neu holt. -->
								<a class="button-quiet" href={resolve('/wellness')}>Abbrechen</a>
								<form method="POST" action="?/wegnehmen" use:enhance={versand}>
									<input type="hidden" name="id" value={eintrag.id} />
									<input type="hidden" name="bestaetigt" value="1" />
									<button
										class="button-quiet button-quiet--zerstoerend"
										type="submit"
										aria-describedby="wegnehmen-frage-{eintrag.id}"
										disabled={imFlug}
									>
										Wegnehmen
									</button>
								</form>
							</div>
						</div>
					{:else}
						<form method="POST" action="?/wegnehmen" use:enhance={versand}>
							<input type="hidden" name="id" value={eintrag.id} />
							<button class="button-quiet button-quiet--kompakt" type="submit" disabled={imFlug}>
								Wegnehmen
							</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
