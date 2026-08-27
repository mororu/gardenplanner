import { datenbank } from '$lib/server/db';

/*
 * Fehlerprobe zu Regel 9: das Datenbank-Handle als $lib/server/db, also über
 * den Verzeichnisnamen ohne /index.
 */
export const load = () => {
	return { handle: datenbank };
};
