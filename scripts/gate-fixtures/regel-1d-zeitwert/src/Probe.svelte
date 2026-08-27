<!--
	Fehlerprobe zu Regel 1, dritter Teil: rohe Zeitwerte.

	Der Massliteral-Teil der Regel prüfte nur px und rem. Ein hartes 140ms kam
	damit durch, und das Zeit-Token in src/app.html war von seinem ersten Tag an
	umgehbar — die Anwendung hat genau eine Animation, und wäre ihre Dauer als
	Zahl in einer Komponente gelandet, hätte die zweite ihre eigene Zahl
	mitgebracht.

	Vier Verletzungen, eine je Schreibweise:

	  transition (Kurzform)   140ms
	  transition-duration     0.2s
	  animation (Kurzform)    1.5s
	  animation-delay         500ms

	Das sind die vier, die scripts/gate.mjs als erwartete Zahl dieser Probe
	führt. Wer hier eine Verletzung hinzufügt oder wegnimmt, zieht die Zahl mit.
	Was **nicht** fallen darf, steht in der Gegenprobe
	regel-1e-zeitwert-erlaubt und ist dort einzeln begründet.
-->
<p class="probe">Probe</p>
<p class="probe probe--zweite">Probe</p>

<style>
	.probe {
		background-color: var(--surface-raised);
		padding: var(--gutter);
		transition: color 140ms ease;
		transition-duration: 0.2s;
	}

	.probe--zweite {
		animation: puls 1.5s infinite;
		animation-delay: 500ms;
	}
</style>
