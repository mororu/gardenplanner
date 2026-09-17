import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { traktandenlistedateiLesen } from '../../../../lib/server/db/queries/meetings.ts';
import { traktandenlisteLesen } from '../../../../lib/server/protokollablage.ts';
import { NICHT_GEFUNDEN } from '../../../../lib/texte.ts';

/*
 * Die Ausgabe einer gezogenen Traktandenliste.
 *
 * **Eine eigene Route neben ../../[id]/+server.ts und nicht dieselbe.** Die
 * Kennungen kommen aus zwei Tabellen und überdecken einander: die Liste 3 und
 * das Protokoll 3 gibt es beide, und eine gemeinsame Route müsste raten oder
 * eine Artangabe im Pfad tragen. Zwei Pfade sind hier die billigere Wahrheit.
 *
 * Alles andere ist die Nachbarroute, und die Begründungen stehen dort in ganzer
 * Länge: der Wächter in src/hooks.server.ts deckt beide mit, drei Zustände
 * fallen auf denselben 404 zusammen (keine Zahl, keine Zeile, keine Datei), und
 * der Rumpf wird aus dem gemeinsamen Lesepuffer **ausgeschnitten** statt über
 * `bytes.buffer` gereicht.
 */

/**
 * Wie die Datei ausgeliefert wird — und warum genau so.
 *
 * `text/plain; charset=utf-8` steht **fest** und kommt nicht aus der Datei: ein
 * geratener Medientyp ist die Stelle, an der aus einer abgelegten Datei ein
 * ausgeliefertes HTML-Dokument im eigenen Ursprung wird. Die Zeichensatzangabe
 * gehört dazu und ist hier keine Förmlichkeit — die Liste trägt Umlaute und das
 * `·` der Herkunftszeile, und ohne sie liest mancher Browser sie als Latin-1.
 *
 * `Content-Disposition: attachment` ist die zweite Hälfte davon: die Datei läuft
 * damit nie in einem Kontext, der Sitzungsdaten sieht. Der Preis ist benannt und
 * angenommen — die Liste öffnet sich nicht im Browserfenster, sie landet im
 * Downloadordner. Für ein Blatt, das man an die Sitzung mitnimmt, ist das der
 * richtige Ort.
 *
 * `X-Content-Type-Options: nosniff` verbietet dem Browser, den Typ am Inhalt zu
 * erraten. Ohne diesen Kopf wäre die feste Angabe darüber ein Vorschlag.
 *
 * Der Dateiname ist gerechnet und nicht gespeichert: `traktanden-<Kennung>.txt`.
 */
function kopfzeilen(id: number, groesse: number): HeadersInit {
	return {
		'content-type': 'text/plain; charset=utf-8',
		'content-length': String(groesse),
		'content-disposition': `attachment; filename="traktanden-${id}.txt"`,
		'x-content-type-options': 'nosniff',
	};
}

export function GET({ params }: RequestEvent): Response {
	const roh = params.id ?? '';
	const id = /^[0-9]+$/.test(roh) ? Number(roh) : Number.NaN;
	if (!Number.isSafeInteger(id) || id <= 0) {
		error(404, NICHT_GEFUNDEN);
	}

	const datei = traktandenlistedateiLesen(id);
	if (datei === null) {
		error(404, NICHT_GEFUNDEN);
	}

	const bytes = traktandenlisteLesen(datei);
	if (bytes === null) {
		error(404, NICHT_GEFUNDEN);
	}

	const rumpf = bytes.buffer.slice(
		bytes.byteOffset,
		bytes.byteOffset + bytes.byteLength
	) as ArrayBuffer;
	return new Response(rumpf, { headers: kopfzeilen(id, bytes.byteLength) });
}
