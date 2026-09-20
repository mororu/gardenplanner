import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/*
 * Die Dateiablage — wo ein abgelegtes PDF wirklich liegt. Seit dem 2026-09-20.
 *
 * **Auf der Platte und nicht in der Datenbank.** Ein PDF von zehn Megabyte als
 * BLOB in SQLite hiesse, dass jede Sicherung der Datenbank die Dateien
 * mitschleppt, dass eine Abfrage versehentlich den Inhalt mitliest und dass die
 * Auslieferung durch den Arbeitsspeicher muss statt durch den Dateizugriff. Die
 * Tabelle hält die Zeile, das Verzeichnis den Inhalt, und der Name in `ablage`
 * verbindet die beiden.
 *
 * **Neben der Datenbankdatei und ohne eigene Umgebungsvariable.** Der Ort
 * leitet sich aus DATABASE_PATH ab: liegt die Datenbank unter
 * `/app/data/garten.sqlite`, liegen die Dokumente unter
 * `/app/data/dokumente/`. Das ist eine Entscheidung und keine Bequemlichkeit —
 * eine zweite Pflichtvariable wäre eine zweite Stelle, an der ein Betrieb sie
 * vergisst, und zwei Orte, von denen einer im Compose-Stapel kein Volume
 * bekommt. Was schon gesichert wird, sichert die Dateien mit.
 *
 * **Und ausdrücklich nicht unter static/.** Dort läge jedes Dokument ohne jede
 * Sitzung im Netz: `static/` wird vom Server ausgeliefert, bevor der Wächter in
 * src/hooks.server.ts überhaupt läuft. Ausgeliefert wird darum über eine
 * Route — /wissen/dokument/[id]/datei —, und die liegt hinter dem Wächter wie
 * jede andere.
 */

/**
 * Das Verzeichnis, in dem die Dokumente liegen.
 *
 * **Gerechnet bei jedem Aufruf und nicht einmal beim Laden des Moduls.**
 * DATABASE_PATH wird in den Prüfskripten je Lauf gesetzt, und ein Wert, der
 * beim Import erstarrte, zeigte dort auf die Datenbank des vorigen Laufs. Die
 * Rechnung kostet nichts.
 *
 * Wirft mit demselben Satzbau wie die Datenschicht, wenn die Variable fehlt:
 * ein erfundener Vorgabewert legte still eine zweite, leere Ablage an.
 */
function ablageverzeichnis(): string {
	const pfad = process.env.DATABASE_PATH?.trim();
	if (!pfad) {
		throw new Error(
			'DATABASE_PATH ist nicht gesetzt, und daraus leitet sich die Dateiablage ab.\n' +
				'Lege .env nach dem Muster von .env.example an, zum Beispiel mit\n' +
				'  DATABASE_PATH=./data/dev.sqlite'
		);
	}
	return join(dirname(resolve(pfad)), 'dokumente');
}

/**
 * Legt das Verzeichnis an, falls es fehlt.
 *
 * **Anders als die Datenschicht, die in diesem Fall wirft.** Der Unterschied
 * ist begründet: das Verzeichnis der Datenbank muss ein Mensch angelegt haben,
 * weil dort ein Volume hineingehört und ein stillschweigend erzeugter Ordner im
 * Container beim nächsten Start leer wäre. Die Ablage liegt **darin** — das
 * Volume ist an dieser Stelle schon da, und ein Unterordner darin ist kein
 * Betriebsentscheid mehr.
 *
 * `recursive: true` macht den Aufruf für ein bestehendes Verzeichnis
 * geräuschlos.
 */
function verzeichnisSicherstellen(): string {
	const verzeichnis = ablageverzeichnis();
	mkdirSync(verzeichnis, { recursive: true });
	return verzeichnis;
}

/**
 * Ein neuer Name für die Ablage: 32 Hexzeichen und `.pdf`.
 *
 * **Aus `randomBytes` und nicht aus einem Zähler oder der Zeit.** Der Name muss
 * vor dem INSERT feststehen (siehe die Begründung an `documents.ablage`), also
 * kann die Datenbank ihn nicht vergeben; und ein Name aus der Uhr kollidierte
 * bei zwei Uploads in derselben Millisekunde. Sechzehn Bytes sind so viel
 * Zufall, dass eine Kollision kein Fall ist, über den jemand nachdenken muss —
 * und die `unique`-Bedingung an der Spalte fängt sie trotzdem.
 */
export function ablagenamenErzeugen(): string {
	return `${randomBytes(16).toString('hex')}.pdf`;
}

/**
 * Der volle Pfad zu einem Ablagenamen — und die Stelle, an der ein Ausbruch
 * scheitert.
 *
 * **Die Prüfung steht hier und nicht bei den Aufrufern**, weil sie sonst an
 * drei Stellen stünde und an einer fehlte. Ein Name, der nicht genau aus 32
 * Hexzeichen und `.pdf` besteht, ergibt gar keinen Pfad: damit sind `..`, ein
 * Trenner und ein absoluter Pfad ausgeschlossen, und zwar durch das, was
 * **erlaubt** ist, statt durch eine Liste dessen, was verboten wäre.
 *
 * Die Namen kommen aus der eigenen Datenbank und nicht von aussen — die
 * Prüfung ist damit die zweite von zwei Sicherungen und nicht die einzige. Sie
 * steht trotzdem da: die erste ist ein Datenbankinhalt, und der ist von Hand
 * änderbar.
 */
function pfadVon(ablagename: string): string {
	if (!/^[0-9a-f]{32}\.pdf$/.test(ablagename)) {
		throw new Error(`Kein gültiger Ablagename: ${JSON.stringify(ablagename)}`);
	}
	return join(ablageverzeichnis(), ablagename);
}

/**
 * Schreibt eine Datei in die Ablage.
 *
 * **Zuerst die Datei, dann die Zeile** — die Reihenfolge steht an
 * `documents.ablage` begründet und wird von der Route eingehalten, nicht von
 * hier. Was diese Funktion zusagt, ist nur: danach liegt unter diesem Namen
 * genau dieser Inhalt.
 *
 * `flag: 'wx'` schreibt **nur**, wenn es die Datei noch nicht gibt. Bei einem
 * Namen aus sechzehn Zufallsbytes ist das kein erwarteter Fall, sondern die
 * Zusage, dass ein Schreibvorgang niemals einen fremden Inhalt überschreibt —
 * die Bedingung, auf der das Löschen ruht.
 */
export function dateiAblegen(ablagename: string, inhalt: Uint8Array): void {
	verzeichnisSicherstellen();
	writeFileSync(pfadVon(ablagename), inhalt, { flag: 'wx' });
}

/**
 * Liest eine Datei aus der Ablage — oder null, wenn sie fehlt.
 *
 * **null und kein Wurf für die fehlende Datei**, weil der Fall vorkommt und
 * kein Fehler der Anwendung sein muss: eine von Hand aufgeräumte Ablage, ein
 * abgebrochener Upload, ein wiederhergestelltes Backup ohne die Dateien. Die
 * Route macht daraus einen 404 und keine Fehlerseite — die Zeile gibt es, der
 * Inhalt fehlt, und das ist eine Auskunft und kein Absturz.
 */
export function dateiLesen(ablagename: string): Uint8Array<ArrayBuffer> | null {
	const pfad = pfadVon(ablagename);
	if (!existsSync(pfad)) return null;
	/*
	 * **Als Uint8Array und nicht als Buffer**, und das ist kein Geschmack:
	 * `Response` nimmt einen `BodyInit`, und Node's `Buffer` zählt für TypeScript
	 * nicht dazu. Die Sicht darauf kostet nichts — sie legt nur einen anderen
	 * Blick auf denselben Speicher und kopiert die Bytes nicht.
	 *
	 * **Der eine `as` dieser Datei, und er ist eng gefasst.** `Buffer.buffer` ist
	 * als `ArrayBufferLike` deklariert, und dieser Typ schliesst `SharedArrayBuffer`
	 * ein — den `BodyInit` ausschliesst. `readFileSync` liefert nie einen
	 * geteilten Puffer; die Zusicherung sagt genau das und nichts darüber hinaus.
	 * Die Alternative wäre eine Kopie von bis zu zwanzig Megabyte je Abruf, für
	 * einen Unterschied, den es zur Laufzeit nicht gibt.
	 */
	const puffer = readFileSync(pfad);
	return new Uint8Array(puffer.buffer as ArrayBuffer, puffer.byteOffset, puffer.byteLength);
}

/**
 * Nimmt eine Datei aus der Ablage.
 *
 * `force: true` lässt eine bereits fehlende Datei durchgehen. Das ist hier
 * richtig und nicht nachlässig: gelöscht wird **nach** der Zeile, und wenn die
 * Datei schon fort ist, ist das Ziel des Aufrufs erreicht. Ein Wurf an dieser
 * Stelle liesse eine gelöschte Zeile wie einen Fehlschlag aussehen.
 */
export function dateiWegnehmen(ablagename: string): void {
	rmSync(pfadVon(ablagename), { force: true });
}
