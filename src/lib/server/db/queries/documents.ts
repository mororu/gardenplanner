import { asc, eq, or, sql } from 'drizzle-orm';
import { datenbank } from '../index.ts';
import { documents, type NewDocument } from '../schema.ts';
import { LIKE_FLUCHT, alsLikeMuster } from '../../../suche.ts';

/*
 * Das Repository für documents. Die Routen benutzen ausschliesslich diese
 * benannten Funktionen — kein Drizzle-Aufruf entsteht inline in einer
 * Routendatei (AD-1, Gate-Regel 9).
 *
 * **Das Schwestermodul zu ./sheets.ts, und es hält denselben Abstand.** Beide
 * Arten stehen auf /wissen nebeneinander, beide ordnen nach dem Titel, beide
 * kennen keinen Autor. Was dieses Modul zusätzlich trägt, ist die eine Spalte,
 * die auf etwas ausserhalb der Datenbank zeigt: `ablage`. Es schreibt selbst
 * **nichts** auf die Platte — das tut ../../ablage.ts, und die Reihenfolge
 * zwischen Datei und Zeile entscheidet die Route. Eine Abfrageschicht, die
 * nebenbei Dateien anlegte, hätte zwei Arten von Wirkung und keine Stelle, an
 * der beide zusammen zurückgenommen werden könnten.
 */

/**
 * Ein Dokument in der Liste: Kennung, Titel und Grösse.
 *
 * **Die Grösse reist mit, der Dateiname nicht.** Das ist der Unterschied zur
 * Blattzeile nebenan, und er hat einen Grund: eine Zeile in der Liste sagt
 * `Merkblatt Brennnesseljauche · 1.2 MB`, weil das die eine Auskunft ist, die
 * vor dem Antippen zählt — am Telefon im Garten ist der Unterschied zwischen
 * 200 KB und 12 MB die Frage, ob man jetzt darauf wartet. Der Dateiname sagt
 * an dieser Stelle nichts, was der Titel nicht besser sagte.
 *
 * `ablage` verlässt diese Schicht **nie** in eine Liste: der Name ist der
 * Schlüssel zur Datei, und er hat in keinem ausgelieferten HTML etwas zu
 * suchen. Dieselbe Kette wie bei `completed_by` in ./tasks.ts (AD-5), mit einem
 * anderen Grund — dort geht es um eine Person, hier um einen Ort auf der
 * Platte.
 */
export type Dokumentzeile = {
	id: number;
	titel: string;
	groesse: number;
};

/**
 * Ein Dokument, wie die Detailseite es sieht: dazu der Dateiname.
 *
 * Auch hier ohne `ablage`. Die Detailseite verlinkt auf
 * /wissen/dokument/<id>/datei, und jene Route schlägt den Ablagenamen selbst
 * nach — über ./dokumentAblageLesen, dessen Ergebnis die Serverschicht nie
 * verlässt.
 */
export type Dokument = {
	id: number;
	titel: string;
	dateiname: string;
	groesse: number;
};

/*
 * Dieselbe Ordnung wie bei den Blättern, aus demselben Grund und mit derselben
 * benannten Lücke: `COLLATE NOCASE` faltet ASCII-Gross auf Klein, Umlaute
 * bleiben hinten. Die ganze Begründung steht an `ordnung` in ./sheets.ts und
 * wird hier nicht wiederholt, sondern geteilt — wer sie dort ändert, ändert sie
 * für beide Listen, und genau darum stehen die zwei Zeilen gleich.
 */
const ordnung = [sql`${documents.titel} collate nocase asc`, asc(documents.id)];

/**
 * Alle Dokumente, alphabetisch.
 *
 * Nimmt **kein Ereignis** entgegen: alle sehen dieselbe Liste, wie bei den
 * Blättern.
 */
export function dokumenteLesen(): Dokumentzeile[] {
	return datenbank()
		.select({ id: documents.id, titel: documents.titel, groesse: documents.groesse })
		.from(documents)
		.orderBy(...ordnung)
		.all();
}

/**
 * Die Dokumente, die einen Begriff tragen — im Titel **oder** im Dateinamen.
 *
 * **Keine Fundstelle, anders als beim Blatt**, und das ist kein Weglassen:
 * durchsucht werden hier nur zwei kurze Felder, und eines davon steht auf der
 * Detailseite ohnehin. Ein Ausschnitt aus einem Dateinamen wäre der Dateiname.
 *
 * **Der Dateiname wird mitdurchsucht, obwohl die Liste ihn nicht zeigt.** Er
 * ist die zweite Art, ein Dokument zu kennen — wer `bj-2024` tippt, sucht das
 * Merkblatt, dessen Datei so heisst, und findet es, ohne den Titel zu wissen.
 *
 * **Der Inhalt des PDF wird nicht durchsucht.** Das wäre eine Textextraktion
 * aus einem Binärformat, also eine Abhängigkeit und ein Verarbeitungsschritt
 * beim Ablegen — für eine Handvoll Merkblätter ist das die falsche Rechnung.
 * Benannt statt verschwiegen: wer ein PDF nach seinem Inhalt sucht, findet es
 * hier nicht.
 *
 * Der Begriff kommt **fertig gefaltet** herein und ist nicht leer — dieselbe
 * Zusage wie bei blaetterSuchen in ./sheets.ts.
 */
export function dokumenteSuchen(begriff: string): Dokumentzeile[] {
	const muster = alsLikeMuster(begriff);
	return datenbank()
		.select({ id: documents.id, titel: documents.titel, groesse: documents.groesse })
		.from(documents)
		.where(
			or(
				sql`${documents.titel} like ${muster} escape ${LIKE_FLUCHT}`,
				sql`${documents.dateiname} like ${muster} escape ${LIKE_FLUCHT}`
			)
		)
		.orderBy(...ordnung)
		.all();
}

/**
 * Ein Dokument an seiner Id — oder null, wenn es die Id nicht gibt.
 *
 * null heisst genau eines: es gibt keine Zeile mit dieser Kennung. Ob die
 * **Datei** dazu noch auf der Platte liegt, beantwortet diese Funktion
 * ausdrücklich nicht — das ist eine Frage an die Ablage, und sie wird an der
 * Stelle gestellt, an der jemand den Inhalt wirklich will.
 */
export function dokumentLesen(id: number): Dokument | null {
	const zeile = datenbank()
		.select({
			id: documents.id,
			titel: documents.titel,
			dateiname: documents.dateiname,
			groesse: documents.groesse,
		})
		.from(documents)
		.where(eq(documents.id, id))
		.get();
	return zeile === undefined ? null : zeile;
}

/**
 * Der Ablagename und der Dateiname zu einer Kennung — **nur für die
 * Auslieferung**.
 *
 * Eine eigene Funktion und kein Feld an `Dokument`, und das ist die ganze
 * Absicht: so gibt es genau einen Aufrufer, der den Ablagenamen je zu sehen
 * bekommt, und der liegt in einem `+server.ts`, dessen Antwort ein Dateistrom
 * ist und keine Seitendaten. Stünde der Name am gemeinsamen Typ, reiste er in
 * jede load, die ein Dokument liest, und von dort ins ausgelieferte HTML.
 */
export function dokumentAblageLesen(id: number): { ablage: string; dateiname: string } | null {
	const zeile = datenbank()
		.select({ ablage: documents.ablage, dateiname: documents.dateiname })
		.from(documents)
		.where(eq(documents.id, id))
		.get();
	return zeile === undefined ? null : zeile;
}

/**
 * Legt die Zeile zu einer bereits abgelegten Datei an und gibt ihre Kennung
 * zurück.
 *
 * **Die Datei liegt zu diesem Zeitpunkt schon auf der Platte.** Das ist die
 * Reihenfolge, die an `documents.ablage` im Schema begründet steht, und diese
 * Funktion setzt sie voraus, statt sie herzustellen: sie schreibt nichts und
 * prüft nichts nach. Titel, Dateiname und Ablagename kommen fertig geprüft
 * herein (../../../dokument.ts und ../../ablage.ts).
 *
 * `satisfies NewDocument` auf dem Objektliteral, damit eine später ergänzte
 * Pflichtspalte hier auffällt statt zur Laufzeit.
 */
export function dokumentAnlegen(
	titel: string,
	dateiname: string,
	ablage: string,
	groesse: number
): number {
	const zeile = datenbank()
		.insert(documents)
		.values({ titel, dateiname, ablage, groesse } satisfies NewDocument)
		.returning({ id: documents.id })
		.get();
	return zeile.id;
}

/**
 * Nimmt die Zeile weg und gibt zurück, was danach noch gebraucht wird.
 *
 * **Die Zeile zuerst, die Datei danach** — und diese Funktion macht nur den
 * ersten Schritt. Die Reihenfolge ist die Umkehrung des Anlegens und aus
 * demselben Grund richtig: bricht es dazwischen ab, bleibt eine Datei ohne
 * Zeile liegen, und die ist unerreichbar, aber harmlos. Andersherum bliebe eine
 * Zeile ohne Datei stehen, und die zeigt in der Liste ein Dokument an, das beim
 * Antippen nicht da ist.
 *
 * Zurück kommt der Titel für die Rückmeldung und der Ablagename für den zweiten
 * Schritt. null heisst, dass es die Kennung nicht (mehr) gibt.
 *
 * **Dieselbe Schranke wie beim Blatt: nur eine Adminperson.** Sie steht nicht
 * hier, sondern in der Route — wie bei blattLoeschen in ./sheets.ts, wo auch die
 * ganze Begründung steht. Kurz: ein Dokument trägt keinen Autor, sein Verlust
 * ist niemandem zuzuordnen, und es gibt weder Versionen noch Papierkorb. Hier
 * kommt eine zweite Erwägung dazu, die es beim Blatt nicht gibt — was
 * verschwindet, ist nicht bloss ein Text, den jemand neu tippen könnte, sondern
 * eine Datei, deren Original vielleicht nirgends sonst mehr liegt.
 */
export function dokumentLoeschen(id: number): { titel: string; ablage: string } | null {
	const zeile = datenbank()
		.delete(documents)
		.where(eq(documents.id, id))
		.returning({ titel: documents.titel, ablage: documents.ablage })
		.get();
	return zeile === undefined ? null : zeile;
}
