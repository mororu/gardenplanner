/*
 * Legt die Rezeptblätter zur Wellnessbehandlung unter /wissen an — die
 * Erstbefüllung einer Instanz, die noch keine hat.
 *
 * **Es ist keine Quelle der Wahrheit, und das ist der wichtigste Satz hier.**
 * Ein Blatt gehört den Mitgliedern: wer eines ändert, ändert es in der
 * Anwendung, und dieses Skript weiss davon nichts. Von da an ist der Text hier
 * die alte Fassung. Wer ihn nachzieht, tut das von Hand und weil er es will —
 * ein Abgleich beim Lauf wäre genau die Hürde, gegen die /wissen gebaut ist.
 *
 * Aufruf:
 *   npm run rezeptblaetter
 *
 * Gegen eine andere Datenbank:
 *   DATABASE_PATH=/pfad/zur/instanz.sqlite npm run rezeptblaetter
 *
 * **Idempotent nach Titel**: ein Blatt, das schon dasteht, wird übersprungen.
 * `sheets` hat bewusst keinen Unique-Index auf dem Titel (die Begründung steht
 * am Schema: wer merkt, dass es ein Blatt schon gibt, ändert das bestehende),
 * darum prüft das Skript selbst — und vergleicht gegen den **gefalteten**
 * Titel, weil in der Datenbank der gefaltete steht.
 *
 * Node 25 strippt TypeScript von sich aus, darum braucht dieses Skript kein
 * tsx. Die Importe stehen relativ und mit .ts-Endung, nie über $lib: nacktes
 * Node löst weder den Alias auf noch eine .js-Endung auf eine .ts-Datei.
 * Dieselbe Bauform wie ./create-admin.ts.
 */
import { blattTextPruefen, blattTitelPruefen } from '../src/lib/blatttext.ts';
import { datenschichtStarten } from '../src/lib/server/db/index.ts';
import { blaetterLesen, blattAnlegen } from '../src/lib/server/db/queries/sheets.ts';

/** Benannte Meldung, kein Stacktrace, Exit 1 — wie in ./create-admin.ts. */
function abbrechen(meldung: string): never {
	console.error(meldung);
	process.exit(1);
}

const BLAETTER: { titel: string; text: string }[] = [
	{
		titel: 'Jauchen und Brühen — die Grundregeln',
		text: `Drei Zubereitungen, drei Zwecke. Wer sie verwechselt, wundert sich über die Wirkung.

JAUCHE — gegoren, 10 bis 14 Tage. Sie düngt.
BRÜHE — gekocht, 30 Minuten. Sie stärkt gegen Pilz.
KALTAUSZUG — 24 Stunden, nicht länger. Er geht gegen Schädlinge.

Verdünnung, die man sich merken muss:
Jauche 1:10. Brühe 1:5. Kaltauszug unverdünnt.

Ansetzen
Regenwasser, wenn vorhanden — es ist kalkarm. Gefäss aus Kunststoff oder Holz, nie aus Metall. Nicht randvoll füllen, Jauche schäumt in den ersten Tagen kräftig. Täglich umrühren. Eine Handvoll Gesteinsmehl nimmt den Geruch.

Giessen
In den Wurzelbereich, nie über die Blätter. Immer auf vorher angefeuchteten Boden — auf trockenen Boden gegossen verbrennt auch verdünnte Jauche die Feinwurzeln. Nicht in die Mittagssonne.

Spritzen
Morgens, bei trockenem Wetter, damit der Belag abtrocknen kann. Blattunterseiten nicht vergessen, dort sitzen die Läuse und beginnt der Mehltau.

Die eine Regel, die man im August vergisst
Ab Mitte August keinen Stickstoff mehr, also keine Brennnesseljauche. Die Triebe müssen bis zum Frost ausreifen; wer im September noch schiebt, erntet im Winter Frostschäden. Kalium (Beinwell) ist davon nicht betroffen, es fördert die Ausreifung sogar.

Wer etwas ausgebracht hat, trägt es unter Wellnessbehandlung ein — sonst weiss beim nächsten Mal niemand, wann es zuletzt dran war.`,
	},
	{
		titel: 'Brennnesseljauche',
		text: `Der Stickstoffdünger des Gartens. Für alles, was schnell und viel wachsen soll.

Ansetzen
1 kg frische Brennnesseln auf 10 l Wasser. Vor der Blüte schneiden — Pflanzen mit Samen bringen die Samen ins Beet. Grob zerkleinern, mit Wasser übergiessen, Gefäss nicht randvoll füllen.

Täglich umrühren. Eine Handvoll Gesteinsmehl bindet den Geruch spürbar. Halbschattig stellen, nicht in die pralle Sonne.

Fertig ist sie, wenn sie nicht mehr schäumt und dunkel geworden ist: 10 bis 14 Tage, bei Hitze schneller, im kühlen Frühjahr länger. Dann abseihen.

Anwenden
1:10 verdünnt — eine Giesskanne Wasser auf einen Liter Jauche. In den Wurzelbereich giessen, nie über die Blätter. Boden vorher anfeuchten.

Alle zwei bis drei Wochen.

Für wen
Starkzehrer: Tomaten, Kohl aller Art, Kürbis, Zucchini, Gurken, Sellerie, Lauch, Mais.

Für wen nicht
Erbsen und Bohnen — sie binden ihren Stickstoff selbst und werden von Jauche nur weich und lauseanfällig. Ebenso Zwiebeln, Knoblauch und die meisten Kräuter: sie wollen mager stehen, sonst verlieren sie an Aroma.

Sperrfenster
Ab Mitte August nicht mehr. Die Triebe reifen sonst nicht aus und erfrieren im Winter.

Haltbar
Gut abgedeckt und kühl bis in den Winter. Sie riecht dann weniger als in der Gärung.`,
	},
	{
		titel: 'Schachtelhalmbrühe',
		text: `Die Vorbeugung gegen Pilzkrankheiten. Kieselsäure härtet die Zellwände, und ein hartes Blatt lässt sich schwerer anbohren.

Wichtig vorweg: sie wirkt VORBEUGEND, nicht heilend. Ein Blatt, das schon Braunfäule hat, wird davon nicht wieder gesund. Wer erst spritzt, wenn es sichtbar ist, ist zu spät dran.

Welcher Schachtelhalm
Ackerschachtelhalm (Equisetum arvense). Er wächst an Wegrändern, Bahndämmen und auf Äckern. Nicht zu verwechseln mit dem Sumpfschachtelhalm, der im Nassen steht.

Ansetzen
1 kg frisches Kraut oder 150 bis 200 g getrocknetes auf 10 l Wasser. 24 Stunden einweichen.

Dann 30 Minuten köcheln lassen. Das ist der Unterschied zur Jauche und nicht wegzulassen: die Kieselsäure geht erst beim Kochen in Lösung. Abkühlen lassen, abseihen.

Anwenden
1:5 verdünnt auf die Blätter spritzen, Ober- und Unterseite.

Morgens, bei trockenem und sonnigem Wetter — der Belag muss abtrocknen. Bei Regen kurz danach war es umsonst.

Alle 10 bis 14 Tage ab dem Austrieb, vorbeugend die ganze Saison. In nassen Wochen eher häufiger.

Gegen
Mehltau, Kraut- und Braunfäule an Tomaten und Kartoffeln, Rost, Schorf, Sternrusstau an Rosen.

Haltbar
Unverdünnt etwa zwei Wochen kühl. Sie vergärt nicht wie eine Jauche, wird aber irgendwann trüb — dann weg damit.

Gekaufter Schachtelhalm
Es gibt Fertigkonzentrate. Sie funktionieren, die Dosierung steht auf der Flasche und ist nicht 1:5. Eingetragen wird beides gleich.`,
	},
	{
		titel: 'Beinwelljauche',
		text: `Das Gegenstück zur Brennnessel: viel Kalium, wenig Stickstoff. Kalium ist das, was Früchte ausreifen lässt.

Ansetzen
Genau wie Brennnesseljauche: 1 kg frisches Kraut auf 10 l Wasser, täglich umrühren, 10 bis 14 Tage, bis es nicht mehr schäumt.

Beinwell (Symphytum) wächst mit etwas Geduld als Dauerpflanze am Rand; einmal gesetzt, liefert er drei bis vier Schnitte im Jahr.

Anwenden
1:10 verdünnt in den Wurzelbereich, Boden vorher anfeuchten.

Ab Blühbeginn und Fruchtansatz, alle zwei bis drei Wochen.

Für wen
Tomaten, Gurken, Paprika, Kartoffeln, Erdbeeren, Beerensträucher — alles, wo die Frucht zählt und nicht das Blatt.

Statt Jauche
Die Blätter lassen sich auch einfach geschnitten auf das Beet legen. Sie verrotten schnell und geben dasselbe Kalium ab, nur langsamer.

Sperrfenster
Unkritischer als bei der Brennnessel — Kalium fördert das Ausreifen, statt es zu verhindern. Ab September braucht es trotzdem nichts mehr.`,
	},
	{
		titel: 'Brennnessel-Kaltauszug gegen Blattläuse',
		text: `Nicht zu verwechseln mit der Jauche. Dasselbe Kraut, andere Zubereitung, anderer Zweck.

Der Unterschied: hier wird nichts vergoren. Sobald es anfängt zu riechen, ist es kein Kaltauszug mehr, sondern eine angefangene Jauche — und die gehört nicht auf ein Blatt.

Ansetzen
1 kg frische Brennnesseln auf 10 l kaltes Wasser. 12 bis 24 Stunden ziehen lassen, nicht länger. Abseihen.

Anwenden
Unverdünnt auf die befallenen Stellen spritzen, besonders die Blattunterseiten und die Triebspitzen — dort sitzen die Kolonien.

Morgens oder abends, nicht in der prallen Sonne.

An drei Tagen hintereinander wiederholen. Eine einzelne Behandlung bringt wenig, weil laufend Junge nachschlüpfen.

Warum es wirkt
Nicht als Gift. Der Auszug stört die Tiere und spült sie teilweise ab; Marienkäfer, Florfliegen und Schwebfliegenlarven bleiben weitgehend verschont. Das ist der Grund, ihn dem Seifenwasser vorzuziehen.

Frisch ansetzen
Er hält sich nicht. Was übrig bleibt, geht am nächsten Tag in die Jauche oder auf den Kompost.`,
	},
	{
		titel: 'Gesteinsmehl',
		text: `Urgesteins-, Basalt- oder Diabasmehl. Kein Dünger im eigentlichen Sinn — es liefert keinen Stickstoff —, aber an vier Stellen nützlich.

Auf die Blätter, gegen Schädlinge
Trocken auf taufeuchte Blätter stäuben, morgens. Die feine Schicht stört Blattläuse, Kohlweisslingsraupen und Erdflöhe mechanisch. Wirkt nur, solange sie liegt.

Um die Pflanze, gegen Schnecken
Ein breiter Streifen um gefährdete Pflanzen. Schnecken meiden die trockene, scharfkantige Schicht.

Hier liegt die häufigste Enttäuschung: nach jedem Regen und nach jedem Giessen ist der Streifen wirkungslos und muss erneuert werden. Wer das nicht einplant, hält das Mittel für wirkungslos.

In die Jauche
Eine Handvoll beim Ansetzen bindet den Gärgeruch spürbar.

In den Boden und den Kompost
Oberflächlich eingearbeitet liefert es Spurenelemente und verbessert die Struktur schwerer Böden. Wirkt langsam, über Jahre, nicht in dieser Saison.

Ausbringen
Bei trockenem Wetter und Windstille, morgens. Eine Staubmaske ist keine Übertreibung — das Mehl ist fein und gehört nicht in die Lunge.`,
	},
];

/*
 * Erst prüfen, dann schreiben — und zwar **alle** Blätter, bevor eines
 * angelegt wird.
 *
 * Ein Lauf, der beim vierten Blatt an einer Längengrenze scheitert, liesse drei
 * angelegte und drei fehlende zurück; der zweite Versuch überspringt dann die
 * drei und bricht wieder an derselben Stelle. Die Prüfung vorweg macht daraus
 * ein Entweder-oder.
 *
 * Geprüft wird mit **derselben** Kette wie unter /wissen: der Titel gefaltet
 * wie ein Aufgabensatz, der Text mit erhaltenen Absätzen. Eine eigene Prüfung
 * hier wäre eine zweite Fassung jener Regeln — der Fehler, den
 * ./create-admin.ts bis Story 3.0.1 am Mitgliedsnamen gemacht hat.
 */
const geprueft = BLAETTER.map((blatt) => {
	const titel = blattTitelPruefen(blatt.titel);
	if ('fehler' in titel) {
		abbrechen(`Der Titel taugt nicht: ${blatt.titel}\n${titel.fehler}`);
	}
	const text = blattTextPruefen(blatt.text);
	if ('fehler' in text) {
		abbrechen(`Der Text von ${titel.titel} taugt nicht:\n${text.fehler}`);
	}
	return { titel: titel.titel, text: text.text };
});

/*
 * Die Datenschicht startet **nach** der Prüfung: sie legt die Datenbank samt
 * -wal und -shm an, und das darf nicht passieren, um danach einen Text
 * abzuweisen. Dieselbe Reihenfolge und derselbe Grund wie in ./create-admin.ts.
 */
datenschichtStarten();

const vorhanden = new Set(blaetterLesen().map((blatt) => blatt.titel));
let angelegt = 0;
for (const blatt of geprueft) {
	if (vorhanden.has(blatt.titel)) {
		console.log(`übersprungen, gibt es schon: ${blatt.titel}`);
		continue;
	}
	blattAnlegen(blatt.titel, blatt.text);
	angelegt += 1;
	console.log(`angelegt: ${blatt.titel}`);
}
console.log(`\n${angelegt} von ${geprueft.length} Blättern angelegt.`);
