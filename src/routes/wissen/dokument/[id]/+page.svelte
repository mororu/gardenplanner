<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { tick } from 'svelte';
	import type { PageProps } from './$types';
	import { groesseAlsSatz } from '$lib/dokument';
	import { VERSAND_FEHLGESCHLAGEN } from '$lib/texte';

	/*
		/wissen/dokument/[id] — ein abgelegtes PDF.

		**Die schmalste Seite dieses Produkts, und das ist ihr Entwurf.** Sie zeigt
		den Titel, sagt, welche Datei darunter liegt, und hat genau zwei Wege: den
		zum Inhalt und, für eine Adminperson, den weg damit. Kein Ändern — eine
		Datei tauscht man nicht um, man legt die neue ab und nimmt die alte weg;
		ein `Ersetzen` wäre genau die Versionsgeschichte, die es auf /wissen
		ausdrücklich nicht gibt.

		Die Bauform der Live-Regionen und des Versands ist die von /wissen/[id];
		hier stehen nur die Unterschiede.
	*/

	const { data, form }: PageProps = $props();

	/**
		Die Rückmeldung des Ablegens.

		Nur eine, anders als beim Blatt: hier wird nichts geändert, und das
		Löschen leitet auf die Liste weiter, wo sein Satz steht.

		**Eine Abweisung löscht sie.** `use:enhance` hält die Adresse fest,
		`data.angelegt` bliebe wahr, und der Erfolgssatz stünde neben einem
		Fehlersatz über einen anderen Vorgang. Dieselbe Regel wie auf den
		Nachbarseiten.
	*/
	const rueckmeldung = $derived(form !== null ? '' : data.angelegt ? 'Abgelegt.' : '');

	let versandFehler = $state('');

	/** Die Meldung eines Fehlschlags. Diese Seite hat kein Feld, also nur eine. */
	const fehlerOben = $derived(
		versandFehler !== ''
			? versandFehler
			: form !== null && form.art === 'fehler'
				? form.meldung
				: ''
	);

	/**
		Die Rückfrage vor dem Löschen — die Antwort des **ersten** POST.

		Sie entsteht auf dem Server und nicht hier, damit sie auch ohne JavaScript
		steht: ein `confirm()` im Browser wäre auf dem zweiten Weg gar nicht da.
		Dieselbe Bauform wie beim Blatt.
	*/
	const frage = $derived(
		form !== null && form.art === 'fragenLoeschen'
			? { titel: form.titel, dateiname: form.dateiname }
			: null
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
				der Knopf dauerhaft disabled. Dieselbe Absicherung wie überall.

				Ein Wurf in der action kommt als `result.type === 'error'` zurück und
				bekommt den geteilten Satz, statt die Seite durch die Fehlergrenze zu
				ersetzen (Gate-Regel 17).
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
			/*
				**Eine Rückfrage bekommt keinen Fokussprung nach oben.** Sie ist die
				Antwort auf den ersten POST und steht dort, wo der Knopf stand; der
				Blick soll bleiben. Dieselbe Entscheidung wie beim Blatt.
			*/
			if (form !== null && form.art === 'fragenLoeschen') return;
			if (form !== null && form.art === 'fehler') {
				fehlerKasten?.focus();
				return;
			}
			meldungKasten?.focus();
		};
	};
</script>

<svelte:head>
	<title>{data.dokument.titel}</title>
</svelte:head>

<div class="seite">
	<!--
		Der Titel des Dokuments ist der Titel der Seite. `.zeile__text` bringt den
		Umbruch für getippten Text mit: zweihundert Zeichen ohne Leerzeichen liefen
		bei 375px sonst aus der Box.
	-->
	<h1 class="seitentitel zeile__text">{data.dokument.titel}</h1>

	<!--
		Die zwei Live-Regionen des Seitenkopfs. Beide stehen **immer** im Markup und
		sind über `.live:empty` aus dem Fluss genommen, solange sie leer sind —
		Retro-Posten B2.
	-->
	<p class="meldung live" bind:this={meldungKasten} role="status" aria-live="polite" tabindex="-1">
		{rueckmeldung}
	</p>
	<p class="fehler live" bind:this={fehlerKasten} role="alert" aria-live="assertive" tabindex="-1">
		{fehlerOben}
	</p>

	<!--
		Was unter dem Titel liegt: der Dateiname und die Grösse, in einer Zeile.

		**Beides und nicht nur eines.** Der Name sagt, welche Datei das ist — die
		Frage, die vor dem Löschen zählt. Die Grösse sagt, was ein Antippen kostet;
		am Telefon im Garten ist der Unterschied zwischen 200 KB und 12 MB die
		Frage, ob man jetzt darauf wartet.

		`.hinweis--ziffern` setzt die Zeile in die Ziffernrolle, wie an jeder
		anderen Stelle, an der eine Zahl in einem Nebentext steht.

		**Kein Datum.** Es gäbe eines (`created_at`), und es hat hier so wenig zu
		suchen wie bei einem Blatt: ein `abgelegt am` wäre der erste Schritt zu
		einer Historie, die /wissen ausdrücklich nicht führt.
	-->
	<p class="hinweis hinweis--ziffern zeile__text">
		{data.dokument.dateiname} · {groesseAlsSatz(data.dokument.groesse)}
	</p>

	<!--
		Der Weg zum Inhalt. **Ein gewöhnlicher Link und kein eingebetteter
		Betrachter**: der Browser des Geräts kann PDF besser, als diese Seite es
		nachbauen könnte, und ein `<iframe>` lüde mehrere Megabyte, bevor jemand
		danach gefragt hat.

		**`target="_blank"` mit `rel="noopener"`**: das Dokument öffnet neben der
		Anwendung und nicht an ihrer Stelle — wer es gelesen hat, ist mit einem
		Griff zurück in der Liste, statt sich durch die Geschichte des Browsers zu
		arbeiten. `noopener` ist dabei Pflicht und keine Zierde: ohne es bekäme das
		geöffnete Dokument über `window.opener` einen Griff an diese Seite.

		resolve() ist Pflicht für interne Ziele (svelte/no-navigation-without-resolve);
		das dynamische Segment reist als zweites Argument mit.
	-->
	<a
		class="button-primary"
		href={resolve('/wissen/dokument/[id]/datei', { id: String(data.dokument.id) })}
		target="_blank"
		rel="noopener"
	>
		Dokument öffnen
	</a>

	<!--
		Das Löschen — **nur für Adminpersonen, und der Griff fehlt sonst ganz**.
		Dieselbe Haltung und dieselbe Bauform wie beim Blatt: kein ausgegrauter
		Knopf, keine Erklärung, warum er nicht geht.

		Durchgesetzt wird es in der action über `adminOderWeg`; dieser Zweig malt
		nur.

		Literales action="?/loeschen" wegen Gate-Regel 11.
	-->
	{#if data.istAdmin}
		{#if frage !== null}
			<div class="bestaetigung">
				<p class="bestaetigung__text" id="loeschen-frage">
					„{frage.titel}" löschen? Die Datei {frage.dateiname} ist dann für alle weg — es gibt keine Versionen
					und keinen Papierkorb.
				</p>
				<div class="knoepfe">
					<!-- `Abbrechen` steht zuerst: die Reihenfolge im DOM ist die
					     Fokusreihenfolge, und die zusagende Handlung soll nicht die erste
					     sein. Ein Link und kein Knopf — er verwirft die Antwort der action,
					     indem er die Seite neu holt. -->
					<a
						class="button-quiet"
						href={resolve('/wissen/dokument/[id]', { id: String(data.dokument.id) })}
					>
						Abbrechen
					</a>
					<form method="POST" action="?/loeschen" use:enhance={versand}>
						<input type="hidden" name="bestaetigt" value="1" />
						<button
							class="button-quiet button-quiet--zerstoerend"
							type="submit"
							aria-describedby="loeschen-frage"
							disabled={imFlug}
						>
							Löschen
						</button>
					</form>
				</div>
			</div>
		{:else}
			<form method="POST" action="?/loeschen" use:enhance={versand}>
				<button class="button-quiet button-quiet--zerstoerend" type="submit" disabled={imFlug}>
					Dokument löschen
				</button>
			</form>
		{/if}
	{/if}

	<!--
		Der Weg zurück zur Liste — wie beim Blatt, und aus demselben Grund: wer über
		die Weiterleitung aus dem Ablegen hier gelandet ist, hat noch keine Liste
		gesehen.
	-->
	<p class="hinweis">
		<a href={resolve('/wissen')}>Alles Wissen</a>
	</p>
</div>
