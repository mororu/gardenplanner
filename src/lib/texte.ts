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
 * eigene Zeile trägt von den drei Zeilen-Aktionen allein das Umbenennen — ein
 * Name ist kein Zugang —, aber ein POST braucht keinen Knopf.
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

/**
 * Die nicht ansprechbare Aufgabe. **Zwei** Wurfstellen — die actions `abhaken`
 * und `wiederOeffnen` in src/routes/+page.server.ts — und dort **ein** Satz für
 * vier Zustände:
 *
 *   1. aufgabeId fehlt im Formular
 *   2. aufgabeId ist nicht numerisch
 *   3. es gibt keine Aufgabe mit dieser Id
 *   4. die Aufgabe ist im falschen Erledigt-Zustand: schon abgehakt beim
 *      Abhaken, noch offen beim Wieder-Öffnen
 *
 * Ein Satz, ein Statuscode, keine Verzweigung — aus demselben Grund wie bei
 * MITGLIED_NICHT_ANSPRECHBAR. Der vierte Zustand trägt hier zusätzlich Gewicht:
 * er ist der Ausgang des Wettrennens zweier gleichzeitiger Abhaker, und die
 * Person, die zu spät kommt, soll erfahren, dass ihr Griff nichts geändert hat,
 * nicht wer schneller war (AD-5).
 *
 * Der Satz sagt, was zu tun ist, statt zu erklären, was schiefging: alle vier
 * Fälle entstehen praktisch nur, wenn die angezeigte Liste veraltet ist — und
 * genau das ist auf dieser Seite der Normalfall, weil das Abhaken die Liste
 * bewusst nicht neu lädt.
 */
export const AUFGABE_NICHT_ANSPRECHBAR =
	'Diese Aufgabe lässt sich nicht ansprechen. Lade die Liste neu.';

/**
 * Ein Wurf in einer action. **Vier** Wurfstellen: die use:enhance-Rückrufe auf
 * `/`, `/aufgabe`, `/monatsplan` und `/verwaltung`.
 *
 * Der Satz vertritt einen Fall, den bis dahin niemand vertrat. Ohne ihn reicht
 * das gereichte update() ein `result.type === 'error'` an applyAction weiter,
 * und die Fehlergrenze ersetzt die Seite: auf `/` kostet das einen Griff, auf
 * `/monatsplan` vierzig Zeilen, die jemand gerade aus einer Notiz übertragen und
 * von Hand durchgesehen hat. Der Verlust wiegt dort genau so viel schwerer, wie
 * die Seite Zeit sparen soll. Entschieden am 2026-08-28 zu Eintrag 32 der
 * zurückgestellten Arbeit: abfangen, einheitlich auf allen vier Seiten, mit
 * einem generischen Satz in der Live-Region, die dort ohnehin schon steht.
 *
 * **Generisch, und das ist Absicht.** Ein SQLITE_BUSY unter WAL oder eine volle
 * Platte hat für die lesende Person keine Bedeutung. Die genaue Ursache erreicht
 * weiterhin handleError und damit das Protokoll — abgefangen wird die
 * **Navigation**, nicht der Wurf.
 *
 * Der Satz sagt ausdrücklich **nicht**, dass nichts entstanden sei. Das wäre für
 * die meisten Wurfstellen wahr und für eine nicht: bricht `aufnehmen` auf
 * /verwaltung nach mitgliedAnlegen ab, steht die Zeile in der Datenbank und der
 * Klartext des Links ist fort — der einzige Fall, in dem die Person danach
 * wirklich etwas vorfindet. Ein Satz, der über alle vier Seiten dasselbe
 * behauptet, muss auf der schwächsten stimmen. Er schickt darum zum Nachsehen,
 * wie MITGLIED_NICHT_ANSPRECHBAR und AUFGABE_NICHT_ANSPRECHBAR es tun.
 *
 * Die Fehlergrenze behält ihre Aufgabe für alles, was keine Formularübermittlung
 * ist.
 */
export const VERSAND_FEHLGESCHLAGEN =
	'Das hat gerade nicht geklappt. Lade die Seite neu und sieh nach, bevor du es noch einmal versuchst.';

/**
 * Die nicht ansprechbare Dienstwoche. **Eine** Wurfstelle heute — die action
 * `besetzen` in src/routes/dienstplan/+page.server.ts — und dort **ein** Satz
 * für vier Zustände:
 *
 *   1. jahr oder woche fehlt im Formular
 *   2. eines von beiden ist nicht numerisch
 *   3. die Woche gibt es im Kalender nicht (Woche 53 in einem 52-Wochen-Jahr)
 *   4. die Woche liegt ausserhalb des angezeigten Fensters — auch: sie liegt in
 *      der Vergangenheit
 *
 * Der Satz steht hier und nicht als Literal in der Route, obwohl es vorerst nur
 * eine Wurfstelle gibt: er steht neben MITGLIED_NICHT_ANSPRECHBAR und
 * AUFGABE_NICHT_ANSPRECHBAR, die dieselbe Form haben, und Story 3.2 bringt mit
 * dem Ausschreiben die zweite Route, die eine Woche oder einen Termin abweist.
 *
 * Ein Satz, ein Statuscode, keine Verzweigung — aus demselben Grund wie dort:
 * jede Abweichung im Wortlaut wäre ein Aufzählungskanal. Der vierte Zustand
 * trägt hier zusätzlich Gewicht: er ist der einzige, den ein Formular der Seite
 * überhaupt erzeugen kann, und zwar dann, wenn die angezeigte Liste über einen
 * Wochenwechsel hinweg veraltet ist.
 */
export const WOCHE_NICHT_ANSPRECHBAR =
	'Diese Woche lässt sich nicht ansprechen. Lade den Plan neu.';
