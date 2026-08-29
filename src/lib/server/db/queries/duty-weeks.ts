import { and, eq, inArray, sql } from 'drizzle-orm';
import { datenbank } from '../index.ts';
import { DIENSTART_TRAENKEN, dutyWeeks, members } from '../schema.ts';
import { isoWocheVon, type Woche } from '../../../zeit.ts';

/*
 * Das Repository für duty_weeks. Die Routen benutzen ausschliesslich diese
 * benannten Funktionen — kein Drizzle-Aufruf entsteht inline in einer
 * Routendatei (AD-1, Gate-Regel 9).
 *
 * Alles synchron: better-sqlite3 gibt Werte direkt zurück.
 *
 * **Die Dienstart steht in jeder Abfrage**, nicht in der Route. Derselbe Grund
 * wie bei `is_active = 1` in ./members.ts: sonst wiederholte sie jede künftige
 * Aufrufstelle, und eine von ihnen täte es falsch — mit dem Ergebnis, dass ein
 * zweiter Dienstplan seine Wochen im Tränkeplan fände.
 */

/**
 * Eine Woche des Plans, wie sie eine Seite sehen darf.
 *
 * `name` ist **null**, wenn niemand zuständig ist — und das fasst die zwei
 * Wege dorthin zusammen, die es gibt: gar keine Zeile für diese Woche, oder
 * eine Zeile, die auf ein beendetes Mitglied zeigt. Für die lesende Person ist
 * beides dasselbe, und die Oberfläche macht aus beidem `— unbesetzt —`.
 *
 * `mitgliedId` reist mit, damit die Auswahl im Besetzen-Formular die schon
 * zuständige Person vorbelegen kann. Bei einem beendeten Mitglied ist sie
 * ebenfalls null: die Auswahl führt nur aktive Mitglieder, und eine
 * Vorbelegung auf einen Wert, den es dort nicht gibt, wäre eine leere Auswahl
 * ohne erkennbaren Grund.
 */
export type Dienstwoche = {
	jahr: number;
	woche: number;
	name: string | null;
	mitgliedId: number | null;
};

/**
 * Die Wochen eines Fensters, in genau der Reihenfolge und Länge, in der sie
 * hereingereicht wurden.
 *
 * **Das Fenster kommt von aussen und wird nicht hier gerechnet.** Welche Wochen
 * der Plan zeigt, ist eine Produktentscheidung (drei Monate) und steht in
 * src/lib/zeit.ts (`wochenfenster`); diese Funktion beantwortet allein, wer in
 * ihnen zuständig ist. Darum gibt sie auch für Wochen **ohne** Zeile einen
 * Eintrag zurück: der Plan zeigt jede Woche des Fensters, nicht nur die
 * besetzten, und eine Route, die die Lücken selbst auffüllen müsste, hätte die
 * Reihenfolge ein zweites Mal herzustellen.
 *
 * **Eine Abfrage und nicht eine je Woche.** Vierzehn Wochen ergäben vierzehn
 * Rundreisen; der `inArray` über den gefalteten Schlüssel holt sie in einer.
 * Gefaltet als `iso_jahr * 100 + iso_woche`, weil SQLite kein Tupel-IN über
 * zwei Spalten kennt — dieselbe Faltung wie `wochenSchluessel` in zeit.ts, und
 * sie ist hier auf **beiden** Seiten des Vergleichs dieselbe Rechnung.
 *
 * Der `leftJoin` und nicht ein `innerJoin`: eine Zeile, deren Mitglied beendet
 * ist, muss **erhalten bleiben** und als unbesetzt erscheinen. Ein innerJoin
 * auf `is_active = 1` liesse sie verschwinden, und die Woche sähe aus wie eine,
 * die nie zugeteilt war — der Datensatz bliebe unsichtbar stehen, und niemand
 * käme je auf die Idee, sie neu zu besetzen.
 */
export function dienstwochenLesen(fenster: readonly Woche[]): Dienstwoche[] {
	if (fenster.length === 0) return [];

	const gefaltet = sql<number>`${dutyWeeks.isoJahr} * 100 + ${dutyWeeks.isoWoche}`;
	const zeilen = datenbank()
		.select({
			jahr: dutyWeeks.isoJahr,
			woche: dutyWeeks.isoWoche,
			name: members.name,
			mitgliedId: members.id,
			istAktiv: members.isActive,
		})
		.from(dutyWeeks)
		.leftJoin(members, eq(members.id, dutyWeeks.memberId))
		.where(
			and(
				eq(dutyWeeks.art, DIENSTART_TRAENKEN),
				inArray(
					gefaltet,
					fenster.map(({ jahr, woche }) => jahr * 100 + woche)
				)
			)
		)
		.all();

	const nachSchluessel = new Map<number, (typeof zeilen)[number]>();
	for (const zeile of zeilen) nachSchluessel.set(zeile.jahr * 100 + zeile.woche, zeile);

	return fenster.map(({ jahr, woche }) => {
		const zeile = nachSchluessel.get(jahr * 100 + woche);
		// Die zwei Wege in dieselbe Darstellung fallen hier zusammen: keine Zeile,
		// oder eine Zeile auf ein beendetes Mitglied.
		const besetzt = zeile !== undefined && zeile.istAktiv === true;
		return {
			jahr,
			woche,
			name: besetzt ? (zeile?.name ?? null) : null,
			mitgliedId: besetzt ? (zeile?.mitgliedId ?? null) : null,
		};
	});
}

/**
 * Wer in der Woche eines Zeitpunkts zuständig ist — oder null.
 *
 * Die schmale Auskunft für den Diensthinweis auf `/`. Sie geht über
 * dienstwochenLesen und nicht an ihr vorbei: die Regel, wann eine Woche als
 * besetzt gilt, steht dort einmal, und eine zweite Abfrage mit eigener
 * Aktiv-Prüfung wäre die Stelle, an der die zwei auseinanderliefen.
 *
 * @param jetztSekunden Der Bezugszeitpunkt in Unix-Sekunden, aus der load.
 */
export function eigeneDienstwoche(
	mitgliedId: number,
	jetztSekunden: number
): { woche: Woche } | null {
	const woche = isoWocheVon(jetztSekunden);
	const [eintrag] = dienstwochenLesen([woche]);
	if (eintrag === undefined || eintrag.mitgliedId !== mitgliedId) return null;
	return { woche };
}

/**
 * Besetzt eine Woche mit einem **aktiven** Mitglied — oder gibt null zurück,
 * wenn es das Mitglied nicht gibt oder sein Zugang beendet ist.
 *
 * **Ein Vorgang für Besetzen und Neubesetzen.** Ein Tausch ist das Ersetzen des
 * Namens, keine Verhandlung: `onConflictDoUpdate` auf der Eindeutigkeit über
 * (Art, Jahr, Woche) schreibt die bestehende Zeile um, statt eine zweite
 * anzulegen. Die Route braucht darum kein vorheriges Select, und es gibt kein
 * Fenster zwischen Prüfen und Schreiben, in dem zwei gleichzeitige Zuteilungen
 * beide durchkämen.
 *
 * **`is_active = 1` steht in der Vorprüfung und nicht in der Route**, aus
 * demselben Grund wie bei mitgliedDeaktivieren und mitgliedUmbenennen in
 * ./members.ts. Sie steht hier ausnahmsweise als eigenes Select davor und nicht
 * als Bedingung im Schreibvorgang: ein INSERT hat keine where-Klausel, in die
 * sie passte. Der Preis ist ein Fenster von Mikrosekunden, in dem ein
 * gleichzeitiger Widerruf durchginge — und sein Ausgang ist genau der, den die
 * Anzeige ohnehin abbildet: die Woche steht als unbesetzt da. Es entsteht keine
 * Zeile auf ein Mitglied, das es nie gab, weil der Fremdschlüssel das abfängt.
 *
 * `createdAt` bleibt beim Ersetzen unberührt — die Woche ist dieselbe, nur die
 * zuständige Person wechselt.
 */
export function dienstwocheBesetzen(woche: Woche, mitgliedId: number): { name: string } | null {
	const mitglied = datenbank()
		.select({ name: members.name })
		.from(members)
		.where(and(eq(members.id, mitgliedId), eq(members.isActive, true)))
		.get();
	if (mitglied === undefined) return null;

	datenbank()
		.insert(dutyWeeks)
		.values({
			art: DIENSTART_TRAENKEN,
			isoJahr: woche.jahr,
			isoWoche: woche.woche,
			memberId: mitgliedId,
		})
		.onConflictDoUpdate({
			target: [dutyWeeks.art, dutyWeeks.isoJahr, dutyWeeks.isoWoche],
			set: { memberId: mitgliedId },
		})
		.run();

	return { name: mitglied.name };
}
