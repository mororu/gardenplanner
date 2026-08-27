import { SignJWT, jwtVerify } from 'jose';
import type { Cookies } from '@sveltejs/kit';

/*
 * Das Sitzungs-Cookie.
 *
 * Es gibt genau ein Cookie, keinen serverseitigen Sitzungsspeicher und keine
 * Sitzungstabelle. Im Nutzinhalt steht nur die member_id — Name, Adminrechte
 * und is_active kommen bei jedem Aufruf frisch aus der Datenbank, weil ein
 * signiertes Cookie ein Versprechen aus der Vergangenheit ist und Widerrufen
 * sofort wirken muss.
 *
 * Wie src/lib/server/token.ts ohne Import aus $app/*, $env/* und ohne
 * Wertimport aus @sveltejs/kit: scripts/smoke-zugang.ts lädt diese Datei mit
 * nacktem Node. Cookies wird nur als Typ gebraucht und ist zur Laufzeit weg.
 */

const COOKIE = 'sitzung';

/** Ein Jahr. Der Link soll nicht nach Wochen wieder eingelöst werden müssen. */
const LAUFZEIT_SEKUNDEN = 60 * 60 * 24 * 365;

/**
 * Die Cookie-Optionen. Ein einziger Ort, weil Setzen und Löschen sich in path
 * und den Attributen decken müssen — sonst löscht der Browser ein anderes
 * Cookie als das gesetzte.
 *
 * secure ausserhalb der Entwicklung: über HTTP auf localhost muss es fehlen,
 * sonst kommt das Cookie im Entwicklungsserver nie an.
 */
const cookieOptionen = () => ({
	httpOnly: true,
	sameSite: 'lax' as const,
	path: '/',
	secure: process.env.NODE_ENV !== 'development',
});

/**
 * Prüft SESSION_SECRET. Gerufen aus dem init-Hook, nicht beim Modulladen.
 *
 * Die Länge allein genügt nicht: 'a'.repeat(32) hat 32 Zeichen und ist kein
 * Geheimnis. Darum zusätzlich mindestens acht verschiedene Zeichen.
 */
export function sitzungsgeheimnisPruefen(): void {
	const geheimnis = process.env.SESSION_SECRET;
	if (geheimnis === undefined || geheimnis === '') {
		throw new Error(
			'SESSION_SECRET ist nicht gesetzt. Ohne Geheimnis ist jedes Sitzungs-Cookie fälschbar,\n' +
				'und ein Vorgabewert wäre genau das: ein öffentlich bekanntes Geheimnis.\n' +
				'Erzeugen mit: openssl rand -base64 32'
		);
	}
	if (geheimnis.length < 32) {
		throw new Error(
			`SESSION_SECRET ist ${geheimnis.length} Zeichen lang, mindestens 32 sind nötig.\n` +
				'Erzeugen mit: openssl rand -base64 32'
		);
	}
	if (new Set(geheimnis).size < 8) {
		throw new Error(
			'SESSION_SECRET besteht aus zu wenigen verschiedenen Zeichen — mindestens acht\n' +
				'müssen es sein. 32 gleiche Zeichen sind kein Zufall.\n' +
				'Erzeugen mit: openssl rand -base64 32'
		);
	}
}

/** Das Geheimnis als Bytes für jose. Prüft bei jedem Aufruf mit. */
function geheimnisBytes(): Uint8Array {
	sitzungsgeheimnisPruefen();
	return new TextEncoder().encode(process.env.SESSION_SECRET);
}

/**
 * Stellt ein Sitzungs-Cookie aus. Auch die gleitende Erneuerung geht hier
 * durch: derselbe Aufruf, neue Laufzeit.
 */
export async function sitzungAusstellen(cookies: Cookies, mitgliedId: number): Promise<void> {
	const jwt = await new SignJWT({ member_id: mitgliedId })
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime(`${LAUFZEIT_SEKUNDEN}s`)
		.sign(geheimnisBytes());

	cookies.set(COOKIE, jwt, { ...cookieOptionen(), maxAge: LAUFZEIT_SEKUNDEN });
}

/**
 * Liest die member_id aus dem Cookie, oder null.
 *
 * Jeder Fehler ergibt null und nie einen Wurf nach aussen: fehlendes Cookie,
 * kaputte Signatur, abgelaufene Laufzeit, fremder Algorithmus, unerwarteter
 * Nutzinhalt. Der Wächter darf nicht zwischen diesen Fällen unterscheiden
 * können, und ein fehlendes SESSION_SECRET ist hier kein Grund für eine 500 —
 * dafür ist der init-Hook zuständig, der den Start abbricht.
 */
export async function sitzungLesen(cookies: Cookies): Promise<number | null> {
	const jwt = cookies.get(COOKIE);
	if (jwt === undefined || jwt === '') return null;

	try {
		const { payload } = await jwtVerify(jwt, geheimnisBytes(), { algorithms: ['HS256'] });
		const id = payload.member_id;
		if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) return null;
		return id;
	} catch {
		return null;
	}
}

/**
 * Löscht das Sitzungs-Cookie.
 *
 * Wahrheitsgemäss zur Wirkung: Auf dem Fatal-Pfad des Wächters — also bei der
 * 403 aus hooks.server.ts — wird diese Kopfzeile nicht ausgeliefert.
 * add_cookies_to_headers läuft in SvelteKit nur auf einer Antwort, die aus
 * resolve zurückkommt, und im Redirect-Zweig; auf dem Fatal-Pfad fällt jede
 * über event.cookies gesetzte Kopfzeile weg. Gemessen an SvelteKit 2.70.3.
 *
 * Darum ruft der Wächter diese Funktion nicht: dort wäre sie toter Code, und
 * das liegengebliebene Cookie ist harmlos, weil Mitglied und is_active bei
 * jedem Aufruf neu aus der Datenbank kommen. Für Story 1.3, wo ein Widerruf
 * eine ausgelieferte Antwort hat, steht sie hier bereit.
 */
export function sitzungLoeschen(cookies: Cookies): void {
	cookies.set(COOKIE, '', { ...cookieOptionen(), maxAge: 0 });
}
