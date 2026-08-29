import type { Actions, RequestEvent, ServerLoadEvent } from '@sveltejs/kit';
import { abweisen } from '../../lib/server/abweisen.ts';
import { adminOderWeg } from '../../lib/server/adminschranke.ts';
import {
	einladungNeuAusstellen,
	mitgliedAnlegen,
	mitgliedDeaktivieren,
	mitgliederAuflisten,
} from '../../lib/server/db/queries/members.ts';
import type { AngemeldetesMitglied } from '../../lib/server/db/schema.ts';
import { tokenErzeugen, tokenHashen } from '../../lib/server/token.ts';
import { EIGENER_ZUGANG_GESCHUETZT, MITGLIED_NICHT_ANSPRECHBAR } from '../../lib/texte.ts';

/*
 * /verwaltung — aufnehmen, Link neu ausstellen, Einladung widerrufen.
 *
 * Die Importe stehen relativ und mit .ts-Endung, und die Typen kommen aus
 * @sveltejs/kit statt aus ./$types. Der Grund ist derselbe wie in
 * src/routes/i/[token]/+server.ts und geprüft, nicht vermutet:
 * scripts/smoke-zugang.ts lädt dieses Modul mit nacktem Node, und
 * tsconfig.scripts.json kennt weder das virtuelle ./$types noch die
 * $lib-Zuordnung.
 *
 * **Der Klartext des Tokens** entsteht in einer action, verlässt den Server
 * genau einmal im Rückgabewert dieser action und wird nie gespeichert, nie
 * geloggt und nie in eine URL, ein Cookie oder eine Weiterleitung gelegt. In
 * members steht ausschliesslich der SHA-256-Hash. Ein Neuladen ist ein GET,
 * dessen load den Klartext nicht kennt und nicht kennen kann — der Hash ist
 * nicht umkehrbar. „Nach dem Verlassen der Seite nirgends mehr abrufbar" ist
 * damit eine Eigenschaft des Aufbaus und keine Zusage der Oberfläche.
 *
 * **Jede** der vier Einstiegsstellen beginnt mit adminOderWeg. Eine action
 * ohne Schranke wäre der Fehler, den die Oberfläche nicht sichtbar macht: für
 * Nicht-Admins fehlt der Knopf, ein POST braucht aber keinen.
 */

/** Der Text für den einen Fall, den nur diese Seite kennt. Eine Wurfstelle. */
const NAME_FEHLT = 'Ohne Namen geht es nicht. Trage ein, wie die Gruppe die Person nennt.';

/**
 * Die Längengrenze des Namens, serverseitig durchgesetzt.
 *
 * 80 Zeichen fassen jeden Doppelnamen mit Bindestrich und jeden Zusatz, den
 * eine Gartengruppe zur Unterscheidung braucht (`Anna Meier (Beet 12)`), und
 * halten die Zeile bei 375px in zwei Zeilen. Das `maxlength` am Feld ist die
 * Bequemlichkeit, diese Konstante die Regel: ein POST braucht kein Feld.
 */
const NAME_HOECHSTLAENGE = 80;

/** Der Text für die Überlänge. Eine Wurfstelle. */
const NAME_ZU_LANG = `Der Name ist zu lang. Höchstens ${NAME_HOECHSTLAENGE} Zeichen, gerne die Kurzform.`;

/**
 * Nullbreiten-Zeichen. Sie sind unsichtbar, haben keine Breite und `trim()`
 * hält sie **nicht** für Leerraum.
 *
 * Ohne dieses Aussieben besteht ein Name aus reinen Nullbreiten-Zeichen jede
 * Prüfung und legt eine Zeile an, die in der Liste als leere Lücke erscheint —
 * ohne lesbaren Namen, mit einem lebenden Einladungslink und ohne jede Aussage,
 * wer das ist. Es gibt keine Umbenennen-Aktion in dieser Anwendung, der Fehler
 * ist also endgültig; ein Widerruf ist dann das Einzige, was bleibt.
 *
 * U+200B ZERO WIDTH SPACE, U+200C ZERO WIDTH NON-JOINER,
 * U+200D ZERO WIDTH JOINER, U+2060 WORD JOINER, U+FEFF ZERO WIDTH NO-BREAK
 * SPACE (die Form, in der eine Byte-Order-Mark beim Einfügen aus einer Datei
 * mitkommt).
 */
const NULLBREITE = /[\u200B-\u200D\u2060\uFEFF]/g;

/**
 * Der Name, wie er in die Datenbank geht — oder null, wenn er nicht taugt.
 *
 * Reihenfolge mit Absicht: erst die Nullbreiten-Zeichen weg, dann Leerraum
 * zusammenziehen, dann trimmen. Umgekehrt bliebe `\u200B \u200B` nach dem
 * Trimmen ein nichtleerer „Name".
 */
function namePruefen(eingabe: string): { name: string } | { fehler: string } {
	const name = eingabe.replace(NULLBREITE, '').replace(/\s+/g, ' ').trim();
	if (name === '') return { fehler: NAME_FEHLT };
	// Nach Codepoints gezählt, nicht nach UTF-16-Einheiten: ein Emoji im Namen
	// ist keine zwei Zeichen. [...name] zerlegt in Codepoints.
	if ([...name].length > NAME_HOECHSTLAENGE) return { fehler: NAME_ZU_LANG };
	return { name };
}

/**
 * Die einzige Kopfzeile, die die Zusage „nie gespeichert" überhaupt trägt.
 *
 * Ohne `no-store` darf der Browser die POST-Antwort in den Plattenzwischen-
 * speicher legen und im Verlauf behalten. Und ohne JavaScript ist diese Antwort
 * kein JSON-Bröckchen, sondern ein vollständiges HTML-Dokument mit dem
 * Klartext-Link darin — genau das, was nirgends liegenbleiben soll. Gesetzt wird
 * sie in **beiden** actions, die Klartext zurückgeben, und in keiner anderen:
 * eine Antwort ohne Geheimnis braucht sie nicht.
 */
const NO_STORE = { 'cache-control': 'no-store' };

/**
 * Liest die mitgliedId aus dem Formular, oder null.
 *
 * Fehlend, nicht numerisch und ausserhalb des Zahlenbereichs fallen auf
 * dasselbe null zusammen — und weiter unten auf denselben Satz wie eine
 * unbekannte und eine schon beendete Zeile. Jede Unterscheidung wäre ein
 * Aufzählungskanal.
 */
function idLesen(roh: unknown): number | null {
	// `unknown` und nicht FormDataEntryValue: das Typprüf-Programm der Skripte
	// (tsconfig.scripts.json) zieht bewusst kein DOM-lib, und dieses Modul liegt
	// über scripts/smoke-zugang.ts darin. Ein Datei-Upload ist hier ohnehin kein
	// gültiger Wert, die Prüfung auf string deckt beides ab.
	if (typeof roh !== 'string') return null;
	const gekuerzt = roh.trim();
	if (!/^[0-9]+$/.test(gekuerzt)) return null;
	const id = Number(gekuerzt);
	return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Der Einladungslink zu einem Klartext-Token. Die Herkunft kommt aus dem Aufruf. */
function linkBauen(url: URL, token: string): string {
	return `${url.origin}/i/${token}`;
}

export function load({ locals }: ServerLoadEvent): {
	ichId: number;
	mitglieder: AngemeldetesMitglied[];
} {
	const ich = adminOderWeg(locals);
	// mitgliederAuflisten gibt die Zeilen **ohne** invite_token_hash zurück.
	// Über data landet dieses Ergebnis im ausgelieferten HTML.
	return { ichId: ich.id, mitglieder: mitgliederAuflisten() };
}

/*
 * Wie diese Seite abweist — die Funktion steht in ../../lib/server/abweisen.ts
 * und ist für alle vier Seiten dieselbe.
 *
 * Diese Seite ist die einzige, die beide Zusatzangaben braucht: `feld: 'name'`
 * schickt die Meldung an das Namensfeld der Aufnahme, `feld: null` lässt sie in
 * der Live-Region des Seitenkopfs stehen — dort, wo die Meldungen zu einer Zeile
 * der Mitgliederliste hingehören, die kein eigenes Feld hat. `eingabe` trägt den
 * abgewiesenen Namen zurück, damit er nach einem Fehlschlag nicht neu getippt
 * werden muss.
 */
export const actions = {
	/**
	 * Nimmt jemanden auf und gibt den Klartext-Link genau einmal zurück.
	 *
	 * Der Name geht durch namePruefen, **bevor** ein Token entsteht — die Matrix
	 * verlangt ausdrücklich, dass bei leerem Namen keines erzeugt wird.
	 *
	 * is_admin ist hier fest 0. Es gibt keine Oberfläche, die Adminrechte
	 * vergibt; das kann allein scripts/create-admin.ts für das erste Mitglied.
	 */
	aufnehmen: async ({ locals, request, url, setHeaders }: RequestEvent) => {
		adminOderWeg(locals);

		const formular = await request.formData();
		const roh = formular.get('name');
		const eingabe = typeof roh === 'string' ? roh : '';
		const geprueft = namePruefen(eingabe);
		// Der Name wird geprüft, **bevor** ein Token entsteht: ein Token für ein
		// Mitglied, das es nicht gibt, wäre Zufall ohne Besitzer.
		if ('fehler' in geprueft) {
			return abweisen(geprueft.fehler, 'name', eingabe);
		}

		const token = tokenErzeugen();
		const mitglied = mitgliedAnlegen({
			name: geprueft.name,
			inviteTokenHash: tokenHashen(token),
			isAdmin: false,
		});

		// Erst jetzt, wo wirklich Klartext in der Antwort steht.
		setHeaders(NO_STORE);
		return {
			art: 'aufgenommen' as const,
			meldung: 'Aufgenommen.',
			name: mitglied.name,
			link: linkBauen(url, token),
		};
	},

	/**
	 * Stellt den Link eines fremden, aktiven Mitglieds neu aus.
	 *
	 * Der alte Link wird damit sofort ungültig, und das ist der Zweck: für ein
	 * zweites Gerät braucht es diese Aktion nicht — das Token bleibt mehrfach
	 * einlösbar (AD-10) —, wohl aber für einen verlorenen oder in falsche Hände
	 * geratenen Link.
	 */
	neuAusstellen: async ({ locals, request, url, setHeaders }: RequestEvent) => {
		const ich = adminOderWeg(locals);

		const formular = await request.formData();
		const id = idLesen(formular.get('mitgliedId'));
		if (id === null) {
			return abweisen(MITGLIED_NICHT_ANSPRECHBAR);
		}
		// In der action geprüft, nicht nur in der Oberfläche: die eigene Zeile
		// trägt keine Knöpfe, aber ein POST braucht keinen.
		if (id === ich.id) {
			return abweisen(EIGENER_ZUGANG_GESCHUETZT);
		}

		const token = tokenErzeugen();
		const mitglied = einladungNeuAusstellen(id, tokenHashen(token));
		// Unbekannt und schon beendet fallen hier zusammen. Das eben erzeugte
		// Token ist dann nirgends gespeichert und damit nichts als Zufall.
		if (mitglied === null) {
			return abweisen(MITGLIED_NICHT_ANSPRECHBAR);
		}

		setHeaders(NO_STORE);
		return {
			art: 'neuAusgestellt' as const,
			meldung: 'Neu ausgestellt.',
			name: mitglied.name,
			link: linkBauen(url, token),
		};
	},

	/**
	 * Beendet den Zugang eines fremden, aktiven Mitglieds.
	 *
	 * Deaktivieren, nicht löschen: keine Zeile verschwindet, kein Name wird
	 * geändert, kein Hash geleert (AD-11). Der Wächter liest is_active bei
	 * jedem Aufruf frisch, der Widerruf wirkt also sofort — auch auf eine schon
	 * lebende Sitzung. Ein Aufruf von sitzungLoeschen wäre hier ohne Wirkung:
	 * der Widerruf trifft immer ein **fremdes** Cookie, das in dieser Antwort
	 * nicht vorkommt.
	 */
	widerrufen: async ({ locals, request }: RequestEvent) => {
		const ich = adminOderWeg(locals);

		const formular = await request.formData();
		const id = idLesen(formular.get('mitgliedId'));
		if (id === null) {
			return abweisen(MITGLIED_NICHT_ANSPRECHBAR);
		}
		if (id === ich.id) {
			return abweisen(EIGENER_ZUGANG_GESCHUETZT);
		}

		const mitglied = mitgliedDeaktivieren(id);
		if (mitglied === null) {
			return abweisen(MITGLIED_NICHT_ANSPRECHBAR);
		}

		return { art: 'widerrufen' as const, meldung: 'Widerrufen.', name: mitglied.name };
	},
} satisfies Actions;
