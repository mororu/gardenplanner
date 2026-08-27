import { datenbank } from '$lib/server/db/index';

/*
 * Fehlerprobe zu Regel 9: dieselbe Datei, diesmal mit ausgeschriebenem /index.
 * Diese Form deckte in Iteration 1 keine Probe — genau die Form, die als
 * Akzeptanzkriterium stand.
 */
export const load = () => {
	return { handle: datenbank };
};
