/*
 * Fehlerprobe zu Regel 16, Form a: die Seite zieht die geteilte Form **und**
 * erklaert daneben ein eigenes abweisen. Der Import ist da, damit die zweite
 * Form der Regel nicht mitzaehlt.
 *
 * Erwartet ist genau ein Treffer.
 */
import { abweisen } from '../lib/server/abweisen.ts';

function abweisen_eigen() {
	return null;
}

// Genau das, wogegen die Regel steht: eine zweite Fehlerform neben der einen.
function abweisen(satz: string) {
	return { fehler: satz };
}

export const actions = {
	ablegen: async () => {
		abweisen_eigen();
		return abweisen('leer');
	},
};
