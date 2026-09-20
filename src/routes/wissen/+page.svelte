<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { tick } from 'svelte';
	import type { PageProps } from './$types';
	import { VERSAND_FEHLGESCHLAGEN } from '$lib/texte';
	import { groesseAlsSatz } from '$lib/dokument';
	import ZeichenWinkel from '$lib/components/ZeichenWinkel.svelte';

	/*
		/wissen — die Blätter, alphabetisch, und das Formular für ein neues.

		Die Bauform ist die von /traenkeplan und /verwaltung: ein aufklappbares
		<details> für das Formular, dessen `open` am Fehlschlag hängt, und eine
		Live-Region, die immer im Markup steht. Der ausführliche Grund für jedes
		dieser Stücke steht dort; hier stehen nur die Unterschiede.

		**Ein einziges Formular und keines je Zeile.** /verwaltung und /traenkeplan
		tragen ihres an jeder Zeile einer Liste und brauchen darum `zeile` in der
		Antwort, um zu wissen, welches aufklappt. Hier steht es einmal unter der
		Liste: das Anlegen gehört zu keinem Blatt, sondern zur Seite. `zeile` bleibt
		in jeder Abweisung dieser Route null.
	*/

	const { data, form }: PageProps = $props();

	/*
		Ein Wurf in der action kommt als `result.type === 'error'` zurück. Der Satz
		steht in derselben Live-Region wie ein Fehlschlag der action; einheitlich
		auf allen Seiten, entschieden am 2026-08-28 zu Eintrag 32 der
		zurückgestellten Arbeit.
	*/
	/**
		Die Rückmeldung des Löschens — die einzige, die auf dieser Seite landet.

		Das Anlegen leitet auf das frische Blatt weiter und meldet dort; das
		Löschen kann das nicht, weil die Seite, auf die es weiterleiten müsste,
		gerade verschwunden ist.

		**Eine Abweisung löscht sie**, aus demselben Grund wie auf /wissen/[id]:
		`use:enhance` hält die Adresse fest, `data.geloescht` bliebe wahr, und der
		Erfolgssatz stünde neben einem Fehlersatz über einen anderen Vorgang.
	*/
	const rueckmeldung = $derived(form !== null ? '' : data.geloescht ? 'Gelöscht.' : '');

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

	/*
		Das Formular steht offen, sobald irgendetwas abgewiesen wurde — und zwar vom
		**Server** entschieden, nicht von einem Client-Zustand. Ohne JavaScript läuft
		kein use:enhance-Rückruf, und ein zugeklapptes Formular mit einem Fehlersatz
		darunter wäre eine Meldung über etwas, das man nicht sieht.
	*/
	const abgewiesen = $derived(
		form !== null && form.art === 'fehler' && (form.feld === 'titel' || form.feld === 'text')
	);

	/*
		**Dasselbe für das zweite Formular, seit dem 2026-09-20.** Die Seite trägt
		seither zwei Aufklapper — `Neues Blatt` und `Dokument ablegen` —, und eine
		Abweisung darf nur den aufklappen, aus dem sie kommt. Ohne die Unterscheidung
		stünde nach einem leeren Dokumenttitel das **Blatt**-Formular offen da, mit
		einem Fehlersatz, der nirgends sichtbar ist.

		Unterschieden wird am Feld und nicht an einer zusätzlichen Marke in der
		Antwort: `feld` sagt ohnehin schon, wohin der Satz gehört, und die zwei
		Formulare teilen sich keinen Feldnamen — genau dafür heissen die Felder hier
		`dokumenttitel` und `datei`.
	*/
	const abgewiesenDokument = $derived(
		form !== null &&
			form.art === 'fehler' &&
			(form.feld === 'dokumenttitel' || form.feld === 'datei')
	);

	/** Die Meldung am Titelfeld des Dokuments. */
	const fehlerAmDokumenttitel = $derived(
		form !== null && form.art === 'fehler' && form.feld === 'dokumenttitel' ? form.meldung : ''
	);

	/** Die Meldung am Dateifeld. */
	const fehlerAnDerDatei = $derived(
		form !== null && form.art === 'fehler' && form.feld === 'datei' ? form.meldung : ''
	);

	/*
		Der getippte Titel des Dokuments, serverseitig zurückgetragen.

		**Die Datei reist nicht zurück, und das ist keine Auslassung**: ein
		Dateifeld lässt sich aus Sicherheitsgründen von keiner Seite vorbelegen —
		sonst könnte eine Seite dem Browser eine Datei unterschieben. Wer abgewiesen
		wird, wählt sie erneut und findet wenigstens den Titel noch vor.
	*/
	const dokumenttitelWert = $derived(
		abgewiesenDokument && form !== null && form.art === 'fehler' ? form.eingabe : ''
	);

	/*
		Die verworfenen Eingaben, serverseitig zurückgetragen — der Titel über
		`eingabe`, der Freitext über `zweiteEingabe`. **Beide**, aus jeder
		Abweisung: ein Blatt-Freitext kann achttausend Zeichen tragen, und ihn wegen
		eines leeren Titels zu verlieren wäre der teuerste Fehlschlag dieser Seite.
		Der zweite Rückweg in ../../lib/server/abweisen.ts ist für genau diese Seite
		entstanden.
	*/
	const titelWert = $derived(form !== null && form.art === 'fehler' ? form.eingabe : '');
	const textWert = $derived(form !== null && form.art === 'fehler' ? form.zweiteEingabe : '');

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
				der Knopf dauerhaft disabled. Dieselbe Absicherung wie in
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
			/*
				Ein geglücktes Anlegen führt fort — die action leitet auf das frische
				Blatt weiter, und ein Fokus auf ein Element dieser Seite wäre einer auf
				etwas, das es gleich nicht mehr gibt. Zu setzen bleibt der Fokus darum
				nur im Fehlerfall, und zwar an das Feld, an dem der Satz steht.
			*/
			if (versandFehler !== '') {
				fehlerKasten?.focus();
				return;
			}
			if (result.type !== 'failure') return;
			const daten = result.data as { feld?: unknown } | undefined;
			const feld = typeof daten?.feld === 'string' ? daten.feld : null;
			if (feld === 'titel' || feld === 'text') {
				document.getElementById(`neu-${feld}`)?.focus();
				return;
			}
			fehlerKasten?.focus();
		};
	};
</script>

<svelte:head>
	<title>Wissen</title>
</svelte:head>

<div class="seite">
	<h1 class="seitentitel">Wissen</h1>

	<!--
		Die Live-Region des Seitenkopfs. Sie steht **immer** im Markup und ist über
		`.live:empty` aus dem Fluss genommen, solange sie leer ist — Retro-Posten
		B2: eine Region, die im selben Augenblick entsteht und ihren Text bekommt,
		wird nicht verlässlich vorgelesen.

		Nur eine, anders als auf /traenkeplan: die Erfolgsmeldung steht auf dem
		angelegten Blatt, weil die action dorthin weiterleitet.
	-->
	<p class="fehler live" bind:this={fehlerKasten} role="alert" aria-live="assertive" tabindex="-1">
		{fehlerOben}
	</p>
	<!--
		**Die zweite Live-Region dieser Seite, seit dem 2026-09-20.** Der Kommentar
		über der ersten sagte bis dahin: „Nur eine, anders als auf /traenkeplan: die
		Erfolgsmeldung steht auf dem angelegten Blatt, weil die action dorthin
		weiterleitet." Das gilt weiter für das Anlegen — nur landet hier seither
		auch das Löschen von /wissen/[id], und das hat kein Blatt mehr, auf dem es
		melden könnte.

		Wie jede Region steht sie **immer** im Markup und ist über `.live:empty`
		aus dem Fluss genommen, solange sie leer ist (Retro-Posten B2).

		**Sie trägt den Fokusgriff, obwohl hier kein Fokus hinspringt** — und das
		ist eine zurückgenommene Entscheidung. Der erste Entwurf liess `tabindex`
		und `bind:this` weg, mit dem Argument: der Vorgang ist auf der vorigen
		Seite passiert, der Fokus steht nach einer Weiterleitung ohnehin am
		Dokumentanfang, und eine Zusage ohne Leser ist eine Einladung.

		`smoke` hat widersprochen, und zwar zu Recht: die Wache verlangt den Griff
		von **jeder** Meldungsregion des Baums, und genau dafür gibt es sie. Eine
		Region ohne ihn ist die eine, die beim nächsten Umbau vergessen wird —
		dann, wenn ein Sprung nötig würde. Gleichförmigkeit über acht Regionen
		wiegt schwerer als die eine, an der die Verdrahtung heute nichts tut.
	-->
	<p class="meldung live" bind:this={meldungKasten} role="status" aria-live="polite" tabindex="-1">
		{rueckmeldung}
	</p>

	<p class="hinweis">
		Ein Blatt gilt für den ganzen Garten, nicht für ein Beet. Wer eines ändert, ändert es für alle —
		es gibt keine Versionen und keinen Autor.
	</p>

	<!--
		**Die Suche, seit dem 2026-09-20 (Entscheid Manuel).**

		**Ein echtes GET-Formular** und kein Feld mit `use:enhance`. Das ist die
		eine Entscheidung, aus der alles Übrige folgt:

		  - Sie **trägt ohne JavaScript**. Ein Feld, das im Browser filtert, wäre
		    auf dem zweiten Weg ein Feld, das nichts tut.
		  - Die Suche steht danach **in der Adresse** und ist teilbar. Wer einen
		    Fund weitergibt, gibt den Link weiter.
		  - Der Zurück-Knopf führt zur ungefilterten Liste und nicht aus der Seite
		    heraus.

		**Kein `method="POST"` und keine action**: eine Suche ändert nichts, und
		ein POST machte aus jedem Zurück-Knopf eine Nachfrage des Browsers, ob das
		Formular erneut geschickt werden soll.

		**Kein `action`-Attribut überhaupt**: ein GET-Formular ohne Ziel schickt an
		die eigene Adresse, und genau das ist gewollt. Gate-Regel 11 liest
		`action="?/…"` und meint die form actions dieser Seite — die zwei stehen
		weiter unten und sind davon unberührt.

		`type="search"` gibt der Bildschirmtastatur eine Suchtaste und dem Feld
		die Löschtaste des Browsers; die Beschriftung steht sichtbar da und nicht
		als `placeholder`, der beim ersten Zeichen verschwände.

		**Nur, wenn es etwas zu durchsuchen gibt** — und das heisst hier: solange
		nicht gesucht wird und beide Listen leer sind. Ohne den zweiten Teil
		verschwände das Feld genau dann, wenn eine Suche nichts findet, und man
		käme aus dem leeren Ergebnis nicht mehr heraus.
	-->
	{#if data.blaetter.length > 0 || data.dokumente.length > 0 || data.suche !== ''}
		<form class="suche" method="GET">
			<label class="feld__beschriftung" for="wissen-suche">Suchen</label>
			<div class="suche__zeile">
				<input
					class="feld"
					type="search"
					id="wissen-suche"
					name="suche"
					value={data.suche}
					maxlength={data.suchgrenze}
					autocomplete="off"
				/>
				<button class="button-quiet" type="submit">Suchen</button>
			</div>
			<!--
				Der Weg zurück zur ganzen Liste. **Ein Link und kein zweiter Knopf**:
				er setzt keinen Wert, er lässt den Parameter weg — und das ist genau
				das, was `/wissen` ohne Abfrageteil tut.

				Er steht nur da, wenn gesucht wird. Ein `Alles zeigen` über einer
				ungefilterten Liste wäre ein Griff ohne Wirkung.
			-->
			{#if data.suche !== ''}
				<p class="hinweis">
					<a href={resolve('/wissen')}>Alles zeigen</a>
				</p>
			{/if}
		</form>
	{/if}

	{#if data.suche !== '' && data.blaetter.length === 0 && data.dokumente.length === 0}
		<!--
			**Der zweite leere Zustand, und er ist ein anderer.** `Noch nichts
			aufgeschrieben.` wäre hier falsch: es ist etwas da, es passt nur nichts
			zum Gesuchten. Ein Zustand, zwei Ursachen, zwei Sätze — dieselbe
			Unterscheidung wie auf /archiv, und dieselbe Gefahr, wenn sie fehlte:
			jemand sucht ein Wort, liest, im Garten sei nichts aufgeschrieben, und
			glaubt es.
		-->
		<p class="leer">Nichts gefunden zu „{data.suche}".</p>
	{:else if data.blaetter.length === 0 && data.dokumente.length === 0}
		<!--
			Der leere Zustand sagt, was gilt, und der Weg heraus steht darunter.

			**Er zählt seit dem 2026-09-20 beide Arten**: solange irgendetwas da ist,
			ist die Seite nicht leer. Ein `Noch nichts aufgeschrieben.` über einer
			Liste von drei Dokumenten wäre eine Falschaussage — und der Satz bleibt
			trotzdem, wie er ist. Eine Datei legt man ab, man schreibt sie nicht auf;
			was hier fehlt, ist beides, und der kürzere der zwei Sätze trägt den
			leeren Garten.
		-->
		<p class="leer">Noch nichts aufgeschrieben.</p>
	{:else}
		<!--
			Die Liste trägt einen zugänglichen Namen über die Marke — sonst heisst sie
			„Liste mit 7 Einträgen". Dieselbe Bauform wie `Offen` auf `/` und
			`Alle Einzelaufgaben` auf /einzelaufgaben.
		-->
		{#if data.blaetter.length > 0}
			<h2 class="marke" id="blaetter-marke">Blätter</h2>
			<ul class="liste liste--getrennt" aria-labelledby="blaetter-marke">
				{#each data.blaetter as blatt (blatt.id)}
					<li class="karte karte--eng">
						<!--
							Der Titel **ist** der Link, und der Link füllt die Karte: das
							Trefferfeld ist damit die ganze Zeile und nicht ein Wort darin.
							`.zeile__text` bringt den Umbruch für getippten Text aus dem
							geteilten Stilblatt mit — zweihundert Zeichen ohne Leerzeichen
							liefen bei 375px sonst aus der Box.

							resolve() ist Pflicht für interne Ziele
							(svelte/no-navigation-without-resolve); ein dynamisches Segment
							reist als zweites Argument mit, nicht als zusammengebaute
							Zeichenkette.
						-->
						<a
							class="blattlink zeile__text"
							href={resolve('/wissen/[id]', { id: String(blatt.id) })}
						>
							{blatt.titel}
							<!--
								**Die Fundstelle, und nur bei einem Treffer im Text.** Steht der
								Begriff schon im Titel, ist die Zeile aus sich heraus
								verständlich, und der Ausschnitt wiederholte ihn nur — die
								Abfrageschicht liefert dann null (siehe blaetterSuchen).

								Sie steht **im** Link, wie die Grösse an einer Dokumentzeile und
								aus demselben Grund: sonst wäre die Zeile zwei Ziele, und das
								Trefferfeld verlöre genau den Teil, der den Griff mit
								Handschuhen trägt.

								Ohne sie sähe ein Treffer, dessen Wort nur im Text steht, aus
								wie ein Fehler der Suche: `Gute Nachbarn` als Antwort auf
								`Brennnessel` beantwortet die Frage nicht, warum die Zeile da
								ist.
							-->
							{#if blatt.fundstelle !== null}
								<span class="fundstelle">{blatt.fundstelle}</span>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		{/if}

		<!--
			**Die Dokumente, gleichberechtigt neben den Blättern** (Entscheid Manuel,
			2026-09-20).

			**Zwei Listen und keine gemischte.** Auf /archiv stehen zwei Quellen in
			**einer** Liste, und dort ist das richtig: was dort zählt, ist der
			Zeitpunkt, und getan ist getan. Hier zählt, wonach man sucht, und die
			zwei Arten beantworten verschiedene Fragen — ein Blatt liest man auf dem
			Telefon im Beet, ein PDF öffnet man, wenn man es genau wissen will. Eine
			gemischte Liste müsste an jeder Zeile sagen, welche Art sie ist; zwei
			Listen sagen es einmal in der Marke darüber.

			**Beide alphabetisch, beide für alle gleich**, und beide ohne Autor.

			Jede Liste erscheint nur, wenn sie Zeilen hat: eine Marke über einer
			leeren Liste nähme Platz weg, um nichts mitzuteilen — dieselbe Regel wie
			bei den Blöcken auf `/`.
		-->
		{#if data.dokumente.length > 0}
			<h2 class="marke" id="dokumente-marke">Dokumente</h2>
			<ul class="liste liste--getrennt" aria-labelledby="dokumente-marke">
				{#each data.dokumente as dokument (dokument.id)}
					<li class="karte karte--eng">
						<!--
							Derselbe Bau wie eine Blattzeile: der Titel **ist** der Link, und
							der Link füllt die Karte. Was dazukommt, ist die Grösse — die eine
							Auskunft, die vor dem Antippen zählt, weil am Telefon im Garten der
							Unterschied zwischen 200 KB und 12 MB die Frage ist, ob man jetzt
							darauf wartet.

							**Sie steht im Link und nicht daneben**: sonst wäre die Zeile zwei
							Ziele — eines, das führt, und eines, das nur danebensteht — und das
							Trefferfeld verlöre genau den Teil, der den Griff mit Handschuhen
							trägt.

							**Der Link führt auf die Seite über das Dokument und nicht auf die
							Datei.** Wer hier tippt, bekommt keinen Download, sondern den Ort,
							an dem steht, welche Datei das ist und was mit ihr geht. Die
							Begründung in ganzer Länge steht am Kopf jener Route.
						-->
						<a
							class="blattlink zeile__text"
							href={resolve('/wissen/dokument/[id]', { id: String(dokument.id) })}
						>
							{dokument.titel}
							<span class="dokumentgroesse">{groesseAlsSatz(dokument.groesse)}</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}

	<!--
		Das Anlegen. Ein <details> und keine eigene Seite: Nachschlagen und
		Ergänzen sind dieselbe Bewegung, und <details> bringt das Auf und Zu ohne
		JavaScript mit. Die Bauform ist die geteilte `.zeilenform` aus Epic 3 —
		dritte Wurfstelle nach /verwaltung und /traenkeplan.

		Das <form> trägt ein **literales** action="?/anlegen": Gate-Regel 11 leitet
		die Route aus dem Verzeichnis der Datei ab und hält den Namen gegen die
		actions der Nachbardatei. Ein dynamisches action={…} machte sie blind.
	-->
	<details class="zeilenform" open={abgewiesen}>
		<summary class="zeilenform__griff">
			<span>Neues Blatt</span>
			<ZeichenWinkel class="aufklapp" />
		</summary>
		<form class="zeilenform__formular" method="POST" action="?/anlegen" use:enhance={versand}>
			<div>
				<label class="feld__beschriftung" for="neu-titel">Titel</label>
				<input
					class="feld"
					id="neu-titel"
					name="titel"
					type="text"
					required
					maxlength={data.titelGrenze}
					value={titelWert}
					aria-invalid={fehlerAmTitel !== '' ? 'true' : undefined}
					aria-describedby={fehlerAmTitel !== '' ? 'neu-titel-fehler' : undefined}
				/>
				<!--
					Der Satz steht ausserhalb des Feldes und immer im Markup, mit
					`.live:empty` aus dem Fluss, solange er leer ist — dieselbe Bauform
					wie an jeder anderen Feldmeldung des Produkts.
				-->
				<p class="fehler live" id="neu-titel-fehler" role="alert" aria-live="assertive">
					{fehlerAmTitel}
				</p>
			</div>
			<div>
				<label class="feld__beschriftung" for="neu-text">Text</label>
				<!--
					`.feld textfeld` — die Mindesthöhe und das senkrechte Ziehen kommen
					seit dieser Story aus dem geteilten Stilblatt und nicht mehr lokal aus
					/monatsplan.

					Kein Editor und keine Werkzeugleiste: ein Textfeld, Absätze und
					Zeilenumbrüche, sonst nichts. Was hier steht, steht auf dem Blatt.

					Der führende Umbruch vor dem Wert ist Pflicht: ein HTML-Parser verwirft
					den ersten Zeilenumbruch direkt nach dem Starttag, und ein
					zurückgetragener Text, der mit einer Leerzeile beginnt, käme sonst um
					genau diese Zeile gekürzt zurück. Die Begründung in ganzer Länge steht
					in der Nachbarseite.
				-->
				<textarea
					class="feld textfeld"
					id="neu-text"
					name="text"
					required
					maxlength={data.textGrenze}
					aria-invalid={fehlerAmText !== '' ? 'true' : undefined}
					aria-describedby={fehlerAmText !== '' ? 'neu-text-fehler' : undefined}
					>{'\n' + textWert}</textarea
				>
				<p class="fehler live" id="neu-text-fehler" role="alert" aria-live="assertive">
					{fehlerAmText}
				</p>
			</div>
			<button class="button-quiet" type="submit" disabled={imFlug}>Anlegen</button>
		</form>
	</details>

	<!--
		**Das zweite Formular dieser Seite, seit dem 2026-09-20** — eine Datei
		ablegen. Dieselbe `.zeilenform`-Bauform wie das Anlegen darüber, und
		bewusst **darunter**: geschrieben wird häufiger als abgelegt.

		**`enctype="multipart/form-data"` ist Pflicht und nicht Zierde.** Ohne
		dieses Attribut schickt der Browser vom Dateifeld nur den **Namen** als
		Text, und der Server bekäme eine Zeichenkette statt einer Datei — ein
		Fehlschlag, der aussieht wie „keine Datei gewählt", obwohl eine gewählt
		war. Er gilt auch für den Weg mit JavaScript: `use:enhance` baut seine
		FormData aus genau diesem Formular.

		Literales action="?/hochladen" wegen Gate-Regel 11.
	-->
	<details class="zeilenform" open={abgewiesenDokument}>
		<summary class="zeilenform__griff">
			<span>Dokument ablegen</span>
			<ZeichenWinkel class="aufklapp" />
		</summary>
		<form
			class="zeilenform__formular"
			method="POST"
			action="?/hochladen"
			enctype="multipart/form-data"
			use:enhance={versand}
		>
			<div>
				<label class="feld__beschriftung" for="neu-dokumenttitel">Titel</label>
				<input
					class="feld"
					id="neu-dokumenttitel"
					name="dokumenttitel"
					type="text"
					required
					maxlength={data.titelGrenze}
					value={dokumenttitelWert}
					aria-invalid={fehlerAmDokumenttitel !== '' ? 'true' : undefined}
					aria-describedby={fehlerAmDokumenttitel !== '' ? 'neu-dokumenttitel-fehler' : undefined}
				/>
				<p class="fehler live" id="neu-dokumenttitel-fehler" role="alert" aria-live="assertive">
					{fehlerAmDokumenttitel}
				</p>
			</div>
			<div>
				<label class="feld__beschriftung" for="neu-datei">PDF-Datei</label>
				<!--
					**`accept="application/pdf"` filtert den Dateidialog und prüft
					nichts.** Es ist eine Bequemlichkeit für den Griff am Telefon, und
					jeder Browser lässt sich darüber hinwegsetzen; geprüft wird auf dem
					Server, und zwar zweimal — der gemeldete Typ und die ersten Bytes der
					Datei (siehe die action in der Nachbardatei).

					**Ohne `class="feld"`**: jene Regel setzt Kante, Innenabstand und
					Höhe für ein Textfeld, und ein Dateifeld ist keines — es rendert in
					jedem Browser seinen eigenen Knopf, und der sässe dann schief in einem
					fremden Rahmen.

					Der Satz darunter nennt die Grenze. Er steht **immer** da und nicht
					erst nach einem Fehlschlag: eine Grenze, die man erst kennenlernt,
					indem man sie überschreitet, kostet den ganzen Upload.
				-->
				<input
					id="neu-datei"
					name="datei"
					type="file"
					accept="application/pdf"
					required
					aria-invalid={fehlerAnDerDatei !== '' ? 'true' : undefined}
					aria-describedby="neu-datei-grenze{fehlerAnDerDatei !== '' ? ' neu-datei-fehler' : ''}"
				/>
				<p class="hinweis hinweis--am-feld" id="neu-datei-grenze">
					Nur PDF, höchstens {data.dateigrenzeMb} MB.
				</p>
				<p class="fehler live" id="neu-datei-fehler" role="alert" aria-live="assertive">
					{fehlerAnDerDatei}
				</p>
			</div>
			<button class="button-quiet" type="submit" disabled={imFlug}>Ablegen</button>
		</form>
	</details>
</div>

<style>
	/*
		Der Titel als Zeilenziel. Die Karte bringt Fläche, Kante und Innenabstand
		mit; hier bleibt, was den Link zum Trefferfeld über die volle Breite macht.

		`display: block` und `min-height` statt eines Innenabstands: die Karte hat
		ihren schon, und zwei Abstände übereinander rissen die Zeile auseinander.
		Die 44px sind der Boden aus UX-DR13 — mit Handschuhen im Beet trifft man
		keine Textzeile.

		Ohne Unterstreichung, weil die ganze Zeile ein Ziel ist und eine Karte
		voller unterstrichener Titel wie ein Formular aussähe; die Akzentfarbe und
		die action-Rolle sagen, dass hier etwas passiert.
	*/
	.blattlink {
		display: block;
		align-content: center;
		min-height: var(--touch);
		color: var(--accent);
		font-family: var(--action-font);
		font-size: var(--action-size);
		font-weight: var(--action-weight);
		line-height: var(--action-line);
		text-decoration: none;
	}

	/*
		Das Suchformular. Beschriftung oben, darunter Feld und Knopf nebeneinander.

		**Feld und Knopf in einer Zeile, und das ist die Ausnahme zu `.knoepfe`**,
		das im geteilten Blatt alles untereinander stellt: dort stehen zwei
		gleichrangige Handlungen, hier ein Feld und der Griff, der es abschickt.
		Die zwei gehören zusammen, und bei 375px bleibt neben einem Knopf von
		rund 90px genug Feld — `flex: 1` gibt ihm allen übrigen Platz, `min-width:
		0` lässt es wirklich schrumpfen statt seine Vorgabebreite zu behaupten.

		`align-items: stretch` ist die Vorgabe und bleibt es: so ist der Knopf
		genau so hoch wie das Feld, ohne dass eine Höhe irgendwo als Zahl steht.
	*/
	.suche {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.suche__zeile {
		display: flex;
		gap: var(--space-2);
	}

	.suche__zeile .feld {
		flex: 1;
		min-width: 0;
	}

	/*
		Der Ausschnitt aus dem Blatttext an einer Trefferzeile — **im** Link und
		trotzdem als Nebentext, wörtlich dieselbe Erwägung wie bei `.dokumentgroesse`
		darunter: der Titel ist die Aussage, die Fundstelle ist die Begründung
		dazu, und beide stehen im selben Ziel, damit die ganze Zeile antippbar
		bleibt.

		Der Unterschied zur Grösse ist der Umbruch: eine Fundstelle ist bis zu 120
		Zeichen lang und **soll** über mehrere Zeilen laufen. `overflow-wrap`
		erbt sie von `.zeile__text` am Link.
	*/
	.fundstelle {
		display: block;
		margin-block-start: var(--space-1);
		color: var(--ink-secondary);
		font-family: var(--meta-font);
		font-size: var(--meta-size);
		font-weight: var(--meta-weight);
		line-height: var(--meta-line);
	}

	/*
		Die Grösse an einer Dokumentzeile — **im** Link und trotzdem als Nebentext.

		Sie steht im Link, damit das Trefferfeld die ganze Zeile bleibt (die
		Begründung steht am Markup). Damit erbt sie dessen Akzentfarbe und
		Schriftrolle, und beides ist für eine Zahl daneben zu laut: der Titel ist
		die Aussage, die Grösse ist die Fussnote dazu. Diese Regel nimmt beides
		zurück, ohne den Link aufzutrennen.

		`--ink-secondary` und die meta-Rolle sind dieselben Werte, die `.hinweis`
		im geteilten Blatt für jeden anderen Nebentext setzt. Sie stehen hier
		ausgeschrieben und nicht über eine zweite Klasse am selben Element: eine
		`.hinweis` in einem Link wäre eine Regel, die gegen die Linkfarbe ankämpft,
		und wer eine davon ändert, hätte zwei Kämpfe statt einem.

		`display: block` setzt sie unter den Titel statt dahinter: bei 375px ist
		hinter einem zweihundert Zeichen langen Titel kein Platz mehr, und eine
		Zahl, die in der letzten Zeile mitschwimmt, liest sich als Teil des Texts.
	*/
	.dokumentgroesse {
		display: block;
		color: var(--ink-secondary);
		font-family: var(--meta-font);
		font-size: var(--meta-size);
		font-weight: var(--meta-weight);
		line-height: var(--meta-line);
	}
</style>
