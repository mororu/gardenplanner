/*
 * Fehlerprobe zu Regel 16, Form c: das Modul ist da, aber sein Export heisst
 * anders. Form a und b bleiben gruen -- die Seite erklaert nichts Eigenes und
 * zieht brav aus diesem Pfad -- und trotzdem faellt jede action zugleich.
 *
 * Erwartet ist genau ein Treffer.
 */
export function zurueckweisen(satz: string, feld: string | null) {
	return { art: 'fehler', satz, feld };
}
