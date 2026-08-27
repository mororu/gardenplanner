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

/**
 * Der eigene Zugang ist unantastbar. **Zwei** Wurfstellen: die actions
 * `widerrufen` und `neuAusstellen` in src/routes/verwaltung/+page.server.ts.
 *
 * Der Satz ist bewusst neutral und nennt **kein** Verb. Eine frühere Fassung
 * sagte „kannst du hier nicht beenden" und passte damit nur auf eine der zwei
 * Wurfstellen: wer den eigenen Link **neu ausstellen** wollte, las eine
 * Ablehnung für eine Handlung, die er gar nicht versucht hat.
 *
 * Beide Fälle wiegen gleich schwer, auch wenn nur einer sofort wirkt. Ein
 * Selbstwiderruf nimmt den Zugang auf der Stelle. Ein Selbst-Neuausstellen
 * lässt die laufende Sitzung bestehen — das Cookie hängt an der member_id, nicht
 * am Token —, macht aber den einzigen Link ungültig, mit dem diese Person je
 * wieder auf ein neues Gerät käme. Es gibt genau eine Adminperson (Adminrechte
 * vergibt allein scripts/create-admin.ts, und nur für das erste Mitglied), also
 * gibt es niemanden, der ihr einen neuen ausstellen könnte.
 *
 * Beide Fälle werden in der action geprüft und nicht nur in der Oberfläche: die
 * eigene Zeile trägt keine Knöpfe, aber ein POST braucht keinen.
 */
export const EIGENER_ZUGANG_GESCHUETZT =
	'Deinen eigenen Zugang kannst du hier nicht ändern — sonst bliebe die Verwaltung womöglich ohne Zugang.';

/**
 * Das nicht ansprechbare Mitglied. Ebenfalls **zwei** Wurfstellen, dieselben
 * zwei actions — und dort **ein** Satz für vier Zustände:
 *
 *   1. mitgliedId fehlt im Formular
 *   2. mitgliedId ist nicht numerisch
 *   3. es gibt kein Mitglied mit dieser Id
 *   4. das Mitglied ist bereits beendet
 *
 * Ein Satz, ein Statuscode, keine Verzweigung — aus demselben Grund wie bei
 * KEIN_ZUGANG: jede Abweichung im Wortlaut wäre ein Aufzählungskanal, an dem
 * sich ablesen liesse, welche Zeilen es gibt und in welchem Zustand sie sind.
 *
 * Der Satz sagt, was zu tun ist, statt zu erklären, was schiefging: alle vier
 * Fälle entstehen praktisch nur, wenn die angezeigte Liste veraltet ist.
 */
export const MITGLIED_NICHT_ANSPRECHBAR =
	'Dieses Mitglied lässt sich nicht ansprechen. Lade die Liste neu.';
