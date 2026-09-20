import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { PDF_TYP } from '../../../../../lib/dokument.ts';
import { dateiLesen } from '../../../../../lib/server/ablage.ts';
import { dokumentAblageLesen } from '../../../../../lib/server/db/queries/documents.ts';
import { NICHT_GEFUNDEN } from '../../../../../lib/texte.ts';

/*
 * /wissen/dokument/[id]/datei — der Inhalt eines abgelegten PDF.
 *
 * **Das zweite `+server.ts` des Produkts neben /i/[token] und den zwei
 * Sitzungsausgaben**, und wie jene ist es kein JSON-Endpunkt: AD-9 verlangt
 * form actions für Mutationen, und diese Route mutiert nichts. Sie liefert
 * Bytes, und dafür gibt es keine Seite.
 *
 * **Hinter dem Wächter, und genau das ist der Grund für diese Route.** Läge
 * die Datei unter `static/`, wäre sie ohne jede Sitzung im Netz — jener
 * Baum wird ausgeliefert, bevor src/hooks.server.ts überhaupt läuft. Hier
 * greift der Wächter wie bei jeder anderen Adresse: kein gültiges Cookie, kein
 * Byte. Die ganze Begründung steht am Kopf von ../../../../../lib/server/ablage.ts.
 *
 * **Warum die Datei nicht direkt unter /wissen/dokument/[id] liegt.** Jene
 * Adresse ist die Seite über das Dokument; dieselbe Adresse könnte nicht beides
 * sein. Ein Anhang `/datei` ist die Auflösung, die auch in der Adresszeile
 * lesbar bleibt.
 */

/**
 * Die Id aus dem Pfadsegment, oder null.
 *
 * Dieselbe Deutung wie in der Nachbarroute und auf /wissen/[id]. Sie steht hier
 * ein zweites Mal und wird **nicht** geteilt: drei Zeilen Musterprüfung gegen
 * ein Modul, das zwei Routen importieren müssten — und die Deutung eines
 * Pfadsegments ist die Sache der Route, die den Pfad hat. Dieselbe Erwägung
 * steht an `idLesen` auf `/verwaltung`.
 */
function idLesen(roh: unknown): number | null {
	if (typeof roh !== 'string') return null;
	const gekuerzt = roh.trim();
	if (!/^[0-9]+$/.test(gekuerzt)) return null;
	const id = Number(gekuerzt);
	return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Wie der Dateiname in `Content-Disposition` landet.
 *
 * **Zweimal, und beide Male ist Absicht.** Der erste Wert (`filename=`) trägt
 * nur, was in ein HTTP-Token passt — alles ausserhalb von ASCII wird zu einem
 * Unterstrich, damit ein alter Client keinen kaputten Namen sieht. Der zweite
 * (`filename*=`) trägt den echten Namen prozentkodiert nach RFC 5987, und jeder
 * heutige Browser bevorzugt ihn. Ohne den ersten bekämen alte Clients gar
 * nichts, ohne den zweiten verlöre `Blattläuse.pdf` seine Umlaute.
 *
 * Das Anführungszeichen und der Backslash fallen im ersten Wert mit weg: sie
 * beendeten sonst die Zeichenkette mitten im Kopfzeilenwert.
 */
function alsDateiname(name: string): string {
	// Die Klasse ist positiv formuliert — erlaubt ist druckbares ASCII —, und
	// damit fallen Steuerzeichen mit weg, ohne dass sie einzeln dastehen müssten.
	const schlicht = name.replace(/[^\u0020-\u007e]|["\\]/g, '_');
	return `inline; filename="${schlicht}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * Liefert das PDF aus.
 *
 * **Zwei Wege zum 404, und sie sind verschieden begründet.** Gibt es die Zeile
 * nicht, hat die Adresse nie etwas bezeichnet. Gibt es die Zeile, aber die
 * Datei fehlt, ist die Ablage unvollständig — ein wiederhergestelltes Backup
 * ohne die Dateien, ein von Hand aufgeräumtes Verzeichnis. Beide fallen auf
 * denselben Satz, weil die Person dasselbe tun kann: nichts, ausser es jemandem
 * zu sagen. Eine Unterscheidung wäre eine Auskunft über den Zustand des
 * Servers.
 *
 * **`inline` und nicht `attachment`**: wer im Garten auf ein Merkblatt tippt,
 * will es lesen und nicht herunterladen. Der Dateiname reist trotzdem mit —
 * wer dann doch speichert, bekommt `merkblatt.pdf` und nicht `datei`.
 *
 * **Die drei Schutzkopfzeilen stehen ausdrücklich hier** und nicht nur global:
 * `X-Content-Type-Options: nosniff` verbietet dem Browser, den Typ zu erraten
 * (sonst wäre ein als PDF abgelegtes HTML doch noch HTML), und
 * `Content-Security-Policy: sandbox` nimmt dem Dokument Skripte und Formulare,
 * falls es je in einem Rahmen landet. PDF ist ein Format mit eigener
 * Ausführungsschicht, und diese zwei Zeilen kosten nichts.
 *
 * **`private` im Cache-Control**: die Datei liegt hinter einer Sitzung, und ein
 * Zwischenspeicher zwischen Server und Browser hat sie niemandem sonst zu
 * geben. `max-age=0, must-revalidate` lässt den Browser sie behalten, aber vor
 * jeder Wiederverwendung nachfragen — eine gelöschte Datei soll nicht aus dem
 * Zwischenspeicher weiterleben.
 */
export function GET({ params }: RequestEvent): Response {
	const id = idLesen(params.id);
	if (id === null) error(404, { message: NICHT_GEFUNDEN });

	const zeile = dokumentAblageLesen(id);
	if (zeile === null) error(404, { message: NICHT_GEFUNDEN });

	const inhalt = dateiLesen(zeile.ablage);
	if (inhalt === null) error(404, { message: NICHT_GEFUNDEN });

	return new Response(inhalt, {
		headers: {
			'content-type': PDF_TYP,
			'content-length': String(inhalt.byteLength),
			'content-disposition': alsDateiname(zeile.dateiname),
			'x-content-type-options': 'nosniff',
			'content-security-policy': 'sandbox',
			'cache-control': 'private, max-age=0, must-revalidate',
		},
	});
}
