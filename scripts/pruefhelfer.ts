/*
 * Die geteilten Helfer der zwei Prüfskripte.
 *
 * Das Projekt hat zwei Prüfskripte mit verschiedener Reichweite und derselben
 * Bauform: scripts/smoke-zugang.ts ruft die Routenmodule direkt und stellt
 * SvelteKit dabei nach, scripts/smoke-http.ts misst den gebauten Baum über
 * echtes HTTP. Was beide brauchen — eine Behauptung, ein Wegwerfverzeichnis,
 * ein benannter Abbruch, eine Schlusszählung — steht hier und nicht zweimal.
 *
 * Der Grund ist nicht Sparsamkeit, sondern Gleichlauf: zwei Kopien von
 * `pruefen` sind zwei Ausgabeformate, und eine Prüfkette, deren zwei Hälften
 * verschieden melden, liest sich beim Fehlschlag doppelt so schlecht.
 *
 * Die Zähler sind Modulzustand. Das ist tragbar, weil jedes Skript in seinem
 * eigenen Prozess läuft; ein Skript, das ein zweites im selben Prozess
 * einbindet, gibt es nicht und soll es nicht geben.
 *
 * Frei von Projektimporten: dieses Modul kennt weder SvelteKit noch die
 * Datenschicht, damit es von beiden Seiten und von nacktem Node ladbar bleibt.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Jedes Wegwerfverzeichnis wird hier vermerkt, damit der Rahmen des rufenden
 * Skripts es auch dann wegräumt, wenn mitten in der Prüfliste etwas
 * Unerwartetes wirft. Die Aufräumzeilen an den einzelnen Stellen bleiben
 * trotzdem stehen: `force: true` macht ein zweites Entfernen zum Nichts, und je
 * früher ein Verzeichnis weg ist, desto weniger kann es einen späteren Lauf
 * verwirren.
 */
const wegwerfverzeichnisse: string[] = [];

export function wegwerfVerzeichnis(vorsilbe: string): string {
	const pfad = mkdtempSync(join(tmpdir(), vorsilbe));
	wegwerfverzeichnisse.push(pfad);
	return pfad;
}

export function aufraeumen(): void {
	for (const pfad of wegwerfverzeichnisse) {
		try {
			rmSync(pfad, { recursive: true, force: true });
		} catch {
			// Ein Verzeichnis, das sich nicht entfernen lässt, ist kein Befund über
			// die geprüfte Schicht. Der Ablagebereich des Systems räumt selbst auf.
		}
	}
}

let gescheitert = 0;
let gelaufen = 0;

export function pruefen(name: string, bedingung: boolean, hinweis?: string): void {
	gelaufen += 1;
	if (bedingung) {
		console.log(`ok      ${name}`);
		return;
	}
	gescheitert += 1;
	console.error(`FEHLER  ${name}${hinweis === undefined ? '' : ` — ${hinweis}`}`);
}

export function pruefenGleich(name: string, ist: unknown, soll: unknown): void {
	pruefen(name, ist === soll, `war ${JSON.stringify(ist)}, erwartet ${JSON.stringify(soll)}`);
}

/**
 * Der Stand der Zähler für die Schlusszählung des rufenden Skripts.
 *
 * Als Funktion und nicht als exportierte Bindung: `gelaufen` und `gescheitert`
 * wären als `export let` zwar live, aber jede Zuweisung von aussen wäre
 * möglich, und genau das soll ein Zähler nicht zulassen, dessen Zweck das
 * Auffallen einer stillschweigend übersprungenen Behauptung ist.
 */
export function zaehlerstand(): { gelaufen: number; gescheitert: number } {
	return { gelaufen, gescheitert };
}

/**
 * Ein unerwarteter Wurf ist ein Befund wie jeder andere und wird benannt.
 *
 * Ausgegeben werden Art und Meldung und — auf einer eigenen, beschrifteten
 * Zeile — die innerste Quellstelle aus dem Stapel. Ein vollständiger Stacktrace
 * bleibt aussen vor, wie überall in diesem Projekt; eine einzelne Fundstelle
 * ist keine Ablage, sondern der Unterschied zwischen einer Meldung, mit der man
 * arbeiten kann, und einer, die nur "ist keine Funktion" sagt.
 *
 * Der Wurf zählt als gescheitert, aber **nicht** als gelaufene Behauptung: die
 * Prüfliste ist abgebrochen, und die Schlusszählung soll genau das zeigen.
 *
 * @param skript der Name, unter dem das Skript meldet — `smoke` oder `smoke:http`
 */
export function unerwarteterWurf(skript: string, fehler: unknown): void {
	gescheitert += 1;
	const art = fehler instanceof Error ? fehler.name : typeof fehler;
	const meldung = fehler instanceof Error ? fehler.message : String(fehler);
	console.error(`VERSTOSS ${skript}  unerwarteter Wurf (${art}): ${meldung}`);

	const stelle =
		fehler instanceof Error && typeof fehler.stack === 'string'
			? (fehler.stack.split('\n').find((zeile) => zeile.trim().startsWith('at ')) ?? '')
			: '';
	if (stelle.trim() !== '') {
		console.error(`         Fundstelle: ${stelle.trim()}`);
	}
	console.error(
		'         Die Prüfliste ist damit abgebrochen — die Schlusszählung darunter\n' +
			'         sagt, wie viele Behauptungen noch gelaufen sind.'
	);
}
