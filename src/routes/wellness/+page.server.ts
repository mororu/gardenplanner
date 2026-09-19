import { redirect } from '@sveltejs/kit';
import type { Actions, RequestEvent, ServerLoadEvent } from '@sveltejs/kit';
import { ortPruefen } from '../../lib/ernte.ts';
import { abweisen } from '../../lib/server/abweisen.ts';
import {
	behandlungEintragen,
	behandlungLesen,
	behandlungWegnehmen,
	behandlungenLesen,
	type Behandlungszeile,
} from '../../lib/server/db/queries/treatments.ts';
import { BEHANDLUNG_NICHT_ANSPRECHBAR } from '../../lib/texte.ts';
import {
	DATUM_AUSSERHALB,
	DATUM_UNGUELTIG,
	intervallPruefen,
	mittelPruefen,
} from '../../lib/wellness.ts';
import {
	heuteAlsFeldwert,
	istInRueckschau,
	rueckschaufenster,
	tagesendeInUnixSekunden,
} from '../../lib/zeit.ts';

/*
 * /wellness — womit die Pflanzen gestärkt wurden. Ein Tagebuch, kein Stand.
 *
 * **Warum die Route `/wellness` heisst und die Seite `Wellnessbehandlung`.**
 * Jede andere Route dieses Produkts trägt genau das Wort ihrer Überschrift, und
 * dies ist die Ausnahme: `/wellnessbehandlung` sind siebzehn Zeichen in einer
 * Adresszeile, die auf einem Telefon ohnehin abgeschnitten wird. Die Kürzung
 * nimmt nichts weg — es gibt keine zweite Seite, mit der `/wellness` verwechselt
 * werden könnte. Wer sie später doch ausschreiben will, ändert das Verzeichnis
 * und die drei Stellen, die darauf zeigen (NavBar, /mehr und der Abbrechen-Link
 * in der Seite selbst).
 *
 * Die Importe stehen relativ und mit .ts-Endung, und die Typen kommen aus
 * @sveltejs/kit statt aus ./$types. Der Grund ist derselbe wie in den
 * Nachbarrouten und geprüft, nicht vermutet: scripts/smoke-zugang.ts lädt
 * dieses Modul mit nacktem Node, und tsconfig.scripts.json kennt weder das
 * virtuelle ./$types noch die $lib-Zuordnung.
 *
 * **Die Ortsprüfung kommt aus ../../lib/ernte.ts und ist nicht kopiert.** Es
 * ist derselbe Garten und dasselbe Beet: dieselbe Vorbelegung `Beet `, dieselbe
 * Grenze, dieselbe Behandlung von leer als null. Eine zweite Fassung liefe beim
 * ersten Nachdenken über die Vorbelegung auseinander, und dann stünde auf zwei
 * Seiten desselben Produkts Verschiedenes im selben Feld. Der Preis ist eine
 * Abhängigkeit von der Wellnessbehandlung auf die Ernte, und er ist benannt:
 * sobald eine dritte Seite einen Ort aufnimmt, gehört die Prüfung in ein
 * eigenes Modul und nicht in ein drittes Mal dieselbe Zeile.
 *
 * **Keine zweite Stufe, an keiner der drei actions.** Der Wächter in
 * src/hooks.server.ts hat einen Aufruf ohne gültige Sitzung schon mit 403
 * abgewiesen; danach darf jedes aktive Mitglied eintragen, fortschreiben und
 * wegnehmen — auch an fremden Zeilen. Dieselbe Offenheit wie auf /ernte und aus demselben Grund:
 * wer sieht, dass eine Zeile falsch ist, soll sie richtigstellen dürfen, ohne
 * die Person zu suchen, die sie geschrieben hat. Die Rückfrage bei `wegnehmen`
 * ist das Gegengewicht.
 *
 * Die Mutationen sind form actions mit use:enhance (AD-9), im Markup mit
 * literalem action="?/name" — ein dynamisches action={…} würde Gate-Regel 11
 * blind machen.
 */

/**
 * Liest eine Zahl aus dem Formular, oder null.
 *
 * Die sechste bewusste Kopie von `idLesen`/`zahlLesen` (siehe
 * ../verwaltung/+page.server.ts, ../+page.server.ts, ../einzelaufgabe,
 * ../traenkeplan und ../ernte). Die Verdopplung bleibt billiger als eine
 * gemeinsame Stelle: fünf Zeilen ohne Domänenwissen, und ein geteiltes Modul
 * dafür hiesse, dass eine Änderung an der einen Seite still die anderen trifft.
 *
 * **Nicht zu verwechseln mit `intervallPruefen`** in ../../lib/wellness.ts. Das
 * sieht ähnlich aus und ist etwas anderes: hier eine Kennung aus einem
 * versteckten Feld, dort eine Angabe, die eine Person eingetippt hat und zu der
 * es einen Satz zu sagen gibt, wenn sie nicht trägt.
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
 * Das ganze Tagebuch, jüngste Anwendung zuerst, plus das, was das Datumsfeld
 * braucht.
 *
 * **`jetzt` reist mit**, anders als auf /ernte und wie auf `/`: was wieder
 * ansteht, wird gegen die Uhr gerechnet, und die Komponente darf sie nicht
 * selbst lesen. Sonst rechnete der Server in der einen Sekunde und das
 * hydrierende Telefon in einer anderen — und über Mitternacht wären es zwei
 * verschiedene Tage und damit zwei verschiedene Listen.
 *
 * **Keine Aufteilung in „steht an" und „Tagebuch" hier.** Beide Listen
 * entstehen aus denselben Zeilen (siehe `letzteJeStelle` in
 * ../../lib/wellness.ts), und zwei Felder in den Seitendaten wären eine zweite
 * Fassung derselben Auswahl. Die erste, die jemand ändert, liefe gegen die
 * andere.
 */
export function load({ locals }: ServerLoadEvent): {
	tagebuch: Behandlungszeile[];
	jetzt: number;
	heute: string;
	frueheste: string;
	spaeteste: string;
} {
	// Unerreichbar: der Wächter hat vorher mit 403 abgewiesen. Die Prüfung steht
	// hier, weil der Typ null zulässt — und ein `!` machte diese Seite von einer
	// Annahme über eine andere Datei abhängig.
	if (locals.mitglied === null) {
		redirect(303, '/');
	}
	const jetzt = Math.floor(Date.now() / 1000);
	return {
		tagebuch: behandlungenLesen(),
		jetzt,
		heute: heuteAlsFeldwert(jetzt),
		...rueckschaufenster(jetzt),
	};
}

/*
 * Wie diese Seite abweist — die Funktion steht in ../../lib/server/abweisen.ts
 * und ist für alle sieben Seiten mit Formular dieselbe.
 *
 * `feld` ist `'mittel'`, `'ort'`, `'datum'` oder `'intervall'` am
 * Eintragen-Formular und null an den zwei Zeilen-Aktionen, die kein Feld haben.
 * `zeile` trägt die Kennung der Behandlung, damit die Meldung an ihr steht statt
 * oben.
 *
 * **Zwei der vier Felder reisen nicht zurück, und das ist benannt.** `eingabe`
 * trägt das Mittel, `zweiteEingabe` den Ort — die zwei freien Textfelder.
 * `abweisen` hat keinen dritten Platz und soll keinen bekommen (siehe die
 * Begründung dort). Für das Datum kostet das nichts: es fällt auf die
 * Vorbelegung `heute` zurück, und das ist in neun von zehn Fällen der Wert, der
 * ohnehin darin stand. Für die Wiederholung kostet es eine neu getippte Zahl
 * mit höchstens drei Ziffern. Beides ist billiger als ein dritter Rückweg, den
 * dann jede der sieben Seiten trüge.
 */
export const actions = {
	/**
	 * Trägt eine Behandlung ein.
	 *
	 * **Die Prüfreihenfolge ist die Reihenfolge im Formular** — Mittel, Ort,
	 * Datum, Wiederholung: wer vier Meldungen zugleich bekäme, läse zuerst die
	 * zur untersten Zeile. Abgewiesen wird an der ersten Stelle, die nicht trägt.
	 *
	 * **Das Datum wird geprüft, obwohl das Markup `min`, `max` und `required`
	 * setzt.** Ein POST braucht kein Formular, und was ein Datumsfeld zusagt, ist
	 * eine Zusage des Browsers und keine des Servers. Dieselbe Trennung wie
	 * zwischen `maxlength` und MITTEL_HOECHSTLAENGE.
	 */
	eintragen: async ({ locals, request }: RequestEvent) => {
		const mitglied = locals.mitglied;
		// Unerreichbar: der Wächter hat vorher mit 403 abgewiesen. Die Prüfung
		// steht hier, weil der Typ null zulässt — ohne Identität gibt es
		// niemanden, der einträgt, und member_id ist notNull.
		if (mitglied === null) {
			return abweisen(BEHANDLUNG_NICHT_ANSPRECHBAR);
		}

		const formular = await request.formData();
		const mittelRoh = textLesen(formular.get('mittel'));
		const ortRoh = textLesen(formular.get('ort'));

		const mittel = mittelPruefen(mittelRoh);
		if ('fehler' in mittel) {
			return abweisen(mittel.fehler, 'mittel', mittelRoh, null, ortRoh);
		}

		const ort = ortPruefen(ortRoh);
		if ('fehler' in ort) {
			return abweisen(ort.fehler, 'ort', mittelRoh, null, ortRoh);
		}

		const angewendetAm = tagesendeInUnixSekunden(textLesen(formular.get('datum')));
		if (angewendetAm === null) {
			return abweisen(DATUM_UNGUELTIG, 'datum', mittelRoh, null, ortRoh);
		}
		// Gegen dieselbe Uhr wie das Feld seine Grenzen bekommen hat. Der heutige
		// Tag liegt drinnen, ein Tag in der Zukunft nicht — siehe istInRueckschau.
		if (!istInRueckschau(angewendetAm, Math.floor(Date.now() / 1000))) {
			return abweisen(DATUM_AUSSERHALB, 'datum', mittelRoh, null, ortRoh);
		}

		const intervall = intervallPruefen(textLesen(formular.get('intervall')));
		if ('fehler' in intervall) {
			return abweisen(intervall.fehler, 'intervall', mittelRoh, null, ortRoh);
		}

		const zeile = behandlungEintragen(
			{
				mittel: mittel.mittel,
				ort: ort.ort,
				angewendetAm,
				intervallTage: intervall.intervallTage,
			},
			mitglied
		);

		// Der Satz nennt das Mittel **und** was daraus folgt: das Formular klappt
		// nach dem Absenden zu, der Fokus springt in die Region oben, und die neue
		// Zeile steht irgendwo im Tagebuch. Eine Zeile mit Wiederholung sagt
		// dazu, wann sie sich wieder meldet — sonst wäre die Zahl, die gerade
		// eingetippt wurde, ohne sichtbare Folge.
		const nachsatz =
			zeile.intervallTage === null
				? 'Steht im Tagebuch.'
				: `Steht in ${zeile.intervallTage} Tagen wieder an.`;
		return {
			art: 'eingetragen' as const,
			meldung: `${zeile.mittel} ist eingetragen. ${nachsatz}`,
			zeile: zeile.id,
		};
	},

	/**
	 * Schreibt eine anstehende Behandlung auf **heute** fort.
	 *
	 * Der Griff an einer Zeile unter `Steht wieder an`, und die einzige Abkürzung
	 * dieser Seite: Mittel, Ort und Wiederholung kommen aus der Zeile, die gerade
	 * mahnt, und was dazukommt, ist das heutige Datum. Wer alle vierzehn Tage
	 * spritzt, tippt damit nichts mehr ab, was schon dasteht.
	 *
	 * **Es ist ein INSERT und kein UPDATE**, und das ist die ganze Aussage des
	 * Tagebuchs: die alte Zeile bleibt stehen, weil die alte Behandlung
	 * stattgefunden hat. Ein UPDATE auf `angewendet_am` schriebe die Geschichte
	 * um und liesse es aussehen, als sei zwischen den beiden Terminen nichts
	 * gewesen.
	 *
	 * **Ohne Rückfrage.** Es nimmt nichts weg, und ein Fehlgriff ist mit
	 * `Wegnehmen` an der frischen Zeile in einem Schritt zurückgenommen. Dieselbe
	 * Abwägung wie beim Umstufen auf /ernte.
	 *
	 * Fehlende, unlesbare und nicht mehr vorhandene Zeile fallen auf **einen**
	 * Satz. Die Unterscheidung wäre ein Aufzählungskanal und für die lesende
	 * Person ohne Folge: in allen Fällen ist die angezeigte Seite veraltet.
	 */
	wiederholen: async ({ locals, request }: RequestEvent) => {
		const mitglied = locals.mitglied;
		// Unerreichbar: der Wächter hat vorher mit 403 abgewiesen. Siehe
		// `eintragen` — ohne Identität gibt es niemanden, der einträgt.
		if (mitglied === null) {
			return abweisen(BEHANDLUNG_NICHT_ANSPRECHBAR);
		}

		const formular = await request.formData();
		const id = zahlLesen(formular.get('id'));
		if (id === null) {
			return abweisen(BEHANDLUNG_NICHT_ANSPRECHBAR);
		}

		const vorlage = behandlungLesen(id);
		if (vorlage === null) {
			return abweisen(BEHANDLUNG_NICHT_ANSPRECHBAR, null, '', id);
		}

		const jetzt = Math.floor(Date.now() / 1000);
		// Über denselben Weg wie das Formular: der Feldwert für heute, von dort in
		// ein Tagesende in der Zone. Ein `jetzt` direkt in die Spalte zu schreiben
		// legte dort eine Uhrzeit ab, und die Spalte trägt Tage.
		const angewendetAm = tagesendeInUnixSekunden(heuteAlsFeldwert(jetzt));
		if (angewendetAm === null) {
			// Unerreichbar: heuteAlsFeldwert erzeugt genau die Form, die
			// tagesendeInUnixSekunden liest. Der Zweig steht hier, weil der Typ null
			// zulässt — und ein `!` machte diese action von einer Annahme über ein
			// anderes Modul abhängig.
			return abweisen(BEHANDLUNG_NICHT_ANSPRECHBAR, null, '', id);
		}

		const zeile = behandlungEintragen(
			{
				mittel: vorlage.mittel,
				ort: vorlage.ort,
				angewendetAm,
				intervallTage: vorlage.intervallTage,
			},
			mitglied
		);

		return {
			art: 'wiederholt' as const,
			meldung: `${zeile.mittel} ist für heute eingetragen.`,
			zeile: zeile.id,
		};
	},

	/**
	 * Nimmt eine Zeile weg — in zwei Schritten, an einer action.
	 *
	 * **Warum gefragt wird.** Es ist ein DELETE ohne Rückweg, und anders als beim
	 * Abernten ist es keine Handlung im Garten, sondern eine Richtigstellung:
	 * was verschwindet, ist die Auskunft über etwas, das trotzdem geschehen ist.
	 * Wer sie zurückhaben will, trägt sie neu ein — mit dem eigenen Namen statt
	 * dem der Person, die sie geschrieben hat. Und wegnehmen darf jede, auch an
	 * fremden Zeilen; die Rückfrage ist das Gegengewicht zu genau dieser
	 * Offenheit.
	 *
	 * Dieselbe Bauform wie das Abernten auf /ernte: ein POST ohne `bestaetigt`
	 * ändert nichts und fragt, erst der zweite schreibt. Ohne JavaScript ist die
	 * Antwort auf den ersten POST ein vollständiges Dokument mit der Frage an der
	 * Zeile.
	 *
	 * Die Frage trägt Mittel und Ort mit, weil sie an der Zeile steht, aber
	 * gelesen wird, nachdem der Blick nach oben gesprungen ist — und weil im
	 * Tagebuch zwangsläufig viele Zeilen `Schachtelhalmbrühe` heissen.
	 */
	wegnehmen: async ({ request }: RequestEvent) => {
		const formular = await request.formData();
		const id = zahlLesen(formular.get('id'));
		if (id === null) {
			return abweisen(BEHANDLUNG_NICHT_ANSPRECHBAR);
		}

		// Schritt 1: fragen. `has` und nicht ein Wertvergleich — das Feld ist eine
		// Marke, kein Wert.
		if (!formular.has('bestaetigt')) {
			const zeile = behandlungLesen(id);
			if (zeile === null) {
				return abweisen(BEHANDLUNG_NICHT_ANSPRECHBAR, null, '', id);
			}
			return {
				art: 'fragenWegnehmen' as const,
				zeile: id,
				mittel: zeile.mittel,
				ort: zeile.ort,
			};
		}

		// Schritt 2: schreiben. Wer das Wettrennen verliert, weil jemand anders in
		// der Zwischenzeit weggenommen hat, bekommt denselben Satz wie jemand mit
		// einer erfundenen Kennung.
		const weg = behandlungWegnehmen(id);
		if (weg === null) {
			return abweisen(BEHANDLUNG_NICHT_ANSPRECHBAR, null, '', id);
		}

		return {
			art: 'weggenommen' as const,
			meldung: `Der Eintrag zu ${weg.mittel} ist weg.`,
			zeile: id,
		};
	},
} satisfies Actions;
