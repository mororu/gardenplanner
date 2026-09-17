import { asc, desc, eq } from 'drizzle-orm';
import { datenbank } from '../index.ts';
import {
	agendaItems,
	agendaLists,
	members,
	minutes,
	type NewAgendaList,
	type NewAgendaItem,
	type NewMinute,
} from '../schema.ts';

/*
 * Das Repository für agenda_items, agenda_lists und minutes. Die Routen
 * benutzen ausschliesslich diese benannten Funktionen — kein Drizzle-Aufruf
 * entsteht inline in einer Routendatei (AD-1, Gate-Regel 9).
 *
 * Alles synchron: better-sqlite3 gibt Werte direkt zurück.
 *
 * **Drei Tabellen in einem Modul, und das ist Absicht.** Sie sind die drei
 * Stufen derselben Sache: was besprochen werden soll (agenda_items), die daraus
 * gezogene Liste (agenda_lists) und was danach beschlossen wurde (minutes). Die
 * Seite /sitzungen zeigt alle drei, und drei Module für neun Funktionen hiessen,
 * dass die Ordnung dieser Stufen an drei Stellen stünde.
 *
 * **Die Klammer war bis zum 2026-09-17 `sitzung_am`, und sie ist es nicht
 * mehr.** Die Spalte stand an agenda_items und ist dort weggefallen (Entscheid
 * Manuel): Traktanden sind eine Sammlung für die nächste Sitzung und hängen an
 * keinem Datum. In `minutes` steht sie weiter, denn ein Protokoll gehört zu
 * einer bestimmten Sitzung.
 *
 * **Die Regel, die dieses Modul durchsetzt, ist die Richtung der Zeit.**
 * ./tasks.ts entscheidet, wann eine Zeile offen ist, ./harvests.ts, wie dringend
 * sie ist; hier ist es die Ordnung. Traktanden stehen aufsteigend nach dem
 * Aufschreiben — was zuerst gesagt wurde, kommt zuoberst —, Protokolle und
 * gezogene Listen absteigend: was vorbei ist, wird vom Jüngsten her
 * nachgeschlagen. Die zwei Richtungen sind kein Versehen, sie sind der
 * Unterschied zwischen Vorschau und Archiv, und sie stehen darum nebeneinander
 * an einer Stelle.
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
 * darf jedes Traktandum sehen **und seit dem 2026-09-17 auch jedes ergänzen**,
 * das eigene wie ein fremdes (Entscheid Manuel). Gerade weil die Schranke fehlt,
 * hat die Seite für die Kennung keinen Leser — sie stünde in den Seitendaten,
 * ohne je verglichen zu werden, und das wäre eine Einladung. Der Name steht
 * daneben, als Herkunft: wer fragen will, weiss wen.
 */
export type Traktandum = {
	id: number;
	text: string;
	name: string | null;
	createdAt: number;
};

/** Eine erzeugte Traktandenliste, wie die Seite sie sieht. */
export type Traktandenliste = {
	id: number;
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
 * Die Sammlung für die nächste Sitzung, zuerst Aufgeschriebenes zuoberst.
 *
 * **Ohne Fenster, ohne Bezugszeitpunkt und seit dem 2026-09-17 ohne
 * Gruppierung**: was in dieser Tabelle steht, steht an. Ein Traktandum
 * verschwindet nicht von selbst — es verschwindet, wenn jemand die Liste zieht
 * (`traktandenAbraeumen`), und dann liegt es in der abgelegten Datei.
 *
 * Geordnet nach `created_at` und nicht nach `id`: es ist dieselbe Reihenfolge,
 * aber sie behauptet etwas über die Sache und nicht über die Vergabe von
 * Schlüsseln. `id` entscheidet den Gleichstand — zwei Punkte in derselben
 * Sekunde hätten sonst keine festgelegte Ordnung, und die Liste wechselte
 * zwischen zwei Aufrufen ihr Aussehen.
 */
export function traktandenLesen(): Traktandum[] {
	return datenbank()
		.select({
			id: agendaItems.id,
			text: agendaItems.text,
			name: members.name,
			createdAt: agendaItems.createdAt,
		})
		.from(agendaItems)
		.leftJoin(members, eq(members.id, agendaItems.memberId))
		.orderBy(asc(agendaItems.createdAt), asc(agendaItems.id))
		.all();
}

/**
 * Ändert den Text eines Traktandums und meldet, ob eine Zeile getroffen wurde.
 *
 * **Jedes Mitglied darf jedes Traktandum ergänzen, auch ein fremdes** (Entscheid
 * Manuel, 2026-09-17), und das ist dieselbe Haltung wie beim Erntestand: was für
 * die nächste Sitzung aufgeschrieben ist, geht alle an, und wer merkt, dass ein
 * Punkt unvollständig ist, soll ihn geradeziehen können, ohne die schreibende
 * Person zu suchen. Es gibt darum **keine** Vorbedingung auf `member_id` — der
 * Unterschied zum Abschliessen eines Termins, wo genau diese Klausel die
 * Schranke ist.
 *
 * `member_id` bleibt beim Ändern **stehen** und wandert nicht auf die ändernde
 * Person: die Spalte sagt, wer den Punkt aufgebracht hat, und das bleibt wahr.
 * Aus demselben Grund gibt es keine zweite Spalte daneben — wer zuletzt
 * geändert hat, ist keine Auskunft, die diese Gemeinschaft von ihrem Werkzeug
 * erwartet.
 *
 * Der Text kommt **fertig geprüft** herein; die Kette steht in der action, wie
 * bei jeder Schreibfunktion dieser Schicht.
 */
export function traktandumAendern(id: number, text: string): boolean {
	const zeile = datenbank()
		.update(agendaItems)
		.set({ text })
		.where(eq(agendaItems.id, id))
		.returning({ id: agendaItems.id })
		.get();
	return zeile !== undefined;
}

/**
 * Räumt die Sammlung leer und gibt zurück, wie viele Punkte darin standen.
 *
 * **Das zweite echte DELETE dieses Produkts** neben dem Abernten, und es hat
 * dieselbe Begründung: die Tabelle ist ein Stand und kein Tagebuch. Was hier
 * verschwindet, ist nicht fort — es steht in der Datei, die
 * `traktandenlisteVermerken` eine Zeile vorher festgehalten hat. **Die
 * Reihenfolge ist darum keine Geschmacksfrage**, und sie steht in der action:
 * erst schreiben, dann vermerken, dann abräumen. Wer abräumt, bevor die Datei
 * liegt, hat im Fehlerfall nichts mehr.
 *
 * Die Zahl ist der Inhalt der Meldung („4 Punkte"). Sie kommt aus `returning`
 * und nicht aus einem `select` davor: ein Zähler vor dem Löschen wäre eine
 * zweite Abfrage über denselben Zustand, und zwischen beiden könnte jemand
 * einen Punkt aufschreiben.
 */
export function traktandenAbraeumen(): number {
	return datenbank().delete(agendaItems).returning({ id: agendaItems.id }).all().length;
}

/**
 * Die erzeugten Traktandenlisten, die jüngste zuerst.
 *
 * Geordnet nach `created_at`, denn das ist hier das einzige Datum — anders als
 * bei den Protokollen, die nach dem **Sitzungsdatum** ordnen, weil man sie dort
 * sucht. Eine Traktandenliste sucht man als „die vom letzten Mal".
 */
export function traktandenlistenLesen(): Traktandenliste[] {
	return datenbank()
		.select({
			id: agendaLists.id,
			name: members.name,
			createdAt: agendaLists.createdAt,
		})
		.from(agendaLists)
		.leftJoin(members, eq(members.id, agendaLists.memberId))
		.orderBy(desc(agendaLists.createdAt), desc(agendaLists.id))
		.all();
}

/**
 * Der Dateiname einer Traktandenliste, oder null.
 *
 * Wie `protokolldateiLesen` darunter, mit genau einem Leser: die Ausgabe in
 * ../../../../routes/sitzungen/liste/[id]/+server.ts. Eine **eigene** Route und
 * nicht dieselbe wie für die Protokolle, weil die Ids aus zwei Tabellen kommen
 * und einander überdecken würden.
 */
export function traktandenlistedateiLesen(id: number): string | null {
	const zeile = datenbank()
		.select({ datei: agendaLists.datei })
		.from(agendaLists)
		.where(eq(agendaLists.id, id))
		.get();
	return zeile === undefined ? null : zeile.datei;
}

/** Vermerkt eine erzeugte Traktandenliste. */
export function traktandenlisteVermerken(zeile: NewAgendaList): void {
	datenbank().insert(agendaLists).values(zeile).run();
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
