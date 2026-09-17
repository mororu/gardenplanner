import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { protokolldateiLesen } from '../../../lib/server/db/queries/meetings.ts';
import { protokollLesen } from '../../../lib/server/protokollablage.ts';
import { NICHT_GEFUNDEN } from '../../../lib/texte.ts';

/*
 * Die Ausgabe eines abgelegten Protokolls.
 *
 * **Die zweite Route dieses Produkts ohne Seite**, nach src/routes/i/[token].
 * Sie ist keine Ausnahme von AD-9 („Mutationen sind form actions"): hier wird
 * nichts mutiert, hier werden Bytes ausgeliefert, und dafür gibt es keine
 * Bauform mit einem `<form>`.
 *
 * **Der Wächter in src/hooks.server.ts deckt sie mit.** Er läuft vor jeder
 * Route und weist einen Aufruf ohne gültige Sitzung mit 403 ab — es gibt hier
 * darum keine eigene Zugangsprüfung, und das ist dieselbe Entscheidung wie auf
 * jeder Seite. Wer die Kennung eines Protokolls kennt, aber keinen Zugang hat,
 * bekommt die Datei nicht.
 *
 * **Drei Zustände fallen auf denselben 404 zusammen:** eine Kennung, die keine
 * Zahl ist; eine, zu der es keine Zeile gibt; und eine Zeile, deren Datei
 * fehlt. Der dritte ist der benannte Preis dafür, dass Datenbank und Ablage
 * zwei Dinge sind (siehe die Tabelle `minutes` in
 * ../../../lib/server/db/schema.ts). Für die lesende Person sind alle drei
 * dasselbe: das Protokoll, das sie sucht, ist hier nicht.
 */

/**
 * Wie die Datei ausgeliefert wird — und warum genau so.
 *
 * `Content-Type: application/pdf` steht **fest** und kommt nicht aus der Datei
 * oder aus dem, was der Browser beim Hochladen gemeldet hat: ein übernommener
 * Medientyp ist die Stelle, an der aus einer abgelegten Datei ein
 * ausgeliefertes HTML-Dokument im eigenen Ursprung wird.
 *
 * `Content-Disposition: attachment` ist die zweite Hälfte davon. Der Browser
 * zeigt die Datei dann nicht im Rahmen dieser Anwendung an, sondern lädt sie
 * herunter — was jemand in eine Datei geschrieben hat, läuft damit nie in
 * einem Kontext, der Sitzungsdaten sieht. Der Preis ist benannt und
 * angenommen: ein Protokoll öffnet sich nicht im Browserfenster, es landet im
 * Downloadordner. Für ein Dokument, das man aufhebt, ist das ohnehin der
 * richtige Ort.
 *
 * `X-Content-Type-Options: nosniff` verbietet dem Browser, den Typ am Inhalt zu
 * erraten. Ohne diesen Kopf wäre die feste Angabe darüber ein Vorschlag.
 *
 * Der Dateiname ist gerechnet und nicht gespeichert: `protokoll-<Kennung>.pdf`.
 * Der hochgeladene Name ist nie in die Datenbank gekommen (siehe
 * ../../../lib/server/protokollablage.ts), und ein Name aus einer Eingabe wäre
 * in dieser Kopfzeile die nächste Stelle, an der man Sonderzeichen entschärfen
 * müsste.
 */
function kopfzeilen(id: number, groesse: number): HeadersInit {
	return {
		'content-type': 'application/pdf',
		'content-length': String(groesse),
		'content-disposition': `attachment; filename="protokoll-${id}.pdf"`,
		'x-content-type-options': 'nosniff',
	};
}

export function GET({ params }: RequestEvent): Response {
	/*
	 * `Number.isSafeInteger` und nicht `Number()` allein: `Number('')` ist 0,
	 * `Number('1.5')` ist 1.5, und beide fänden in der Datenbank nichts — nur
	 * eben nach einer Abfrage statt vorher. Dieselbe Auslegung wie in
	 * ../../wissen/[id]/+page.server.ts.
	 */
	const roh = params.id ?? '';
	const id = /^[0-9]+$/.test(roh) ? Number(roh) : Number.NaN;
	if (!Number.isSafeInteger(id) || id <= 0) {
		error(404, NICHT_GEFUNDEN);
	}

	const datei = protokolldateiLesen(id);
	if (datei === null) {
		error(404, NICHT_GEFUNDEN);
	}

	const bytes = protokollLesen(datei);
	if (bytes === null) {
		error(404, NICHT_GEFUNDEN);
	}

	/*
	 * **Ausgeschnitten und nicht `bytes.buffer`**, und der Unterschied ist kein
	 * Typdetail, sondern eine Lücke.
	 *
	 * `Response` nimmt ein Uint8Array über einem `ArrayBufferLike` nicht an (der
	 * Typprüfer sagt es, gemessen). Der naheliegende Griff wäre `bytes.buffer` —
	 * und der ist falsch: Node legt kleine Lesevorgänge in einen **gemeinsamen**
	 * Puffer, `bytes` ist dann ein Ausschnitt daraus, und `bytes.buffer` ist der
	 * ganze Pool. Ausgeliefert würde alles, was gerade sonst noch darin steht —
	 * bei einem Protokoll unter vier Kilobyte der Normalfall und nicht der
	 * Sonderfall.
	 *
	 * `slice` über `byteOffset` und `byteLength` schneidet genau diese Datei
	 * heraus, in eine eigene Kopie. Sie kostet die Grösse des Protokolls einmal
	 * im Speicher, und das ist der Preis, den man dafür zahlt.
	 */
	const rumpf = bytes.buffer.slice(
		bytes.byteOffset,
		bytes.byteOffset + bytes.byteLength
	) as ArrayBuffer;
	return new Response(rumpf, { headers: kopfzeilen(id, bytes.byteLength) });
}
