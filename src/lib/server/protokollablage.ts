import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/*
 * Die Ablage der Sitzungsdateien.
 *
 * **Sie trägt seit dem 2026-09-17 zwei Arten**: die hochgeladenen Protokolle als
 * PDF und die erzeugten Traktandenlisten als Textdatei. Beide liegen im selben
 * Verzeichnis, weil beide zur selben Sache gehören und dieselbe Sicherung
 * brauchen; unterschieden werden sie an der Endung, und die vergibt diese Datei
 * selbst. Der Modulname sagt weiter `protokollablage` — er ist der Pfad, unter
 * dem drei Module sie importieren, und eine Umbenennung kostete jede Fundstelle
 * für nichts als ein treffenderes Wort.
 *
 * **Sie liegt im Dateisystem und nicht in der Datenbank** (Entscheid Manuel,
 * 2026-09-17). Die Begründung steht an der Tabelle `minutes` in
 * ./db/schema.ts: ein Protokoll wiegt hunderte Kilobyte, und eine SQLite-Datei,
 * die damit wächst, wird bei jeder Sicherung ganz kopiert.
 *
 * **Kein eigener Umgebungswert.** Das Verzeichnis leitet sich aus
 * DATABASE_PATH ab — daneben, als Unterverzeichnis `protokolle`. Das ist die
 * eine Entscheidung dieses Moduls, und sie ist bewusst so herum getroffen:
 *
 *   - Ein zweiter Wert (`PROTOKOLL_PFAD`) wäre ehrlicher und teurer. Er müsste
 *     in .env.example, in docker-compose.yml, ins Runbook und in die
 *     Fail-Fast-Prüfung beim Start — und die häufigste Störung, die er
 *     einbrächte, wäre ein Betrieb, in dem er auf ein Verzeichnis **ausserhalb**
 *     des gesicherten Volumes zeigt. Genau dann sind die Protokolle fort und
 *     niemand merkt es, bis jemand eines sucht.
 *   - Neben der Datenbank liegt die Ablage **im selben Volume** (`daten:/data`,
 *     siehe docker-compose.yml) und damit in derselben Sicherung. Wer die
 *     Datenbank hat, hat die Protokolle.
 *
 * Der Preis ist benannt: die Ablage lässt sich nicht getrennt verschieben, ohne
 * die Datenbank mitzunehmen. Für zwanzig Leute und ein paar Sitzungen im Jahr
 * ist das kein Verlust, sondern die Zusage, die man will.
 *
 * Alles synchron, wie die Datenschicht daneben: kein async, kein await, kein
 * Promise. better-sqlite3 gibt Werte direkt zurück, und ein halb asynchrones
 * Servermodul wäre die Naht, an der die nächste Rennbedingung entsteht.
 */

/**
 * Wo die Protokolle liegen — neben der Datenbank.
 *
 * Wird bei jedem Aufruf frisch gerechnet und nicht beim Modulladen: das
 * Modulladen ist ausdrücklich nebenwirkungsfrei, aus demselben Grund wie in
 * ./db/index.ts — der Analyseschritt von `vite build` importiert jedes
 * Servermodul einmal, und eine Prüfung beim Laden machte `npm run build` im
 * frisch geklonten Zustand unmöglich.
 */
function ablageverzeichnis(): string {
	const pfad = process.env.DATABASE_PATH?.trim();
	if (!pfad) {
		throw new Error(
			'DATABASE_PATH ist nicht gesetzt. Die Protokollablage liegt neben der Datenbank.\n' +
				'Lege .env nach dem Muster von .env.example an, zum Beispiel mit\n' +
				'  DATABASE_PATH=./data/dev.sqlite'
		);
	}
	return join(dirname(resolve(pfad)), 'protokolle');
}

/**
 * Legt ein Protokoll ab und gibt den **erzeugten** Dateinamen zurück.
 *
 * Der Name kommt aus randomUUID und nicht vom Gerät der hochladenden Person.
 * Das ist die Schranke, auf die es ankommt: ein übernommener Name kann
 * `../../etc/…` heissen, und jede Entschärfung davon ist eine Liste von Fällen,
 * die jemand vollständig geraten haben muss. Ein erzeugter Name hat diese
 * Frage nicht — er besteht aus 36 Zeichen aus Hexziffern und Bindestrichen,
 * und die Endung hängen wir selbst an.
 *
 * Der hochgeladene Name geht damit verloren, und das ist kein Verlust: die
 * Liste zeigt das Sitzungsdatum, und danach sucht man ein Protokoll.
 *
 * Das Verzeichnis entsteht beim ersten Ablegen. `recursive: true` macht den
 * Aufruf still, wenn es schon da ist — eine Prüfung davor wäre ein Zeitfenster
 * zwischen Frage und Antwort.
 */
export function protokollAblegen(bytes: Uint8Array): string {
	return ablegen(bytes, 'pdf');
}

/**
 * Legt eine erzeugte Traktandenliste ab und gibt den Dateinamen zurück.
 *
 * Nimmt **Text** und keine Bytes, und das ist der ganze Unterschied zum
 * Protokoll daneben: die Liste entsteht in diesem Programm und kommt nicht von
 * einem Gerät. `writeFileSync` schreibt einen String als UTF-8 — Umlaute und das
 * `·` der Herkunftszeile stehen darum in der Datei so, wie sie auf der Seite
 * stehen.
 */
export function traktandenlisteAblegen(text: string): string {
	return ablegen(text, 'txt');
}

/**
 * Schreibt eine Datei unter einem erzeugten Namen und gibt ihn zurück.
 *
 * Die gemeinsame Hälfte der zwei Ablagefunktionen darüber. Der Name kommt aus
 * randomUUID, die Endung von hier — beides aus dem Grund, der am Modul steht:
 * ein übernommener Name kann `../../etc/…` heissen.
 *
 * Das Verzeichnis entsteht beim ersten Ablegen. `recursive: true` macht den
 * Aufruf still, wenn es schon da ist — eine Prüfung davor wäre ein Zeitfenster
 * zwischen Frage und Antwort.
 */
function ablegen(inhalt: Uint8Array | string, endung: 'pdf' | 'txt'): string {
	const verzeichnis = ablageverzeichnis();
	mkdirSync(verzeichnis, { recursive: true });
	const datei = `${randomUUID()}.${endung}`;
	writeFileSync(join(verzeichnis, datei), inhalt);
	return datei;
}

/** Liest ein abgelegtes Protokoll, oder null. Die Prüfung steht an `gelesen`. */
export function protokollLesen(datei: string): Uint8Array | null {
	return gelesen(datei, 'pdf');
}

/**
 * Liest eine abgelegte Traktandenliste, oder null.
 *
 * Dieselbe Prüfung und dieselbe Begründung wie beim Protokoll darüber, mit der
 * anderen Endung — und die Trennung ist Absicht: ein Muster, das beide Endungen
 * zuliesse, gäbe eine PDF heraus, wo eine Route eine Liste erwartet, und die
 * Ausgabe setzte den falschen Medientyp.
 */
export function traktandenlisteLesen(datei: string): Uint8Array | null {
	return gelesen(datei, 'txt');
}

/**
 * Liest eine Datei der Ablage, wenn ihr Name **genau** die erzeugte Form hat.
 *
 * Der Name wird gegen jene Form geprüft und nicht bloss auf `..` durchsucht.
 * Er kommt zwar aus der Datenbank und damit aus dieser Datei selbst — aber
 * „kommt aus der Datenbank" ist eine Annahme über jeden künftigen Schreibweg,
 * und diese Funktion liest eine Datei, deren Pfad sie zusammensetzt. Was hier
 * durchkommt, sind 36 Zeichen UUID plus die erwartete Endung; ein Schrägstrich,
 * ein Punkt zu viel und eine Endung, die nicht stimmt, fallen raus, ohne dass
 * jemand die Liste der Angriffe vollständig geraten haben muss.
 *
 * null und kein Wurf, wenn die Datei fehlt: eine Zeile ohne Datei ist der
 * benannte Preis dafür, dass Datenbank und Ablage zwei Dinge sind (siehe
 * ./db/schema.ts). Die Route macht daraus einen 404.
 */
function gelesen(datei: string, endung: 'pdf' | 'txt'): Uint8Array | null {
	const muster = new RegExp(
		`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.${endung}$`
	);
	if (!muster.test(datei)) return null;
	const voll = join(ablageverzeichnis(), datei);
	if (!existsSync(voll)) return null;
	return readFileSync(voll);
}
