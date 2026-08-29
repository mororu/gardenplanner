import { and, count, desc, eq } from 'drizzle-orm';
import { datenbank } from '../index.ts';
import { members, type AngemeldetesMitglied, type Member, type NewMember } from '../schema.ts';

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

/*
 * Die Spaltenauswahl ohne invite_token_hash.
 *
 * Sie steht als Konstante und nicht dreimal ausgeschrieben, damit alle
 * Funktionen, deren Ergebnis eine load-Funktion verlässt, dieselbe Auswahl
 * benutzen. Ein `select()` über alles wäre hier der teure Fehler: die
 * vollständige Zeile landete über `data` im ausgelieferten HTML jeder
 * Verwaltungsseite, und der Hash sähe dort wie eine beliebige Kennung aus.
 *
 * Bewusst ausgeschrieben und nicht über eine Auslassung gebildet — eine neue
 * Spalte soll hier auffallen, statt still mitzureisen. Derselbe Grund wie bei
 * ohneTokenHash in ../schema.ts.
 */
const ohneHashSpalte = {
	id: members.id,
	name: members.name,
	isAdmin: members.isAdmin,
	isActive: members.isActive,
	createdAt: members.createdAt,
	/*
	 * Die Klammer, die diese Liste gegen ohneTokenHash in ../schema.ts hält.
	 *
	 * Beide Stellen schreiben dieselben fünf Spalten aus und begründen das
	 * beide mit „eine neue Spalte soll hier auffallen" — nichts erzwang, dass
	 * sie in **beiden** auffällt. Eine neue Spalte, die nur in einer
	 * nachgetragen wird, fehlt still in der Verwaltungsliste oder reist still
	 * in jede ausgelieferte Seite.
	 *
	 * `satisfies Record<keyof AngemeldetesMitglied, unknown>` schliesst beide
	 * Richtungen, ohne einen Wert zu verändern:
	 *   - eine **fehlende** Spalte ist ein Fehler, weil Record jeden Schlüssel
	 *     von AngemeldetesMitglied verlangt;
	 *   - eine **überzählige** Spalte ist ein Fehler, weil satisfies auf einem
	 *     Objektliteral zusätzliche Eigenschaften abweist — insbesondere
	 *     inviteTokenHash, der in AngemeldetesMitglied gerade nicht vorkommt.
	 * Und weil ohneTokenHash seinen Rückgabewert als AngemeldetesMitglied
	 * annotiert, fällt die Gegenrichtung dort auf.
	 */
} satisfies Record<keyof AngemeldetesMitglied, unknown>;

/**
 * Alle Mitglieder für die Verwaltungsliste — aktive zuerst, darin nach Name.
 *
 * Aktive zuerst, weil die Liste zum Handeln da ist und an einem beendeten
 * Zugang nichts mehr zu tun ist. `desc` auf is_active stellt 1 vor 0; diese
 * Gruppierung darf die Datenbank machen, sie sortiert eine Zahl.
 *
 * **Der Name wird in JavaScript sortiert, nicht in SQL.** SQLites
 * Vorgabekollation ist BINARY, also ein Vergleich über UTF-8-Bytes: `Zoe` käme
 * vor `oskar` (Grossbuchstaben liegen tiefer als Kleinbuchstaben) und `Ärni`
 * hinter beiden (mehrbytige Zeichen liegen am höchsten). In einer Schweizer
 * Gartengruppe ist beides der Normalfall und nicht der Sonderfall. `COLLATE
 * NOCASE` hälfe nur bei der Grossschreibung und wäre auf ASCII beschränkt; ein
 * ICU-Build von SQLite ist für zwanzig Zeilen kein Handel.
 *
 * `localeCompare` mit `de-CH` ordnet `Ärni` zu `A` ein und behandelt
 * Grossschreibung als nachrangigen Unterschied. Bei zwanzig Zeilen kostet das
 * nichts, und die Funktion bleibt **synchron** — die Datenschicht kennt kein
 * Promise.
 *
 * Ohne die Hash-Spalte: dieses Ergebnis geht durch `return` einer load-Funktion
 * und damit in den ausgelieferten Quelltext.
 */
export function mitgliederAuflisten(): AngemeldetesMitglied[] {
	const zeilen = datenbank()
		.select(ohneHashSpalte)
		.from(members)
		.orderBy(desc(members.isActive))
		.all();

	/*
	 * Ein Vergleicher, einmal gebaut. Die Gruppierung nach is_active kommt
	 * schon aus dem orderBy; der Vergleicher hält sie ausdrücklich fest, weil
	 * Array.prototype.sort in V8 stabil ist, aber eine Sortierung, die sich auf
	 * die Stabilität einer Vorsortierung verlässt, das nirgends sagt.
	 */
	const nachName = new Intl.Collator('de-CH').compare;
	return zeilen.sort((links, rechts) =>
		links.isActive === rechts.isActive
			? nachName(links.name, rechts.name)
			: Number(rechts.isActive) - Number(links.isActive)
	);
}

/**
 * Beendet den Zugang eines **aktiven** Mitglieds und gibt die getroffene Zeile
 * zurück, oder null, wenn keine getroffen wurde.
 *
 * Zugang beenden heisst deaktivieren: kein DELETE, kein geleerter Name, kein
 * geleerter Hash. Die Historie bleibt, und künftige Dienstwochen erscheinen als
 * unbesetzt statt zu verschwinden (AD-11).
 *
 * Die Bedingung `is_active = 1` steht **hier** und nicht in der Route. Sonst
 * müssten die Route und jede künftige Aufrufstelle sie wiederholen, und eine
 * von ihnen täte es falsch — ein zweiter Widerruf auf dieselbe Zeile wäre dann
 * ein stiller Erfolg statt der Meldung, die die Matrix vorschreibt.
 *
 * null bedeutet also dreierlei auf einmal: es gibt die Id nicht, oder das
 * Mitglied ist schon beendet. Die Route macht daraus **einen** Satz — jede
 * Unterscheidung wäre ein Kanal, an dem sich ablesen liesse, welche Zeilen es
 * gibt.
 */
export function mitgliedDeaktivieren(id: number): AngemeldetesMitglied | null {
	const zeile = datenbank()
		.update(members)
		.set({ isActive: false })
		.where(and(eq(members.id, id), eq(members.isActive, true)))
		.returning(ohneHashSpalte)
		.get();
	return zeile ?? null;
}

/**
 * Die Zeile eines **aktiven** Mitglieds, oder null.
 *
 * Der Unterschied zu mitgliedNachId ist die Bedingung `is_active = 1`, und sie
 * steht **hier** und nicht in der Route — aus demselben Grund wie bei
 * mitgliedDeaktivieren. Ohne Hash-Spalte, weil das Ergebnis nur zur Auskunft
 * dient, ob die Zeile ansprechbar ist.
 *
 * Gebraucht von der action `umbenennen`, und zwar **vor** der Namensprüfung:
 * eine Abweisung muss immer an einer Zeile anzubringen sein. Bei einer
 * unbekannten oder beendeten Id und einem untauglichen Namen zugleich trüge die
 * Antwort sonst `feld: 'neuerName'` und eine Zeilennummer, die es nicht gibt —
 * die Oberfläche fände keine Stelle dafür, und die abgewiesene Eingabe
 * verschwände spurlos. Der Satz über das nicht ansprechbare Mitglied gehört in
 * diesem Fall nach oben, ohne Feld und ohne Zeile.
 *
 * Dass mitgliedUmbenennen danach **noch einmal** auf null prüft, ist keine
 * Verdopplung, sondern der Schluss des Fensters dazwischen: zwischen Auskunft
 * und UPDATE kann ein Widerruf laufen. Die Auskunft entscheidet, **welchen Satz**
 * die Person liest; die Bedingung im UPDATE entscheidet, **ob** geschrieben wird.
 */
export function aktivesMitgliedLesen(id: number): AngemeldetesMitglied | null {
	const zeile = datenbank()
		.select(ohneHashSpalte)
		.from(members)
		.where(and(eq(members.id, id), eq(members.isActive, true)))
		.get();
	return zeile ?? null;
}

/**
 * Ersetzt den Namen eines **aktiven** Mitglieds und gibt die getroffene Zeile
 * zurück, oder null, wenn keine getroffen wurde.
 *
 * Ein UPDATE derselben Zeile, kein INSERT mit anschliessendem Widerruf: Id,
 * invite_token_hash, is_admin, is_active und created_at bleiben unberührt.
 * Umbenennen ist **kein** Zugangsvorgang — der Weg über Beenden und neu
 * Aufnehmen nähme der Person zugleich alle künftigen Dienstwochen (AD-11), und
 * genau dafür war ein vertippter Name bis Story 3.0.1 der einzige Weg.
 *
 * Die Bedingung `is_active = 1` steht **hier** und nicht in der Route, aus
 * demselben Grund wie bei mitgliedDeaktivieren: sonst wiederholte sie jede
 * künftige Aufrufstelle, und eine von ihnen täte es falsch. Ein beendeter
 * Zugang wird nicht umbenannt — es gibt an ihm nichts mehr zu tun.
 *
 * null bedeutet also zweierlei auf einmal: es gibt die Id nicht, oder das
 * Mitglied ist beendet. Die Route macht daraus **einen** Satz.
 *
 * Der Name kommt geprüft und gefaltet herein — namePruefen in
 * ../../../mitgliedsname.ts ist die eine Stelle, die das entscheidet.
 */
export function mitgliedUmbenennen(id: number, name: string): AngemeldetesMitglied | null {
	const zeile = datenbank()
		.update(members)
		.set({ name })
		.where(and(eq(members.id, id), eq(members.isActive, true)))
		.returning(ohneHashSpalte)
		.get();
	return zeile ?? null;
}

/**
 * Ersetzt den Token-Hash eines **aktiven** Mitglieds und gibt die getroffene
 * Zeile zurück, oder null.
 *
 * Ein UPDATE derselben Zeile, kein INSERT: invite_token_hash ist unique, und
 * die Person behält Id, Name und ihre Historie. Der alte Link ist damit sofort
 * ungültig — genau das ist der Zweck, denn Neuausstellen ist der Weg für einen
 * verlorenen oder in falsche Hände geratenen Link. Für ein zweites Gerät
 * braucht es ihn nicht: das Token bleibt mehrfach einlösbar (AD-10).
 *
 * Den Klartext erzeugt die Route und behält ihn; hier kommt nur der Hash an.
 */
export function einladungNeuAusstellen(
	id: number,
	inviteTokenHash: string
): AngemeldetesMitglied | null {
	const zeile = datenbank()
		.update(members)
		.set({ inviteTokenHash })
		.where(and(eq(members.id, id), eq(members.isActive, true)))
		.returning(ohneHashSpalte)
		.get();
	return zeile ?? null;
}
