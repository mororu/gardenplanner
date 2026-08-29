import type { Actions, RequestEvent, ServerLoadEvent } from '@sveltejs/kit';
import { abweisen } from '../lib/server/abweisen.ts';
import { eigeneDienstwoche } from '../lib/server/db/queries/duty-weeks.ts';
import {
	aufgabeAbhaken,
	aufgabeWiederOeffnen,
	offeneAufgabenAuflisten,
	type OffeneAufgabe,
} from '../lib/server/db/queries/tasks.ts';
import { AUFGABE_NICHT_ANSPRECHBAR } from '../lib/texte.ts';
import { wochendatum } from '../lib/zeit.ts';

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
 * Die Zahl hinter `?abgelegt`, oder null, wenn der Parameter fehlt.
 *
 * Die Deutung steht als eigene Funktion und nicht als Ausdruck in der load,
 * weil sie drei Fälle hat und jeder eine Begründung trägt — siehe den Docblock
 * der load darunter.
 */
function abgelegtLesen(url: URL): number | null {
	if (!url.searchParams.has('abgelegt')) return null;
	const roh = (url.searchParams.get('abgelegt') ?? '').trim();
	if (!/^[0-9]+$/.test(roh)) return 1;
	const anzahl = Number(roh);
	return Number.isSafeInteger(anzahl) && anzahl > 0 ? anzahl : 1;
}

/**
 * Die offenen Aufgaben, älteste zuerst — dazu der eigene Dienst dieser Woche und
 * ob gerade etwas abgelegt wurde.
 *
 * **Die Aufgabenliste ist für alle dieselbe, und das bleibt so.** Bis Story 3.1
 * las diese Funktion aus dem Ereignis allein die Adresse — weder locals noch
 * Cookies —, und scripts/smoke-zugang.ts belegte das ausgeführt mit einem
 * Ereignis, das beim Anfassen beider Felder wirft. Der Diensthinweis ist
 * personenbezogen und bricht die Hälfte dieser Zusage: `locals.mitglied` wird
 * jetzt gelesen. Der **Grund** der Zusage gilt weiter und ist die schärfere
 * Fassung, die im Prüfskript an ihre Stelle getreten ist:
 *
 *   - `cookies` bleibt unberührt — das Ereignis wirft dort weiterhin;
 *   - zwei load-Aufrufe mit **verschiedenen** locals.mitglied geben eine
 *     wortgleiche Aufgabenliste zurück. Verschieden ist allein `dienst`.
 *
 * Der namenlose Pool ist damit weiterhin gemessen und nicht bloss behauptet
 * (AD-2). Wer die alte Zeile streicht, statt sie zu verengen, behält davon nur
 * den Kommentar.
 *
 * offeneAufgabenAuflisten projiziert schon in der Datenbank ohne completed_by
 * und completed_at — der Abhakende kann diesen Rückgabewert nicht verlassen,
 * weil das Feld nicht existiert (AD-5).
 *
 * **Der Bezugszeitpunkt der Überfälligkeit entsteht hier**, als
 * `Math.floor(Date.now() / 1000)`, und wird an offeneAufgabenAuflisten
 * weitergegeben. Er entsteht ausdrücklich **nicht** im Browser: ein `Date.now()`
 * in der Komponente lief einmal serverseitig beim Rendern und einmal beim
 * Hydrieren, und Svelte meldete einen Hydrierungsunterschied — genau derselbe
 * Grund, aus dem die Vorgabe von `Fällig bis` in ./monatsplan/+page.server.ts
 * serverseitig entsteht. Der Nebeneffekt ist erwünscht: **eine** Uhr für die
 * ganze Liste, keine Zeile wird an einem anderen Moment gemessen als ihre
 * Nachbarin.
 *
 * Die Zusage „aus dem Ereignis liest die Funktion allein die Adresse" bleibt
 * dabei wörtlich wahr: `Date.now()` ist die Uhr des Prozesses und kein Feld des
 * Ereignisses. Ein Umweg über `event.locals` oder ein Cookie bräche sie, diese
 * Zeile nicht.
 *
 * `abgelegt` ist die Meldung, die eine Weiterleitung überlebt hat. Ein
 * redirect() aus einer form action verwirft deren Rückgabewert; /aufgabe und
 * /monatsplan legen die Bestätigung darum als Query-Parameter in die Adresse,
 * und diese load macht daraus eine **Zahl, keinen Satz**. Der Satz gehört zur
 * Oberfläche: sie macht aus der 1 `Abgelegt.` und aus jeder grösseren Zahl
 * `N Aufgaben abgelegt.`
 *
 * Drei Fälle, und keiner davon ist ein Fehlschlag:
 *
 *   - kein Parameter                        → null, es wurde nichts abgelegt;
 *   - `?abgelegt` ohne Wert                 → 1, die Form, die /aufgabe seit
 *     Story 1.5 schickt und die gültig bleibt;
 *   - `?abgelegt=22` mit positiver Ganzzahl → 22, der Stapel aus /monatsplan.
 *
 * Ein unlesbarer Wert (`?abgelegt=viele`, `?abgelegt=-3`, `?abgelegt=0`) fällt
 * auf dieselbe 1 wie der bare Parameter. Das ist Absicht: die Adresse ist von
 * Hand veränderbar, die Meldung hat keine Folgen, und eine Fehlerseite für eine
 * verunstaltete Bestätigung wäre lauter als der Anlass.
 *
 * Der Preis ist benannt und abgenommen: die Adresse trägt den Parameter
 * sichtbar, ein Neuladen wiederholt die Meldung, und wer die Adresse von Hand
 * eintippt, sieht sie auch. Eine Bestätigung ohne Folgen verträgt das.
 */
export function load({ locals, url }: ServerLoadEvent): {
	aufgaben: OffeneAufgabe[];
	dienst: { datum: string } | null;
	abgelegt: number | null;
} {
	const jetztSekunden = Math.floor(Date.now() / 1000);
	const mitglied = locals.mitglied;
	/*
	 * **null heisst: der Block fehlt ganz.** Er ist nicht leer, sondern nicht
	 * vorhanden — die Oberfläche hat für diesen Fall kein `{:else}`.
	 *
	 * Die Komponente bekommt das fertige Wochendatum und nicht Jahr und Woche,
	 * weil sie sonst nichts damit täte: der Block zeigt einen Satz und ein Datum,
	 * und ein Wochenschlüssel, den erst die Komponente auflöste, wäre eine
	 * Rechnung an einer Stelle, die keine braucht.
	 *
	 * **Nicht** aus Sorge vor einem Hydrierungsunterschied — `wochendatum` ist
	 * rein und gäbe im Browser dasselbe wie auf dem Server; /dienstplan ruft es
	 * denn auch in der Komponente. Was hier wirklich nicht in den Browser gehört,
	 * ist der **Bezugszeitpunkt**: der entsteht einmal in dieser load, und ein
	 * `Date.now()` in einer Komponente liefe zweimal.
	 */
	const eigene = mitglied === null ? null : eigeneDienstwoche(mitglied.id, jetztSekunden);
	return {
		aufgaben: offeneAufgabenAuflisten(jetztSekunden),
		dienst: eigene === null ? null : { datum: wochendatum(eigene.woche) },
		abgelegt: abgelegtLesen(url),
	};
}

/*
 * Wie diese Seite abweist — die Funktion steht in ../lib/server/abweisen.ts und
 * ist für alle vier Seiten dieselbe.
 *
 * Diese Seite lässt beide Zusatzangaben leer: sie hat kein Feld, in das eine
 * Meldung zeigen könnte, und keine Eingabe, die zurückreisen müsste — ein
 * Kästchen und eine Id. Fünf Zustände fallen darum auf **einen** Satz zusammen,
 * ohne jede Verzweigung: fehlende Id, nicht numerische Id, unbekannte Id,
 * falscher Erledigt-Zustand und eine Zeile, die inzwischen jemand anders
 * angefasst hat. Wer eine Aufgabe nicht abhaken kann, braucht keine Diagnose,
 * sondern die aktuelle Liste — und die kommt mit der nächsten load.
 */
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
			return abweisen(AUFGABE_NICHT_ANSPRECHBAR);
		}

		const formular = await request.formData();
		const id = idLesen(formular.get('aufgabeId'));
		if (id === null) {
			return abweisen(AUFGABE_NICHT_ANSPRECHBAR);
		}

		const aufgabe = aufgabeAbhaken(id, mitglied.id);
		// Unbekannt und schon erledigt fallen hier zusammen.
		if (aufgabe === null) {
			return abweisen(AUFGABE_NICHT_ANSPRECHBAR);
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
			return abweisen(AUFGABE_NICHT_ANSPRECHBAR);
		}

		const aufgabe = aufgabeWiederOeffnen(id);
		// Unbekannt und noch offen fallen hier zusammen.
		if (aufgabe === null) {
			return abweisen(AUFGABE_NICHT_ANSPRECHBAR);
		}

		return {
			art: 'wiederGeoeffnet' as const,
			meldung: 'Wieder offen.',
			aufgabeId: aufgabe.id,
			text: aufgabe.text,
		};
	},
} satisfies Actions;
