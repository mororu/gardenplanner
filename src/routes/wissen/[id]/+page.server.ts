import { error, redirect } from '@sveltejs/kit';
import type { Actions, RequestEvent, ServerLoadEvent } from '@sveltejs/kit';
import { AUFGABE_HOECHSTLAENGE } from '../../../lib/aufgabentext.ts';
import {
	BLATT_HOECHSTLAENGE,
	blattTextPruefen,
	blattTitelPruefen,
} from '../../../lib/blatttext.ts';
import { abweisen } from '../../../lib/server/abweisen.ts';
import { adminOderWeg } from '../../../lib/server/adminschranke.ts';
import {
	blattAendern,
	blattLesen,
	blattLoeschen,
	type Blatt,
} from '../../../lib/server/db/queries/sheets.ts';
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
 * **Seit dem 2026-09-20 ist der Zweig erreichbar, und der Absatz darüber
 * musste umgeschrieben werden.** Er sagte: „Der Zweig bleibt als defensiver und
 * nicht als erreichbarer stehen, es gibt keine Löschen-Aktion für Blätter, eine
 * Zeile kann nur durch direkten Datenbankzugriff verschwinden." Das stimmt
 * nicht mehr — `loeschen` darunter nimmt Blätter weg. Wer ein Blatt offen hat,
 * während eine Adminperson es löscht, und dann `Ablegen` drückt, bekommt genau
 * diesen Satz. Der Fall ist damit von gedacht zu möglich geworden.
 *
 * Ihn wegzunehmen hiesse, das Ändern eines fortgekommenen Blatts auf beiden
 * Wegen zum 404 zu machen; ihn zu härten hiesse, die `load` müsste den
 * Fehlschlag der action kennen. Beides steht weiterhin in deferred-work.md.
 */
const BLATT_NICHT_ANSPRECHBAR =
	'Dieses Blatt gibt es nicht mehr. Kopiere deinen Text und lege ihn neu an.';

/**
 * Derselbe Umstand am **Löschen**, und darum ein anderer Satz.
 *
 * `Kopiere deinen Text` wäre hier eine Aufforderung an jemanden, der nichts
 * getippt hat: wer löschen wollte, hat einen Knopf gedrückt und kein Formular
 * ausgefüllt. Was zu tun ist, ist ausserdem ein anderes — beim Ändern soll die
 * Arbeit gerettet werden, hier ist das Ziel schon erreicht, nur von jemand
 * anderem.
 */
const BLATT_SCHON_FORT = 'Dieses Blatt gibt es nicht mehr — jemand war schneller.';

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
export function load({ locals, params, url }: ServerLoadEvent): {
	blatt: Blatt;
	titelGrenze: number;
	textGrenze: number;
	angelegt: boolean;
	geaendert: boolean;
	istAdmin: boolean;
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
		/*
		 * **Nur dafür, ob der Löschen-Griff gemalt wird — und für nichts sonst.**
		 * Die Schranke selbst steht in der action (adminOderWeg); dieser Wert ist
		 * die Oberfläche dazu und nicht ihre Durchsetzung. Wer ihn im Browser auf
		 * true dreht, bekommt einen Knopf, der beim Drücken auf `/` weiterleitet.
		 *
		 * `locals.mitglied` ist hier nie null — der Wächter in src/hooks.server.ts
		 * hat vorher mit 403 abgewiesen. Der `?.`-Zugriff steht trotzdem, weil der
		 * Typ null zulässt und ein `!` diese Seite von einer Annahme über eine
		 * andere Datei abhängig machte.
		 */
		istAdmin: locals.mitglied?.isAdmin ?? false,
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

	/**
	 * Löscht das Blatt — **nur eine Adminperson, und in zwei Schritten**
	 * (Entscheid Manuel, 2026-09-20).
	 *
	 * **Die Schranke steht hier und nicht im Markup.** `data.istAdmin` entscheidet
	 * allein darüber, ob der Griff gemalt wird; durchgesetzt wird es von
	 * `adminOderWeg`, und ein POST braucht kein Formular. Dieselbe Trennung wie
	 * zwischen `maxlength` und einer Längengrenze — nur mit ungleich höherem
	 * Einsatz, denn hier verschwindet etwas.
	 *
	 * **`adminOderWeg` leitet weiter und wirft keine 403**, wie auf /verwaltung:
	 * für jemanden ohne Adminrechte soll das Löschen nicht existieren, nicht
	 * verboten sein. Eine Fehlerseite wäre die Auskunft, dass es hier etwas gibt.
	 *
	 * **Warum gefragt wird.** Es gibt keine Versionen und keinen Papierkorb; ein
	 * Blatt ist nach dem zweiten POST fort, und wer es zurückhaben will, schreibt
	 * es neu. Dieselbe Bauform wie das Abernten auf /ernte: ein POST ohne
	 * `bestaetigt` ändert nichts und fragt, erst der zweite schreibt. Ohne
	 * JavaScript ist die Antwort auf den ersten POST ein vollständiges Dokument
	 * mit der Frage.
	 *
	 * Die Frage trägt den Titel mit, obwohl er zwei Zeilen höher als Überschrift
	 * steht: sie wird gelesen, nachdem der Blick nach oben gesprungen ist.
	 *
	 * Weitergeleitet wird auf die **Liste** und nicht auf das Blatt — das gibt es
	 * nicht mehr, und ein `?geloescht` an seiner eigenen Adresse wäre ein 404 mit
	 * einer Erfolgsmeldung im Gepäck.
	 */
	loeschen: async ({ locals, params, request }: RequestEvent) => {
		// Zuerst die Schranke, vor jedem Lesen und vor jeder Deutung des Formulars:
		// wer nicht durchdarf, soll auch nicht erfahren, ob es die Kennung gibt.
		adminOderWeg(locals);

		const id = idLesen(params.id);
		if (id === null) error(404, { message: NICHT_GEFUNDEN });

		const formular = await request.formData();

		// Schritt 1: fragen. `has` und nicht ein Wertvergleich — das Feld ist eine
		// Marke, kein Wert.
		if (!formular.has('bestaetigt')) {
			const blatt = blattLesen(id);
			if (blatt === null) {
				return abweisen(BLATT_SCHON_FORT);
			}
			return { art: 'fragenLoeschen' as const, titel: blatt.titel };
		}

		// Schritt 2: schreiben. Wer das Wettrennen verliert, weil jemand anders in
		// der Zwischenzeit gelöscht hat, bekommt denselben Satz wie jemand mit
		// einer erfundenen Kennung.
		const weg = blattLoeschen(id);
		if (weg === null) {
			return abweisen(BLATT_SCHON_FORT);
		}

		// Nach dem redirect läuft hier nichts mehr: redirect() wirft.
		redirect(303, '/wissen?geloescht');
	},
} satisfies Actions;
