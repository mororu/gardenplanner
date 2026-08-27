/*
 * Legt das erste Admin-Mitglied an und gibt seinen Einladungslink genau einmal
 * auf der Konsole aus. Der Klartext ist danach unwiederbringlich weg — in der
 * Datenbank steht nur der SHA-256-Hash.
 *
 * Es gibt keinen zweiten Weg zu einer Adminperson: /verwaltung nimmt
 * ausschliesslich Mitglieder ohne Adminrechte auf, und dieses Skript läuft nur
 * auf einem leeren System. Der Alleinverwalter ist damit eine benannte
 * Sollbruchstelle, siehe README.md.
 *
 * Aufruf:
 *   npm run create-admin -- Anna Meier
 *
 * Node 25 strippt TypeScript von sich aus, darum braucht dieses Skript kein
 * tsx. Die Importe stehen relativ und mit .ts-Endung, nie über $lib: nacktes
 * Node löst weder den Alias auf noch eine .js-Endung auf eine .ts-Datei.
 */
import { datenschichtStarten } from '../src/lib/server/db/index.ts';
import { mitgliedAnlegen, mitgliederZaehlen } from '../src/lib/server/db/queries/members.ts';
import { herkunftLesen } from '../src/lib/server/herkunft.ts';
import { tokenErzeugen, tokenHashen } from '../src/lib/server/token.ts';

/** Benannte Meldung, kein Stacktrace, Exit 1. */
function abbrechen(meldung: string): never {
	console.error(meldung);
	process.exit(1);
}

/*
 * Name und ORIGIN werden geprüft, bevor die Datenschicht startet.
 *
 * Das Modulladen oben ist nebenwirkungsfrei — keiner dieser Importe öffnet eine
 * Datei. Erst datenschichtStarten() legt die Datenbank samt -wal und -shm an,
 * und das darf nicht passieren, um danach "Es fehlt der Name" zu sagen.
 */
/*
 * Der Name kommt aus **allen** Argumenten, nicht nur aus dem ersten.
 * `npm run create-admin -- Anna Meier` hat vorher stillschweigend "Anna"
 * angelegt und "Meier" verworfen — belegt, in der Datenbank stand
 * [{"name":"Anna"}]. Der Name ist die einzige menschenlesbare Identität im
 * System; ihn zur Hälfte zu speichern ist schlimmer als eine Rückfrage.
 */
const name = process.argv.slice(2).join(' ').replace(/\s+/g, ' ').trim();
if (name === '') {
	abbrechen('Es fehlt der Name. Aufruf: npm run create-admin -- Anna Meier');
}

let herkunft: string;
try {
	herkunft = herkunftLesen();
} catch (fehler) {
	abbrechen(fehler instanceof Error ? fehler.message : String(fehler));
}

try {
	datenschichtStarten();
} catch (fehler) {
	abbrechen(fehler instanceof Error ? fehler.message : String(fehler));
}

/*
 * Zweitlauf-Schutz. Dieses Skript ist ausdrücklich für das **erste** Mitglied
 * gedacht. Ein zweiter Lauf erzeugte einen zweiten Admin und einen zweiten
 * lebenden Klartext-Link, ohne dass jemand danach gefragt hätte — und
 * Adminrechte vergibt keine Oberfläche wieder ab, /verwaltung nimmt
 * ausschliesslich Mitglieder ohne Adminrechte auf.
 */
let vorhandene: number;
try {
	vorhandene = mitgliederZaehlen();
} catch (fehler) {
	abbrechen(fehler instanceof Error ? fehler.message : String(fehler));
}
if (vorhandene > 0) {
	abbrechen(
		`Es gibt schon ${vorhandene} Mitglied(er). Dieses Skript legt nur das erste an.\n` +
			'Weitere Mitglieder nimmt eine Adminperson unter /verwaltung auf — dort gibt es\n' +
			'Aufnehmen, Link neu ausstellen und Einladung widerrufen.\n' +
			'Hier gibt es bewusst keinen zweiten Weg, damit nicht unbemerkt ein zweiter\n' +
			'Admin mit einem zweiten lebenden Link entsteht. Adminrechte vergibt allein\n' +
			'dieses Skript, und nur für das erste Mitglied.'
	);
}

const token = tokenErzeugen();

let mitgliedId: number;
try {
	const mitglied = mitgliedAnlegen({
		name,
		inviteTokenHash: tokenHashen(token),
		isAdmin: true,
	});
	mitgliedId = mitglied.id;
} catch (fehler) {
	// Kein Hinweis auf eine unique-Bedingung auf name — die gibt es nicht, zwei
	// Mitglieder dürfen gleich heissen. Eindeutig ist allein invite_token_hash.
	abbrechen(
		`Das Mitglied liess sich nicht anlegen: ${fehler instanceof Error ? fehler.message : String(fehler)}\n` +
			'Ist die Datenbankdatei oder ihr Verzeichnis schreibgeschützt?'
	);
}

console.log(`Mitglied "${name}" angelegt, Nummer ${mitgliedId}, mit Adminrechten.`);
console.log('Der Einladungslink erscheint genau einmal — jetzt. Er ist nicht wiederherstellbar:');
// Die einzige Zeile, die ein Klartext-Token auf die **Konsole** schreibt. Seit
// Story 1.3 nicht mehr die einzige Stelle im System, die einen Klartext-Link
// zeigt: die actions aufnehmen und neuAusstellen unter /verwaltung geben je
// einen im Rumpf ihrer POST-Antwort zurück. Derselbe Handel, anderer Kanal.
console.log(`${herkunft}/i/${token}`);
