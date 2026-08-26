# Scope-Prioritäten (MoSCoW)

Companion zu `SPEC.md`. Die Kernel-Capabilities tragen keine Priorität; sie steht hier. Epics, Stories und Sprint-Planung lesen diese Tabelle, um die Reihenfolge zu bestimmen.

## MUST — das MVP

| Capability | Kurz |
|---|---|
| CAP-1 | Offene Aufgaben sehen, ohne Anmeldehürde |
| CAP-2 | Abhaken |
| CAP-3 | Monatsplan ablegen |
| CAP-4 | Ad-hoc Aufgabe erfassen |
| CAP-5 | Dienstplan mit Namen + „diese Woche bist du dran" |
| CAP-6 | Einzelaufgabe mit Anmeldung |
| CAP-8 | Mitglieder aufnehmen und Zugang beenden |

## SHOULD

| Capability | Kurz |
|---|---|
| CAP-7 | Referenz-Sheets (gute Nachbarn, Starkzehrer) |

## COULD — zurückgestellt, nicht verworfen

Kein Kernel-Capability. Erst nach dem MUST-Satz zu bewerten.

| Thema | Beschreibung |
|---|---|
| Folgeaufgabe automatisch | Beim Erfassen genau eine Zusatzfrage („wieder wann?"), die eine Aufgabe in *n* Tagen erzeugt. Belegfall: die zweite Blattlaus-Behandlung. |
| Historie als eigene Ansicht | Entsteht aus dem Abhaken ohnehin; eine dedizierte Ansicht ist Komfort. |

**Aufgelöst am 2026-08-26:** Die Tauschmechanik stand hier, ist aber entschieden und trivial — eine Dienstwoche wird durch Ersetzen des Namens neu besetzt. Sie ist in CAP-5 eingegangen und kein COULD mehr.

## WON'T this time — verworfen, mit Grund

| Thema | Grund |
|---|---|
| Beet-, Mischkultur- und Platzplanung | Bewusst zurückgestellt, um das MVP schmal zu halten |
| Pflanzendokumentation, Beet-Biografien, Fotos pro Beet | Verstösst gegen den Constraint „kein Aufwand pro Beet oder pro Pflanze" — Ausschlusskriterium bei 40+ Beeten |
| Erkennungshilfe für Neue (Keimling vs. Unkraut) | Reales Problem (belegter Fall: Nüsslisalat in Beet 25), aber keine Lösung gefunden, die den Aufwands-Constraint einhält |

## Priorisierungsprinzip

CAP-8 ist MUST, weil die Einladungslinks aus der Architektur (AD-3, AD-10, AD-11) ohne Verwaltung nicht existieren können — ohne sie kommt niemand in die Anwendung.

**Verbindlichkeit schlägt Komfort.** Jedes MUST ist eine Stelle, an der heute Verantwortung diffus ist — Threema-Umfrage, Chat-Notiz, Papierblatt, Gedächtnis einzelner Personen. Jedes COULD ist Komfort-Automatik. Deshalb steht CAP-6 (Einzelaufgabe mit Anmeldung) im MUST und die automatische Folgeaufgabe nur im COULD, obwohl letztere technisch einfacher ist.

## Risikohinweis für die Planung

Fünf der sieben MUST-Capabilities verschieben eine Praxis, die es heute schon gibt (Monatsplan, Papierblatt für Ad-hoc-Beobachtungen, Tränkeplan, Threema-Umfrage, „was ist zu tun"). **Neu ist allein CAP-2, das Abhaken.** Das gesamte Adoptionsrisiko sitzt dort: bürgert es sich ein, trägt alles andere; bürgert es sich nicht ein, ist das Werkzeug eine hübschere Ablage. Diese Annahme ist ohne Code prüfbar — etwa einen Monat mit einer Tafel am Gartenhaus.
