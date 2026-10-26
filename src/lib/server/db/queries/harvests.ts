import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { ERNTESTATUS, type Erntestatus } from '../../../ernte.ts';
import { anzeigename, anzeigenameOderNull } from '../../../mitgliedsname.ts';
import { datenbank } from '../index.ts';
import { harvests, members, type NewHarvest } from '../schema.ts';

/*
 * Das Repository für harvests. Die Routen benutzen ausschliesslich diese
 * benannten Funktionen — kein Drizzle-Aufruf entsteht inline in einer
 * Routendatei (AD-1, Gate-Regel 9).
 *
 * Alles synchron: better-sqlite3 gibt Werte direkt zurück.
 *
 * **Die Regel, die dieses Modul durchsetzt, ist die Ordnung.** ./tasks.ts
 * entscheidet, wann eine Zeile offen ist, ./signup-tasks.ts, wann eine frei
 * ist; hier ist es die Reihenfolge, in der der Stand gelesen wird — erst die
 * Dringlichkeit, dann das Alter. Sie steht an genau einer Stelle, und sie wird
 * **abgeleitet** und nicht geschrieben: siehe `rang` unten.
 */

/**
 * Eine Zeile des Stands, wie die Seite sie sieht.
 *
 * `name` ist nullbar, obwohl `member_id` es nicht ist: der leftJoin liefert
 * null, wenn die Mitgliedszeile fehlt. Kein Weg der Anwendung löscht eine —
 * Zugang beenden heisst deaktivieren —, aber der Typ soll nicht behaupten, was
 * allein eine Gewohnheit ist.
 *
 * `name` ist seit dem 2026-10-26 der **Anzeigename** (`anzeigename` in
 * src/lib/mitgliedsname.ts): der Kurzname, sonst das erste Wort des Namens.
 * Der volle Name verlässt dieses Modul nicht.
 *
 * **`memberId` reist nicht mit.** Anders als beim Tränkeplan, wo die Komponente
 * die eigene Zeile erkennen muss, um das Austragen anzubieten, darf hier jede
 * Person jede Zeile umstufen und abernten. Es gibt also nichts zu vergleichen,
 * und eine Kennung in den Seitendaten ohne Leser wäre eine Einladung.
 */
export type Erntezeile = {
	id: number;
	kultur: string;
	ort: string | null;
	status: Erntestatus;
	laufend: boolean;
	/** Was jemand zur Ernte weiss, oder null (seit dem 2026-10-26). */
	notiz: string | null;
	name: string | null;
	createdAt: number;
};

const anzeigeSpalten = {
	id: harvests.id,
	kultur: harvests.kultur,
	ort: harvests.ort,
	status: harvests.status,
	laufend: harvests.laufend,
	notiz: harvests.notiz,
	name: members.name,
	kurzname: members.kurzname,
	createdAt: harvests.createdAt,
};

/**
 * Der Rang einer Stufe: ihr Platz in ERNTESTATUS, als SQL-Ausdruck.
 *
 * **Aus der Liste erzeugt und nicht ausgeschrieben.** Eine von Hand getippte
 * CASE-Kaskade wäre eine zweite Fassung der Reihenfolge aus src/lib/ernte.ts,
 * und die zwei liefen beim ersten Umsortieren auseinander: die Abschnitte der
 * Seite stünden dann anders als die Zeilen, die die Abfrage liefert. Wer eine
 * vierte Stufe einfügt, ändert das Array — hier ist nichts nachzuziehen.
 *
 * Die Werte gehen als gebundene Parameter in die Anweisung (`${wert}` in einem
 * sql-Schablonenliteral bindet, es interpoliert nicht), also auch dann, wenn
 * eine Stufe je ein Anführungszeichen im Namen trüge.
 *
 * Ein unbekannter Wert in der Spalte fällt auf `ERNTESTATUS.length` und landet
 * **hinten** statt zu verschwinden. Er kann nur von Hand in die Datenbank
 * geraten sein; ihn still wegzulassen hiesse, dass eine Zeile existiert, die
 * niemand sieht und darum niemand aberntet.
 */
const rang = sql.join(
	[
		sql`case ${harvests.status}`,
		...ERNTESTATUS.map((stufe, platz) => sql`when ${stufe} then ${platz}`),
		sql`else ${ERNTESTATUS.length} end`,
	],
	sql` `
);

/*
 * Erst die Dringlichkeit, dann das Alter: innerhalb einer Stufe steht die
 * frischeste Angabe oben, weil sie die verlässlichste ist. `desc(id)` als
 * dritter Schlüssel, damit zwei Zeilen aus derselben Sekunde eine feste
 * Reihenfolge haben — ohne ihn wäre die Liste zwischen zwei Aufrufen
 * unterschiedlich sortiert, und niemand sähe warum.
 */
const ordnung = [asc(rang), desc(harvests.createdAt), desc(harvests.id)];

type Anzeigezeile = {
	id: number;
	kultur: string;
	ort: string | null;
	status: string;
	laufend: boolean;
	notiz: string | null;
	name: string | null;
	kurzname: string | null;
	createdAt: number;
};

/*
 * Die Spalte trägt Text, der Typ trägt drei Werte. Die Zusicherung steht hier
 * an **einer** Stelle, und sie ist bewusst keine Prüfung: was in der Spalte
 * steht, hat die action über istErntestatus passieren müssen. Eine zweite
 * Prüfung beim Lesen müsste entscheiden, was sie mit einem Fund anfängt — und
 * die einzige ehrliche Antwort wäre, die Zeile trotzdem zu zeigen. Genau das
 * tut sie so, und `rang` oben sortiert sie ans Ende.
 */
const alsErntezeile = ({ kurzname, ...zeile }: Anzeigezeile): Erntezeile => ({
	...zeile,
	status: zeile.status as Erntestatus,
	name: anzeigenameOderNull(zeile.name, kurzname),
});

/** Der ganze Stand, dringend zuerst. */
export function erntestandLesen(): Erntezeile[] {
	return datenbank()
		.select(anzeigeSpalten)
		.from(harvests)
		.leftJoin(members, eq(members.id, harvests.memberId))
		.orderBy(...ordnung)
		.all()
		.map(alsErntezeile);
}

/** Eine einzelne Zeile — für die Rückfrage vor dem Abernten. */
export function erntezeileLesen(id: number): Erntezeile | null {
	const zeile = datenbank()
		.select(anzeigeSpalten)
		.from(harvests)
		.leftJoin(members, eq(members.id, harvests.memberId))
		.where(eq(harvests.id, id))
		.get();
	return zeile === undefined ? null : alsErntezeile(zeile);
}

/**
 * Trägt ein, was reif ist.
 *
 * Der Name kommt als Argument mit und wird **nicht** zurückgelesen: die
 * einfügende Person ist die angemeldete, ihr Name steht der Route ohnehin
 * schon zur Verfügung, und ein zweiter Lesevorgang ergäbe dasselbe.
 */
export function ernteEintragen(
	eingabe: {
		kultur: string;
		ort: string | null;
		status: Erntestatus;
		laufend: boolean;
		notiz: string | null;
	},
	mitglied: { id: number; name: string; kurzname: string | null }
): Erntezeile {
	const zeile = datenbank()
		.insert(harvests)
		.values({ ...eingabe, memberId: mitglied.id } satisfies NewHarvest)
		.returning({
			id: harvests.id,
			kultur: harvests.kultur,
			ort: harvests.ort,
			laufend: harvests.laufend,
			notiz: harvests.notiz,
			createdAt: harvests.createdAt,
		})
		.get();
	return {
		...zeile,
		status: eingabe.status,
		name: anzeigename(mitglied.name, mitglied.kurzname),
	};
}

/**
 * Stuft eine Zeile um.
 *
 * **Ohne Vorbedingung auf die alte Stufe.** Zwei Leute, die im selben
 * Augenblick dieselbe Zeile umstufen, sind kein Wettrennen, das jemand
 * verlieren müsste: beide haben gesehen, was im Beet steht, und die zweite
 * Angabe ist die jüngere. Eine Vorbedingung wiese die zweite ab und behauptete
 * damit, die erste sei richtiger.
 *
 * null heisst: die Zeile gibt es nicht mehr — jemand hat sie abgeerntet.
 */
export function ernteUmstufen(id: number, status: Erntestatus): Erntezeile | null {
	const zeile = datenbank()
		.update(harvests)
		.set({ status })
		.where(eq(harvests.id, id))
		.returning({ id: harvests.id })
		.get();
	return zeile === undefined ? null : erntezeileLesen(zeile.id);
}

/**
 * Setzt oder entfernt die Notiz einer Zeile (spec-notiz-und-kurzname.md,
 * 2026-10-26).
 *
 * **Ohne Vorbedingung auf die eintragende Person und ohne eine auf die alte
 * Notiz** — dieselbe Haltung wie beim Umstufen darüber, und aus demselben
 * Grund: wer im Beet steht und mehr weiss, schreibt es dazu, ohne die Person
 * zu suchen, die die Zeile angelegt hat. null entfernt die Notiz; die Notiz
 * kommt fertig geprüft herein (`notizPruefen` in src/lib/ernte.ts).
 *
 * **Aber mit einer Vorbedingung auf die Notiz, die die absendende Seite sah**
 * (`bekannteNotiz`, Review vom 2026-10-26): anders als beim Umstufen ist die
 * zweite Angabe nicht einfach die jüngere — sie ist Text, den jemand über
 * einen Text geschrieben hat, den er gar nicht gesehen hat. Dieselbe Bauform
 * wie mitgliedUmbenennen in ./members.ts. Ein gespeicherter Wert aus lauter
 * Leerzeichen zählt dabei wie keiner: die Anwendung schreibt ihn nie
 * (`notizPruefen` macht ihn zu null), und eine Zeile, die so in der Spalte
 * stünde, wäre sonst für immer gesperrt.
 *
 * null zurück heisst: die Zeile gibt es nicht mehr — jemand hat sie
 * abgeerntet —, oder ihre Notiz ist inzwischen eine andere.
 */
export function ernteNotizSetzen(
	id: number,
	notiz: string | null,
	bekannteNotiz: string | null
): Erntezeile | null {
	const zeile = datenbank()
		.update(harvests)
		.set({ notiz })
		.where(
			and(
				eq(harvests.id, id),
				bekannteNotiz === null
					? or(isNull(harvests.notiz), eq(sql`trim(${harvests.notiz})`, ''))
					: eq(harvests.notiz, bekannteNotiz)
			)
		)
		.returning({ id: harvests.id })
		.get();
	return zeile === undefined ? null : erntezeileLesen(zeile.id);
}

/**
 * Nimmt eine Zeile weg — **das erste von drei DELETEs dieses Produkts
 * ausserhalb der Verwaltung**, und das einzige, das der normale Ausgang eines
 * Zeilenlebens ist: sie ist abgeerntet. Die zwei anderen meinen etwas anderes
 * und stehen in ./treatments.ts (eine Richtigstellung) und ./sheets.ts (das
 * einzige mit einer Adminschranke davor); die Aufstellung im Ganzen steht an
 * blattLoeschen.
 *
 * Es gibt **keine** Bedingung auf die eintragende Person: abernten darf jede,
 * und das ist der Entscheid vom 2026-09-13. Wer im Garten steht und sieht, dass
 * nichts mehr da ist, soll das sagen dürfen, ohne die Person zu suchen, die es
 * eingetragen hat. Die Rückfrage in der action ist das Gegengewicht.
 *
 * Zurück kommt, was die Rückmeldung braucht — die Zeile ist danach fort und
 * lässt sich nicht mehr lesen.
 */
export function ernteAbernten(id: number): { kultur: string; ort: string | null } | null {
	const zeile = datenbank()
		.delete(harvests)
		.where(eq(harvests.id, id))
		.returning({ kultur: harvests.kultur, ort: harvests.ort })
		.get();
	return zeile === undefined ? null : zeile;
}
