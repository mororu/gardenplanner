/*
 * Die unsichtbaren Zeichen — **die eine Stelle**, an der steht, welche das sind.
 *
 * Drei Leser, und alle drei brauchen dieselbe Antwort: ./aufgabentext.ts faltet
 * einen Aufgabentext, ./mitgliedsname.ts einen Mitgliedsnamen, ./blatttext.ts
 * seit Story 4.1 den Freitext eines Wissensblatts.
 *
 * Bis zum 2026-08-29 trug jedes der damals zwei Module eine eigene, wortgleiche
 * Konstante NULLBREITE, und die Verdopplung war dort ausdrücklich begründet: es
 * geht einmal um einen Aufgabentext und einmal um einen Namen, und eine
 * Änderung an der einen Regel soll die andere nicht still treffen.
 *
 * **Für diese Zeichenklasse trägt diese Begründung nicht**, und genau das haben
 * die Einträge 23 und 24 der zurückgestellten Arbeit über zwei Stories hinweg
 * festgehalten: beide sagen „gehört an beide Stellen zugleich". Welche Zeichen
 * unsichtbar sind, ist keine Aussage über Namen oder über Aufgaben, sondern eine
 * über Unicode. Was in den zwei Modulen bleibt, sind die Regeln, die dort
 * wirklich verschieden sind: die Längengrenzen, die Sätze, und ob überhaupt
 * geprüft oder nur gefaltet wird.
 *
 * Das Modul liegt in src/lib/ und nicht unter client/ oder server/: es wird von
 * beiden Seiten gelesen — der Zähler unter dem Textfeld auf /monatsplan läuft im
 * Browser. Es hängt von nichts ab, damit scripts/create-admin.ts und
 * scripts/smoke-zugang.ts es über nacktes Node laden können.
 */

/**
 * Zeichen, die keine Breite haben oder als leere Fläche erscheinen, und die
 * `trim()` **nicht** für Leerraum hält.
 *
 * Ohne dieses Aussieben besteht ein Text aus lauter solchen Zeichen jede
 * Prüfung: die Aufgabe erscheint im Pool als leere Zeile mit einem Kästchen
 * daneben, das Mitglied als leere Lücke in der Liste mit einem lebenden
 * Einladungslink, das Wissensblatt als Titel ohne Wort in einer Liste, die nur
 * Titel zeigt. Für die Aufgabe gibt es dagegen bis heute kein Mittel — keine
 * Bearbeiten- und keine Löschen-Aktion, Abhaken ist das Einzige, was bleibt.
 *
 * **Die Liste, Zeichen für Zeichen:**
 *
 *   - U+00AD SOFT HYPHEN — ein Trennvorschlag, sichtbar nur am Zeilenumbruch;
 *   - U+180E MONGOLIAN VOWEL SEPARATOR — seit Unicode 6.3 breitenlos;
 *   - U+200B ZERO WIDTH SPACE, U+200C ZERO WIDTH NON-JOINER;
 *   - U+200D ZERO WIDTH JOINER — **bedingt**, siehe unten;
 *   - U+2060 WORD JOINER;
 *   - U+202A–U+202E und U+2066–U+2069 — die Bidi-Steuerzeichen. Sie sind nicht
 *     nur unsichtbar, sie drehen die Anzeigerichtung des Folgenden um: ein
 *     Aufgabentext kann damit etwas anderes zeigen, als in der Datenbank steht;
 *   - U+2800 BRAILLE PATTERN BLANK — ein **sichtbares** Zeichen ohne Punkte, das
 *     als leere Fläche erscheint und von `trim()` nicht angerührt wird;
 *   - U+3164 HANGUL FILLER und U+FFA0 HALFWIDTH HANGUL FILLER — dasselbe in
 *     zwei Breiten;
 *   - U+FEFF ZERO WIDTH NO-BREAK SPACE — die Form, in der eine Byte-Order-Mark
 *     beim Einfügen aus einer Datei mitkommt.
 *
 * **U+200D wird nur ausserhalb einer Emoji-Folge entfernt.** Ein Verbinder
 * zwischen zwei Piktogrammen ist kein unsichtbares Zeichen, sondern der Klebstoff
 * eines einzigen Glyphen: `👨‍🌾` ist U+1F468 U+200D U+1F33E, und ein
 * bedingungsloses Aussieben machte daraus **zwei** sichtbare Figuren. Die Zusage
 * „unsichtbare Zeichen weg" träfe damit ein sichtbares.
 *
 * Die zwei Ausnahmen der dritten und vierten Alternative lesen sich umständlich
 * und sagen zusammen etwas Einfaches: ein U+200D fällt, wenn er **nicht**
 * zwischen zwei Piktogrammen steht. Die optionale Klasse in der Rückschau ist
 * Pflicht und keine Vorsicht — die Hautton-Modifikatoren U+1F3FB–U+1F3FF und
 * der Variationsselektor U+FE0F stehen bei `👩🏽‍🌾` und `❤️‍🔥` zwischen dem
 * Piktogramm und dem Verbinder, und sie sind selbst **nicht**
 * Extended_Pictographic.
 *
 * Das `g`-Flag ist Pflicht, nicht Zierat: ohne es ersetzte `replace` nur das
 * **erste** Zeichen. Statthaft ist es, weil `String.prototype.replace` den
 * `lastIndex` eines globalen Regex vor jedem Lauf selbst auf 0 zurücksetzt — die
 * Konstante trägt also keinen Zustand von Aufruf zu Aufruf mit, was bei zwanzig
 * bis vierzig Zeilen in einer Schleife kein gedachter Fall wäre. Sie ist trotzdem
 * **nicht exportiert**: die Funktion darunter ist die ganze Schnittstelle, und
 * damit kann niemand den Zustand versehentlich doch anfassen.
 *
 * Das `u`-Flag ist ebenfalls Pflicht: ohne es kennt die Maschine weder
 * `\p{…}` noch die Codepoints über U+FFFF.
 */
const UNSICHTBAR =
	/[\u00AD\u180E\u200B\u200C\u2060\u202A-\u202E\u2066-\u2069\u2800\u3164\uFEFF\uFFA0]|\u200D(?!\p{Extended_Pictographic})|(?<!\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}])?)\u200D/gu;

/**
 * Nimmt alle unsichtbaren Zeichen aus einem Text — und **nur** die.
 *
 * Leerraum bleibt unangetastet: das Zusammenziehen von `\s+`, das Normalisieren
 * der Zeilenenden und das Trimmen gehören zur Faltung der drei aufrufenden
 * Module und stehen dort, in der Reihenfolge, die sie begründen. Sie sind je
 * verschieden — ./blatttext.ts zieht `\s+` ausdrücklich **nicht** zusammen —,
 * und genau darum steht hier nur die Zeichenklasse.
 */
export function unsichtbarEntfernen(eingabe: string): string {
	return eingabe.replace(UNSICHTBAR, '');
}
