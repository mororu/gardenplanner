// Die eine Form, aus der jede action abweist.
export function abweisen(satz: string, feld: string | null) {
	return { art: 'fehler', satz, feld };
}
