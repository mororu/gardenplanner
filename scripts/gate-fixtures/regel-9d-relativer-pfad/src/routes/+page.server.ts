import { datenbank } from '../lib/server/db/index.ts';

/*
 * Fehlerprobe zu Regel 9: dieselbe Datei über einen relativen Pfad mit
 * .ts-Endung. Wer nur nach dem Alias sucht, sieht diese Form nie.
 */
export const load = () => {
	return { handle: datenbank };
};

// import { datenbank } from '$lib/server/db';
// Dieser auskommentierte Import darf keinen Verstoss geben: ohneKommentare
// blendet Zeilenkommentare aus, bevor Regel 9 liest. Ohne diese Zeile hier
// wäre nichts belegt — mit ihr bleibt die erwartete Trefferzahl 1.
