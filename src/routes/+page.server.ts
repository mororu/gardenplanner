import { fail } from '@sveltejs/kit';
import type { Actions, RequestEvent, ServerLoadEvent } from '@sveltejs/kit';
import {
	aufgabeAbhaken,
	aufgabeWiederOeffnen,
	offeneAufgabenAuflisten,
} from '../lib/server/db/queries/tasks.ts';
import type { SichtbareAufgabe } from '../lib/server/db/schema.ts';
import { AUFGABE_NICHT_ANSPRECHBAR } from '../lib/texte.ts';

/*
 * / — die Kernschleife: sehen, was offen ist, und mit einem Griff abhaken.
 *
 * Die Importe stehen relativ und mit .ts-Endung, und die Typen kommen aus
 * @sveltejs/kit statt aus ./$types. Der Grund ist derselbe wie in
 * src/routes/verwaltung/+page.server.ts:14-22 und geprüft, nicht vermutet:
 * scripts/smoke-zugang.ts lädt dieses Modul mit nacktem Node, und
 * tsconfig.scripts.json kennt weder das virtuelle ./$types noch die
 * $lib-Zuordnung.
 *
 * Diese Seite hat **keine** eigene Schranke. Der Wächter in src/hooks.server.ts
 * hat einen Aufruf ohne gültige Sitzung schon mit 403 abgewiesen, und `/` ist
 * für jedes aktive Mitglied da — es gibt keine zweite Stufe, die hier zu prüfen
 * wäre. Jedes Mitglied darf jede Aufgabe abhaken und jede erledigte wieder
 * öffnen (AD-2).
 *
 * Beide Mutationen sind form actions mit use:enhance (AD-9). Kein +server.ts,
 * kein JSON-Endpunkt, und im Markup zwei Formulare mit **literalem** action —
 * ein dynamisches action={…} würde Gate-Regel 11 blind machen.
 */

/** Ein Fehlschlag mit 400 und dem einen Satz. Vier Zustände, keine Verzweigung. */
function abweisen() {
	return fail(400, { art: 'fehler' as const, meldung: AUFGABE_NICHT_ANSPRECHBAR });
}

/**
 * Liest die aufgabeId aus dem Formular, oder null.
 *
 * Wortgleich mit idLesen in ../verwaltung/+page.server.ts, und die Verdopplung
 * ist billiger als eine gemeinsame Stelle: die Funktion ist fünf Zeilen ohne
 * Domänenwissen, und ein geteiltes Modul dafür hiesse, dass eine Änderung an der
 * einen Seite still die andere trifft.
 *
 * Fehlend, nicht numerisch und ausserhalb des Zahlenbereichs fallen auf dasselbe
 * null zusammen — und weiter unten auf denselben Satz wie eine unbekannte Id und
 * ein falscher Erledigt-Zustand.
 */
function idLesen(roh: unknown): number | null {
	// `unknown` und nicht FormDataEntryValue: das Typprüf-Programm der Skripte
	// (tsconfig.scripts.json) zieht bewusst kein DOM-lib, und dieses Modul liegt
	// über scripts/smoke-zugang.ts darin.
	if (typeof roh !== 'string') return null;
	const gekuerzt = roh.trim();
	if (!/^[0-9]+$/.test(gekuerzt)) return null;
	const id = Number(gekuerzt);
	return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Die offenen Aufgaben, älteste zuerst — und ob gerade etwas abgelegt wurde.
 *
 * Aus dem Ereignis liest die Funktion **allein die Adresse**: weder locals noch
 * Cookies. Wer hier ist, ist angemeldet, und alle sehen dieselbe Liste. Belegt
 * ist das ausgeführt, nicht behauptet: scripts/smoke-zugang.ts ruft diese load
 * mit einem Ereignis, dessen locals und cookies beim Lesen werfen.
 *
 * offeneAufgabenAuflisten projiziert schon in der Datenbank ohne completed_by
 * und completed_at — der Abhakende kann diesen Rückgabewert nicht verlassen,
 * weil das Feld nicht existiert (AD-5).
 *
 * `abgelegt` ist die Meldung, die eine Weiterleitung überlebt hat. Ein
 * redirect() aus einer form action verwirft deren Rückgabewert; /aufgabe legt
 * die Bestätigung darum als Query-Parameter in die Adresse (`/?abgelegt`), und
 * diese load macht daraus einen **Wahrheitswert, keinen Satz**. Der Satz gehört
 * zur Oberfläche, und eine spätere Massen-Eingabe kann den Parameter mit einer
 * Zahl belegen, ohne die Form dieses Feldes zu ändern.
 *
 * Der Preis ist benannt und abgenommen: die Adresse trägt `?abgelegt` sichtbar,
 * ein Neuladen wiederholt die Meldung, und wer die Adresse von Hand eintippt,
 * sieht sie auch. Eine Bestätigung ohne Folgen verträgt das.
 */
export function load({ url }: ServerLoadEvent): {
	aufgaben: SichtbareAufgabe[];
	abgelegt: boolean;
} {
	return { aufgaben: offeneAufgabenAuflisten(), abgelegt: url.searchParams.has('abgelegt') };
}

export const actions = {
	/**
	 * Hakt eine offene Aufgabe ab. Genau eine Interaktion, keine Rückfrage.
	 *
	 * Die Vorbedingung „noch offen" steht in aufgabeAbhaken und damit in der
	 * where-Klausel des UPDATE. Diese action prüft den Zustand deshalb **nicht**
	 * vorher: ein Vorab-Select hätte ein Zeitfenster, in dem zwei gleichzeitige
	 * Abhaker beide durchkämen und der zweite den ersten überschriebe.
	 */
	abhaken: async ({ locals, request }: RequestEvent) => {
		const mitglied = locals.mitglied;
		// Unerreichbar: der Wächter hat vorher mit 403 abgewiesen. Die Prüfung
		// steht hier, weil der Typ null zulässt — und ein `!` machte diese Seite
		// von einer Annahme über eine andere Datei abhängig. Derselbe Satz wie
		// überall: ohne Identität gibt es niemanden, der abgehakt hätte, und
		// verändert wird nichts.
		if (mitglied === null) {
			return abweisen();
		}

		const formular = await request.formData();
		const id = idLesen(formular.get('aufgabeId'));
		if (id === null) {
			return abweisen();
		}

		const aufgabe = aufgabeAbhaken(id, mitglied.id);
		// Unbekannt und schon erledigt fallen hier zusammen.
		if (aufgabe === null) {
			return abweisen();
		}

		// `art` ist der Diskriminator, den der Rückruf im Markup liest — wie in
		// Story 1.3. Der Text der Aufgabe darf mit, der Abhakende nicht: er steht
		// in diesem Rückgabewert nicht, weil aufgabeAbhaken ihn nicht zurückgibt.
		return {
			art: 'abgehakt' as const,
			meldung: 'Abgehakt.',
			aufgabeId: aufgabe.id,
			text: aufgabe.text,
		};
	},

	/**
	 * Öffnet eine erledigte Aufgabe wieder — der Gegenzug zum Fehlgriff.
	 *
	 * Ohne Zeitschranke und ohne Bindung an die abhakende Person: wer die Zeile
	 * sieht, darf sie öffnen. locals wird hier nicht gelesen, weil es keine
	 * Spalte gibt, die einen Wieder-Öffnenden hielte.
	 */
	wiederOeffnen: async ({ request }: RequestEvent) => {
		const formular = await request.formData();
		const id = idLesen(formular.get('aufgabeId'));
		if (id === null) {
			return abweisen();
		}

		const aufgabe = aufgabeWiederOeffnen(id);
		// Unbekannt und noch offen fallen hier zusammen.
		if (aufgabe === null) {
			return abweisen();
		}

		return {
			art: 'wiederGeoeffnet' as const,
			meldung: 'Wieder offen.',
			aufgabeId: aufgabe.id,
			text: aufgabe.text,
		};
	},
} satisfies Actions;
