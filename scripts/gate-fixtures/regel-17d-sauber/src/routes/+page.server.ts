/*
 * Gegenprobe zu Regel 16: actions da, geteilte Form gezogen, kein eigenes
 * abweisen. Die Erwaehnung von `function abweisen` in diesem Kommentar darf
 * nicht ausloesen -- Kommentare sind vor der Auswertung ausgeblendet.
 *
 * Erwartet sind null Treffer.
 */
import { abweisen } from '../lib/server/abweisen.ts';

export const actions = {
	ablegen: async () => abweisen('leer', 'text'),
};
