import { redirect } from '@sveltejs/kit';
import type { Actions, RequestEvent, ServerLoadEvent } from '@sveltejs/kit';
import { abweisen } from '../../lib/server/abweisen.ts';
import { protokollAblegen, traktandenlisteAblegen } from '../../lib/server/protokollablage.ts';
import {
	protokolleLesen,
	protokollVermerken,
	traktandenAbraeumen,
	traktandenLesen,
	traktandenlistenLesen,
	traktandenlisteVermerken,
	traktandumAendern,
	traktandumErfassen,
	type Protokoll,
	type Traktandenliste,
	type Traktandum,
} from '../../lib/server/db/queries/meetings.ts';
import {
	PROTOKOLL_FEHLT,
	PROTOKOLL_HOECHSTGROESSE,
	PROTOKOLL_KEIN_PDF,
	PROTOKOLL_ZU_GROSS,
	SITZUNGSDATUM_FEHLT,
	TRAKTANDEN_LEER,
	TRAKTANDUM_HOECHSTLAENGE,
	TRAKTANDUM_NICHT_ANSPRECHBAR,
	istPdf,
	traktandenlisteSchreiben,
	traktandumPruefen,
} from '../../lib/sitzung.ts';
import { FRIST_AUSSERHALB } from '../../lib/texte.ts';
import { fristfenster, istImFristfenster, tagesendeInUnixSekunden } from '../../lib/zeit.ts';

/*
 * /sitzungen — Traktanden für die nächste Sitzung, und die Protokolle der
 * vergangenen.
 *
 * Die Importe stehen relativ und mit .ts-Endung, und die Typen kommen aus
 * @sveltejs/kit statt aus ./$types. Der Grund ist derselbe wie in den
 * Nachbarrouten und geprüft, nicht vermutet: scripts/smoke-zugang.ts lädt
 * dieses Modul mit nacktem Node, und tsconfig.scripts.json kennt weder das
 * virtuelle ./$types noch die $lib-Zuordnung.
 *
 * **Zwei Handlungen auf einer Seite, und das ist die Entscheidung.** Sie hätten
 * zwei Routen sein können — `/traktanden` und `/protokolle` —, und sie sind es
 * nicht: beide drehen sich um dieselbe Sache, die Sitzung, und wer eine
 * vorbereitet, schreibt Traktanden auf **und** schlägt nach, was letztes Mal
 * beschlossen wurde. Zwei Ziele dafür wären zwei Wege zu einem Gedanken.
 *
 * Der Preis ist die Länge dieser Datei und zwei Aufklapper untereinander auf
 * der Seite. Die Auslösebedingung für eine Trennung ist ausgeschrieben: sobald
 * eine der beiden Listen von sich aus gescrollt werden muss.
 *
 * **Keine Adminschranke und keine zweite Stufe.** Der Wächter in
 * src/hooks.server.ts hat einen Aufruf ohne gültige Sitzung schon mit 403
 * abgewiesen; danach darf jedes aktive Mitglied ein Traktandum aufschreiben und
 * ein Protokoll ablegen (Entscheid Manuel, 2026-09-17). Was es **nicht** gibt,
 * ist eine Löschen-Aktion — weder für ein Traktandum noch für ein Protokoll.
 * Dieselbe Haltung wie im Archiv: was abgelegt ist, bleibt. Ein Fehlgriff wird
 * dadurch teuer, und das ist der angenommene Preis dafür, dass niemand die
 * Vorgeschichte einer Sitzung stillschweigend umschreiben kann.
 *
 * Die Mutationen sind form actions mit use:enhance (AD-9), im Markup mit
 * literalem action="?/name" — ein dynamisches action={…} würde Gate-Regel 11
 * blind machen.
 */

export function load({ locals, url }: ServerLoadEvent): {
	traktanden: Traktandum[];
	traktandenlisten: Traktandenliste[];
	protokolle: Protokoll[];
	traktandumgrenze: number;
	frueheste: string;
	spaeteste: string;
	abgelegt: boolean;
} {
	// Unerreichbar: der Wächter in src/hooks.server.ts hat einen Aufruf ohne
	// gültige Sitzung schon mit 403 abgewiesen. Die Prüfung steht hier, weil der
	// Typ null zulässt — und ein `!` machte diese Seite von einer Annahme über
	// eine andere Datei abhängig.
	if (locals.mitglied === null) {
		redirect(303, '/');
	}

	/*
	 * Das Fenster für beide Datumsfelder, aus derselben Rechnung wie auf
	 * /einzelaufgabe und /monatsplan. Ein Jahr in jede Richtung — **auch
	 * rückwärts**, und das ist hier der wichtigere Teil: ein Protokoll wird
	 * nachgetragen, sein Datum liegt in der Vergangenheit.
	 *
	 * Es entsteht serverseitig und nicht in der Komponente: ein `Date.now()` dort
	 * liefe einmal beim Rendern und einmal beim Hydrieren, und Svelte meldete
	 * einen Hydrierungsunterschied. Dieselbe Begründung wie bei der Vorgabe von
	 * `Fällig bis` auf /monatsplan.
	 */
	const { frueheste, spaeteste } = fristfenster(Math.floor(Date.now() / 1000));

	return {
		traktanden: traktandenLesen(),
		/*
		 * Die gezogenen Listen. Sie stehen neben den Protokollen und nicht bei den
		 * Traktanden: beides sind abgelegte Dateien, die man nachschlägt, und die
		 * Sammlung darüber ist das, woran gerade gearbeitet wird.
		 */
		traktandenlisten: traktandenlistenLesen(),
		protokolle: protokolleLesen(),
		/*
		 * Die Längengrenze reist mit, statt im Markup als Literal zu stehen —
		 * dieselbe Bauform wie auf /einzelaufgabe und /verwaltung. Ein
		 * `maxlength="200"` neben einem Server, der aus TRAKTANDUM_HOECHSTLAENGE
		 * prüft, wären zwei Zahlen über eine Regel.
		 */
		traktandumgrenze: TRAKTANDUM_HOECHSTLAENGE,
		frueheste,
		spaeteste,
		/*
		 * Die Meldung, die eine Weiterleitung überlebt hat. Ein redirect() aus
		 * einer form action verwirft deren Rückgabewert; das Ablegen eines
		 * Protokolls leitet darum mit `?abgelegt` auf diese Seite zurück.
		 *
		 * Ohne Wert und ohne Deutung: der Parameter ist da oder nicht. Anders als
		 * `?abgelegt` auf `/`, das eine Zahl trägt — hier wird immer genau eine
		 * Datei abgelegt.
		 */
		abgelegt: url.searchParams.has('abgelegt'),
	};
}

/**
 * Liest eine Zahl aus dem Formular, oder null.
 *
 * Die sechste bewusste Kopie von `idLesen`/`zahlLesen` (siehe ../verwaltung,
 * ../+page.server.ts, ../einzelaufgabe, ../traenkeplan und ../ernte). Die
 * Verdopplung bleibt billiger als eine gemeinsame Stelle: fünf Zeilen ohne
 * Domänenwissen, und ein geteiltes Modul dafür hiesse, dass eine Änderung an
 * der einen Seite still die anderen trifft.
 */
function zahlLesen(roh: unknown): number | null {
	// `unknown` und nicht FormDataEntryValue: das Typprüf-Programm der Skripte
	// (tsconfig.scripts.json) zieht bewusst kein DOM-lib, und dieses Modul liegt
	// in seinem Programm.
	if (typeof roh !== 'string' || !/^[0-9]+$/.test(roh)) return null;
	const zahl = Number(roh);
	return Number.isSafeInteger(zahl) && zahl > 0 ? zahl : null;
}

/**
 * Liest das Sitzungsdatum aus dem Formular, oder null.
 *
 * Fehlend, leer, keine Form JJJJ-MM-TT und ein unmögliches Datum wie 2026-02-31
 * fallen auf dasselbe null zusammen — und damit auf denselben Satz. Dieselbe
 * Auslegung wie auf /einzelaufgabe und /monatsplan, und die Umrechnung ist
 * dieselbe Funktion: das Datum steht als **Tagesende** in der Spalte.
 */
function sitzungsdatumLesen(roh: unknown): number | null {
	return tagesendeInUnixSekunden(typeof roh === 'string' ? roh : '');
}

export const actions = {
	/**
	 * Schreibt ein Traktandum für eine Sitzung auf.
	 *
	 * **Die Reihenfolge der Prüfungen folgt den Feldern**, von oben nach unten:
	 * erst der Text, dann das Datum. Dieselbe Ordnung wie auf /einzelaufgabe, und
	 * aus demselben Grund: wer abgewiesen wird, soll die Meldung dort finden, wo
	 * sein Blick ohnehin zuerst hinfällt.
	 *
	 * Der getippte Text reist über `eingabe` zurück — ohne JavaScript ist das der
	 * einzige Weg, auf dem er einen abgewiesenen Versand übersteht. Das Datum
	 * braucht keinen zweiten Platz: es ist ein `<input type="date">` mit `min`,
	 * `max` und `required`, und der Browser prüft es selbst.
	 */
	aufschreiben: async ({ locals, request }: RequestEvent) => {
		const mitglied = locals.mitglied;
		if (mitglied === null) {
			redirect(303, '/');
		}

		const formular = await request.formData();
		const rohText = formular.get('text');
		const getippt = typeof rohText === 'string' ? rohText : '';

		const geprueft = traktandumPruefen(getippt);
		if ('fehler' in geprueft) {
			return abweisen(geprueft.fehler, 'text', getippt);
		}

		traktandumErfassen({ text: geprueft.text, memberId: mitglied.id });

		return { art: 'erfasst' as const, meldung: 'Aufgeschrieben.', text: geprueft.text };
	},

	/**
	 * Ergänzt ein Traktandum.
	 *
	 * **Ohne Schranke auf die schreibende Person** (Entscheid Manuel,
	 * 2026-09-17): wer merkt, dass ein Punkt unvollständig ist, zieht ihn gerade,
	 * ohne die aufschreibende Person zu suchen. Dieselbe Haltung wie beim
	 * Umstufen einer Erntezeile, und der Unterschied zum Abschliessen eines
	 * Termins, wo `member_id` in der where-Klausel steht.
	 *
	 * Die Kennung fällt auf denselben Satz wie eine Zeile, die es nicht mehr
	 * gibt: die Unterscheidung wäre eine Auskunft darüber, welche Kennungen es
	 * gibt.
	 */
	aendern: async ({ locals, request }: RequestEvent) => {
		if (locals.mitglied === null) {
			redirect(303, '/');
		}

		const formular = await request.formData();
		const id = zahlLesen(formular.get('traktandumId'));
		const rohText = formular.get('text');
		const getippt = typeof rohText === 'string' ? rohText : '';

		const geprueft = traktandumPruefen(getippt);
		if ('fehler' in geprueft) {
			return abweisen(geprueft.fehler, 'text', getippt, id);
		}
		if (id === null || !traktandumAendern(id, geprueft.text)) {
			return abweisen(TRAKTANDUM_NICHT_ANSPRECHBAR, null, getippt, id);
		}

		return { art: 'erfasst' as const, meldung: 'Geändert.', text: geprueft.text };
	},

	/**
	 * Zieht die Traktandenliste: schreibt sie in die Ablage und räumt die
	 * Sammlung leer.
	 *
	 * **Drei Schritte in dieser Reihenfolge, und die Reihenfolge ist die ganze
	 * Zusage**: erst die Datei, dann die Zeile, dann das Abräumen. Bricht es nach
	 * dem ersten ab, liegt eine Datei ohne Zeile in der Ablage — unsichtbar, und
	 * sie schadet nicht; die Sammlung steht noch. Bricht es nach dem zweiten ab,
	 * steht die Liste da und die Punkte auch — doppelt, aber nichts ist fort. Die
	 * umgekehrte Reihenfolge hätte einen Zustand, in dem beides weg ist, und
	 * genau den darf es nicht geben. Dieselbe Abwägung wie beim Ablegen eines
	 * Protokolls, mit einem Schritt mehr.
	 *
	 * **Kein Bestätigungsdialog**, anders als beim Abernten — und das ist kein
	 * Versehen. Abernten löscht eine Auskunft, die es nur einmal gibt; hier
	 * wandert der Inhalt in eine Datei, die danebensteht und bleibt. Was diese
	 * Handlung kostet, wenn sie versehentlich läuft, ist eine Liste zu viel in
	 * der Ablage.
	 */
	ziehen: async ({ locals }: RequestEvent) => {
		const mitglied = locals.mitglied;
		if (mitglied === null) {
			redirect(303, '/');
		}

		const punkte = traktandenLesen();
		if (punkte.length === 0) {
			return abweisen(TRAKTANDEN_LEER, null);
		}

		const text = traktandenlisteSchreiben(punkte, Math.floor(Date.now() / 1000));
		const datei = traktandenlisteAblegen(text);
		traktandenlisteVermerken({ datei, memberId: mitglied.id });
		const abgeraeumt = traktandenAbraeumen();

		return {
			art: 'erfasst' as const,
			// Die Zahl kommt aus dem Abräumen und nicht aus `punkte.length`: sie sagt,
			// was wirklich verschwunden ist.
			meldung:
				abgeraeumt === 1 ? 'Liste gezogen, 1 Punkt.' : `Liste gezogen, ${abgeraeumt} Punkte.`,
			text: '',
		};
	},

	/**
	 * Legt ein Protokoll als PDF ab.
	 *
	 * **Die Prüfungen stehen in der Reihenfolge, in der sie billig sind**, und
	 * das ist hier nicht dasselbe wie die Reihenfolge der Felder: erst das Datum
	 * (ein String), dann die Grösse (eine Zahl am Objekt), erst danach die Bytes.
	 * `arrayBuffer()` zieht die ganze Datei in den Speicher — bei einer Datei
	 * jenseits der Grenze wäre das genau die Arbeit, die die Grenze verhindern
	 * soll.
	 *
	 * **Die Datei wird geschrieben, bevor die Zeile entsteht.** Bricht der
	 * zweite Schritt ab, liegt eine Datei ohne Zeile in der Ablage: unsichtbar,
	 * und sie schadet nicht. Umgekehrt stünde eine Zeile ohne Datei in der
	 * Liste — ein Verweis, der ins Leere führt. Von zwei unvollständigen
	 * Zuständen ist der stille der richtige.
	 */
	ablegen: async ({ locals, request }: RequestEvent) => {
		const mitglied = locals.mitglied;
		if (mitglied === null) {
			redirect(303, '/');
		}

		const formular = await request.formData();

		const sitzungAm = sitzungsdatumLesen(formular.get('sitzungAm'));
		if (sitzungAm === null) {
			return abweisen(SITZUNGSDATUM_FEHLT, 'protokollDatum');
		}
		if (!istImFristfenster(sitzungAm, Math.floor(Date.now() / 1000))) {
			return abweisen(FRIST_AUSSERHALB, 'protokollDatum');
		}

		/*
		 * `instanceof File` und keine Prüfung auf einzelne Eigenschaften: ein
		 * leeres Dateifeld kommt als File mit Grösse 0 an, ein fehlendes als null,
		 * und ein Textfeld unter demselben Namen als String. Alle drei fallen auf
		 * denselben Satz — was fehlt, ist die Datei.
		 */
		const datei = formular.get('datei');
		if (!(datei instanceof File) || datei.size === 0) {
			return abweisen(PROTOKOLL_FEHLT, 'datei');
		}
		if (datei.size > PROTOKOLL_HOECHSTGROESSE) {
			return abweisen(PROTOKOLL_ZU_GROSS, 'datei');
		}

		const bytes = new Uint8Array(await datei.arrayBuffer());
		if (!istPdf(bytes)) {
			return abweisen(PROTOKOLL_KEIN_PDF, 'datei');
		}

		const name = protokollAblegen(bytes);
		protokollVermerken({ sitzungAm, datei: name, memberId: mitglied.id });

		/*
		 * **Weiterleiten und nicht zurückgeben**, anders als beim Traktandum
		 * daneben. Ein Dateifeld lässt sich nicht aus JavaScript zurücksetzen und
		 * behielte nach einem Rückgabewert die eben abgelegte Datei — der nächste
		 * Griff auf `Ablegen` legte sie ein zweites Mal ab. Ein GET dazwischen
		 * räumt das Formular ab, und `?abgelegt` trägt die Bestätigung hinüber.
		 */
		redirect(303, '/sitzungen?abgelegt');
	},
} satisfies Actions;
