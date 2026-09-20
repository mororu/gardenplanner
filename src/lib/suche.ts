import { unsichtbarEntfernen } from './unsichtbar.ts';

/*
 * Die Regeln der Suche auf /wissen — seit dem 2026-09-20.
 *
 * **Warum diese Suche auf dem Server läuft und die auf /archiv nicht.** Das ist
 * der eine Unterschied, der alles Übrige erklärt, und er liegt nicht in der
 * Vorliebe, sondern in den Daten:
 *
 *   /archiv  hält kurze Zeilen, und sie sind **ohnehin alle geladen** — die
 *            Seite zeigt sie ja. Eine Suche im Browser kostet dort nichts
 *            Zusätzliches und antwortet im selben Tastenanschlag.
 *   /wissen  hält Freitext, und der ist **ausdrücklich nicht geladen**: ein
 *            Blatt trägt bis zu achttausend Zeichen, und die Liste holt nur
 *            Kennung und Titel (siehe Blattzeile in
 *            ./server/db/queries/sheets.ts). Eine Suche im Browser müsste
 *            zwanzig Blätter samt Text in jede Listenansicht legen — hundert
 *            Kilobyte HTML für eine Suche, die vielleicht niemand benutzt.
 *
 * Gesucht wird darum über die Adresse (`/wissen?suche=…`), und das bringt zwei
 * Dinge mit, die die Browsersuche nicht hat: **sie funktioniert ohne
 * JavaScript**, weil ein GET-Formular sie trägt, und **sie ist teilbar** — wer
 * einen Fund weitergibt, gibt die Adresse weiter.
 *
 * **Kein Server-Import hier drin.** Dieses Modul deutet Zeichenketten und sonst
 * nichts; es kennt weder die Datenbank noch `node:*`. So lässt es sich in
 * scripts/smoke-zugang.ts prüfen wie jede andere reine Funktion, und die
 * Komponente darf es mitladen.
 */

/**
 * Wie lang ein Suchbegriff höchstens sein darf.
 *
 * **Keine Fehlermeldung, sondern ein Schnitt** — anders als bei jedem anderen
 * Feld dieser Anwendung. Ein zu langer Titel ist ein Missverständnis, das man
 * der Person sagt; ein zu langer Suchbegriff findet einfach nichts, und ein
 * Satz darüber wäre eine Belehrung ohne Nutzen. Die Grenze steht trotzdem, weil
 * ein `LIKE '%…%'` über zehntausend Zeichen Rechenzeit kostet, die niemand
 * bestellt hat.
 */
export const SUCHE_HOECHSTLAENGE = 100;

/**
 * Wie viel Text eine Fundstelle zeigt.
 *
 * Genug für den Satz um den Treffer und wenig genug, dass zwanzig davon eine
 * Liste bleiben und keine Textwand. Bei 375px sind das rund drei Zeilen.
 */
export const FUNDSTELLE_LAENGE = 120;

/**
 * Der Suchbegriff, wie er in die Abfrage geht.
 *
 * Gefaltet wie jeder andere Text dieser Anwendung — unsichtbare Zeichen weg,
 * Leerraum zusammengezogen, aussen getrimmt —, danach auf die Grenze
 * geschnitten. Das Ergebnis ist leer, wenn niemand etwas gesucht hat; die
 * Route deutet das als „keine Suche" und zeigt alles.
 *
 * **Geschnitten wird nach Codepoints**, wie jede Längenrechnung dieser
 * Anwendung: ein Emoji ist ein Zeichen und nicht zwei. `slice` auf der
 * Zeichenkette zerschnitte ein Ersatzpaar und liesse ein halbes Zeichen stehen.
 */
export function suchbegriffFalten(eingabe: string): string {
	const gefaltet = unsichtbarEntfernen(eingabe).replace(/\s+/g, ' ').trim();
	return [...gefaltet].slice(0, SUCHE_HOECHSTLAENGE).join('');
}

/**
 * Das Zeichen, das in `LIKE` einer Sonderbedeutung entkommt.
 *
 * Ein Backslash, und das ist in SQLite eine **Wahl** und keine Vorgabe: die
 * Sprache kennt kein voreingestelltes Fluchtzeichen, es muss in der Abfrage mit
 * `ESCAPE` benannt werden. Darum steht es hier als Konstante und nicht als
 * Literal an zwei Stellen — das Muster und das `ESCAPE` müssen dasselbe Zeichen
 * meinen, sonst sucht die Abfrage nach dem Backslash selbst.
 */
export const LIKE_FLUCHT = '\\';

/**
 * Ein Suchbegriff als `LIKE`-Muster: `%begriff%`.
 *
 * **Die drei Sonderzeichen werden entschärft**, und das ist keine Feinheit:
 * `%` steht in `LIKE` für beliebig viele Zeichen und `_` für genau eines. Ohne
 * diesen Schritt fände die Eingabe `_` **jedes** Blatt, und die Eingabe `%`
 * ebenso — eine Suche, die bei einem einzelnen Zeichen die ganze Liste zeigt,
 * sieht kaputt aus. Der Backslash muss mit, weil er selbst das Fluchtzeichen
 * ist: wer nach `a\b` sucht, meint den Backslash.
 *
 * Das ist ausdrücklich **keine** Abwehr einer Einschleusung — die besorgt die
 * Parameterbindung von Drizzle, und zwar allein. Hier geht es um die Bedeutung
 * der Zeichen **innerhalb** des gebundenen Werts, und die kennt keine Bindung.
 */
export function alsLikeMuster(begriff: string): string {
	const entschaerft = begriff.replace(/[\\%_]/g, (zeichen) => `${LIKE_FLUCHT}${zeichen}`);
	return `%${entschaerft}%`;
}

/**
 * Ein Ausschnitt um die erste Fundstelle — oder null, wenn der Begriff nicht
 * vorkommt.
 *
 * **Wozu es das gibt.** Ein Blatt wird auch dann gefunden, wenn der Begriff nur
 * in seinem Text steht. In der Liste sieht man aber nur den Titel, und `Gute
 * Nachbarn` als Treffer auf `Brennnessel` sieht aus wie ein Fehler der Suche.
 * Der Ausschnitt beantwortet die Frage, die die Zeile sonst offenlässt: warum
 * steht das hier.
 *
 * **Nur die erste Fundstelle**, nicht alle. Wer wissen will, wie oft ein Wort
 * vorkommt, öffnet das Blatt; eine Liste mit drei Ausschnitten je Zeile wäre
 * keine Liste mehr.
 *
 * **Der Vergleich läuft in Kleinschreibung, der Ausschnitt kommt aus dem
 * Original.** Sonst stünde in der Liste Text, den so niemand geschrieben hat.
 *
 * Die Ellipsen sagen, dass vorn oder hinten etwas fehlt. Sie stehen nur da, wo
 * wirklich etwas abgeschnitten ist — eine Fundstelle am Textanfang bekommt
 * keine führende.
 */
export function fundstelleSchneiden(text: string, begriff: string): string | null {
	if (begriff === '') return null;
	const stelle = text.toLocaleLowerCase('de-CH').indexOf(begriff.toLocaleLowerCase('de-CH'));
	if (stelle === -1) return null;

	/*
	 * Ein Drittel des Fensters vor dem Treffer, der Rest dahinter: so steht das
	 * gesuchte Wort im vorderen Bereich und der Satz, in dem es vorkommt,
	 * dahinter — die Leserichtung. Bei einem Treffer ganz am Anfang schiebt
	 * `Math.max` das Fenster an den Textanfang, statt ins Negative zu laufen.
	 */
	const vorlauf = Math.floor(FUNDSTELLE_LAENGE / 3);
	const von = Math.max(0, stelle - vorlauf);
	const bis = Math.min(text.length, von + FUNDSTELLE_LAENGE);
	/*
	 * Zeilenumbrüche werden zu Leerzeichen: der Ausschnitt steht in **einer**
	 * Zeile einer Liste, und die Absätze des Blatts gehören auf das Blatt.
	 */
	const ausschnitt = text.slice(von, bis).replace(/\s+/g, ' ').trim();
	return `${von > 0 ? '…' : ''}${ausschnitt}${bis < text.length ? '…' : ''}`;
}
