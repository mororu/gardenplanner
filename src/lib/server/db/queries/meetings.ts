import { asc, desc, eq } from 'drizzle-orm';
import { datenbank } from '../index.ts';
import { agendaItems, members, minutes, type NewAgendaItem, type NewMinute } from '../schema.ts';

/*
 * Das Repository für agenda_items und minutes. Die Routen benutzen
 * ausschliesslich diese benannten Funktionen — kein Drizzle-Aufruf entsteht
 * inline in einer Routendatei (AD-1, Gate-Regel 9).
 *
 * Alles synchron: better-sqlite3 gibt Werte direkt zurück.
 *
 * **Zwei Tabellen in einem Modul, und das ist Absicht.** Sie haben dieselbe
 * Klammer — `sitzung_am` —, und die Seite zeigt beide. Ein zweites Modul für
 * drei Funktionen hiesse, dass die Ordnung „Sitzung für Sitzung, die nächste
 * zuoberst" an zwei Stellen stünde.
 *
 * **Die Regel, die dieses Modul durchsetzt, ist diese Ordnung.** ./tasks.ts
 * entscheidet, wann eine Zeile offen ist, ./harvests.ts, wie dringend sie ist;
 * hier ist es die Richtung der Zeit. Traktanden stehen aufsteigend nach
 * Sitzungsdatum — was als Nächstes ansteht, kommt zuerst —, Protokolle
 * absteigend: was vorbei ist, wird vom Jüngsten her nachgeschlagen. Die zwei
 * Richtungen sind kein Versehen, sie sind der Unterschied zwischen Vorschau und
 * Archiv, und sie stehen darum nebeneinander an einer Stelle.
 */

/**
 * Ein Traktandum, wie die Seite es sieht.
 *
 * `name` ist nullbar, obwohl `member_id` es nicht ist: der leftJoin liefert
 * null, wenn die Mitgliedszeile fehlt. Kein Weg der Anwendung löscht eine —
 * Zugang beenden heisst deaktivieren —, aber der Typ soll nicht behaupten, was
 * allein eine Gewohnheit ist.
 *
 * **`memberId` reist nicht mit.** Es gibt nichts zu vergleichen: jedes Mitglied
 * darf jedes Traktandum sehen, und ändern darf es keines — auch das eigene
 * nicht. Eine Kennung in den Seitendaten ohne Leser wäre eine Einladung.
 */
export type Traktandum = {
	id: number;
	text: string;
	sitzungAm: number;
	name: string | null;
	createdAt: number;
};

/** Ein abgelegtes Protokoll, wie die Seite es sieht. */
export type Protokoll = {
	id: number;
	sitzungAm: number;
	name: string | null;
	createdAt: number;
};

/**
 * Alle Traktanden, die nächste Sitzung zuerst.
 *
 * **Ohne Fenster und ohne Bezugszeitpunkt**: ein Traktandum einer vergangenen
 * Sitzung verschwindet nicht. Die Liste ist kurz — ein paar Sitzungen im Jahr,
 * eine Handvoll Punkte je Sitzung —, und ein stilles Verschwinden wäre die
 * schlechtere Antwort auf etwas, das vielleicht nie behandelt wurde. Dieselbe
 * Haltung wie bei den freien Terminen auf `/`.
 *
 * Der zweite Schlüssel ist `created_at` und nicht `id`: innerhalb einer Sitzung
 * steht, was zuerst aufgeschrieben wurde, auch zuoberst. `id` gäbe hier
 * dieselbe Reihenfolge und behauptete dabei etwas über die Vergabe von
 * Schlüsseln, was keine Aussage über die Sache ist.
 */
export function traktandenLesen(): Traktandum[] {
	return datenbank()
		.select({
			id: agendaItems.id,
			text: agendaItems.text,
			sitzungAm: agendaItems.sitzungAm,
			name: members.name,
			createdAt: agendaItems.createdAt,
		})
		.from(agendaItems)
		.leftJoin(members, eq(members.id, agendaItems.memberId))
		.orderBy(asc(agendaItems.sitzungAm), asc(agendaItems.createdAt))
		.all();
}

/**
 * Schreibt ein Traktandum auf.
 *
 * Der Name kommt **nicht** zurück: die schreibende Person ist die angemeldete,
 * ihr Name steht der Route ohnehin zur Verfügung, und ein zweiter Lesevorgang
 * ergäbe dasselbe. Dieselbe Bauform wie beim Eintragen einer Erntezeile.
 */
export function traktandumErfassen(zeile: NewAgendaItem): void {
	datenbank().insert(agendaItems).values(zeile).run();
}

/**
 * Die abgelegten Protokolle, das jüngste zuerst.
 *
 * Geordnet nach dem **Sitzungsdatum** und nicht nach dem Zeitpunkt des
 * Ablegens: wer im März das Protokoll vom Januar nachträgt, soll es beim Januar
 * finden und nicht zuoberst. `created_at` entscheidet nur den Gleichstand — zwei
 * Protokolle zu einer Sitzung gibt es nicht, aber verboten ist es auch nicht,
 * und eine Ordnung ohne zweiten Schlüssel wäre an dieser Stelle dem Zufall
 * überlassen.
 *
 * **Der Dateiname reist nicht mit.** Die Seite verweist über die Kennung der
 * Zeile auf die Ausgabe, und die schlägt den Namen selbst nach — was in der
 * Ablage liegt, gehört nicht in ein ausgeliefertes Dokument.
 */
export function protokolleLesen(): Protokoll[] {
	return datenbank()
		.select({
			id: minutes.id,
			sitzungAm: minutes.sitzungAm,
			name: members.name,
			createdAt: minutes.createdAt,
		})
		.from(minutes)
		.leftJoin(members, eq(members.id, minutes.memberId))
		.orderBy(desc(minutes.sitzungAm), desc(minutes.createdAt))
		.all();
}

/**
 * Der Dateiname eines Protokolls, oder null.
 *
 * Die einzige Stelle, an der er die Datenschicht verlässt, und sie hat genau
 * einen Leser: die Ausgabe in ../../../../routes/sitzungen/[id]/+server.ts.
 */
export function protokolldateiLesen(id: number): string | null {
	const zeile = datenbank()
		.select({ datei: minutes.datei })
		.from(minutes)
		.where(eq(minutes.id, id))
		.get();
	return zeile === undefined ? null : zeile.datei;
}

/** Vermerkt ein abgelegtes Protokoll. */
export function protokollVermerken(zeile: NewMinute): void {
	datenbank().insert(minutes).values(zeile).run();
}
