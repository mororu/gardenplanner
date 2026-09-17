<script lang="ts">
	import { resolve } from '$app/paths';
	import { datumKurz, monatUndJahr } from '$lib/client/utils/date';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	/*
		Die Zeilen nach Monat gebündelt.

		**Die Gruppen entstehen hier und nicht in der load**, obwohl beides ginge.
		Der Monatsname ist Text für die Anzeige, und die eine Stelle, die einen
		Zeitstempel in Text verwandelt, ist $lib/client/utils/date — das steht dort
		als Zusage im Kopf der Datei. Eine Gruppierung auf dem Server müsste den
		Namen entweder mitschicken (dann formatiert eine zweite Stelle) oder einen
		eigenen Schlüssel erfinden (dann rechnen zwei Stellen denselben Monat aus,
		und sie laufen am Monatsanfang auseinander).

		**Ein Durchlauf und kein Sortieren.** Die Liste kommt absteigend nach dem
		Zeitpunkt des Erledigens aus der load — die beide Quellen dort
		zusammensortiert —, und damit stehen die Zeilen eines Monats zwangsläufig
		beieinander: es genügt, die laufende Gruppe weiterzuführen, solange der
		Name derselbe bleibt. Das ist die eine Stelle, an der diese Komponente sich
		auf jene Ordnung verlässt, und darum steht es hier ausgeschrieben — wer den
		Vergleich in der load umdreht, dreht hier nicht bloss die Reihenfolge um,
		sondern bekommt dieselbe Gruppierung in der anderen Richtung; wer die
		Sortierung ganz herausnimmt, bekommt denselben Monat mehrfach.

		Der Monatsname trägt sein Jahr und ist darum als Schlüssel eindeutig —
		anders als ein blosses `September`, das im zweiten Gartenjahr zwei Gruppen
		zusammenlegte. Die Begründung steht an monatUndJahr.
	*/
	const gruppen = $derived.by(() => {
		const liste: { monat: string; zeilen: typeof data.erledigte }[] = [];
		for (const zeile of data.erledigte) {
			const monat = monatUndJahr(zeile.erledigtAm);
			const laufende = liste.at(-1);
			if (laufende !== undefined && laufende.monat === monat) laufende.zeilen.push(zeile);
			else liste.push({ monat, zeilen: [zeile] });
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

	{#if gruppen.length === 0}
		<!-- Der leere Zustand sagt, was gilt. Ein Weg heraus gehört hier nicht hin: er führte zum Abhaken, und das tut man im Garten und nicht im Archiv. -->
		<p class="leer">Noch nichts erledigt.</p>
	{:else}
		{#each gruppen as gruppe (gruppe.monat)}
			<!--
				Jede Monatsliste trägt ihren zugänglichen Namen über die Marke darüber —
				sonst heisst sie „Liste mit 7 Einträgen", und auf dieser Seite stünden
				mehrere davon ununterscheidbar untereinander. Dieselbe Bauform wie `Offen`
				auf `/` und `Alle Termine` auf /einzelaufgaben, hier je Gruppe statt
				einmal je Seite.

				Die Id kommt aus dem Monatsnamen und nicht aus einem Zähler: sie bleibt
				damit dieselbe, wenn eine Gruppe dazukommt, und ein Zähler wäre eine
				zweite Ordnung neben der, die schon da ist. Das Leerzeichen muss weg —
				eine Id mit Leerzeichen ist in HTML gültig, aber in einer
				aria-labelledby-Liste trennte es den Verweis in zwei.
			-->
			{@const marke = `monat-${gruppe.monat.replace(' ', '-')}`}
			<h2 class="marke" id={marke}>{gruppe.monat}</h2>
			<ul class="liste liste--getrennt" aria-labelledby={marke}>
				{#each gruppe.zeilen as zeile (zeile.schluessel)}
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
							`.hinweis--ziffern` setzt sie in die Ziffernrolle.
						-->
						<p class="hinweis hinweis--ziffern">{datumKurz(zeile.erledigtAm)}</p>
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
	{/if}
</div>
