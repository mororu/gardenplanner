import { abgeschlosseneEinzelaufgabenLesen } from '../../lib/server/db/queries/signup-tasks.ts';
import { erledigteAufgabenAuflisten } from '../../lib/server/db/queries/tasks.ts';
import { abgeschlosseneBehandlungenLesen } from '../../lib/server/db/queries/treatments.ts';
import { abschluesseBuendeln } from '../../lib/wellness.ts';

/*
 * /archiv — was in diesem Garten schon getan ist.
 *
 * Die Importe stehen relativ und mit .ts-Endung, und die Typen kommen aus
 * @sveltejs/kit statt aus ./$types. Der Grund ist derselbe wie in den
 * Nachbarrouten und geprüft, nicht vermutet: scripts/smoke-zugang.ts lädt dieses
 * Modul mit nacktem Node, und tsconfig.scripts.json kennt weder das virtuelle
 * ./$types noch die $lib-Zuordnung.
 *
 * **Drei Quellen, eine Liste** — zwei seit dem 2026-09-17, die dritte seit
 * dem 2026-10-11 (beides Entscheid Manuel). Die abgehakten Poolaufgaben kommen
 * aus ./queries/tasks.ts, die abgeschlossenen Termine aus
 * ./queries/signup-tasks.ts, die abgeschlossenen Kulturen aus dem Tagebuch in
 * ./queries/treatments.ts, und **zusammengeführt wird hier und nicht dort**.
 * Das ist AD-3 und AD-4: die Aufgabenarten haben bewusst keine Basistabelle
 * und keine gemeinsame Zuständigkeitsspalte, weil sie verschieden verbindlich
 * sind. Eine Abfrage, die mehrere dieser Tabellen mischte, ebnete genau den
 * Unterschied ein, den das Schema zeigen soll. Was hier entsteht, ist keine
 * weitere Aufgabenart, sondern **eine Ansicht**: getan ist getan — und eine
 * Behandlung im Beet ist ebenso getane Arbeit wie ein abgehaktes Kästchen.
 *
 * Das Tagebuch auf /wellness bleibt dabei, was es ist: das Archiv liest es,
 * es kopiert und entfernt nichts daraus. **Seit dem 2026-10-12 liest es nur,
 * was abgeschlossen ist** (Entscheid Manuel): eine einzelne Behandlung steht
 * hier nicht mehr, solange die Reihe läuft, sondern erst, wenn die Kultur im
 * Beet auf /wellness abgeschlossen wird — dann als **eine** Zeile je
 * Abschluss.
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
 * **Ein Abschluss ist Historie bis auf einen Augenblick.** Direkt nach dem
 * Abschliessen lässt er sich auf /wellness rückgängig machen — in der
 * Oberfläche lebt der Knopf nur in der Meldung dort; die action selbst nimmt
 * jeden Abschluss mit passendem Ort, Kultur und Zeitpunkt zurück —, und dann
 * fehlt seine Zeile hier beim nächsten Laden. Ändern und Wegnehmen treffen abgeschlossene Zeilen nicht. Von hier
 * aus ändert sich nichts (Spec, _Ask First_: Rückgängig aus dem Archiv).
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
 * Eine Zeile des Archivs — aus dem Pool, aus den Terminen oder aus dem
 * Wellnesstagebuch.
 *
 * **Ein flacher Typ und kein unterschiedener Verbund** über die Arten. Die
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
 * Eine Wellnesszeile ist es ebenso (Entscheid Manuel, 2026-10-11): das
 * Tagebuch kennt die eintragende Person, aber eine Behandlung ist keine
 * Zusage vor allen — die Abfrage für das Archiv liest den Namen gar nicht.
 *
 * `zusatz` ist die zweite Zeile unter dem Text, und nur eine Wellnesszeile
 * trägt sie: die Mittel des Abschlusses mit Anzahl, `Schachtelhalm 4×,
 * Brennnesseljauche 2×`. Für Aufgabe und Termin ist sie null.
 *
 * **`schluessel` und nicht `id`**: die Ids kommen aus drei Tabellen und
 * kollidieren. Zwei Zeilen mit demselben `{#each}`-Schlüssel sind kein
 * Schönheitsfehler, sondern ein Zustandsfehler — Svelte hält Knoten darüber
 * auseinander.
 */
export type Archivzeile = {
	schluessel: string;
	art: Archivart;
	text: string;
	zusatz: string | null;
	erledigtAm: number;
	uebernehmer: string | null;
	/**
	 * Der volle Name zu `uebernehmer`, gelesen allein von der Suche — angezeigt
	 * wird der Anzeigename (spec-notiz-und-kurzname.md, Review vom 2026-10-26).
	 * Null, wo `uebernehmer` null ist.
	 */
	uebernehmerVoll: string | null;
};

/**
 * Woher eine Zeile kommt — aus dem Pool, aus den Terminen oder aus dem
 * Wellnesstagebuch.
 *
 * **Seit dem 2026-09-17, und das nimmt eine Entscheidung zurück** (Entscheid
 * Manuel). Der Absatz darüber stand hier einen Tag lang mit dem Satz, eine
 * Art-Marke beantworte „eine vierte Frage, die niemand stellt". Sie wird
 * gestellt: in einer gemischten Liste trägt die eine Zeile einen Namen und die
 * andere nicht, und ohne Angabe sieht das nach einer Lücke aus statt nach dem
 * Unterschied, der es ist.
 *
 * **Eine Aufzählung und kein `istTermin: boolean`.** Ein Wahrheitswert benennt
 * eine der Arten und lässt die übrigen namenlos. Seit dem 2026-10-11 gibt es
 * die dritte, und sie kam als dritter Wert dazu statt als zweites Flag — genau
 * der Fall, für den dieser Absatz stand.
 */
export type Archivart = 'aufgabe' | 'termin' | 'wellness';

export function load(): { erledigte: Archivzeile[] } {
	const ausDemPool: Archivzeile[] = erledigteAufgabenAuflisten().map((aufgabe) => ({
		schluessel: `aufgabe-${aufgabe.id}`,
		art: 'aufgabe',
		text: aufgabe.text,
		zusatz: null,
		erledigtAm: aufgabe.erledigtAm,
		// Namenlos, und zwar nicht mangels Daten: die Spalte gibt es, sie verlässt
		// nur die Abfrageschicht nicht (AD-5).
		uebernehmer: null,
		uebernehmerVoll: null,
	}));
	const ausDenTerminen: Archivzeile[] = abgeschlosseneEinzelaufgabenLesen().map((termin) => ({
		schluessel: `termin-${termin.id}`,
		art: 'termin',
		text: termin.titel,
		zusatz: null,
		erledigtAm: termin.erledigtAm,
		uebernehmer: termin.uebernehmer,
		uebernehmerVoll: termin.uebernehmerVoll,
	}));
	/*
	 * Aus dem Tagebuch **je Abschluss eine Zeile** (Entscheid Manuel,
	 * 2026-10-12): `{Beet} · {Kultur}` mit denselben Ersatzwörtern wie im
	 * Tagebuch, darunter die Mittel mit Anzahl, und als Zeitpunkt der Abschluss
	 * — nach ihm richten sich Datum und Monat. Gebündelt wird in
	 * `abschluesseBuendeln` in ../../lib/wellness.ts.
	 *
	 * **Kein Name, keine Wiederholung, kein `createdAt`**: die Abfrage liest sie
	 * gar nicht, und die Abbildung nimmt nur, was hier steht.
	 *
	 * Der Schlüssel ist die kleinste Kennung im Abschluss — eindeutig, weil
	 * jede Zeile zu genau einem Abschluss gehört.
	 */
	const ausDemTagebuch: Archivzeile[] = abschluesseBuendeln(abgeschlosseneBehandlungenLesen()).map(
		(abschluss) => ({
			schluessel: `wellness-${abschluss.ersteId}`,
			art: 'wellness',
			text: `${abschluss.ort ?? 'Ohne Beet'} · ${abschluss.kultur ?? 'Ohne Kultur'}`,
			zusatz: abschluss.mittel.map(({ mittel, anzahl }) => `${mittel} ${anzahl}×`).join(', '),
			erledigtAm: abschluss.abgeschlossenAm,
			uebernehmer: null,
			uebernehmerVoll: null,
		})
	);
	/*
	 * Alle drei Quellen kommen schon absteigend; das Zusammenfügen braucht
	 * trotzdem einen eigenen Durchlauf, weil sortierte Listen hintereinandergehängt
	 * nicht sortiert sind.
	 *
	 * `sort` ist in JavaScript **stabil**, und darauf ruht hier eine Zusage: bei
	 * gleichem Zeitpunkt — zwei Dinge in derselben Sekunde erledigt — behalten
	 * die Zeilen die Reihenfolge, in der sie hier stehen, also erst der Pool,
	 * dann die Termine, dann die Behandlungen. Ohne diese Eigenschaft
	 * wechselte die Liste zwischen zwei Aufrufen ihre Anordnung, ohne dass sich
	 * etwas geändert hätte, und die Gruppierung in der Komponente ist genau
	 * darauf angewiesen.
	 *
	 * Ein Abschluss trägt in der Regel die Sekunde, in der er geschah —
	 * dieselbe Art Zeitpunkt wie ein Abhaken. **Nicht immer:** damit zwei
	 * Abschlüsse derselben Kultur nie denselben Zeitpunkt tragen, rückt
	 * `kulturAbschliessen` ihn um eine Sekunde hinter den letzten, wenn der auf
	 * oder nach `jetzt` liegt. Wer oft hintereinander abschliesst, schiebt ihn
	 * so um Sekunden nach vorn — im Grenzfall kurz vor Mitternacht auf den
	 * nächsten Tag, und die Zeile steht dann unter diesem Datum. Hingenommen:
	 * es braucht dafür Abschlüsse derselben Kultur im Sekundentakt.
	 */
	return {
		erledigte: [...ausDemPool, ...ausDenTerminen, ...ausDemTagebuch].sort(
			(eine, andere) => andere.erledigtAm - eine.erledigtAm
		),
	};
}
