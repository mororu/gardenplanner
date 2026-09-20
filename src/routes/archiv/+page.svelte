<script lang="ts">
	import { resolve } from '$app/paths';
	import { datumKurz, jahrVon, monatName } from '$lib/client/utils/date';
	import ZeichenWinkel from '$lib/components/ZeichenWinkel.svelte';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	/**
	 * Woher eine Zeile kommt, als Wort.
	 *
	 * **Die Sache und nicht der Abschnitt.** Auf `/` heissen die zwei Blöcke nach
	 * Fragen — `Zum Erledigen` und `Wer übernimmt` —, und beide klängen hier
	 * falsch: im Archiv ist nichts mehr zu erledigen und übernimmt niemand mehr.
	 * `Aufgabe` und `Termin` sind die Wörter, die AGENTS.md für die Dinge selbst
	 * festhält, und sie stimmen auch im Rückblick.
	 *
	 * **Steht seit dem 2026-09-20 oben und nicht mehr unten**, weil die Suche sie
	 * braucht: `Termin` ist ein Wort, nach dem jemand sucht, und es steht an der
	 * Zeile, ohne in ihren Daten vorzukommen.
	 */
	const herkunft = (art: (typeof data.erledigte)[number]['art']): string =>
		art === 'termin' ? 'Termin' : 'Aufgabe';

	/*
		**Die Suche, seit dem 2026-09-20 (Entscheid Manuel).**

		Sie filtert **im Browser** über die Liste, die ohnehin schon da ist, und
		schickt nichts an den Server. Das ist keine Bequemlichkeit, sondern die
		Rechnung dieser Grösse: zwanzig Leute haken eine Handvoll Aufgaben je Woche
		ab, ein Gartenjahr ergibt ein paar hundert Zeilen, und die stehen nach dem
		Laden vollständig im Speicher. Eine Suche über den Server verlangte eine
		Route, einen Parameter in der Adresse, einen Ladezustand und eine zweite
		Stelle, die entscheidet, was ein Treffer ist — für ein Ergebnis, das hier
		im selben Tastenanschlag steht.

		**Die Auslösebedingung dagegen steht wie überall in dieser Anwendung
		benannt da**: wird das Archiv je so gross, dass die load spürbar lädt,
		gehört die Einschränkung in die Abfrage, und dann trägt ein Index auf
		`completed_at` zum ersten Mal etwas (siehe die Rechnung an
		erledigteAufgabenAuflisten). Bis dahin ist jede Serverrunde Aufwand ohne
		Gegenwert.

		**Gesucht wird in allem, was an der Zeile steht** — Text, Übernehmer, das
		Herkunftswort **und das Datum**, in genau den drei Formen, in denen die
		Seite es zeigt: `15. Sep 2026` an der Zeile, `September` über der Gruppe,
		`2026` über dem Jahr.

		**Das Datum kam am 2026-09-20 dazu, und der Absatz hier stand vorher
		umgekehrt**: „ausdrücklich nicht im Datum … nach dem Monat sucht man,
		indem man ihn aufklappt". Das war eine Annahme über die Leute, und sie war
		falsch. Wer ein Suchfeld über einer nach Monaten geordneten Liste sieht,
		tippt einen Monat hinein — und bekam `Nichts gefunden`, während die Zeilen
		einen Griff weiter dastanden. Eine Suche, die genau das nicht findet,
		wonach die Seite selbst gliedert, sieht kaputt aus, und sie hat recht damit.

		**Gesucht wird in der angezeigten Form und nicht im Zeitstempel.** Das ist
		die Regel, die diese Erweiterung trägt: was auf der Seite steht, ist
		findbar; was nicht dasteht, ist es nicht. `1789…` findet nichts, und `Sep`
		findet den September, weil er so an der Zeile steht.

		`toLocaleLowerCase('de-CH')` und nicht `toLowerCase()`: die zweite Form
		hängt an der Umgebung des Browsers, und in einer türkischen fiele aus `I`
		ein punktloses `ı`. Der Unterschied ist an deutschem Text selten sichtbar
		und trotzdem der Grund, warum die Sprache hier steht und nicht weggelassen
		ist.
	*/
	let suche = $state('');
	const suchbegriff = $derived(suche.trim().toLocaleLowerCase('de-CH'));

	/**
	 * Alles, was an einer Zeile steht, als **eine** Zeichenkette in
	 * Kleinschreibung.
	 *
	 * Die drei Datumsformen kommen aus denselben Funktionen, die sie auch
	 * anzeigen — `datumKurz` an der Zeile, `monatName` über der Gruppe, `jahrVon`
	 * über dem Jahr. Das ist keine Bequemlichkeit, sondern die Zusage: die Suche
	 * findet, was dasteht, weil sie dieselbe Rechnung liest. Ein zweites
	 * Datumsformat nur für die Suche liefe am Monatsanfang auseinander, und dann
	 * fände `September` Zeilen, über denen `August` steht.
	 */
	const durchsuchbar = (zeile: (typeof data.erledigte)[number]): string =>
		[
			zeile.text,
			zeile.uebernehmer ?? '',
			herkunft(zeile.art),
			datumKurz(zeile.erledigtAm),
			monatName(zeile.erledigtAm),
			jahrVon(zeile.erledigtAm),
		]
			.join(' ')
			.toLocaleLowerCase('de-CH');
	const getroffene = $derived(
		suchbegriff === ''
			? data.erledigte
			: data.erledigte.filter((zeile) => durchsuchbar(zeile).includes(suchbegriff))
	);

	/*
		**Aufgeklappt wird alles, solange gesucht wird.**

		Das ist die eine Stelle, an der die Suche und die Aufklapper voneinander
		wissen müssen. Ohne sie fände die Suche ihre Treffer und legte sie hinter
		zugeklappte Griffe — man tippte ein Wort, die Seite bliebe scheinbar leer,
		und der einzige Hinweis wären die Griffe, die stehen bleiben. Genau dieser
		Fall ist der Grund, warum die zwei Änderungen zusammen in einen Commit
		gehören und nicht nacheinander.

		Der Ausdruck steht an **beiden** Stufen, und jede hat daneben ihre eigene
		Vorgabe für den Fall ohne Suche: das jüngste Jahr und darin der jüngste
		Monat. Die Stelle in der Liste entscheidet und nicht das Datum von heute —
		die Liste ist absteigend sortiert, also ist die erste Gruppe die jüngste,
		und in einem Garten, in dem seit Monaten nichts abgehakt wurde, ist das
		eben nicht der laufende Monat.
	*/
	const sucht = $derived(suchbegriff !== '');

	/**
	 * Was die Live-Region nach einer Suche ansagt.
	 *
	 * **Eine Trefferzahl und kein Zähler je Monat.** Der Kommentar am Markup
	 * verbietet die zweite Sorte ausdrücklich: eine Zahl an jedem Monat wäre der
	 * erste Schritt zu einer Bilanz über eine Nachbarschaft. Diese Zahl sagt
	 * nichts über einen Monat und vergleicht nichts — sie beantwortet die eine
	 * Frage, die eine Suche offenlässt, nämlich ob überhaupt etwas gefunden wurde
	 * und ob es sich lohnt, weiterzublättern. Ohne sie bliebe der Fall „ein
	 * Treffer weit unten" von „nichts gefunden" nur durch Scrollen zu
	 * unterscheiden.
	 *
	 * Leer, solange niemand sucht: eine Region, die beim Laden `340 Treffer`
	 * ansagt, hat niemand gefragt.
	 */
	const trefferSatz = $derived.by(() => {
		if (!sucht) return '';
		if (getroffene.length === 0) return 'Nichts gefunden.';
		return getroffene.length === 1 ? '1 Treffer' : `${getroffene.length} Treffer`;
	});

	/*
		Die Zeilen nach Jahr und darunter nach Monat gebündelt — **zwei Stufen seit
		dem 2026-09-17** (Entscheid Manuel). Vorher war es eine: ein Monat trug sein
		Jahr im Titel, und nach ein paar Gartenjahren stünden zwanzig Monatstitel
		untereinander auf einer Seite, die man von oben nach unten absucht.

		**Die Gruppen entstehen hier und nicht in der load**, obwohl beides ginge.
		Monat und Jahr sind Text für die Anzeige, und die eine Stelle, die einen
		Zeitstempel in Text verwandelt, ist $lib/client/utils/date — das steht dort
		als Zusage im Kopf der Datei. Eine Gruppierung auf dem Server müsste die
		Namen entweder mitschicken (dann formatiert eine zweite Stelle) oder einen
		eigenen Schlüssel erfinden (dann rechnen zwei Stellen dasselbe aus, und sie
		laufen am Monatsanfang auseinander).

		**Ein Durchlauf und kein Sortieren.** Die Liste kommt absteigend nach dem
		Zeitpunkt des Erledigens aus der load — die beide Quellen dort
		zusammensortiert —, und damit stehen die Zeilen eines Monats und die Monate
		eines Jahres zwangsläufig beieinander: es genügt, die laufende Gruppe
		weiterzuführen, solange Jahr und Monat dieselben bleiben. Das ist die eine
		Stelle, an der diese Komponente sich auf jene Ordnung verlässt, und darum
		steht es hier ausgeschrieben — wer den Vergleich in der load umdreht, dreht
		hier nicht bloss die Reihenfolge um, sondern bekommt dieselbe Gruppierung in
		der anderen Richtung; wer die Sortierung ganz herausnimmt, bekommt denselben
		Monat mehrfach.

		**Der Monatsname trägt sein Jahr nicht mehr**, denn das steht jetzt über
		ihm. Als Schlüssel ist er damit nur **innerhalb** eines Jahres eindeutig,
		und genau so wird er benutzt: die Monatsliste hängt an ihrem Jahr.
	*/
	const jahre = $derived.by(() => {
		const liste: {
			jahr: string;
			monate: { monat: string; zeilen: typeof data.erledigte }[];
		}[] = [];
		for (const zeile of getroffene) {
			const jahr = jahrVon(zeile.erledigtAm);
			const monat = monatName(zeile.erledigtAm);
			let laufendesJahr = liste.at(-1);
			if (laufendesJahr === undefined || laufendesJahr.jahr !== jahr) {
				laufendesJahr = { jahr, monate: [] };
				liste.push(laufendesJahr);
			}
			const laufenderMonat = laufendesJahr.monate.at(-1);
			if (laufenderMonat !== undefined && laufenderMonat.monat === monat) {
				laufenderMonat.zeilen.push(zeile);
			} else {
				laufendesJahr.monate.push({ monat, zeilen: [zeile] });
			}
		}
		return liste;
	});
</script>

<svelte:head>
	<title>Archiv</title>
</svelte:head>

<!--
	/archiv — die abgehakten Aufgaben, nach Monat, das Neueste zuerst.

	**Keine Aktion auf dieser Seite**, und der Grund steht in der Nachbardatei:
	eine erledigte Zeile ist Historie. Die Seite beantwortet die eine Frage, die
	das Produkt bis dahin nirgends beantwortete — was ist schon getan.

	**Zwei Arten in einer Liste** seit dem 2026-09-17: abgehakte Poolaufgaben und
	abgeschlossene Termine, zusammengeführt in der load und hier nur noch nach
	Monat gebündelt. Eine Poolzeile steht **ohne Namen** da — die Abfrage reicht
	`completed_by` nicht heraus, der Zeilentyp verbietet es, und darum kann dort
	auch dann keiner stehen, wenn eine spätere Änderung ihn zeigen wollte (AD-5).
	Eine Terminzeile trägt ihren Übernehmer, weil bei ihr jemand vor allen
	zugesagt hat; dieselbe Darstellung wie auf `Alle Termine`, aus der sie mit dem
	Abschliessen verschwindet.

	**Kein Zähler, keine Summe, kein Vergleich zwischen Monaten.** Eine Zahl je
	Monat wäre der erste Schritt zu einer Bilanz über eine Nachbarschaft, und der
	zweite wäre die Frage, warum der August schwächer ausfiel als der Juli. Die
	Liste zeigt, was getan wurde. Wer zählen will, zählt selbst.
-->
<div class="seite">
	<h1 class="seitentitel">Archiv</h1>

	<!--
		Der Satz sagt, wozu die Seite da ist und was sie **nicht** tut. Der Weg
		zurück steht mit darin, weil er die naheliegende Frage beim Lesen ist —
		eine versehentlich abgehakte Aufgabe holt man auf der Startseite zurück,
		nicht hier.

		resolve() ist Pflicht für interne Ziele (svelte/no-navigation-without-resolve).
	-->
	<p class="hinweis">
		Erledigte Aufgaben und abgeschlossene Termine, nach Monat. Hier lässt sich nichts ändern; ein
		fälschlich abgehaktes Kästchen nimmt die <a href={resolve('/')}>Startseite</a> zurück, solange die
		Zeile noch dasteht.
	</p>

	<!--
		**Das Suchfeld steht ausserhalb eines `<form>`**, und das ist eine
		Entscheidung und keine Auslassung. Ein Formular verspricht einen Versand;
		dieses Feld schickt nichts ab, es filtert eine Liste, die schon im Browser
		liegt. Mit einem `<form>` darum drückte ein Enter den voreingestellten
		Versand aus — ein GET auf dieselbe Seite, das die gefundene Ansicht
		wegwürfe.

		`type="search"` und nicht `type="text"`: die Löschtaste, die der Browser
		daran selbst rendert, ist am Telefon der kürzeste Weg zurück zur ganzen
		Liste, und die Bildschirmtastatur bekommt eine Suchtaste statt einer
		Eingabetaste.

		Die Beschriftung steht sichtbar da und nicht als `placeholder`. Ein
		Platzhalter verschwindet beim ersten Zeichen — genau dann, wenn das Feld
		erklärt werden müsste —, und er trägt in keinem Browser verlässlich einen
		zugänglichen Namen.

		**Nur, wenn es etwas zu durchsuchen gibt.** In einem Garten, in dem noch
		nichts erledigt ist, wäre das Feld eine Aufforderung ins Leere.
	-->
	{#if data.erledigte.length > 0}
		<div class="suche">
			<label class="feld__beschriftung" for="archiv-suche">Suchen</label>
			<input
				class="feld feld--suche"
				type="search"
				id="archiv-suche"
				bind:value={suche}
				autocomplete="off"
				aria-describedby="archiv-treffer"
			/>
		</div>
	{/if}

	<!--
		Die Trefferzahl in einer höflichen Live-Region. Sie steht **immer** im
		Markup, auch leer: ein Element, das erst mit seinem Text in den DOM kommt,
		liest ein Screenreader in der Regel nicht vor. Leer nimmt sie keinen Platz
		ein — dieselbe `:empty`-Regel wie auf `/` nimmt sie aus dem Fluss.

		`polite` und nicht `assertive`: eine Trefferzahl unterbricht niemanden. Sie
		hängt am Feld über `aria-describedby`, damit sie beim Tippen auch dort
		gelesen wird, wo der Fokus steht.
	-->
	<p class="hinweis live" id="archiv-treffer" role="status" aria-live="polite">{trefferSatz}</p>

	{#if data.erledigte.length === 0}
		<!-- Der leere Zustand sagt, was gilt. Ein Weg heraus gehört hier nicht hin: er führte zum Abhaken, und das tut man im Garten und nicht im Archiv. -->
		<p class="leer">Noch nichts erledigt.</p>
	{:else if jahre.length === 0}
		<!--
			**Der zweite leere Zustand, und er ist ein anderer.** „Noch nichts
			erledigt" wäre hier schlicht falsch: es ist etwas erledigt, es passt nur
			nichts zum Gesuchten. Ein Zustand, zwei Ursachen, zwei Sätze — sonst
			sucht jemand nach einem Wort, liest, im Garten sei nichts getan, und
			glaubt es.
		-->
		<p class="leer">Nichts gefunden zu „{suche.trim()}".</p>
	{:else}
		<!--
			**Ein Aufklapper je Jahr**, in der geteilten Abschnittsbauform wie auf `/`
			und auf /sitzungen.

			**Das neueste steht offen, die älteren zugeklappt.** Wer das Archiv
			öffnet, sucht fast immer im laufenden Jahr — beim Schreiben des
			Monatsplans etwa —, und ein Archiv, das ganz zugeklappt aufgeht, zeigt
			beim Öffnen nichts als Jahreszahlen. Umgekehrt wäre alles offen nach ein
			paar Jahren genau die Seite, gegen die diese Stufe gebaut ist. Der
			Vergleich läuft über die Stelle in der Liste und nicht über das Jahr von
			heute: die Liste ist absteigend, also ist die erste Gruppe die jüngste —
			und in einem Garten, in dem seit Monaten nichts abgehakt wurde, ist das
			eben nicht das Kalenderjahr.
		-->
		{#each jahre as gruppe, stelle (gruppe.jahr)}
			<details class="abschnitt" open={stelle === 0 || sucht}>
				<summary class="abschnitt__griff">
					<h2 class="abschnittstitel">{gruppe.jahr}</h2>
					<ZeichenWinkel class="aufklapp" />
				</summary>
				<div class="abschnitt__inhalt">
					{#each gruppe.monate as monatsgruppe, monatsstelle (monatsgruppe.monat)}
						<!--
							Jede Monatsliste trägt ihren zugänglichen Namen über die Marke
							darüber — sonst heisst sie „Liste mit 7 Einträgen", und auf dieser
							Seite stünden mehrere davon ununterscheidbar untereinander.
							Dieselbe Bauform wie `Offen` auf `/` und `Alle Termine` auf
							/einzelaufgaben, hier je Gruppe statt einmal je Seite.

							Die Id trägt **Jahr und Monat**: der Monatsname allein käme im
							zweiten Gartenjahr zweimal vor, und zwei gleiche Ids in einem
							Dokument sind kein Schönheitsfehler — `aria-labelledby` findet
							dann die erste, und die Liste von 2027 hiesse nach dem Monat von
							2026.

							**Der Monat ist seit dem 2026-09-20 selbst ein Aufklapper**
							(Entscheid Manuel) — die zweite Stufe, nach dem Jahr. Ein
							Gartenjahr bringt bis zu zwölf Monatslisten in **einem** Jahr, und
							aufgeklappt ist das genau die Seite, gegen die die erste Stufe
							gebaut wurde: man scrollt an hunderten Zeilen vorbei, um den
							März zu finden.

							**Die Marke bleibt die Marke und wird nicht zur Überschrift
							umgebaut.** Sie zieht nur in den Griff um: dasselbe `h3`, dieselbe
							Klasse, dieselbe Kennung, an die die Liste ihren Namen hängt. Ein
							`<summary>` ist von sich aus kein Gliederungspunkt, und ohne das
							`h3` darin verlöre diese Seite ihre zweite Ebene in der
							Überschriftenliste eines Screenreaders.

							**Leichter als das Jahr**: kein eigener Rahmen und keine eigene
							Fläche um den ganzen Block, nur der getönte Griff. Zwei
							ineinanderliegende Behälter mit Kante lägen schwerer im Bild als
							das, was sie ordnen — und die Kante des Jahres ist schon da.
						-->
						{@const marke = `monat-${gruppe.jahr}-${monatsgruppe.monat}`}
						<details class="monat" open={(stelle === 0 && monatsstelle === 0) || sucht}>
							<summary class="abschnitt__griff">
								<h3 class="marke" id={marke}>{monatsgruppe.monat}</h3>
								<ZeichenWinkel class="aufklapp" />
							</summary>
							<ul class="liste liste--getrennt monat__liste" aria-labelledby={marke}>
								{#each monatsgruppe.zeilen as zeile (zeile.schluessel)}
									<li class="karte karte--eng">
										<!--
							`.zeile__text` bringt den Umbruch für getippten Text aus dem
							geteilten Stilblatt mit: zweihundert Zeichen ohne Leerzeichen
							liefen bei 375px sonst aus der Box.
						-->
										<p class="fliesstext zeile__text">{zeile.text}</p>
										<!--
							Das Datum steht seit dem 2026-09-17 an jeder Zeile (Entscheid
							Manuel). Die erste Fassung liess es weg und verwies auf die
							Monatsüberschrift; das trägt nicht, sobald jemand eine Zeile
							wiederfinden will — `Mitte September` ist die Auskunft, nach der man
							sucht, und der Monat allein gibt sie nicht.

							**Mit Jahr und mit abgekürztem Monat** — `datumKurz`, seit dem
							2026-09-17. Das Jahr steht über der Gruppe schon; es hier zu
							wiederholen ist der billigere Handel als zwei Schreibweisen desselben
							Datums, denn dieselbe Zeile trägt diese Form auch auf `Alle Termine`,
							auf `/ernte` und auf `/sitzungen`.

							Abgekürzt, weil sie neben anderem steht: `datumLang` bleibt den
							Überschriften und den Sätzen vorbehalten. Die Begründung in ganzer
							Länge steht an `datumKurz` in $lib/client/utils/date.
							`.hinweis--ziffern` setzt sie in die Ziffernrolle — die Klasse setzt
							`tabular-nums` und sonst nichts, das angehängte Wort nimmt daran
							keinen Schaden.

							**Die Herkunft steht seit dem 2026-09-17 daneben** (Entscheid
							Manuel) und in derselben Zeile statt in einer eigenen: sie ist eine
							Angabe über die Zeile und keine zweite Aussage. In einer gemischten
							Liste trägt die eine Zeile einen Namen und die andere nicht, und
							ohne das Wort sieht das nach einer Lücke aus statt nach dem
							Unterschied, der es ist.
						-->
										<p class="hinweis hinweis--ziffern">
											{datumKurz(zeile.erledigtAm)} · {herkunft(zeile.art)}
										</p>
										<!--
							Der Name steht nur an einer Terminzeile — eine Poolaufgabe ist
							namenlos, und zwar im Typ und nicht bloss in der Anzeige. Es gibt
							darum auch keinen {:else}-Zweig mit einem Ersatzwort: `noch niemand`
							wie auf `Alle Termine` wäre hier eine Falschaussage über etwas, das
							getan ist, und `unbekannt` erklärte einen Zustand, der keiner ist.
						-->
										{#if zeile.uebernehmer !== null}
											<p class="fliesstext">{zeile.uebernehmer}</p>
										{/if}
									</li>
								{/each}
							</ul>
						</details>
					{/each}
				</div>
			</details>
		{/each}
	{/if}
</div>

<style>
	/*
		Das Suchfeld mit seiner Beschriftung darüber. Dieselbe Anordnung wie ein
		Feld in einem Formular — Beschriftung, dann Feld, untereinander —, und
		darum hier nur die zwei Zeilen, die das herstellen: `.feld` und
		`.feld__beschriftung` bringen alles Übrige aus dem geteilten Blatt mit.

		Ein eigener Behälter und nicht `.knoepfe` oder ein nacktes Geschwisterpaar:
		die Seite ist eine Spalte mit `gap`, und ohne diesen Kasten stünde zwischen
		Beschriftung und Feld derselbe Abstand wie zwischen den Abschnitten.
	*/
	.suche {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	/*
		Der Monatsaufklapper. **Ohne Kante und ohne eigene Fläche** — anders als
		`.abschnitt`, in dem er steht: die Kante des Jahres umschliesst ihn schon,
		und eine zweite darin machte aus einer Gliederung einen Stapel Kästen.

		Das `overflow: hidden` hat denselben Grund wie an `.abschnitt`: es zwingt
		die getönte Fläche des Griffs in den Radius. Ohne es stehen ihre Ecken
		quadratisch über der Rundung.

		`--radius-sm` und nicht `--radius-md`: er sitzt in einem Behälter mit
		`--radius-md`, und ein Kind mit demselben Radius wie sein Elternteil liest
		sich als verrutschte Kopie davon.
	*/
	.monat {
		border-radius: var(--radius-sm);
		overflow: hidden;
	}

	/*
		Der Abstand zwischen dem Griff und den Karten darunter. Er steht als
		Innenabstand an der Liste und nicht als `gap` am Aufklapper: ein `<details>`
		ist kein Flexcontainer, und `gap` wirkte dort nicht — eine Falle, die
		stillschweigend nichts tut statt zu brechen.
	*/
	.monat__liste {
		padding-top: var(--space-2);
	}
</style>
