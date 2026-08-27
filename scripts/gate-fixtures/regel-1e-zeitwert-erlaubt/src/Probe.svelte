<!--
	Gegenprobe zu Regel 1, Zeitteil: nichts hier darf fallen.

	Ohne diese Probe bliebe eine zu breite Fassung des Zeitteils im Selbsttest
	grün — die Fehlerprobe regel-1d-zeitwert wäre weiter erfüllt — und fiele
	erst als rätselhafter Verstoss im echten Baum auf. Fünf Stellen, jede mit
	ihrem eigenen Grund:

	  var(--duration-quick)      der vorgeschriebene Weg. Fiele er, wäre die
	                             Regel nicht zu schärfen, sondern zu löschen.
	  transition-duration: 0s    eine Null ist keine Gestaltungsentscheidung,
	                             sondern deren Abwesenheit — wie 0px beim Mass.
	  linear 3                   eine Zahl **ohne** Einheit im Wert einer
	                             Bewegungs-Eigenschaft: die Wiederholungszahl
	                             einer Animation ist keine Dauer.
	  transition-property        trägt Eigenschaftsnamen, nie eine Zeit.
	  cubic-bezier(0.4, 0, 0.2, 1)  vier Zahlen ohne Einheit in der
	                             Beschleunigungskurve.

	Erwartet sind darum **null** Treffer zu Regel 1. Schweigen ist hier der
	Nachweis.
-->
<p class="probe">Probe</p>
<p class="probe probe--zweite">Probe</p>

<style>
	.probe {
		background-color: var(--surface-raised);
		padding: var(--gutter);
		transition-property: color, background-color;
		transition-duration: var(--duration-quick);
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
	}

	.probe--zweite {
		transition: color var(--duration-quick) ease;
		transition-delay: 0s;
		animation: puls var(--duration-quick) linear 3;
	}
</style>
