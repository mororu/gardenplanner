<script lang="ts">
	import { resolve } from '$app/paths';
	import { monatUndJahr } from '$lib/client/utils/date';
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
		Zeitpunkt des Abhakens aus der Abfrage, und damit stehen die Zeilen eines
		Monats zwangsläufig beieinander: es genügt, die laufende Gruppe
		weiterzuführen, solange der Name derselbe bleibt. Das ist die eine Stelle,
		an der diese Komponente sich auf die Ordnung der Abfrage verlässt, und
		darum steht es hier ausgeschrieben — wer dort das `desc` gegen ein `asc`
		tauscht, dreht hier nicht bloss die Reihenfolge um, sondern bekommt
		dieselbe Gruppierung in der anderen Richtung; wer die Ordnung ganz
		herausnimmt, bekommt denselben Monat mehrfach.

		Der Monatsname trägt sein Jahr und ist darum als Schlüssel eindeutig —
		anders als ein blosses `September`, das im zweiten Gartenjahr zwei Gruppen
		zusammenlegte. Die Begründung steht an monatUndJahr.
	*/
	const gruppen = $derived.by(() => {
		const liste: { monat: string; aufgaben: typeof data.erledigte }[] = [];
		for (const aufgabe of data.erledigte) {
			const monat = monatUndJahr(aufgabe.erledigtAm);
			const laufende = liste.at(-1);
			if (laufende !== undefined && laufende.monat === monat) laufende.aufgaben.push(aufgabe);
			else liste.push({ monat, aufgaben: [aufgabe] });
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
	eine abgehakte Zeile ist Historie. Die Seite beantwortet die eine Frage, die
	das Produkt bis dahin nirgends beantwortete — was ist schon getan —, und sie
	beantwortet sie **ohne Namen**: die Abfrage reicht `completed_by` nicht heraus,
	der Zeilentyp verbietet es, und darum kann hier auch dann keiner stehen, wenn
	eine spätere Änderung ihn zeigen wollte (AD-5).

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
		Was abgehakt wurde, bleibt hier stehen — ohne Namen und unveränderlich. Ein Fehlgriff lässt sich
		auf der <a href={resolve('/')}>Startseite</a> zurücknehmen, solange die Zeile noch dasteht.
	</p>

	{#if gruppen.length === 0}
		<!-- Der leere Zustand sagt, was gilt. Ein Weg heraus gehört hier nicht hin: er führte zum Abhaken, und das tut man im Garten und nicht im Archiv. -->
		<p class="leer">Noch nichts abgehakt.</p>
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
				{#each gruppe.aufgaben as aufgabe (aufgabe.id)}
					<li class="karte karte--eng">
						<!--
							`.zeile__text` bringt den Umbruch für getippten Text aus dem
							geteilten Stilblatt mit: zweihundert Zeichen ohne Leerzeichen
							liefen bei 375px sonst aus der Box.

							Nur der Text, kein Datum daneben. Der Monat steht über der Gruppe,
							und das ist die Auflösung, die diese Seite braucht — wer im Oktober
							den Monatsplan schreibt, will wissen, was der September gebracht
							hat, nicht an welchem Dienstag. Ein Tagesdatum an jeder Zeile
							machte die Liste unruhig und beantwortete keine Frage, die jemand
							stellt.
						-->
						<p class="fliesstext zeile__text">{aufgabe.text}</p>
					</li>
				{/each}
			</ul>
		{/each}
	{/if}
</div>
