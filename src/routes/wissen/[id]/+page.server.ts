import { error, redirect } from '@sveltejs/kit';
import type { Actions, RequestEvent, ServerLoadEvent } from '@sveltejs/kit';
import { AUFGABE_HOECHSTLAENGE } from '../../../lib/aufgabentext.ts';
import {
	BLATT_HOECHSTLAENGE,
	blattTextPruefen,
	blattTitelPruefen,
} from '../../../lib/blatttext.ts';
import { abweisen } from '../../../lib/server/abweisen.ts';
import { blattAendern, blattLesen, type Blatt } from '../../../lib/server/db/queries/sheets.ts';
import { NICHT_GEFUNDEN } from '../../../lib/texte.ts';

/*
 * /wissen/[id] — ein Blatt, und das Formular, es zu ändern.
 *
 * Die einzige Route des Produkts mit einem **dynamischen Segment** ausser
 * /i/[token], und anders als jene ist sie eine Oberfläche und kein Durchgang.
 *
 * Die Importe stehen relativ und mit .ts-Endung, und die Typen kommen aus
 * @sveltejs/kit statt aus ./$types — derselbe Grund wie in der Nachbarroute:
 * scripts/smoke-zugang.ts lädt dieses Modul mit nacktem Node.
 *
 * **Keine eigene Zugangsschranke und keine zweite Stufe**, wie auf /wissen.
 * Lesen und Ändern darf jedes aktive Mitglied, die action liest `locals` gar
 * nicht, und es wird nirgends gespeichert, wer geändert hat. Wer ändert,
 * ändert für alle — es gibt keine Versionen, keinen Autor und keinen Verlauf
 * (siehe schema.ts).
 */

/**
 * Der Satz für ein Blatt, das es beim Ablegen nicht mehr gibt. Eine Wurfstelle.
 *
 * **Nicht** NICHT_GEFUNDEN, obwohl es dieselbe Lage beschreibt: jener Satz ist
 * die Fehlerseite und beendet den Weg. Hier hat die Person gerade getippt, und
 * ihre Eingabe soll im offenen Formular stehen bleiben. Dieselbe Unterscheidung
 * wie zwischen AUFGABE_NICHT_ANSPRECHBAR und der Fehlerseite auf `/`.
 *
 * **Mit JavaScript. Ohne JavaScript hält die Zusage nicht**, und das ist
 * gemessen und nicht vermutet — ein Befund des Reviews zu Story 4.1, belegt am
 * Quelltext von SvelteKit 2.70.3: nach einem `fail()` rendert der Server die
 * Seite, und dafür läuft die `load` darunter **erneut**. Sie findet die Zeile
 * nicht und wirft 404. Wer ohne JavaScript ein fortgekommenes Blatt ändern
 * will, bekommt darum die Fehlerseite und verliert seinen Text — genau das, was
 * dieser Zweig verhindern soll. Mit `use:enhance` greift die Antwort der action
 * im Browser, und der Satz erscheint wie gedacht.
 *
 * Der Zweig bleibt trotzdem stehen, und zwar als **defensiver** und nicht als
 * erreichbarer: es gibt keine Löschen-Aktion für Blätter, eine Zeile kann nur
 * durch direkten Datenbankzugriff verschwinden. Ihn wegzunehmen hiesse, das
 * Ändern eines fortgekommenen Blatts auf beiden Wegen zum 404 zu machen; ihn zu
 * härten hiesse, die `load` müsste den Fehlschlag der action kennen. Beides ist
 * mehr, als diese Story trägt, und steht in deferred-work.md.
 */
const BLATT_NICHT_ANSPRECHBAR =
	'Dieses Blatt gibt es nicht mehr. Kopiere deinen Text und lege ihn neu an.';

/**
 * Die Id aus dem Pfadsegment, oder null.
 *
 * Dieselbe Deutung wie `idLesen` auf `/` und `/verwaltung` — nur Ziffern, eine
 * sichere Ganzzahl, grösser als null. `/wissen/abc`, `/wissen/-1` und
 * `/wissen/1.5` fallen darum auf dasselbe null und damit auf denselben 404 wie
 * eine Kennung, die es nie gab.
 *
 * `unknown` und nicht `string`: das Typprüf-Programm der Skripte
 * (tsconfig.scripts.json) zieht bewusst kein DOM-lib, und dieses Modul liegt
 * über scripts/smoke-zugang.ts darin — dieselbe Begründung wie dort.
 */
function idLesen(roh: unknown): number | null {
	if (typeof roh !== 'string') return null;
	const gekuerzt = roh.trim();
	if (!/^[0-9]+$/.test(gekuerzt)) return null;
	const id = Number(gekuerzt);
	return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Das Blatt, die zwei Längengrenzen und ob gerade etwas angelegt oder geändert
 * wurde.
 *
 * **Eine unbekannte Kennung ist ein 404 und keine leere Seite.** `error(404,
 * { message })` und nie `throw new Error` in einer Routendatei; der Satz ist
 * derselbe, den die Navigationsleiste bis zu dieser Story für `/wissen` selbst
 * lieferte.
 *
 * `angelegt` und `geaendert` sind die Meldungen, die eine Weiterleitung
 * überlebt haben — derselbe Mechanismus wie `?abgelegt` und `?ausgeschrieben`
 * auf `/`. Zwei **eigene** Parameter und nicht einer mit einem Wert: es sind
 * zwei Verben, und ein gemeinsamer Parameter hiesse `Angelegt.` über etwas, das
 * niemand angelegt hat.
 *
 * Beide sind Wahrheitswerte ohne Zahl: es entsteht und ändert sich immer genau
 * ein Blatt, es gibt keinen Stapel.
 */
export function load({ params, url }: ServerLoadEvent): {
	blatt: Blatt;
	titelGrenze: number;
	textGrenze: number;
	angelegt: boolean;
	geaendert: boolean;
} {
	const id = idLesen(params.id);
	if (id === null) error(404, { message: NICHT_GEFUNDEN });

	const blatt = blattLesen(id);
	if (blatt === null) error(404, { message: NICHT_GEFUNDEN });

	return {
		blatt,
		titelGrenze: AUFGABE_HOECHSTLAENGE,
		textGrenze: BLATT_HOECHSTLAENGE,
		angelegt: url.searchParams.has('angelegt'),
		geaendert: url.searchParams.has('geaendert'),
	};
}

/*
 * Wie diese Seite abweist — dieselbe Verteilung wie auf /wissen: `feld` sagt,
 * an welches der zwei Felder die Meldung gehört, und **beide** Eingaben reisen
 * zurück, der Titel über `eingabe` und der Freitext über `zweiteEingabe`.
 *
 * Ein abgewiesener Versand ändert **nichts**: blattAendern wird auf diesem Weg
 * nie erreicht.
 */
export const actions = {
	/**
	 * Ändert das Blatt und leitet auf dasselbe Blatt zurück.
	 *
	 * **Die Id kommt aus dem Pfad und nicht aus dem Formular.** Ein verstecktes
	 * Feld daneben wäre eine zweite Wahrheit darüber, welches Blatt gemeint ist,
	 * und die zwei liefen auseinander, sobald jemand das Formular abschickt,
	 * nachdem die Adresse sich geändert hat. `params` ist die Adresse selbst.
	 *
	 * **Die Prüfreihenfolge folgt den Feldern**, wie beim Anlegen: erst der
	 * Titel, dann der Text.
	 *
	 * Weitergeleitet wird auf dasselbe Blatt mit `?geaendert`. Der Satz
	 * `Geändert.` ist das Verb des Knopfs im Perfekt, und die Person sieht den
	 * neuen Stand dort, wo sie ihn erwartet.
	 */
	aendern: async ({ params, request }: RequestEvent) => {
		const id = idLesen(params.id);
		if (id === null) error(404, { message: NICHT_GEFUNDEN });

		const formular = await request.formData();

		// Fehlendes Feld und Nicht-String fallen auf dieselbe leere Eingabe
		// zusammen — dieselbe Deutung wie in der Nachbarroute.
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

		/*
		 * Trifft das UPDATE keine Zeile, ist das Blatt zwischen dem Öffnen der
		 * Seite und dem Absenden fortgekommen. Ein Satz und kein 404: der Text
		 * steht im Formular und soll dort bleiben — mit JavaScript; die Grenze
		 * dieser Zusage steht an BLATT_NICHT_ANSPRECHBAR. `feld` ist null, die
		 * Meldung gehört an keines der zwei Felder, sondern über das Formular.
		 */
		if (!blattAendern(id, gepruefterTitel.titel, gepruefterText.text)) {
			return abweisen(BLATT_NICHT_ANSPRECHBAR, null, getippterTitel, null, getippterText);
		}

		// Nach dem redirect läuft hier nichts mehr: redirect() wirft.
		redirect(303, `/wissen/${id}?geaendert`);
	},
} satisfies Actions;
