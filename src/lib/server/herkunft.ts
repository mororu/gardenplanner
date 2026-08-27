/*
 * ORIGIN.
 *
 * Zwei Stellen brauchen den Wert und dieselbe Prüfung: der init-Hook, weil
 * adapter-node hinter nginx ohne ORIGIN jeden Formularversand als CSRF-Verstoss
 * abweist, und scripts/create-admin.ts, weil der ausgegebene Einladungslink
 * sonst unklickbar ist und das Klartext-Token damit verbraucht.
 *
 * Frei von SvelteKit-Importen, damit nacktes Node die Datei laden kann.
 */

/**
 * Gibt ORIGIN als reine Herkunft zurück — Schema, Host, Port, sonst nichts.
 * Wirft mit benannter Meldung, wenn der Wert fehlt, keine absolute
 * http(s)-Adresse ist oder mehr als eine Herkunft trägt.
 *
 * Ein Pfad, ein Abfrageteil, ein Fragment und Zugangsdaten werden **abgewiesen**
 * und nicht still weggeschnitten: `https://garten.example.ch/app?x=1` ergäbe den Link
 * `https://garten.example.ch/app?x=1/i/<token>`, und der ist unklickbar — das
 * Einmal-Token wäre dabei verbraucht, denn es erscheint genau einmal. Genau
 * diesen Fehlschlag soll die Funktion verhindern, also muss sie ihn benennen,
 * bevor ein Token entsteht. adapter-node erwartet ohnehin eine reine Herkunft.
 */
export function herkunftLesen(): string {
	const wert = process.env.ORIGIN?.trim();
	if (!wert) {
		throw new Error(
			'ORIGIN ist nicht gesetzt. Ohne diesen Wert weist adapter-node hinter einem\n' +
				'Reverse Proxy jeden POST einer form action als CSRF-Verstoss ab, und der\n' +
				'Einladungslink aus create-admin hätte keine Adresse.\n' +
				'Beispiel lokal: ORIGIN=http://localhost:5173'
		);
	}

	let adresse: URL;
	try {
		adresse = new URL(wert);
	} catch {
		throw new Error(
			`ORIGIN ist keine Adresse: ${wert}\n` +
				'Erwartet wird eine vollständige Herkunft, zum Beispiel https://garten.example.ch'
		);
	}
	if (adresse.protocol !== 'http:' && adresse.protocol !== 'https:') {
		throw new Error(
			`ORIGIN trägt das Schema ${adresse.protocol} — erwartet wird http oder https.\n` +
				'Beispiel: https://garten.example.ch'
		);
	}
	// Das Fragment steht ausdrücklich mit in dieser Prüfung. adresse.origin würde
	// es lautlos wegwerfen — und ein JSDoc, der "abgewiesen" verspricht, während
	// der Code schweigend zurechtbiegt, ist schlimmer als beides einzeln.
	if (
		(adresse.pathname !== '' && adresse.pathname !== '/') ||
		adresse.search !== '' ||
		adresse.hash !== ''
	) {
		throw new Error(
			`ORIGIN trägt mehr als eine Herkunft: ${wert}\n` +
				'Erwartet werden Schema, Host und höchstens ein Port — kein Pfad, kein\n' +
				'Abfrageteil, kein Fragment. Sonst ist der Einladungslink aus create-admin\n' +
				'unklickbar und das Klartext-Token verbraucht.\n' +
				`Gemeint war wohl: ${adresse.origin}`
		);
	}
	if (adresse.username !== '' || adresse.password !== '') {
		throw new Error(
			'ORIGIN trägt Zugangsdaten. Erwartet werden Schema, Host und höchstens ein Port.\n' +
				`Gemeint war wohl: ${adresse.origin}`
		);
	}

	// adresse.origin statt wert: das normalisiert den Host und wirft einen
	// Schrägstrich am Ende weg, ohne dass hier eine eigene Zeichenkettenkur nötig
	// ist. Alles, was origin sonst noch wegwerfen würde, ist oben schon
	// abgewiesen — die Funktion biegt nichts zurecht, was sie nicht benennt.
	return adresse.origin;
}
