import { fail, redirect } from '@sveltejs/kit';
import type { Actions, RequestEvent } from '@sveltejs/kit';
import { AUFGABE_HOECHSTLAENGE, PLAN_HOECHSTZAHL, zeilenErkennen } from '../../lib/aufgabentext.ts';
import { aufgabenStapelAnlegen } from '../../lib/server/db/queries/tasks.ts';
import { monatsendeAlsFeldwert, tagesendeInUnixSekunden } from '../../lib/zeit.ts';

/*
 * /monatsplan — den ganzen Monatsplan in einem Zug ablegen.
 *
 * Die Importe stehen relativ und mit .ts-Endung, und die Typen kommen aus
 * @sveltejs/kit statt aus ./$types. Der Grund ist derselbe wie in
 * ../aufgabe/+page.server.ts und geprüft, nicht vermutet:
 * scripts/smoke-zugang.ts lädt dieses Modul mit nacktem Node, und
 * tsconfig.scripts.json kennt weder das virtuelle ./$types noch die
 * $lib-Zuordnung.
 *
 * **Genau eine action.** Der Prüfschritt der Oberfläche ist keine Mutation an
 * Domänendaten (AD-9 bindet nur solche an eine form action): Schritt 1 → 2 → 1
 * zerlegt einen Text, den die Person gerade selbst getippt hat, und läuft in
 * Runes-$state ohne Server-Rundgang. Ein Rundgang dafür kostete eine
 * Roundtrip-Latenz pro entfernter Zeile, brauchte eine zweite action oder eine
 * zweite Route, und der Server müsste den Zwischenstand irgendwo halten.
 *
 * Der Server bleibt trotzdem die Instanz: er zerlegt die übergebenen Zeilen mit
 * **derselben** Funktion (zeilenErkennen aus ../../lib/aufgabentext.ts) noch
 * einmal und prüft sie gegen **dieselben** Grenzen, bevor etwas entsteht.
 * AUFGABE_HOECHSTLAENGE und PLAN_HOECHSTZAHL stehen darum in jenem Modul und
 * nicht hier: eine Grenze, die nur diese Datei kennt, sperrt den Knopf erst nach
 * dem Versand.
 *
 * **Keine eigene Zugangsschranke.** Der Wächter in src/hooks.server.ts schützt
 * jeden Pfad ausser /i/… und hat einen Aufruf ohne gültige Sitzung schon mit 403
 * abgewiesen. Es gibt hier auch keine zweite Stufe: die planende Person wechselt
 * monatlich und ist nicht die Adminperson. `locals` wird gar nicht gelesen — es
 * gibt keine Spalte, die einen Erfassenden hielte, und es soll keine geben
 * (AD-2, AD-5). Ein Monatsplan ist namenlos wie der Rest des Pools.
 *
 * Kein +server.ts, kein JSON-Endpunkt, und im Markup ein **literales**
 * action="?/ablegen" — ein dynamisches action={…} würde Gate-Regel 11 blind
 * machen.
 */

/** Ohne ein Datum entsteht kein Stapel. Eine Wurfstelle. */
const DATUM_FEHLT = 'Wähle ein Datum, bis zu dem die Aufgaben erledigt sein sollen.';

/** Ohne Zeilen entsteht kein Plan. Eine Wurfstelle. */
const ZEILEN_FEHLEN = 'Ohne Zeilen entsteht kein Plan. Schreib eine Aufgabe pro Zeile.';

/** Zu viele Zeilen. Eine Wurfstelle. */
const ZU_VIELE_ZEILEN =
	`Das sind zu viele Zeilen für einen Monatsplan. Höchstens ${PLAN_HOECHSTZAHL} Aufgaben ` +
	'auf einmal.';

/**
 * Zu lange Zeilen — der einzige Satz, der eine Zahl aus der Eingabe trägt.
 *
 * **Der ganze Stapel wird abgewiesen**, nicht die eine Zeile. Die Alternativen
 * sind schlechter: eine Zeile still zu kürzen erzeugt eine Aufgabe, die niemand
 * so geschrieben hat, und eine Zeile still zu überspringen bricht die Zusage,
 * die der Knopf trägt — `24 Aufgaben ablegen` muss 24 Aufgaben ablegen. Der
 * Satz nennt darum die Zahl der zu langen Zeilen, und die Person geht mit
 * `Zurück zum Text` an die eine Stelle, an der sich das beheben lässt.
 */
function zuLangSatz(anzahl: number): string {
	const zeilen = anzahl === 1 ? 'Eine Zeile ist' : `${anzahl} Zeilen sind`;
	return `${zeilen} zu lang für eine Aufgabe. Höchstens ${AUFGABE_HOECHSTLAENGE} Zeichen je Zeile.`;
}

/**
 * Ein Fehlschlag mit 400.
 *
 * `feld` benennt, wohin die Meldung gehört, und die Komponente **liest es**:
 * diese Seite hat zwei Felder, und eine Meldung über das Datum gehört an das
 * Datumsfeld, nicht unter die Liste. Anders als auf /aufgabe, wo es genau ein
 * Feld gibt und die Zuordnung darum ein toter Zweig wäre.
 *
 * Die Eingabe reist **nicht** zurück: der Text steht im $state der Komponente
 * und ist nach einem abgewiesenen Versand unverändert da — anders als auf
 * /aufgabe, wo der serverseitig gerenderte Feldwert die einzige Quelle ist.
 *
 * Ein abgewiesener Versand legt **nichts** an: aufgabenStapelAnlegen wird auf
 * diesem Weg nie erreicht.
 */
function abweisen(meldung: string, feld: 'datum' | 'zeilen') {
	return fail(400, { art: 'fehler' as const, meldung, feld });
}

/**
 * Die Seitendaten: **nur** die Vorbelegung des Datumsfeldes.
 *
 * `Fällig bis` ist Pflicht und mit dem Ende des laufenden Monats vorbelegt. Eine
 * Planaufgabe ohne Frist wäre von einer vor Ort erfassten nicht mehr zu
 * unterscheiden, und die Monatsplan-Ausnahme aus Story 2.2 fiele still aus.
 *
 * Die Vorgabe entsteht auf dem **Server** und nicht im Browser: sonst rechnete
 * sie beim serverseitigen Rendern in UTC und beim Hydrieren in der Ortszeit des
 * Geräts, und am Monatsersten um 00:30 stünden zwei verschiedene Werte im Feld.
 * Die Zone kommt aus ../../lib/zeit.ts und steht genau dort.
 *
 * Sie nimmt **kein Ereignis** entgegen, und das ist die Aussage: sie liest
 * weder locals noch cookies noch die Adresse. Alle sehen dieselbe Vorgabe.
 */
export function load(): { faelligBisVorgabe: string } {
	return { faelligBisVorgabe: monatsendeAlsFeldwert(Math.floor(Date.now() / 1000)) };
}

export const actions = {
	/**
	 * Legt den ganzen Stapel ab und leitet auf die Liste zurück.
	 *
	 * **Die Reihenfolge der Prüfungen ist festgelegt** und nicht beliebig: erst
	 * das Datum, dann ob überhaupt Zeilen da sind, dann die Höchstzahl, dann die
	 * Zeilenlänge. Sie geht vom Billigen zum Teuren und, wichtiger, vom
	 * Grundsätzlichen zum Einzelnen: wer das Datum vergessen hat, soll das lesen
	 * und nicht zuerst erfahren, dass drei Zeilen zu lang sind.
	 *
	 * **Ein Aufruf, ein INSERT.** aufgabenStapelAnlegen setzt alle Zeilen mit
	 * demselben due_at in einem mehrzeiligen INSERT — das ist in SQLite atomar,
	 * es braucht keine Transaktion.
	 *
	 * Die Meldung reist als **Query-Parameter mit Zahl**: `/?abgelegt=22`. Ein
	 * redirect() verwirft den Rückgabewert der action, und die Bestätigung
	 * braucht einen Träger. Die load von / macht daraus eine Zahl, die Oberfläche
	 * den Satz `22 Aufgaben abgelegt.` — dasselbe Verb wie auf dem Knopf, im
	 * Perfekt. Das bare `?abgelegt` von /aufgabe bleibt gültig und bedeutet
	 * weiterhin `Abgelegt.`
	 *
	 * 303 und nicht 302: nach einem POST ist die Folgeanfrage ausdrücklich ein
	 * GET.
	 */
	ablegen: async ({ request }: RequestEvent) => {
		const formular = await request.formData();

		// Ein fehlendes Feld und ein Nicht-String (ein Datei-Upload) fallen auf
		// dieselbe leere Eingabe zusammen — und damit auf denselben Satz.
		const rohDatum = formular.get('faelligBis');
		const faelligAm = tagesendeInUnixSekunden(typeof rohDatum === 'string' ? rohDatum : '');
		// Fehlend, leer, keine Form JJJJ-MM-TT und ein unmögliches Datum wie
		// 2026-02-31 fallen auf dasselbe null zusammen und auf denselben Satz:
		// jede Unterscheidung wäre eine Auskunft ohne Handlung.
		if (faelligAm === null) {
			return abweisen(DATUM_FEHLT, 'datum');
		}

		const rohZeilen = formular.get('zeilen');
		// **Dieselbe** Zerlegung wie der Zähler im Browser. Zwei Fassungen
		// derselben Regel liefen auseinander, und der Knopf `24 Aufgaben ablegen`
		// legte 23 an.
		const zeilen = zeilenErkennen(typeof rohZeilen === 'string' ? rohZeilen : '');
		if (zeilen.length === 0) {
			return abweisen(ZEILEN_FEHLEN, 'zeilen');
		}
		if (zeilen.length > PLAN_HOECHSTZAHL) {
			return abweisen(ZU_VIELE_ZEILEN, 'zeilen');
		}

		// Nach Codepoints gezählt, nicht nach UTF-16-Einheiten: ein Emoji in einer
		// Zeile ist kein zweites Zeichen. [...zeile] zerlegt in Codepoints.
		const zuLang = zeilen.filter((zeile) => [...zeile].length > AUFGABE_HOECHSTLAENGE).length;
		if (zuLang > 0) {
			return abweisen(zuLangSatz(zuLang), 'zeilen');
		}

		aufgabenStapelAnlegen(zeilen, faelligAm);

		// Nach dem redirect läuft hier nichts mehr: redirect() wirft.
		redirect(303, `/?abgelegt=${zeilen.length}`);
	},
} satisfies Actions;
