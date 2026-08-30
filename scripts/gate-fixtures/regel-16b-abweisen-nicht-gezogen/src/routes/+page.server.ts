/*
 * Fehlerprobe zu Regel 16, Form b: die Seite exportiert actions, zieht die
 * geteilte Form aber nicht. Sie weist auf eigene Faust ab, und das Markup
 * daneben liest ein Feld, das nie kommt.
 *
 * Erwartet ist genau ein Treffer.
 */
export const actions = {
	ablegen: async () => {
		return { art: 'kaputt', satz: 'geht nicht' };
	},
};
