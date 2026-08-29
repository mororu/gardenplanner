import { redirect } from '@sveltejs/kit';
import type { Actions, RequestEvent } from '@sveltejs/kit';
import { AUFGABE_HOECHSTLAENGE, aufgabentextFalten } from '../../lib/aufgabentext.ts';
import { abweisen } from '../../lib/server/abweisen.ts';
import { einzelaufgabeAusschreiben } from '../../lib/server/db/queries/signup-tasks.ts';
import { FRIST_AUSSERHALB } from '../../lib/texte.ts';
import { fristfenster, istImFristfenster, tagesendeInUnixSekunden } from '../../lib/zeit.ts';

/*
 * /einzelaufgabe — eine verbindliche Einzelaufgabe ausschreiben. Zwei Felder,
 * ein Knopf.
 *
 * Die Importe stehen relativ und mit .ts-Endung, und die Typen kommen aus
 * @sveltejs/kit statt aus ./$types. Der Grund ist derselbe wie in
 * src/routes/aufgabe/+page.server.ts und geprüft, nicht vermutet:
 * scripts/smoke-zugang.ts lädt dieses Modul mit nacktem Node, und
 * tsconfig.scripts.json kennt weder das virtuelle ./$types noch die
 * $lib-Zuordnung.
 *
 * **Keine eigene Zugangsschranke und keine zweite Stufe.** Der Wächter in
 * src/hooks.server.ts hat einen Aufruf ohne gültige Sitzung schon mit 403
 * abgewiesen, und ausschreiben darf jedes aktive Mitglied. Die action liest
 * `locals` gar nicht — wer ausschreibt, wird nicht gespeichert, und wer
 * ausschreibt, übernimmt damit auch nicht. Beides ist Absicht: die Einzelaufgabe
 * trägt genau einen Namen, und der entsteht beim Übernehmen.
 *
 * Die Mutation ist eine form action mit use:enhance (AD-9). Kein +server.ts,
 * kein JSON-Endpunkt, und im Markup ein **literales** action="?/ausschreiben" —
 * ein dynamisches action={…} würde Gate-Regel 11 blind machen.
 */

/** Der Text für den fehlenden Titel. Eine Wurfstelle. */
const TITEL_FEHLT =
	'Ohne Titel entsteht keine Einzelaufgabe. Schreib in einem Satz, worum es geht.';

/**
 * Der Text für die Überlänge. Eine Wurfstelle.
 *
 * Die Grenze ist AUFGABE_HOECHSTLAENGE aus ../../lib/aufgabentext.ts, dieselbe
 * wie für eine Poolaufgabe und für jede Zeile eines Monatsplans — die dritte
 * Wurfstelle derselben Zahl, und darum keine eigene. Ein Titel ist derselbe
 * Gegenstand wie ein Aufgabentext: ein Satz, den jemand im Garten liest.
 *
 * Der Satz bleibt lokal: er nennt ein Feld dieser Seite und ist ihre Auslegung.
 * Die Zahl im `maxlength` des Feldes stand bis zum Review als Literal daneben;
 * sie kommt jetzt über die `load` aus derselben Konstante — abgeleitet statt
 * gegeneinander geprüft, wie `namensgrenze` auf /verwaltung.
 */
const TITEL_ZU_LANG = `Das ist zu lang für einen Titel. Höchstens ${AUFGABE_HOECHSTLAENGE} Zeichen.`;

/**
 * Der Text für den fehlenden Termin. Eine Wurfstelle.
 *
 * **Nicht** DATUM_FEHLT aus ../../lib/texte.ts, und das ist eine Entscheidung:
 * jener Satz lautet „Wähle ein Datum, bis zu dem die Aufgaben erledigt sein
 * sollen" und beschreibt einen Stapel mit einer gemeinsamen Frist. Hier geht es
 * um **einen** Termin für **eine** Sache. Die Regel dahinter — das Fenster von
 * einem Jahr in jede Richtung — ist dieselbe und teilt sich darum FRIST_AUSSERHALB;
 * die Auslegung des leeren Felds ist es nicht.
 */
const TERMIN_FEHLT = 'Wähle einen Termin, bis zu dem die Einzelaufgabe erledigt sein soll.';

/**
 * Der Titel, wie er in die Datenbank geht — oder null, wenn er nicht taugt.
 *
 * Gefaltet wird in aufgabentextFalten in ../../lib/aufgabentext.ts: erst die
 * unsichtbaren Zeichen weg (src/lib/unsichtbar.ts), dann Leerraum
 * zusammenziehen, dann trimmen. Gespeichert wird die **gefaltete** Fassung.
 *
 * Die dritte Wurfstelle dieser Kette, angekündigt in der Triage vom 2026-08-28
 * (Posten B5): sie erbt die Zeichenklasse geschenkt, statt sie zu wiederholen.
 * Was hier bleibt, ist die **Deutung** — leer und zu lang ergeben die zwei Sätze
 * dieser Seite.
 */
function titelPruefen(eingabe: string): { titel: string } | { fehler: string } {
	const titel = aufgabentextFalten(eingabe);
	if (titel === '') return { fehler: TITEL_FEHLT };
	// Nach Codepoints gezählt, nicht nach UTF-16-Einheiten: ein Emoji im Titel
	// ist kein zweites Zeichen. [...titel] zerlegt in Codepoints.
	if ([...titel].length > AUFGABE_HOECHSTLAENGE) return { fehler: TITEL_ZU_LANG };
	return { titel };
}

/**
 * Die Grenzen des Terminfelds — dieselben wie an `Fällig bis` auf /monatsplan.
 *
 * Sie nimmt **kein Ereignis** entgegen, und das ist die Aussage: sie liest weder
 * locals noch cookies noch die Adresse. Alle sehen dasselbe Feld.
 *
 * **Keine Vorgabe für den Termin.** /monatsplan schlägt das Monatsende vor, weil ein Monatsplan
 * bis zum Monatsende gilt und die Vorgabe fast immer stimmt. Für eine
 * Einzelaufgabe gibt es kein solches Datum: der Termin ist der Kern dessen, was
 * ausgeschrieben wird, und ein vorbelegtes Feld, das jemand ungelesen stehen
 * lässt, wäre eine Zusage, die niemand gemacht hat.
 */
export function load(): {
	titelGrenze: number;
	terminFrueheste: string;
	terminSpaeteste: string;
} {
	const { frueheste, spaeteste } = fristfenster(Math.floor(Date.now() / 1000));
	return {
		/*
		 * Die Längengrenze reist mit, statt im Markup als Literal zu stehen.
		 * Dieselbe Bauform wie `namensgrenze` auf /verwaltung, und derselbe Grund:
		 * ein `maxlength="200"` neben einem Server, der aus AUFGABE_HOECHSTLAENGE
		 * prüft, sind zwei Zahlen über eine Regel. Wer die Konstante verschiebt,
		 * bekommt hier ein Feld, das mitgeht, statt einen roten Prüflauf.
		 */
		titelGrenze: AUFGABE_HOECHSTLAENGE,
		terminFrueheste: frueheste,
		terminSpaeteste: spaeteste,
	};
}

/*
 * Wie diese Seite abweist — die Funktion selbst steht in
 * ../../lib/server/abweisen.ts und ist für alle Seiten dieselbe.
 *
 * `feld` benennt, wohin die Meldung gehört, und die Komponente **liest es**:
 * diese Seite hat zwei Felder, und eine Meldung über den Termin gehört an das
 * Terminfeld, nicht an den Titel. Dieselbe Lage wie auf /monatsplan, anders als
 * auf /aufgabe mit seinem einen Feld.
 *
 * `eingabe` trägt den verworfenen **Titel** zurück ins Feld, und zwar aus
 * **allen** drei Abweisungen — auch aus den zwei, die den Termin betreffen. Wer
 * einen Titel getippt und dann ein Datum ausserhalb des Fensters gewählt hat,
 * soll den Titel wiederfinden; sein Wert wird serverseitig gerendert und wäre
 * sonst leer.
 *
 * Der **Termin** reist ausdrücklich **nicht** zurück: die geteilte Form von
 * `abweisen` hat einen Rückweg, nicht zwei. Ohne JavaScript ist das Feld nach
 * einer Abweisung darum leer. Das ist benannt und in deferred-work.md
 * festgehalten, und es ist die richtige Verteilung des einen Rückwegs: der Titel
 * passiert `required` und fällt erst am Server, der Termin trägt `required`,
 * `min` und `max`, die der Browser selbst prüft.
 *
 * Ein abgewiesener Versand legt **nichts** an: einzelaufgabeAusschreiben wird
 * auf diesem Weg nie erreicht.
 */
export const actions = {
	/**
	 * Schreibt eine Einzelaufgabe aus und leitet auf die Liste zurück.
	 *
	 * **Die Reihenfolge der Prüfungen folgt den Feldern**, von oben nach unten:
	 * erst der Titel, dann der Termin. Das ist die andere Ordnung als auf
	 * /monatsplan, wo das Datum zuerst geprüft wird — dort gilt es für einen
	 * ganzen Stapel und ist die grundsätzlichere Angabe, hier stehen zwei
	 * gleichrangige Felder nebeneinander, und wer eines übersieht, soll den Satz
	 * an der Stelle finden, an der sein Auge ohnehin steht.
	 *
	 * **Ohne Übernehmer.** `member_id` bleibt leer; wer ausschreibt, sagt damit
	 * nichts zu. Das Übernehmen ist ein eigener Vorgang auf `/` und trägt seine
	 * eigene Bestätigung.
	 *
	 * Die Meldung reist als **Query-Parameter** über die Weiterleitung: ein
	 * redirect() verwirft den Rückgabewert der action. `?ausgeschrieben` steht
	 * ohne Wert — die load von / liest daraus einen Wahrheitswert und die
	 * Oberfläche setzt den Satz `Ausgeschrieben.`, das Verb des Knopfs im
	 * Perfekt. Ein eigener Parameter und nicht `?abgelegt`: abgelegt wird eine
	 * Aufgabe in den Pool, ausgeschrieben wird eine Einzelaufgabe, und die zwei
	 * Verben stehen für zwei verschiedene Verbindlichkeiten.
	 *
	 * 303 und nicht 302: nach einem POST ist die Folgeanfrage ausdrücklich ein
	 * GET.
	 */
	ausschreiben: async ({ request }: RequestEvent) => {
		const formular = await request.formData();

		// Ein fehlendes Feld und ein Nicht-String (ein Datei-Upload) fallen auf
		// dieselbe leere Eingabe zusammen — und damit auf denselben Satz wie ein
		// leeres Feld. Jede Unterscheidung wäre eine Auskunft ohne Handlung.
		const rohTitel = formular.get('titel');
		const getippt = typeof rohTitel === 'string' ? rohTitel : '';
		const geprueft = titelPruefen(getippt);
		if ('fehler' in geprueft) {
			return abweisen(geprueft.fehler, 'titel', getippt);
		}

		const rohTermin = formular.get('termin');
		const terminAt = tagesendeInUnixSekunden(typeof rohTermin === 'string' ? rohTermin : '');
		// Fehlend, leer, keine Form JJJJ-MM-TT und ein unmögliches Datum wie
		// 2026-02-31 fallen auf dasselbe null zusammen und auf denselben Satz.
		if (terminAt === null) {
			return abweisen(TERMIN_FEHLT, 'termin', getippt);
		}
		// Gleiches Feld, gleicher Platz in der Kette, ein zweiter Satz: erst ob
		// überhaupt ein Tag gemeint ist, dann ob er in Reichweite liegt. Die Uhr
		// ist die des **Versands** und nicht die der load — zwischen Aufruf und
		// Absenden kann eine Nacht liegen, und dann ist das Fenster ein anderes.
		if (!istImFristfenster(terminAt, Math.floor(Date.now() / 1000))) {
			return abweisen(FRIST_AUSSERHALB, 'termin', getippt);
		}

		einzelaufgabeAusschreiben(geprueft.titel, terminAt);

		// Nach dem redirect läuft hier nichts mehr: redirect() wirft.
		redirect(303, '/?ausgeschrieben');
	},
} satisfies Actions;
