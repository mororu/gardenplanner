import { error, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { sitzungAusstellen } from '../../../lib/server/auth.ts';
import { mitgliedNachTokenHash } from '../../../lib/server/db/queries/members.ts';
import type { Member } from '../../../lib/server/db/schema.ts';
import { tokenHashen } from '../../../lib/server/token.ts';
import { KEIN_ZUGANG } from '../../../lib/texte.ts';

/*
 * Der einzige Weg herein und der einzige +server.ts der Anwendung.
 *
 * Die Importe stehen relativ und mit .ts-Endung statt über $lib, weil
 * scripts/smoke-zugang.ts diese Datei mit nacktem Node lädt, um die
 * Ununterscheidbarkeit der Fehlerfälle bei jedem Lauf nachzuweisen. Der Typ
 * kommt aus @sveltejs/kit und nicht aus ./$types, weil ./$types ein virtuelles
 * Modul ist und im Typprüf-Programm der Skripte nicht auflösbar wäre.
 *
 * Das Token bleibt bis zum Widerruf gültig und mehrfach einlösbar: ein zweites
 * Gerät braucht keinen neuen Link, und die erste Sitzung bleibt gültig.
 */
/**
 * Sucht das Mitglied zum Klartext-Token.
 *
 * Ein Wurf der Abfrage wird zu null und damit zur selben 403, nie zu einer 500:
 * ein abweichender Statuscode verriete, dass es diese Zeile gibt.
 */
function mitgliedSuchen(token: string | undefined): Member | null {
	if (token === undefined) return null;
	try {
		return mitgliedNachTokenHash(tokenHashen(token));
	} catch {
		return null;
	}
}

export async function GET({ params, cookies }: RequestEvent): Promise<Response> {
	const mitglied = mitgliedSuchen(params.token);

	// Unbekanntes Token und deaktiviertes Mitglied sind hier ununterscheidbar —
	// gleicher Status, gleicher Satz, gleiche Kopfzeilen. Das Token erscheint
	// weder in der Antwort noch in einer Protokollzeile.
	if (mitglied === null || !mitglied.isActive) {
		error(403, KEIN_ZUGANG);
	}

	await sitzungAusstellen(cookies, mitglied.id);
	redirect(303, '/');
}
