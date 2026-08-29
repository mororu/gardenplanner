import type { Actions, RequestEvent, ServerLoadEvent } from '@sveltejs/kit';
import { abweisen } from '../../lib/server/abweisen.ts';
import { adminOderWeg } from '../../lib/server/adminschranke.ts';
import {
	aktivesMitgliedLesen,
	einladungNeuAusstellen,
	mitgliedAnlegen,
	mitgliedDeaktivieren,
	mitgliederAuflisten,
	mitgliedUmbenennen,
} from '../../lib/server/db/queries/members.ts';
import type { AngemeldetesMitglied } from '../../lib/server/db/schema.ts';
import { NAME_HOECHSTLAENGE, namePruefen } from '../../lib/mitgliedsname.ts';
import { tokenErzeugen, tokenHashen } from '../../lib/server/token.ts';
import { EIGENER_ZUGANG_GESCHUETZT, MITGLIED_NICHT_ANSPRECHBAR } from '../../lib/texte.ts';

/*
 * /verwaltung — aufnehmen, umbenennen, Link neu ausstellen, Einladung
 * widerrufen.
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
 * **Jede** der fünf Einstiegsstellen beginnt mit adminOderWeg. Eine action
 * ohne Schranke wäre der Fehler, den die Oberfläche nicht sichtbar macht: für
 * Nicht-Admins fehlt der Knopf, ein POST braucht aber keinen.
 */

/*
 * Die Namensregel steht in ../../lib/mitgliedsname.ts und **nicht** hier.
 *
 * Bis Story 3.0.1 standen NAME_FEHLT, NAME_HOECHSTLAENGE, NAME_ZU_LANG,
 * NULLBREITE und namePruefen an dieser Stelle, mit der Begründung „eine
 * Wurfstelle". Seither sind es drei Leser derselben Regel: die zwei actions
 * dieser Datei und scripts/create-admin.ts — und das Skript **war** die
 * auseinandergelaufene Kopie, die einen Namen aus reinen Nullbreiten-Zeichen
 * durchliess. Ausgelagert, nicht neu gefasst: beide Sätze und die 80 sind
 * wortgleich mitgewandert.
 */

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
	namensgrenze: number;
} {
	const ich = adminOderWeg(locals);
	// mitgliederAuflisten gibt die Zeilen **ohne** invite_token_hash zurück.
	// Über data landet dieses Ergebnis im ausgelieferten HTML.
	//
	// namensgrenze reist mit, damit das `maxlength` beider Namensfelder aus
	// NAME_HOECHSTLAENGE kommt und nicht als zweite 80 im Markup steht. Der
	// Import läuft über diese Datei und nicht über $lib in der Komponente: die
	// Regel liegt auf der Serverseite, und eine zweite Einstiegstür zu ihr wäre
	// eine zweite Stelle, an der sie sich lösen könnte.
	return { ichId: ich.id, mitglieder: mitgliederAuflisten(), namensgrenze: NAME_HOECHSTLAENGE };
}

/*
 * Wie diese Seite abweist — die Funktion steht in ../../lib/server/abweisen.ts
 * und ist für alle vier Seiten dieselbe.
 *
 * Diese Seite ist die einzige, die beide Zusatzangaben braucht: `feld: 'name'`
 * schickt die Meldung an das Namensfeld der Aufnahme, `feld: 'neuerName'` an das
 * Feld der umbenannten Zeile, und `feld: null` lässt sie in der Live-Region des
 * Seitenkopfs stehen — dort, wo die Meldungen zu einer Zeile der
 * Mitgliederliste hingehören, die kein eigenes Feld hat. `eingabe` trägt den
 * abgewiesenen Namen zurück, damit er nach einem Fehlschlag nicht neu getippt
 * werden muss.
 *
 * **Zwei Marken und nicht eine**, obwohl beide Felder einen Namen tragen: `name`
 * gehört dem Aufnahmeformular, und zwei Felder unter einer Marke wären die
 * Zweideutigkeit, gegen die die Marke da ist — ein abgewiesenes Umbenennen
 * setzte sonst die Kante ans Aufnahmefeld und trüge den verworfenen Namen dort
 * hinein.
 *
 * **Welche Zeile** es war, sagt der Server mit: das vierte Argument von
 * `abweisen`. Eine frühere Fassung liess den use:enhance-Rückruf die
 * abgeschickte `mitgliedId` aus dem `formData` lesen — ohne JavaScript läuft
 * kein Rückruf, und die Seite verlor damit genau das, was der eingefrorene Block
 * unbedingt verlangt: den Satz am Feld **dieser** Zeile, auch ohne JavaScript.
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

	/**
	 * Gibt einem **aktiven** Mitglied einen anderen Namen.
	 *
	 * Kein Zugangsvorgang: Id, invite_token_hash, is_admin, is_active und
	 * created_at bleiben unberührt, es ist ein UPDATE derselben Zeile. Bis Story
	 * 3.0.1 war ein vertippter Name nur zu beheben, indem man den Zugang beendete
	 * und die Person neu aufnahm — was ihr zugleich alle künftigen Dienstwochen
	 * genommen hätte, sobald der Name ab Story 3.1 im Dienstplan vor allen steht.
	 *
	 * **Die eigene Zeile darf umbenannt werden**, anders als bei neuAusstellen
	 * und widerrufen: ein Name ist kein Zugang. Ein Selbst-Umbenennen sperrt
	 * niemanden aus, und es gibt genau eine Adminperson, die es sonst für sie
	 * täte. EIGENER_ZUGANG_GESCHUETZT kommt hier darum nicht vor.
	 *
	 * Die Zeile wird **vor** dem Namen geprüft, und zwar vollständig: erst die
	 * Form der Id, dann ob sie eine aktive Zeile trifft. Ohne ansprechbare Zeile
	 * gibt es kein Feld, an dem ein Satz über den Namen stehen könnte — die
	 * Antwort trüge `feld: 'neuerName'` und eine Zeilennummer, die es nicht gibt,
	 * und die Oberfläche fände keine Stelle dafür. Die abgewiesene Eingabe
	 * verschwände spurlos.
	 */
	umbenennen: async ({ locals, request }: RequestEvent) => {
		adminOderWeg(locals);

		const formular = await request.formData();
		const id = idLesen(formular.get('mitgliedId'));
		// Fehlend, nicht numerisch, unbekannt und beendet fallen auf denselben
		// Satz — ohne Feld und ohne Zeile, damit er in der Live-Region oben steht.
		if (id === null || aktivesMitgliedLesen(id) === null) {
			return abweisen(MITGLIED_NICHT_ANSPRECHBAR);
		}

		const roh = formular.get('neuerName');
		const eingabe = typeof roh === 'string' ? roh : '';
		const geprueft = namePruefen(eingabe);
		if ('fehler' in geprueft) {
			// Die Zeile geht mit zurück. Ohne sie stünde der Satz zwar am richtigen
			// **Feldtyp**, aber an keiner bestimmten Zeile — und ohne JavaScript
			// könnte die Seite ihn nirgends anbringen.
			return abweisen(geprueft.fehler, 'neuerName', eingabe, id);
		}

		// is_active = 1 steht in der Query, nicht hier. Die zweite Prüfung auf null
		// ist keine Verdopplung der ersten, sondern schliesst das Fenster
		// dazwischen: zwischen Auskunft und UPDATE kann ein Widerruf laufen.
		const mitglied = mitgliedUmbenennen(id, geprueft.name);
		if (mitglied === null) {
			return abweisen(MITGLIED_NICHT_ANSPRECHBAR);
		}

		// Ein Name, der dem alten gleicht, ist ein Erfolg und keine Abweisung: die
		// Person hat bekommen, was sie wollte, und eine Meldung darüber wäre eine
		// Aufforderung, etwas zu ändern, das schon stimmt.
		return { art: 'umbenannt' as const, meldung: 'Umbenannt.', name: mitglied.name };
	},
} satisfies Actions;
