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
 * Ein Wurf in einer action. **Acht** Wurfstellen, und gezählt werden
 * **Rückrufe**, nicht Seiten: je einer auf `/aufgabe`, `/monatsplan`,
 * `/verwaltung`, `/dienstplan` und `/einzelaufgabe`, und **drei** auf `/` — das
 * Abhaken im Pool, das Bestätigen der Übernahme und der Ausfallweg des Knopfs
 * in der Zeile. Die Zahl stand bis Story 3.2
 * auf vier und stimmte seit Story 3.1 nicht mehr; sie zählte ausserdem Seiten,
 * und genau diese Zählweise verdeckte, dass eine Seite mehr als einen Rückruf
 * tragen kann. scripts/smoke-zugang.ts schneidet seit dieser Story die einzelnen
 * Rückrufrümpfe und ist die Quelle, dieser Satz die Beschreibung.
 *
 * /einzelaufgaben trägt keinen — die Seite hat kein Formular.
 *
 * Der dritte `use:enhance` auf `/` (der Knopf in der Zeile) ist der achte, und
 * er ist seit dem Review vom 2026-08-30 mitgezählt. Sein Regelweg bricht den
 * Versand ab und gibt keine Fortsetzung zurück — dort gibt es kein `result`,
 * das ein Wurf erreichen könnte. Sein **Ausfallweg** aber, wenn `dialog` nicht
 * gebunden ist, lässt den gewöhnlichen POST laufen, und dann gibt es eines. Bis
 * zu diesem Review gab er dort gar nichts zurück, use:enhance fuhr sein
 * Vorgabeverhalten, und der Wurf lief über applyAction an dieser Regel vorbei
 * in die Fehlergrenze. Ein Ausfallweg ist keine Ausnahme von der Regel: er ist
 * der Weg, auf dem am ehesten etwas schiefgeht.
 *
 * Der Satz vertritt einen Fall, den bis dahin niemand vertrat. Ohne ihn reicht
 * das gereichte update() ein `result.type === 'error'` an applyAction weiter,
 * und die Fehlergrenze ersetzt die Seite: auf `/` kostet das einen Griff, auf
 * `/monatsplan` vierzig Zeilen, die jemand gerade aus einer Notiz übertragen und
 * von Hand durchgesehen hat. Der Verlust wiegt dort genau so viel schwerer, wie
 * die Seite Zeit sparen soll. Entschieden am 2026-08-28 zu Eintrag 32 der
 * zurückgestellten Arbeit: abfangen, einheitlich auf allen Seiten mit einem
 * Formular, mit einem generischen Satz in der Live-Region, die dort ohnehin
 * schon steht.
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
 * Die nicht ansprechbare Dienstwoche. **Zwei** Wurfstellen, beide in der action
 * `besetzen` in src/routes/dienstplan/+page.server.ts — die Formprüfung und die
 * Fensterschranke —, und beide werfen **denselben** Satz für vier Zustände:
 *
 *   1. jahr oder woche fehlt im Formular
 *   2. eines von beiden ist nicht numerisch
 *   3. die Woche gibt es im Kalender nicht (Woche 53 in einem 52-Wochen-Jahr)
 *   4. die Woche liegt ausserhalb des angezeigten Fensters — auch: sie liegt in
 *      der Vergangenheit
 *
 * Der Satz steht hier und nicht als Literal in der Route: zwei Literale in
 * derselben action wären zwei Sätze, sobald jemand einen davon anfasst. Er steht
 * neben MITGLIED_NICHT_ANSPRECHBAR, AUFGABE_NICHT_ANSPRECHBAR und seit Story 3.2
 * EINZELAUFGABE_NICHT_ANSPRECHBAR, die alle dieselbe Form haben: **eine**
 * Sache, die sich nicht ansprechen lässt, und der Rat, neu zu laden.
 *
 * Ein Satz, ein Statuscode, keine Verzweigung — aus demselben Grund wie dort:
 * jede Abweichung im Wortlaut wäre ein Aufzählungskanal. Der vierte Zustand
 * trägt hier zusätzlich Gewicht: er ist der einzige, den ein Formular der Seite
 * überhaupt erzeugen kann, und zwar dann, wenn die angezeigte Liste über einen
 * Wochenwechsel hinweg veraltet ist.
 */
export const WOCHE_NICHT_ANSPRECHBAR =
	'Diese Woche lässt sich nicht ansprechen. Lade den Plan neu.';

/**
 * Ohne Datum entsteht kein Stapel. **Zwei** Wurfstellen: die action `ablegen` in
 * src/routes/monatsplan/+page.server.ts und der Hinweis unter dem Datumsfeld in
 * der Komponente daneben.
 *
 * Ein Satz für vier Zustände — Feld fehlt, Feld leer, keine Form `JJJJ-MM-TT`,
 * unmögliches Datum wie `2026-02-31` —, aus demselben Grund wie bei
 * MITGLIED_NICHT_ANSPRECHBAR: jede Unterscheidung wäre eine Auskunft ohne
 * Handlung.
 *
 * Er steht hier und nicht als Literal an beiden Stellen, seit das Fenster an
 * `Fällig bis` daneben einen **zweiten** solchen Satz gebracht hat. Zwei Paare
 * wortgleicher Literale sind das Muster, aus dem Drift entsteht: wer den einen
 * anfasst, sieht den anderen nicht.
 */
export const DATUM_FEHLT = 'Wähle ein Datum, bis zu dem die Aufgaben erledigt sein sollen.';

/**
 * Eine Frist ausserhalb des Fensters von einem Jahr in jede Richtung.
 * **Drei** Wurfstellen: die zwei von DATUM_FEHLT und, seit Story 3.2, die action
 * `ausschreiben` in src/routes/einzelaufgabe/+page.server.ts.
 *
 * Die dritte trägt ein **Datum mit anderem Namen** — dort heisst das Feld
 * `Termin` und nicht `Fällig bis`. Der Satz gilt trotzdem wörtlich, und darum
 * bekommt er keine zweite Fassung: die Regel dahinter ist dieselbe Zahl und
 * dieselbe Rechnung (FRIST_FENSTER_TAGE, istImFristfenster), und zwei Sätze über
 * eine Regel sind der Anfang zweier Regeln. Was die zwei Seiten wirklich
 * unterscheidet, ist der Satz für das **fehlende** Datum: `Wähle ein Datum, bis
 * zu dem die Aufgaben erledigt sein sollen` passt auf einen Stapel und nicht auf
 * einen Termin, und der bleibt darum je Seite eigen.
 *
 * Der Satz nennt die **Jahreszahl**, weil sie der Fehler ist: ein Datumsfeld
 * lässt Tag und Monat kaum verrutschen, das Jahr schon — `2016` statt `2026`
 * ist ein Anschlag daneben. Die Grenze selbst steht nicht im Satz: „ein Jahr"
 * ist die Auskunft, die zur Handlung führt, und die zwei Grenzdaten wären eine
 * Zahl mehr, die niemand nachrechnet.
 *
 * Die Zahl dahinter ist FRIST_FENSTER_TAGE in src/lib/zeit.ts, und sie steht
 * dort genau einmal. Dieser Satz nennt sie nur in Worten — „ein Jahr" bleibt
 * wahr, solange die Konstante bei 365 steht, und wer sie verschiebt, schreibt
 * ihn mit.
 */
export const FRIST_AUSSERHALB =
	'Diese Frist liegt mehr als ein Jahr von heute entfernt. Prüfe die Jahreszahl.';

/**
 * Die Folge einer Zusage. **Zwei Stellen**, beide in src/routes/+page.svelte:
 * der Dialog und der Frageblock ohne JavaScript.
 *
 * Er steht hier und nicht als Literal im Markup, weil er auf **beiden** Wegen
 * derselbe sein muss. Bis zum Review vom 2026-08-30 trug ihn allein der Dialog;
 * wer ohne JavaScript zusagte, las nur, **was** er übernimmt, und nicht, **warum**
 * gerade diese Handlung gefragt wird. Die Bestätigung ist eine Eigenschaft des
 * Servers und der Dialog die Aufwertung — dann darf die Aufwertung nicht die
 * Begründung tragen.
 *
 * Der Satz nennt die Folge und nicht die Handlung: dass der Name danach für alle
 * sichtbar danebensteht, ist genau das, was die Zusage verbindlich macht und was
 * eine Poolaufgabe nicht kennt.
 */
export const UEBERNAHME_FOLGE = 'Dein Name steht danach für alle daneben.';

/**
 * Die nicht ansprechbare Einzelaufgabe. **Vier** Wurfstellen, alle in der action
 * `uebernehmen` in src/routes/+page.server.ts — zwei vor der Verzweigung, je
 * eine im Bestätigungs- und im Übernahmeschritt —, und alle werfen **denselben**
 * Satz für sechs Zustände:
 *
 *   1. locals.mitglied ist null (unerreichbar; der Wächter hat vorher mit 403
 *      abgewiesen, aber der Typ lässt es zu, und ein `!` machte die Seite von
 *      einer Annahme über eine andere Datei abhängig)
 *   2. einzelaufgabeId fehlt im Formular
 *   3. einzelaufgabeId ist nicht numerisch
 *   4. es gibt keine Einzelaufgabe mit dieser Id
 *   5. sie ist schon übernommen
 *   6. jemand anders war im selben Augenblick schneller
 *
 * Ein Satz, ein Statuscode, keine Verzweigung — aus demselben Grund wie bei
 * AUFGABE_NICHT_ANSPRECHBAR, dem er nachgebildet ist. Der sechste Zustand trägt
 * hier dasselbe Gewicht wie dort der vierte: er ist der Ausgang des Wettrennens
 * zweier Personen, die im selben Moment zusagen wollen, und die zu spät kommt,
 * soll erfahren, dass ihr Griff nichts geändert hat — nicht, wer schneller war.
 *
 * Der Satz sagt, was zu tun ist, statt zu erklären, was schiefging: alle sechs
 * Fälle entstehen praktisch nur, wenn die angezeigte Liste veraltet ist.
 *
 * **Eine fünfte Lesestelle, und ausdrücklich keine sechste Wurfstelle:**
 * src/routes/+page.svelte setzt denselben Satz in `fehlerOben`, wenn die
 * zurückgegebene Frage zwischen der Antwort der action und dem Rendern ihre
 * Zeile verliert. Dort wird nichts abgewiesen — die HTTP-Antwort ist die
 * erfolgreiche `fragen`-Antwort —, sondern angezeigt. Es ist derselbe Zustand
 * wie Fall 6 aus der Sicht der lesenden Person, und darum derselbe Satz.
 */
export const EINZELAUFGABE_NICHT_ANSPRECHBAR =
	'Diese Einzelaufgabe lässt sich nicht ansprechen. Lade die Liste neu.';
