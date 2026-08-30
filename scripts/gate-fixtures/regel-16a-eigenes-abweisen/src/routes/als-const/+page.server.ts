/*
 * Die zweite Schreibweise desselben Verstosses: das eigene abweisen als
 * Zuweisung statt als Deklaration. Ein erster Entwurf der Regel sah nur
 * `function abweisen` und waere hier vorbeigekommen -- obwohl dies die
 * naheliegendere der zwei Formen ist.
 *
 * Der Import ist da, damit allein Form a faellt.
 */
import { abweisen } from '../../lib/server/abweisen.ts';

const abweisen = (satz: string) => ({ fehler: satz });

export const actions = {
	ablegen: async () => {
		return abweisen('leer');
	},
};
