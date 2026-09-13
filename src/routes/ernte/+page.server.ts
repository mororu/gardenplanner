import { redirect } from '@sveltejs/kit';
import type { Actions, RequestEvent, ServerLoadEvent } from '@sveltejs/kit';
import {
	ERNTETEXT,
	STATUS_FEHLT,
	istErntestatus,
	kulturPruefen,
	ortPruefen,
} from '../../lib/ernte.ts';
import { abweisen } from '../../lib/server/abweisen.ts';
import {
	ernteAbernten,
	ernteEintragen,
	ernteUmstufen,
	erntestandLesen,
	erntezeileLesen,
	type Erntezeile,
} from '../../lib/server/db/queries/harvests.ts';
import { ERNTEZEILE_NICHT_ANSPRECHBAR } from '../../lib/texte.ts';

/*
 * /ernte — was gerade reif ist, in drei Stufen. Ein Stand, kein Tagebuch.
 *
 * Die Importe stehen relativ und mit .ts-Endung, und die Typen kommen aus
 * @sveltejs/kit statt aus ./$types. Der Grund ist derselbe wie in den
 * Nachbarrouten und geprüft, nicht vermutet: scripts/smoke-zugang.ts lädt
 * dieses Modul mit nacktem Node, und tsconfig.scripts.json kennt weder das
 * virtuelle ./$types noch die $lib-Zuordnung.
 *
 * **Keine zweite Stufe, an keiner der drei actions.** Der Wächter in
 * src/hooks.server.ts hat einen Aufruf ohne gültige Sitzung schon mit 403
 * abgewiesen; danach darf jedes aktive Mitglied eintragen, umstufen und
 * abernten — auch an fremden Zeilen. Das ist der Entscheid vom 2026-09-13 und
 * die Aussage der Seite: was im Beet steht, sieht jede, die im Garten steht,
 * und wer sieht, dass nichts mehr da ist, soll das sagen dürfen, ohne die
 * eintragende Person zu suchen. Es gibt darum ausdrücklich **kein**
 * adminOderWeg und keine `where`-Klausel auf die eigene Person — der
 * Unterschied zum Austragen im Tränkeplan, wo genau diese Klausel die Schranke
 * ist.
 *
 * Das Gegengewicht steht bei `abernten`: die einzige zerstörende Handlung
 * dieses Produkts ausserhalb der Verwaltung fragt einmal nach.
 *
 * Die Mutationen sind form actions mit use:enhance (AD-9), im Markup mit
 * literalem action="?/name" — ein dynamisches action={…} würde Gate-Regel 11
 * blind machen.
 */

/**
 * Liest eine Zahl aus dem Formular, oder null.
 *
 * Die fünfte bewusste Kopie von `idLesen`/`zahlLesen` (siehe
 * ../verwaltung/+page.server.ts, ../+page.server.ts, ../einzelaufgabe und
 * ../traenkeplan). Die Verdopplung bleibt billiger als eine gemeinsame Stelle:
 * fünf Zeilen ohne Domänenwissen, und ein geteiltes Modul dafür hiesse, dass
 * eine Änderung an der einen Seite still die anderen trifft.
 */
function zahlLesen(roh: unknown): number | null {
	// `unknown` und nicht FormDataEntryValue: das Typprüf-Programm der Skripte
	// (tsconfig.scripts.json) zieht bewusst kein DOM-lib, und dieses Modul liegt
	// über scripts/smoke-zugang.ts darin.
	if (typeof roh !== 'string') return null;
	const gekuerzt = roh.trim();
	if (!/^[0-9]+$/.test(gekuerzt)) return null;
	const zahl = Number(gekuerzt);
	return Number.isSafeInteger(zahl) && zahl > 0 ? zahl : null;
}

/** Liest ein Textfeld als Zeichenkette, auch wenn es fehlt. */
function textLesen(roh: unknown): string {
	return typeof roh === 'string' ? roh : '';
}

/**
 * Der ganze Stand, dringend zuerst.
 *
 * **Keine Aufteilung in drei Listen hier.** Die Abfrage liefert die Zeilen in
 * der Reihenfolge der Stufen, und die Komponente setzt daraus ihre Abschnitte.
 * Drei Felder in den Seitendaten wären eine zweite Fassung derselben
 * Gruppierung — und die erste, die jemand ändert, liefe gegen die andere.
 *
 * **Kein Zeitpunkt in den Daten.** Anders als auf `/`, wo die Überfälligkeit
 * gegen `jetzt` gerechnet wird, hängt hier nichts an der Uhr: `createdAt` steht
 * als Datum an der Zeile, und ein Datum ist dasselbe, ob man es um 23:59 oder
 * um 00:01 liest. Der Satz zur Dauerernte ist fest und wird nicht gerechnet
 * (siehe DAUERERNTE_SATZ in src/lib/ernte.ts).
 */
export function load({ locals }: ServerLoadEvent): { stand: Erntezeile[] } {
	// Unerreichbar: der Wächter hat vorher mit 403 abgewiesen. Die Prüfung steht
	// hier, weil der Typ null zulässt — und ein `!` machte diese Seite von einer
	// Annahme über eine andere Datei abhängig.
	if (locals.mitglied === null) {
		redirect(303, '/');
	}
	return { stand: erntestandLesen() };
}

/*
 * Wie diese Seite abweist — die Funktion steht in ../../lib/server/abweisen.ts
 * und ist für alle sechs Seiten mit Formular dieselbe.
 *
 * `feld` ist `'kultur'`, `'ort'` oder `'status'` am Eintragen-Formular und null
 * an den zwei Zeilen-Aktionen, die kein Feld haben. `zeile` trägt die Kennung
 * der Erntezeile, damit die Meldung an ihr steht statt oben.
 *
 * `eingabe` trägt die verworfene Kultur zurück, `zweiteEingabe` den Ort — die
 * zwei freien Textfelder dieser Seite. Ohne JavaScript ist das der einzige Weg
 * zurück ins Feld; dieselbe Bauform wie Titel und Text auf /wissen.
 */
export const actions = {
	/**
	 * Trägt ein, was reif ist.
	 *
	 * **Die Kultur wird vor dem Ort geprüft und der Status zuletzt**, und diese
	 * Reihenfolge ist die Reihenfolge im Formular: wer drei Meldungen zugleich
	 * bekäme, läse zuerst die zur untersten Zeile. Abgewiesen wird an der ersten
	 * Stelle, die nicht trägt.
	 *
	 * **Der Status wird geprüft, obwohl das Markup `required` setzt.** Ein POST
	 * braucht kein Formular, und `required` an drei Knöpfen ist eine Zusage des
	 * Browsers, keine des Servers.
	 *
	 * `laufend` wird über `has` gelesen und nicht über einen Wertvergleich: ein
	 * Häkchen ist eine Marke, kein Wert. Fehlt es, ist es nicht gesetzt — ein
	 * nicht angekreuztes Kästchen schickt nichts mit, und genau das heisst hier
	 * „nein".
	 */
	eintragen: async ({ locals, request }: RequestEvent) => {
		const mitglied = locals.mitglied;
		// Unerreichbar: der Wächter hat vorher mit 403 abgewiesen. Die Prüfung
		// steht hier, weil der Typ null zulässt — ohne Identität gibt es
		// niemanden, der einträgt, und member_id ist notNull.
		if (mitglied === null) {
			return abweisen(ERNTEZEILE_NICHT_ANSPRECHBAR);
		}

		const formular = await request.formData();
		const kulturRoh = textLesen(formular.get('kultur'));
		const ortRoh = textLesen(formular.get('ort'));

		const kultur = kulturPruefen(kulturRoh);
		if ('fehler' in kultur) {
			return abweisen(kultur.fehler, 'kultur', kulturRoh, null, ortRoh);
		}

		const ort = ortPruefen(ortRoh);
		if ('fehler' in ort) {
			return abweisen(ort.fehler, 'ort', kulturRoh, null, ortRoh);
		}

		const status = formular.get('status');
		if (!istErntestatus(status)) {
			return abweisen(STATUS_FEHLT, 'status', kulturRoh, null, ortRoh);
		}

		const zeile = ernteEintragen(
			{ kultur: kultur.kultur, ort: ort.ort, status, laufend: formular.has('laufend') },
			mitglied
		);

		// Der Satz nennt die Kultur **und** die Stufe: das Formular klappt nach
		// dem Absenden zu, der Fokus springt in die Region oben, und die neue
		// Zeile steht irgendwo in einer von drei Listen. Ohne beides sagt die
		// Meldung, dass etwas geklappt hat, aber nicht was und nicht wohin.
		return {
			art: 'eingetragen' as const,
			meldung: `${zeile.kultur} steht jetzt unter „${ERNTETEXT[status].titel}".`,
			zeile: zeile.id,
		};
	},

	/**
	 * Stuft eine Zeile um — ohne Rückfrage.
	 *
	 * Umstufen nimmt niemandem etwas weg und ist mit einem zweiten Griff wieder
	 * zurückgenommen; die Rückfrage bliebe ein Griff, der nichts schützt.
	 * Dieselbe Abwägung wie beim Eintragen im Tränkeplan, und die umgekehrte wie
	 * bei `abernten` daneben.
	 *
	 * Fehlende, unlesbare und nicht mehr vorhandene Zeile fallen auf **einen**
	 * Satz, ebenso ein Status, den es nicht gibt. Die Unterscheidung wäre ein
	 * Aufzählungskanal und für die lesende Person ohne Folge: in allen Fällen
	 * ist die angezeigte Liste veraltet.
	 */
	umstufen: async ({ request }: RequestEvent) => {
		const formular = await request.formData();
		const id = zahlLesen(formular.get('id'));
		const status = formular.get('status');
		if (id === null || !istErntestatus(status)) {
			return abweisen(ERNTEZEILE_NICHT_ANSPRECHBAR, null, '', id);
		}

		const zeile = ernteUmstufen(id, status);
		if (zeile === null) {
			return abweisen(ERNTEZEILE_NICHT_ANSPRECHBAR, null, '', id);
		}

		return {
			art: 'umgestuft' as const,
			meldung: `${zeile.kultur} steht jetzt unter „${ERNTETEXT[status].titel}".`,
			zeile: id,
		};
	},

	/**
	 * Nimmt eine Zeile weg — in zwei Schritten, an einer action.
	 *
	 * **Warum gefragt wird.** Es ist ein DELETE ohne Rückweg: die Zeile ist fort,
	 * und wer sie zurückhaben will, trägt sie neu ein — mit einem neuen Datum und
	 * dem eigenen Namen statt dem der Person, die es zuerst gesehen hat. Und
	 * abernten darf jede, auch an fremden Zeilen; die Rückfrage ist das
	 * Gegengewicht zu genau dieser Offenheit.
	 *
	 * Dieselbe Bauform wie das Austragen im Tränkeplan und das Übernehmen auf
	 * `/`: ein POST ohne `bestaetigt` ändert nichts und fragt, erst der zweite
	 * schreibt. Ohne JavaScript ist die Antwort auf den ersten POST ein
	 * vollständiges Dokument mit der Frage an der Zeile.
	 *
	 * Die Frage trägt Kultur und Ort mit, weil sie an der Zeile steht, aber
	 * gelesen wird, nachdem der Blick nach oben gesprungen ist — und weil zwei
	 * Zeilen `Zucchini` heissen dürfen, eine im Hochbeet und eine im Freiland.
	 */
	abernten: async ({ request }: RequestEvent) => {
		const formular = await request.formData();
		const id = zahlLesen(formular.get('id'));
		if (id === null) {
			return abweisen(ERNTEZEILE_NICHT_ANSPRECHBAR);
		}

		// Schritt 1: fragen. `has` und nicht ein Wertvergleich — das Feld ist eine
		// Marke, kein Wert.
		if (!formular.has('bestaetigt')) {
			const zeile = erntezeileLesen(id);
			if (zeile === null) {
				return abweisen(ERNTEZEILE_NICHT_ANSPRECHBAR, null, '', id);
			}
			return {
				art: 'fragenAbernten' as const,
				zeile: id,
				kultur: zeile.kultur,
				ort: zeile.ort,
			};
		}

		// Schritt 2: schreiben. Wer das Wettrennen verliert, weil jemand anders in
		// der Zwischenzeit abgeerntet hat, bekommt denselben Satz wie jemand mit
		// einer erfundenen Kennung.
		const weg = ernteAbernten(id);
		if (weg === null) {
			return abweisen(ERNTEZEILE_NICHT_ANSPRECHBAR, null, '', id);
		}

		return {
			art: 'abgeerntet' as const,
			meldung: `${weg.kultur} ist abgeerntet und aus der Liste weg.`,
			zeile: id,
		};
	},
} satisfies Actions;
