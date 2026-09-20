import { redirect } from '@sveltejs/kit';
import type { Actions, RequestEvent, ServerLoadEvent } from '@sveltejs/kit';
import { AUFGABE_HOECHSTLAENGE } from '../../lib/aufgabentext.ts';
import { BLATT_HOECHSTLAENGE, blattTextPruefen, blattTitelPruefen } from '../../lib/blatttext.ts';
import { abweisen } from '../../lib/server/abweisen.ts';
import {
	DOKUMENT_DATEI_FEHLT,
	DOKUMENT_HOECHSTGROESSE,
	DOKUMENT_HOECHSTGROESSE_MB,
	DOKUMENT_KEIN_PDF,
	DOKUMENT_ZU_GROSS,
	PDF_TYP,
	dateinamenFalten,
	dokumentTitelPruefen,
	istPdfAnfang,
} from '../../lib/dokument.ts';
import { ablagenamenErzeugen, dateiAblegen } from '../../lib/server/ablage.ts';
import { SUCHE_HOECHSTLAENGE, suchbegriffFalten } from '../../lib/suche.ts';
import {
	blaetterLesen,
	blaetterSuchen,
	blattAnlegen,
	type Blattfund,
} from '../../lib/server/db/queries/sheets.ts';
import {
	dokumentAnlegen,
	dokumenteLesen,
	dokumenteSuchen,
	type Dokumentzeile,
} from '../../lib/server/db/queries/documents.ts';

/*
 * /wissen — die Blätter, alphabetisch, und das Formular für ein neues.
 *
 * Die Importe stehen relativ und mit .ts-Endung, und die Typen kommen aus
 * @sveltejs/kit statt aus ./$types. Der Grund ist derselbe wie in den
 * Nachbarrouten und geprüft, nicht vermutet: scripts/smoke-zugang.ts lädt
 * dieses Modul mit nacktem Node, und tsconfig.scripts.json kennt weder das
 * virtuelle ./$types noch die $lib-Zuordnung.
 *
 * **Keine eigene Zugangsschranke und keine zweite Stufe.** Der Wächter in
 * src/hooks.server.ts hat einen Aufruf ohne gültige Sitzung schon mit 403
 * abgewiesen, und lesen wie schreiben darf jedes aktive Mitglied. Die action
 * liest `locals` gar nicht, und das ist die Aussage der Story: ein Blatt gehört
 * der Gemeinschaft, nicht der Person, die es getippt hat. Wer anlegt, wird
 * nirgends gespeichert — es gibt keine Autorenspalte (siehe schema.ts).
 *
 * Die Mutation ist eine form action mit use:enhance (AD-9). Kein +server.ts,
 * kein JSON-Endpunkt, und im Markup ein **literales** action="?/anlegen" — ein
 * dynamisches action={…} würde Gate-Regel 11 blind machen.
 *
 * **Diese Seite hat kein Ändern und kein Löschen.** Beides sitzt am Blatt
 * selbst, auf /wissen/[id], wo der Text ohnehin schon steht; ein zweiter
 * Änderungsweg von der Liste aus hiesse, den ganzen Freitext jedes Blatts ins
 * ausgelieferte HTML der Liste zu legen — und ein Löschen-Knopf an einer
 * Listenzeile löschte etwas, dessen Inhalt man gerade nicht sieht.
 *
 * **Der zweite Halbsatz hat bis zum 2026-09-20 etwas anderes behauptet** und
 * ist richtiggestellt: „Gelöscht wird gar nicht — das ist keine Auslassung
 * dieser Story, sondern ihr Umfang." Das stimmte, solange es kein Löschen gab.
 * Seit dem Entscheid Manuels an jenem Tag gibt es eines, auf /wissen/[id] und
 * nur für Adminpersonen; die Begründung für die Schranke steht an
 * blattLoeschen in ../../lib/server/db/queries/sheets.ts.
 *
 * Was von dieser Seite aus **landet**, ist seither die Meldung darüber: das
 * Löschen leitet auf `/wissen?geloescht` weiter, weil das Blatt, auf dem es
 * sonst melden würde, gerade verschwunden ist.
 */

/*
 * Die vier Sätze zu Titel und Text stehen **nicht** hier, sondern in
 * ../../lib/blatttext.ts: sie haben zwei Wurfstellen — diese action und
 * `aendern` auf /wissen/[id] —, und zwei Routen, die je selbst deuteten, wären
 * die Drift, gegen die das geteilte Modul steht. Dieselbe Bauform wie
 * NAME_FEHLT in ../../lib/mitgliedsname.ts.
 */

/**
 * Die Liste und die zwei Längengrenzen.
 *
 * Sie nimmt **kein Ereignis** entgegen, und das ist die Aussage: sie liest
 * weder locals noch cookies noch die Adresse. Alle sehen dieselbe Liste — es
 * gibt keine persönliche Sicht auf Wissen, und darum auch kein Gegenstück zum
 * personenbezogenen Diensthinweis auf `/`.
 *
 * **Kein `?angelegt` in dieser load.** Nach dem Anlegen leitet die action auf
 * das frische Blatt weiter und nicht auf die Liste: wer gerade etwas
 * aufgeschrieben hat, will es dastehen sehen. Der Satz `Angelegt.` steht darum
 * auf /wissen/[id].
 *
 * Die zwei Grenzen reisen mit, statt im Markup als Literal zu stehen —
 * dieselbe Bauform wie `titelGrenze` auf /einzelaufgabe und `namensgrenze` auf
 * /verwaltung, und derselbe Grund: ein `maxlength="200"` neben einem Server,
 * der aus der Konstante prüft, sind zwei Zahlen über eine Regel.
 */
export function load({ url }: ServerLoadEvent): {
	blaetter: Blattfund[];
	dokumente: Dokumentzeile[];
	suche: string;
	suchgrenze: number;
	titelGrenze: number;
	textGrenze: number;
	dateigrenzeMb: number;
	geloescht: boolean;
} {
	/*
	 * **Die Suche steht in der Adresse, seit dem 2026-09-20** (Entscheid
	 * Manuel).
	 *
	 * Sie läuft auf dem Server und nicht im Browser — anders als die auf
	 * /archiv, und der Unterschied liegt in den Daten: dort sind die Zeilen
	 * ohnehin alle geladen, hier ist der Freitext eines Blatts ausdrücklich
	 * **nicht** geladen. Die ganze Rechnung steht am Kopf von ../../lib/suche.ts.
	 *
	 * **Ein Parameter in der Adresse und kein Zustand im Browser**, und das
	 * bringt dreierlei mit: die Suche trägt ohne JavaScript, sie ist teilbar, und
	 * der Zurück-Knopf führt zur ungefilterten Liste statt aus der Seite heraus.
	 *
	 * Der gefaltete Begriff reist zurück an das Feld: er ist das, wonach wirklich
	 * gesucht wurde. Stünde dort die rohe Eingabe, zeigte das Feld `  Kohl  `,
	 * während die Liste die Treffer zu `Kohl` führt — ein kleiner Unterschied,
	 * der beim Nachbessern des Begriffs zu einem verwirrenden wird.
	 */
	const suche = suchbegriffFalten(url.searchParams.get('suche') ?? '');
	const sucht = suche !== '';

	return {
		/*
		 * **Zwei Wege in dieselbe Liste**, und die Verzweigung steht hier und nicht
		 * in der Abfrage: ein `blaetterSuchen('')`, das dann doch alles liefert,
		 * wäre eine Funktion mit zwei Bedeutungen — und die zweite fiele niemandem
		 * auf, der nur ihren Namen liest.
		 *
		 * Ohne Suche trägt keine Zeile eine Fundstelle. Der Typ `Blattfund`
		 * schreibt sie trotzdem vor, und `blaetterLesen` liefert sie nicht — darum
		 * die Ergänzung hier. Ein optionales Feld stattdessen hiesse, dass die
		 * Komponente an jeder Zeile fragen müsste, ob es das Feld gibt.
		 */
		blaetter: sucht
			? blaetterSuchen(suche)
			: blaetterLesen().map((blatt) => ({ ...blatt, fundstelle: null })),
		/*
		 * **Die zweite Art auf dieser Seite, seit dem 2026-09-20** (Entscheid
		 * Manuel: gleichberechtigt neben den Blättern).
		 *
		 * Zwei Abfragen und keine, die beide zusammenführte: die zwei Arten haben
		 * getrennte Tabellen ohne Basistabelle (siehe documents in
		 * ../../lib/server/db/schema.ts), und eine Abfrage über beide ebnete
		 * genau den Unterschied ein, den das Schema zeigen soll. Zusammengeführt
		 * wird in der Komponente und nur für die Anzeige — dieselbe Bauform wie
		 * auf /archiv, wo abgehakte Aufgaben und abgeschlossene Termine in einer
		 * Liste stehen.
		 */
		dokumente: sucht ? dokumenteSuchen(suche) : dokumenteLesen(),
		/*
		 * Der Begriff reist mit, damit das Feld ihn zeigt und die Sätze ihn nennen
		 * können — `Nichts gefunden zu „Kohl"` sagt mehr als `Nichts gefunden`,
		 * besonders nach einem Tippfehler.
		 */
		suche,
		/*
		 * Die Grenze am Feld, wie die drei anderen Grenzen dieser Seite und aus
		 * demselben Grund: ein `maxlength` im Markup neben einem Server, der aus
		 * der Konstante schneidet, wären zwei Zahlen über eine Regel.
		 */
		suchgrenze: SUCHE_HOECHSTLAENGE,
		titelGrenze: AUFGABE_HOECHSTLAENGE,
		textGrenze: BLATT_HOECHSTLAENGE,
		/*
		 * Die Dateigrenze reist als **Megabyte-Zahl** mit und nicht als Bytes:
		 * sie steht am Feld in einem Satz, den ein Mensch liest. Dieselbe Bauform
		 * wie die zwei Längengrenzen darüber und derselbe Grund — eine Zahl im
		 * Markup neben einem Server, der aus der Konstante prüft, sind zwei
		 * Zahlen über eine Regel.
		 */
		dateigrenzeMb: DOKUMENT_HOECHSTGROESSE_MB,
		/*
		 * **Die einzige Rückmeldung, die auf dieser Seite landet** — seit dem
		 * 2026-09-20 und dem Löschen auf /wissen/[id].
		 *
		 * Bisher hatte die Liste keine: das Anlegen leitet auf das frische Blatt
		 * weiter, und der Erfolgssatz steht dort. Das Löschen kann das nicht — die
		 * Seite, auf die es weiterleiten müsste, ist gerade verschwunden.
		 *
		 * Ein Wahrheitswert ohne Titel, und das ist bedacht: der Titel stünde in
		 * der Adresszeile, wäre bis zu zweihundert Zeichen lang und bliebe dort
		 * stehen, bis jemand die Seite verlässt. Was die Person wissen muss, ist,
		 * **dass** es geklappt hat — was gelöscht wurde, hat sie eine Sekunde
		 * zuvor in der Rückfrage gelesen.
		 */
		geloescht: url.searchParams.has('geloescht'),
	};
}

/*
 * Wie diese Seite abweist — die Funktion selbst steht in
 * ../../lib/server/abweisen.ts und ist für alle Seiten dieselbe.
 *
 * `feld` benennt, wohin die Meldung gehört: diese Seite hat zwei Felder, und
 * eine Meldung über den Freitext gehört an das Textfeld, nicht an den Titel.
 *
 * **Beide Eingaben reisen zurück, aus jeder Abweisung** — der Titel über
 * `eingabe`, der Freitext über `zweiteEingabe`. Das ist der Anlass, aus dem der
 * zweite Rückweg entstanden ist: ein Blatt-Freitext kann achttausend Zeichen
 * tragen, und ihn wegen eines leeren Titels zu verlieren wäre der teuerste
 * Fehlschlag dieser Seite. Ohne JavaScript wird die Seite neu gerendert, und
 * was nicht zurückreist, ist fort.
 *
 * Ein abgewiesener Versand legt **nichts** an: blattAnlegen wird auf diesem Weg
 * nie erreicht.
 */
export const actions = {
	/**
	 * Legt ein Blatt an und leitet auf **das Blatt** weiter.
	 *
	 * **Die Reihenfolge der Prüfungen folgt den Feldern**, von oben nach unten:
	 * erst der Titel, dann der Text. Dieselbe Ordnung wie auf /einzelaufgabe und
	 * aus demselben Grund — zwei gleichrangige Felder stehen nebeneinander, und
	 * wer eines übersieht, soll den Satz an der Stelle finden, an der sein Auge
	 * ohnehin steht.
	 *
	 * Weitergeleitet wird auf `/wissen/<id>?angelegt` und nicht auf die Liste.
	 * Das ist die Ausnahme zur Regel „Formularseiten leiten auf die Liste
	 * zurück", und sie hat einen Grund: die Liste zeigt nur Titel, und wer
	 * gerade zwei Absätze getippt hat, sähe dort nichts als eine Zeile mehr. Der
	 * Satz `Angelegt.` — das Verb des Knopfs im Perfekt — steht auf der
	 * Zielseite.
	 *
	 * 303 und nicht 302: nach einem POST ist die Folgeanfrage ausdrücklich ein
	 * GET.
	 */
	anlegen: async ({ request }: RequestEvent) => {
		const formular = await request.formData();

		// Ein fehlendes Feld und ein Nicht-String (ein Datei-Upload) fallen auf
		// dieselbe leere Eingabe zusammen — und damit auf denselben Satz wie ein
		// leeres Feld. Jede Unterscheidung wäre eine Auskunft ohne Handlung.
		const rohTitel = formular.get('titel');
		const getippterTitel = typeof rohTitel === 'string' ? rohTitel : '';
		const rohText = formular.get('text');
		const getippterText = typeof rohText === 'string' ? rohText : '';

		const gepruefterTitel = blattTitelPruefen(getippterTitel);
		if ('fehler' in gepruefterTitel) {
			return abweisen(gepruefterTitel.fehler, 'titel', getippterTitel, null, getippterText);
		}

		const gepruefterText = blattTextPruefen(getippterText);
		if ('fehler' in gepruefterText) {
			return abweisen(gepruefterText.fehler, 'text', getippterTitel, null, getippterText);
		}

		const id = blattAnlegen(gepruefterTitel.titel, gepruefterText.text);

		// Nach dem redirect läuft hier nichts mehr: redirect() wirft.
		redirect(303, `/wissen/${id}?angelegt`);
	},

	/**
	 * Legt ein PDF ab und leitet auf **das Dokument** weiter.
	 *
	 * **Die eigenen Feldnamen `dokumenttitel` und `datei`** und nicht `titel`
	 * und `text`: die Seite trägt zwei Formulare, und `feld` in der Abweisung
	 * entscheidet, welches davon aufklappt und wo der Satz steht. Zwei
	 * Formulare mit einem Feld namens `titel` hiessen, dass eine Abweisung des
	 * einen den Satz am anderen zeigt.
	 *
	 * **Vier Prüfungen in dieser Reihenfolge**, und die Reihenfolge ist keine
	 * Geschmacksfrage:
	 *
	 *   1. **Der Titel**, weil er oben steht — dieselbe Ordnung wie überall,
	 *      der Satz soll da sein, wo das Auge ohnehin ist.
	 *   2. **Ist überhaupt eine Datei da**, und ist sie nicht leer. Eine leere
	 *      Datei fällt auf denselben Satz wie gar keine: beide Male hat die
	 *      Person nichts gewählt, was sich ablegen liesse.
	 *   3. **Die Grösse**, und zwar **vor** dem Lesen. `File.size` steht ohne
	 *      Zugriff auf den Inhalt fest, und ein 200-MB-Rumpf soll nicht erst
	 *      vollständig in den Arbeitsspeicher wandern, um dann abgewiesen zu
	 *      werden.
	 *   4. **Der Typ, und dann der Inhalt.** Der gemeldete Medientyp kommt aus
	 *      der Endung des Dateinamens und ist eine Behauptung der Gegenseite;
	 *      die ersten fünf Bytes sind es nicht. Beide fallen auf denselben
	 *      Satz — die Unterscheidung wäre eine Auskunft über die Prüfung und
	 *      keine über die Handlung, die hilft.
	 *
	 * **Zuerst die Datei, dann die Zeile.** Die Begründung steht an
	 * `documents.ablage` im Schema: bricht es dazwischen ab, bleibt eine Datei
	 * ohne Zeile liegen — unerreichbar, aber harmlos. Andersherum stünde in der
	 * Liste ein Dokument, das beim Antippen nicht da ist.
	 *
	 * **Der Titel reist bei jeder Abweisung zurück, die Datei nicht.** Das ist
	 * keine Nachlässigkeit, sondern eine Eigenschaft des Browsers: ein
	 * Dateifeld lässt sich aus Sicherheitsgründen von keiner Seite vorbelegen.
	 * Wer abgewiesen wird, wählt die Datei erneut — und liest daneben den
	 * getippten Titel, damit wenigstens der nicht verloren ist.
	 */
	hochladen: async ({ request }: RequestEvent) => {
		const formular = await request.formData();

		const rohTitel = formular.get('dokumenttitel');
		const getippterTitel = typeof rohTitel === 'string' ? rohTitel : '';

		const gepruefterTitel = dokumentTitelPruefen(getippterTitel);
		if ('fehler' in gepruefterTitel) {
			return abweisen(gepruefterTitel.fehler, 'dokumenttitel', getippterTitel);
		}

		/*
		 * `instanceof File` und nicht `typeof !== 'string'`: ein fehlendes Feld
		 * gibt null, ein leer abgeschicktes Dateifeld gibt in manchen Browsern
		 * eine File mit dem Namen `""` und der Grösse 0. Beide Fälle laufen über
		 * die eine Bedingung darunter in denselben Satz.
		 */
		const rohDatei = formular.get('datei');
		if (!(rohDatei instanceof File) || rohDatei.size === 0) {
			return abweisen(DOKUMENT_DATEI_FEHLT, 'datei', getippterTitel);
		}

		if (rohDatei.size > DOKUMENT_HOECHSTGROESSE) {
			return abweisen(DOKUMENT_ZU_GROSS, 'datei', getippterTitel);
		}

		if (rohDatei.type !== PDF_TYP) {
			return abweisen(DOKUMENT_KEIN_PDF, 'datei', getippterTitel);
		}

		const inhalt = new Uint8Array(await rohDatei.arrayBuffer());
		if (!istPdfAnfang(inhalt)) {
			return abweisen(DOKUMENT_KEIN_PDF, 'datei', getippterTitel);
		}

		const ablagename = ablagenamenErzeugen();
		dateiAblegen(ablagename, inhalt);
		const id = dokumentAnlegen(
			gepruefterTitel.titel,
			dateinamenFalten(rohDatei.name),
			ablagename,
			inhalt.byteLength
		);

		// Nach dem redirect läuft hier nichts mehr: redirect() wirft.
		redirect(303, `/wissen/dokument/${id}?angelegt`);
	},
} satisfies Actions;
