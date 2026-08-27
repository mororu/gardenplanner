/*
 * Die Sätze, die an mehr als einer Stelle stehen müssen.
 *
 * KEIN_ZUGANG hat **zwei** Wurfstellen: den Wächter in src/hooks.server.ts und
 * die Einlöseroute in src/routes/i/[token]/+server.ts. Die Matrix zählt vier
 * Zustände, der Code deckt fünf — dieselben zwei Zeilen fangen alle ab:
 *
 *   1. kein Cookie                          Wächter
 *   2. Cookie manipuliert oder abgelaufen   Wächter
 *   3. Cookie gültig, Mitgliedszeile weg    Wächter  (in der Matrix nicht
 *      aufgeführt, weil kein Weg der Anwendung eine Zeile löscht — Zugang
 *      beenden heisst deaktivieren. Ein Eingriff von Hand an der Datenbank
 *      erzeugt ihn trotzdem, und er ist dann ununterscheidbar wie die anderen.)
 *   4. Token unbekannt                      Einlöseroute
 *   5. Mitglied is_active = 0               beide
 *
 * Ein Satz, ein Statuscode, keine Verzweigung: jede Abweichung im Wortlaut wäre
 * ein Kanal, an dem sich ablesen liesse, welcher Fall vorliegt.
 *
 * Derselbe Satz steht **nicht** wörtlich in src/error.html — dort steht der
 * Platzhalter %sveltekit.error.message%, den SvelteKit mit dem Rumpf des Wurfs
 * füllt. scripts/smoke-zugang.ts rendert die Vorlage über SvelteKits eigene
 * erzeugte Fassung und behauptet den Satz im gerenderten <h1>.
 */
export const KEIN_ZUGANG = 'Dieser Link gilt nicht mehr. Melde dich in der Gartengruppe.';

/**
 * Für einen Pfad, den es nicht gibt. Ein 404 ist kein Fehlschlag der Anwendung,
 * darum darf er nicht wie einer klingen.
 */
export const NICHT_GEFUNDEN = 'Diese Seite gibt es nicht.';

/**
 * Für alles wirklich Unerwartete — der Satz, den handleError statt
 * "Internal Error" zurückgibt, und der Rückfall in +error.svelte, wenn eine
 * Meldung leer ist.
 */
export const UNERWARTETER_FEHLER = 'Etwas ist schiefgelaufen. Versuche es später noch einmal.';
