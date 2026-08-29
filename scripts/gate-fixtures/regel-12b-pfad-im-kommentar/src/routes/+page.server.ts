/*
 * Gegenprobe zu Regel 11, Serverseite.
 *
 * Die drei Namen stehen so, wie das echte Modul sie schreibt: als Schlüssel
 * eines Objektliterals, mit destrukturierten Parametern und Pfeilfunktionen
 * darunter. Das ist der Grund, dass diese Probe etwas prüft — eine Regel, die
 * ihre Namen naiv über `\w+:` sucht, fände hier zusätzlich `locals`, `request`,
 * `art` und `meldung` und wäre damit nicht zu falsch, sondern zu nachsichtig:
 * sie hielte auch verschriebene Namen für vorhanden, solange sie irgendwo im
 * Rumpf als Schlüssel auftauchen.
 */
export const actions = {
	aufnehmen: async ({ request, locals }: { request: Request; locals: unknown }) => {
		const formular = await request.formData();
		return { art: 'aufgenommen', meldung: 'Aufgenommen.', wer: locals, name: formular.get('name') };
	},
	neuAusstellen: async ({ request }: { request: Request }) => {
		const formular = await request.formData();
		return { art: 'neuAusgestellt', meldung: 'Neu ausgestellt.', id: formular.get('mitgliedId') };
	},
	widerrufen: async ({ request }: { request: Request }) => {
		const formular = await request.formData();
		return { art: 'widerrufen', meldung: 'Widerrufen.', id: formular.get('mitgliedId') };
	},
};
