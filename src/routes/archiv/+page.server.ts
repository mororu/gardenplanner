import { abgeschlosseneEinzelaufgabenLesen } from '../../lib/server/db/queries/signup-tasks.ts';
import { erledigteAufgabenAuflisten } from '../../lib/server/db/queries/tasks.ts';

/*
 * /archiv — was in diesem Garten schon getan ist.
 *
 * Die Importe stehen relativ und mit .ts-Endung, und die Typen kommen aus
 * @sveltejs/kit statt aus ./$types. Der Grund ist derselbe wie in den
 * Nachbarrouten und geprüft, nicht vermutet: scripts/smoke-zugang.ts lädt dieses
 * Modul mit nacktem Node, und tsconfig.scripts.json kennt weder das virtuelle
 * ./$types noch die $lib-Zuordnung.
 *
 * **Zwei Quellen, eine Liste** — seit dem 2026-09-17 (Entscheid Manuel). Die
 * abgehakten Poolaufgaben kommen aus ./queries/tasks.ts, die abgeschlossenen
 * Termine aus ./queries/signup-tasks.ts, und **zusammengeführt wird hier und
 * nicht dort**. Das ist AD-3 und AD-4: die Aufgabenarten haben bewusst keine
 * Basistabelle und keine gemeinsame Zuständigkeitsspalte, weil sie verschieden
 * verbindlich sind. Eine Abfrage, die beide Tabellen mischte, ebnete genau den
 * Unterschied ein, den das Schema zeigen soll. Was hier entsteht, ist keine
 * dritte Aufgabenart, sondern **eine Ansicht**: getan ist getan.
 *
 * **Diese Seite hat keine action, und das ist eine Entscheidung** — dieselbe wie
 * auf /einzelaufgaben, mit einem eigenen Grund. Eine erledigte Aufgabe ist
 * Historie (FR14): sie lässt sich nicht ändern, nicht löschen und nicht von hier
 * aus wieder öffnen. Den Weg zurück gibt es für die Poolaufgabe, aber er steht
 * dort, wo der Fehlgriff passiert — auf `/`, wo die eben abgehakte Zeile noch
 * durchgestrichen dasteht und `wiederOeffnen` daneben. Ein abgeschlossener
 * Termin hat gar keinen Rückweg; die Begründung steht an
 * einzelaufgabeAbschliessen.
 *
 * scripts/smoke-zugang.ts hält das fest: dieses Modul exportiert kein `actions`.
 *
 * **Keine Zugangsschranke und keine zweite Stufe.** Der Wächter in
 * src/hooks.server.ts hat einen Aufruf ohne gültige Sitzung schon mit 403
 * abgewiesen, und lesen darf jedes aktive Mitglied. Die load nimmt darum **kein
 * Ereignis** entgegen: sie liest weder locals noch cookies noch die Adresse.
 * Alle sehen dieselbe Liste.
 *
 * **Kein Bezugszeitpunkt in den Seitendaten**, anders als bei der load von `/`.
 * Dort reist `jetzt` mit, weil die Überfälligkeit gegen eine Uhr gerechnet wird;
 * hier ändert sich nichts dadurch, dass Zeit vergeht. Die Monatsgruppen bildet
 * die Komponente aus den Zeitstempeln selbst.
 */

/**
 * Eine Zeile des Archivs — aus dem Pool oder aus den Terminen.
 *
 * **Ein flacher Typ und kein unterschiedener Verbund** über die zwei Arten. Die
 * Seite stellt an eine Zeile genau drei Fragen: was war es, wann war es getan,
 * und steht ein Name daran. Eine Art-Marke daneben beantwortete eine vierte, die
 * niemand stellt — wer im Oktober nachliest, was der September gebracht hat,
 * sucht die Arbeit und nicht die Tabelle, in der sie steht.
 *
 * `uebernehmer` ist die eine Stelle, an der man den Unterschied trotzdem sieht,
 * und das ist kein Zufall, sondern das Datenmodell: bei einem Termin hat jemand
 * **vor allen** zugesagt, und der Name gehört zur Sache. Eine Poolaufgabe ist
 * namenlos, und sie bleibt es auch hier — `completed_by` verlässt die
 * Abfrageschicht nicht (AD-5), und dieses Feld ist für jede Poolzeile null.
 *
 * **`schluessel` und nicht `id`**: die Ids kommen aus zwei Tabellen und
 * kollidieren. Zwei Zeilen mit demselben `{#each}`-Schlüssel sind kein
 * Schönheitsfehler, sondern ein Zustandsfehler — Svelte hält Knoten darüber
 * auseinander.
 */
export type Archivzeile = {
	schluessel: string;
	art: Archivart;
	text: string;
	erledigtAm: number;
	uebernehmer: string | null;
};

/**
 * Woher eine Zeile kommt — aus dem Pool oder aus den Terminen.
 *
 * **Seit dem 2026-09-17, und das nimmt eine Entscheidung zurück** (Entscheid
 * Manuel). Der Absatz darüber stand hier einen Tag lang mit dem Satz, eine
 * Art-Marke beantworte „eine vierte Frage, die niemand stellt". Sie wird
 * gestellt: in einer gemischten Liste trägt die eine Zeile einen Namen und die
 * andere nicht, und ohne Angabe sieht das nach einer Lücke aus statt nach dem
 * Unterschied, der es ist.
 *
 * **Zwei Werte und kein `istTermin: boolean`.** Ein Wahrheitswert benennt eine
 * der zwei Arten und lässt die andere namenlos; käme je eine dritte dazu, wäre
 * er die Stelle, an der jemand ein zweites Flag daneben setzt.
 */
export type Archivart = 'aufgabe' | 'termin';

export function load(): { erledigte: Archivzeile[] } {
	const ausDemPool: Archivzeile[] = erledigteAufgabenAuflisten().map((aufgabe) => ({
		schluessel: `aufgabe-${aufgabe.id}`,
		art: 'aufgabe',
		text: aufgabe.text,
		erledigtAm: aufgabe.erledigtAm,
		// Namenlos, und zwar nicht mangels Daten: die Spalte gibt es, sie verlässt
		// nur die Abfrageschicht nicht (AD-5).
		uebernehmer: null,
	}));
	const ausDenTerminen: Archivzeile[] = abgeschlosseneEinzelaufgabenLesen().map((termin) => ({
		schluessel: `termin-${termin.id}`,
		art: 'termin',
		text: termin.titel,
		erledigtAm: termin.erledigtAm,
		uebernehmer: termin.uebernehmer,
	}));
	/*
	 * Beide Quellen kommen schon absteigend; das Zusammenfügen braucht trotzdem
	 * einen eigenen Durchlauf, weil zwei sortierte Listen hintereinandergehängt
	 * nicht sortiert sind.
	 *
	 * `sort` ist in JavaScript **stabil**, und darauf ruht hier eine Zusage: bei
	 * gleichem Zeitpunkt — zwei Dinge in derselben Sekunde erledigt — behalten
	 * die Zeilen die Reihenfolge, in der sie hier stehen, also erst der Pool,
	 * dann die Termine. Ohne diese Eigenschaft wechselte die Liste zwischen zwei
	 * Aufrufen ihre Anordnung, ohne dass sich etwas geändert hätte, und die
	 * Gruppierung in der Komponente ist genau darauf angewiesen.
	 */
	return {
		erledigte: [...ausDemPool, ...ausDenTerminen].sort(
			(eine, andere) => andere.erledigtAm - eine.erledigtAm
		),
	};
}
