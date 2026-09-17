<script lang="ts">
	import { resolve } from '$app/paths';
	import { datumKurz, jahrVon, monatName } from '$lib/client/utils/date';
	import ZeichenWinkel from '$lib/components/ZeichenWinkel.svelte';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

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
		for (const zeile of data.erledigte) {
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

	/**
	 * Woher eine Zeile kommt, als Wort.
	 *
	 * **Die Sache und nicht der Abschnitt.** Auf `/` heissen die zwei Blöcke nach
	 * Fragen — `Zum Erledigen` und `Wer übernimmt` —, und beide klängen hier
	 * falsch: im Archiv ist nichts mehr zu erledigen und übernimmt niemand mehr.
	 * `Aufgabe` und `Termin` sind die Wörter, die AGENTS.md für die Dinge selbst
	 * festhält, und sie stimmen auch im Rückblick.
	 */
	const herkunft = (art: (typeof data.erledigte)[number]['art']): string =>
		art === 'termin' ? 'Termin' : 'Aufgabe';
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

	{#if jahre.length === 0}
		<!-- Der leere Zustand sagt, was gilt. Ein Weg heraus gehört hier nicht hin: er führte zum Abhaken, und das tut man im Garten und nicht im Archiv. -->
		<p class="leer">Noch nichts erledigt.</p>
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
			<details class="abschnitt" open={stelle === 0}>
				<summary class="abschnitt__griff">
					<h2 class="abschnittstitel">{gruppe.jahr}</h2>
					<ZeichenWinkel class="aufklapp" />
				</summary>
				<div class="abschnitt__inhalt">
					{#each gruppe.monate as monatsgruppe (monatsgruppe.monat)}
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
						-->
						{@const marke = `monat-${gruppe.jahr}-${monatsgruppe.monat}`}
						<h3 class="marke" id={marke}>{monatsgruppe.monat}</h3>
						<ul class="liste liste--getrennt" aria-labelledby={marke}>
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
					{/each}
				</div>
			</details>
		{/each}
	{/if}
</div>
