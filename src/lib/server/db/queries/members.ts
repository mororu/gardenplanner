import { count, eq } from 'drizzle-orm';
import { datenbank } from '../index.ts';
import { members, type Member, type NewMember } from '../schema.ts';

/*
 * Das Repository für members. Route, Wächter und CLI-Skript benutzen
 * ausschliesslich diese benannten Funktionen — kein Drizzle-Aufruf entsteht
 * inline in einer Routendatei.
 *
 * Alles synchron: better-sqlite3 gibt Werte direkt zurück.
 */

/**
 * Wie viele Mitglieder es gibt — aktive und deaktivierte zusammen.
 *
 * Gebraucht vom Zweitlauf-Schutz in scripts/create-admin.ts: ein zweiter Admin
 * mit einem zweiten lebenden Link darf nicht aus Versehen entstehen. Die Zahl
 * kommt aus dem Repository und nicht aus einem Drizzle-Aufruf im Skript.
 */
export function mitgliederZaehlen(): number {
	const zeile = datenbank().select({ anzahl: count() }).from(members).get();
	return zeile === undefined ? 0 : zeile.anzahl;
}

/** Das Mitglied zu einem Token-Hash, oder null. */
export function mitgliedNachTokenHash(tokenHash: string): Member | null {
	const zeile = datenbank()
		.select()
		.from(members)
		.where(eq(members.inviteTokenHash, tokenHash))
		.get();
	return zeile ?? null;
}

/** Das Mitglied zu einer Id, oder null. */
export function mitgliedNachId(id: number): Member | null {
	const zeile = datenbank().select().from(members).where(eq(members.id, id)).get();
	return zeile ?? null;
}

/**
 * Legt ein Mitglied an und gibt die erzeugte Zeile zurück.
 *
 * createdAt kommt aus dem Schema ($defaultFn), nicht von hier — sonst müsste
 * jede künftige Einfügestelle den Zeitstempel wiederholen.
 */
export function mitgliedAnlegen(daten: {
	name: string;
	inviteTokenHash: string;
	isAdmin: boolean;
}): Member {
	return datenbank()
		.insert(members)
		.values({
			name: daten.name,
			inviteTokenHash: daten.inviteTokenHash,
			isAdmin: daten.isAdmin,
		} satisfies NewMember)
		.returning()
		.get();
}
