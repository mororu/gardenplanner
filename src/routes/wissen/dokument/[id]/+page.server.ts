import { error, redirect } from '@sveltejs/kit';
import type { Actions, RequestEvent, ServerLoadEvent } from '@sveltejs/kit';
import { abweisen } from '../../../../lib/server/abweisen.ts';
import { adminOderWeg } from '../../../../lib/server/adminschranke.ts';
import { dateiWegnehmen } from '../../../../lib/server/ablage.ts';
import {
	dokumentLesen,
	dokumentLoeschen,
	type Dokument,
} from '../../../../lib/server/db/queries/documents.ts';
import { NICHT_GEFUNDEN } from '../../../../lib/texte.ts';

/*
 * /wissen/dokument/[id] — ein abgelegtes PDF: Titel, Dateiangaben, der Weg zum
 * Inhalt und, für eine Adminperson, der Weg weg damit.
 *
 * **Warum es diese Seite gibt und der Listeneintrag nicht direkt auf die Datei
 * zeigt.** Der Grund steht schon in der Nachbarroute, für Blätter: „ein
 * Löschen-Knopf an einer Listenzeile löschte etwas, dessen Inhalt man gerade
 * nicht sieht." Für ein Dokument gilt das genauso, und es kommt eines dazu —
 * ein Titel in einer Liste sagt nicht, welche Datei dahinter liegt. Wer
 * `Merkblatt Brennnesseljauche` löschen will, soll vorher gesehen haben, dass
 * darunter `bj-2024-final.pdf` von 1.2 MB liegt.
 *
 * **Die Seite zeigt das PDF nicht eingebettet.** Kein `<iframe>`, kein
 * `<object>`, kein Betrachter: ein eingebettetes PDF lädt auf dem Telefon
 * mehrere Megabyte, bevor irgendjemand danach gefragt hat, und der Betrachter
 * des Geräts kann es ohnehin besser. Der Link öffnet es — das ist der ganze
 * Vorgang.
 *
 * Die Importe stehen relativ und mit .ts-Endung, und die Typen kommen aus
 * @sveltejs/kit statt aus ./$types — derselbe Grund wie in den Nachbarrouten:
 * scripts/smoke-zugang.ts lädt dieses Modul mit nacktem Node.
 */

/**
 * Der Satz für ein Dokument, das beim Löschen schon fort ist.
 *
 * Wörtlich derselbe Bau wie BLATT_SCHON_FORT auf /wissen/[id] und aus
 * demselben Grund: wer löschen wollte, hat einen Knopf gedrückt und nichts
 * getippt, das zu retten wäre — das Ziel ist erreicht, nur von jemand anderem.
 */
const DOKUMENT_SCHON_FORT = 'Dieses Dokument gibt es nicht mehr — jemand war schneller.';

/**
 * Die Id aus dem Pfadsegment, oder null.
 *
 * Dieselbe Deutung wie `idLesen` auf /wissen/[id], `/` und `/verwaltung` — nur
 * Ziffern, eine sichere Ganzzahl, grösser als null.
 *
 * `unknown` und nicht `string`: das Typprüf-Programm der Skripte
 * (tsconfig.scripts.json) zieht bewusst kein DOM-lib, und dieses Modul liegt
 * über scripts/smoke-zugang.ts darin.
 */
function idLesen(roh: unknown): number | null {
	if (typeof roh !== 'string') return null;
	const gekuerzt = roh.trim();
	if (!/^[0-9]+$/.test(gekuerzt)) return null;
	const id = Number(gekuerzt);
	return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Das Dokument und ob gerade eines abgelegt wurde.
 *
 * **Eine unbekannte Kennung ist ein 404 und keine leere Seite**, wie beim
 * Blatt. Ob die **Datei** dazu noch auf der Platte liegt, prüft diese load
 * ausdrücklich nicht: das kostete einen Dateizugriff für jede Anzeige, und die
 * Antwort wäre beim Antippen des Links ohnehin erneut zu holen. Wer den Inhalt
 * will, bekommt ihn oder einen 404 — und zwar dort, wo er ihn angefordert hat.
 */
export function load({ locals, params, url }: ServerLoadEvent): {
	dokument: Dokument;
	angelegt: boolean;
	istAdmin: boolean;
} {
	const id = idLesen(params.id);
	if (id === null) error(404, { message: NICHT_GEFUNDEN });

	const dokument = dokumentLesen(id);
	if (dokument === null) error(404, { message: NICHT_GEFUNDEN });

	return {
		dokument,
		angelegt: url.searchParams.has('angelegt'),
		/*
		 * **Nur dafür, ob der Löschen-Griff gemalt wird** — die Schranke selbst
		 * steht in der action (adminOderWeg). Wörtlich dieselbe Begründung wie auf
		 * /wissen/[id]: wer diesen Wert im Browser auf true dreht, bekommt einen
		 * Knopf, der beim Drücken auf `/` weiterleitet.
		 */
		istAdmin: locals.mitglied?.isAdmin ?? false,
	};
}

export const actions = {
	/**
	 * Nimmt das Dokument weg — **Zeile zuerst, Datei danach**.
	 *
	 * Die Reihenfolge ist die Umkehrung des Ablegens und an `dokumentLoeschen`
	 * begründet: bricht es dazwischen ab, bleibt eine Datei ohne Zeile liegen,
	 * und die ist unerreichbar, aber harmlos.
	 *
	 * **Nur eine Adminperson**, wie beim Blatt. `adminOderWeg` leitet jede andere
	 * auf `/` — die Begründung für die Schranke steht an blattLoeschen und, um
	 * die eine zusätzliche Erwägung ergänzt, an dokumentLoeschen: was hier
	 * verschwindet, ist nicht bloss ein Text, den jemand neu tippen könnte,
	 * sondern eine Datei, deren Original vielleicht nirgends sonst mehr liegt.
	 *
	 * Weitergeleitet wird auf `/wissen?geloescht` und nicht hierher zurück: die
	 * Seite, auf der sonst gemeldet würde, ist gerade verschwunden. Derselbe Weg
	 * wie beim Löschen eines Blatts, und die Liste trägt dieselbe Meldung.
	 */
	loeschen: async ({ locals, params, request }: RequestEvent) => {
		adminOderWeg(locals);

		const id = idLesen(params.id);
		if (id === null) error(404, { message: NICHT_GEFUNDEN });

		const formular = await request.formData();

		/*
		 * **Schritt 1: fragen.** Dieselbe zweistufige Bauform wie beim Löschen
		 * eines Blatts, und hier trägt sie schwerer: was verschwindet, ist eine
		 * Datei, deren Original vielleicht nirgends sonst mehr liegt.
		 *
		 * `has` und nicht ein Wertvergleich — das Feld ist eine Marke, kein Wert.
		 *
		 * Die Rückfrage nennt den Titel **und** den Dateinamen. Beim Blatt genügt
		 * der Titel, weil er über dem Text steht, den man gerade liest; hier steht
		 * der Inhalt nicht auf der Seite, und `Merkblatt` allein sagt nicht, welche
		 * Datei gleich fort ist.
		 */
		if (!formular.has('bestaetigt')) {
			const dokument = dokumentLesen(id);
			if (dokument === null) return abweisen(DOKUMENT_SCHON_FORT);
			return {
				art: 'fragenLoeschen' as const,
				titel: dokument.titel,
				dateiname: dokument.dateiname,
			};
		}

		// Schritt 2: schreiben. Wer das Wettrennen verliert, bekommt denselben
		// Satz wie jemand mit einer erfundenen Kennung.
		const weg = dokumentLoeschen(id);
		if (weg === null) return abweisen(DOKUMENT_SCHON_FORT);

		/*
		 * Die Datei danach. `dateiWegnehmen` lässt eine bereits fehlende Datei
		 * durchgehen — die Zeile ist fort, und das Ziel des Aufrufs ist damit
		 * erreicht, auch wenn die Ablage schon von Hand aufgeräumt wurde.
		 */
		dateiWegnehmen(weg.ablage);

		// Nach dem redirect läuft hier nichts mehr: redirect() wirft.
		redirect(303, '/wissen?geloescht');
	},
} satisfies Actions;
