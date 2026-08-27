/*
 * Fehlerprobe zu Regel 11, Serverseite: die actions heissen `aufnehmen` und
 * `widerrufen`. Das Markup daneben ruft `neuAusstellen` — ein Name, den es hier
 * nicht gibt.
 */
export const actions = {
	aufnehmen: async ({ request }: { request: Request }) => {
		const formular = await request.formData();
		return { name: String(formular.get('name')) };
	},
	widerrufen: async ({ request }: { request: Request }) => {
		const formular = await request.formData();
		return { id: String(formular.get('mitgliedId')) };
	},
};
