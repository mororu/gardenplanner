---
id: SPEC-gartengemeinschaft-koordination
companions: [scope-priorities.md, ../../planning-artifacts/architecture/architecture-Gartenplaner-2026-08-26/ARCHITECTURE-SPINE.md]
sources: [../../brainstorming/brainstorm-gartengemeinschaft-koordination-2026-08-26/brainstorm-intent.md]
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Koordinationswerkzeug für die Gartengemeinschaft

## Why

Ein Schmerz, der eine Gemeinschaft von 20+ Gärtner\*innen mit 40+ Beeten und 2 Tunneln trägt: die Koordination liegt heute in Papierblättern, Threema-Nachrichten, Threema-Umfragen und den Köpfen von zwei bis drei erfahrenen Personen. Die Monatsplanung rotiert, aber die planende Person hat keinen Zugang zum tatsächlichen Ist-Zustand — sie plant aus alten Plänen, die Absicht dokumentieren statt Realität, und bekommt vor Ort gesagt, dass die Hälfte längst ausgesät ist. Gearbeitet wird asynchron und in wechselnder Besetzung — mal kommt eine Gruppe, mal eine einzelne Person —, sodass niemand weiss, was seit dem letzten Mal geschehen ist. Aufgaben ohne zugewiesene Verantwortung bleiben liegen, bis dieselben zwei Zuverlässigen sie ein zweites Mal selbst machen: eine Chat-Nachricht an 20 Leute ist Zuständigkeit für niemanden, ein Papierprotokoll löst nichts aus. Wer neu ist, erhält Aufgaben, die er ohne Vorwissen nicht sicher ausführen kann. Ziel ist Koordination ohne Koordinator — der aktuelle Stand liegt im System, nicht in Köpfen und Chatverläufen.

## Capabilities

- **CAP-1**
  - **intent:** Jede\*r Gärtner\*in kann sehen, welche Aufgaben aktuell offen sind, um beim Ankommen im Garten sofort zu wissen, was zu tun ist.
  - **success:** Eine Person, die die App auf ihrem eingerichteten Handy öffnet, benennt ohne Anleitung innerhalb von 15 Sekunden eine konkrete offene Aufgabe; zwischen Öffnen und Liste liegt kein weiterer Schritt.

- **CAP-2**
  - **intent:** Wer eine Aufgabe erledigt hat — oder feststellt, dass sie längst erledigt ist — kann sie als erledigt markieren, sodass sie für alle anderen von der Liste verschwindet.
  - **success:** Das Markieren erfordert nach dem Auffinden der Aufgabe genau eine Interaktion und keine Eingabe; die Aufgabe ist danach für alle anderen aus der offenen Liste verschwunden, sobald diese die Liste laden.

- **CAP-3**
  - **intent:** Die monatlich wechselnde planende Person kann ihren Monatsplan als Satz offener Aufgaben ablegen, damit er die Gemeinschaft dort erreicht, wo auch alles andere steht.
  - **success:** Eine planende Person überträgt einen realen Monatsplan in Grössenordnung 20–40 Aufgaben in einer Sitzung vollständig und beurteilt den Aufwand als nicht höher als die bisherige Papier- oder Chat-Variante.

- **CAP-4**
  - **intent:** Wer im Garten etwas entdeckt, das getan werden muss, kann vor Ort eine Aufgabe erfassen, ohne den Monatsplan anzufassen, damit Wetter- und Schädlingsereignisse die Liste aktuell halten.
  - **success:** Das Erfassen dauert auf dem Handy im Garten unter 30 Sekunden, und die Aufgabe erscheint für alle in derselben Liste wie die geplanten Aufgaben, ohne Unterschied in der Behandlung.

- **CAP-5**
  - **intent:** Verbindliche wochenweise Dienste sind bis drei Monate im Voraus namentlich zugeteilt, und die zuständige Person erfährt, dass ihre Woche läuft.
  - **success:** Für jede Woche der nächsten drei Monate benennt das System genau eine zuständige Person; die zuständige Person erkennt ihre laufende Woche, ohne im Plan suchen zu müssen; ein zugeteilter Name kann durch einen anderen ersetzt werden.

- **CAP-6**
  - **intent:** Eine unregelmässig anfallende verbindliche Einzelaufgabe kann ausgeschrieben und von einer Person verbindlich übernommen werden, damit Verantwortung nicht in einer Gruppennachricht verdunstet.
  - **success:** Eine ausgeschriebene Einzelaufgabe zeigt jederzeit an, ob sie übernommen ist und von wem; ein realer Setzling-Abholtermin wird ohne Threema-Umfrage vollständig besetzt.

- **CAP-7**
  - **intent:** Erfahrene Mitglieder können Nachschlagewissen als freie Textblätter ablegen, das unabhängig von einzelnen Beeten gilt, damit ihr Wissen abrufbar ist, ohne dass sie befragt werden müssen.
  - **success:** Ein Blatt zu guten Nachbarn wird einmalig erstellt und ist danach von jedem Handy auffindbar und lesbar, ohne dass pro Beet oder pro Pflanze etwas gepflegt wird.

- **CAP-8**
  - **intent:** Die Verwaltung kann eine Person in die Gemeinschaft aufnehmen oder ihren Zugang beenden, damit Verbindlichkeit immer an eine bekannte Person gebunden ist.
  - **success:** Eine neu aufgenommene Person erreicht über ihren persönlichen Link ohne weitere Eingabe die Aufgabenliste; nach dem Beenden des Zugangs führt derselbe Link zu keinem Zugang mehr, und die von dieser Person abgehakten Aufgaben bleiben in der Historie erhalten.

## Constraints

- Das System darf nie mehr verlangen als die kleinste Handlung, die schon von sich aus ein Motiv hat. Schliesst jede Form von Pflicht-Dokumentation aus.
- Kein Aufwand, der pro Beet oder pro Pflanze anfällt. Bei 40+ Beeten ist das ein Ausschlusskriterium — es schliesst Pflanzendatenbanken, Beet-Biografien und Foto-Dokumentation aus.
- Erledigen kostet genau eine Interaktion: kein Formular, kein Statusfeld, kein Pflichtkommentar, keine Begründung.
- Identität kommt aus einem persönlichen Einladungslink, nie aus einer Eingabe. Kein Passwort-Konto. Nach dem einmaligen Einlösen des Links liegt zwischen Öffnen und Aufgabenliste kein weiterer Schritt.
- Abhaken ist sofort für alle sichtbar. Es gibt kein privates Erledigen.
- Das Ablegen des Monatsplans darf netto keinen Mehraufwand gegenüber Papier oder Chat erzeugen, sonst tut es die rotierende Person nicht.
- Die drei Aufgabentypen bleiben strukturell getrennt: namenloser Aufgaben-Pool, namentlicher Dienstplan, Einzelaufgabe mit Anmeldung. Aufgaben im Pool erhalten keine Namen — Namen an allem macht das Werkzeug zum Dienstplan und vertreibt die spontan Kommenden.
- Mobile-first, bedienbar für 20+ Personen mit sehr unterschiedlicher Handy-Geduld.
- Identität ist ein Name, kein Konto: einmaliges Anmelden oder das Eintragen eines Benutzernamens genügt. Kein Passwort, kein Registrierungsvorgang mit Bestätigung.
- Nur online. Offline-Fähigkeit ist nicht gefordert, auch nicht für das Abhaken — das schliesst lokale Synchronisation und Konfliktauflösung aus dem Umfang aus.
- Offene Aufgaben verfallen nie. Nach drei Wochen ohne Abhaken werden sie sichtbar als überfällig hervorgehoben, bleiben aber in der Liste.

## Non-goals

- Beet-, Mischkultur- und Platzplanung. Keine Verträglichkeits-, Fruchtfolge- oder Belegungslogik.
- Pflanzendokumentation, Beet-Biografien, Foto-Dokumentation pro Beet.
- Erkennungshilfe, die Neuen Keimling von Unkraut unterscheiden hilft.
- Kein Ersatz für den Gruppenchat als Kommunikationskanal — dieses Werkzeug trägt Aufgaben und Verbindlichkeit, nicht Gespräch. Die Umfragen zur Aufgabenübernahme ersetzt es jedoch vollständig (CAP-6).
- Zurückgestellt, nicht verworfen (Details in `scope-priorities.md`): automatisch erzeugte Folgeaufgaben, Historie als eigene Ansicht.
- Kein Echtzeit-Abgleich zwischen Geräten. Die Liste ist aktuell, wenn sie geladen wird; es gibt keine Push-Kanäle und keinen Hintergrundabruf.
- Keine Tausch- oder Vertretungsverhandlung im System. Eine Dienstwoche wird neu besetzt, indem der Name ersetzt wird (CAP-5); wer mit wem tauscht, klären die Beteiligten unter sich.

## Success signal

Die planende Person des Folgemonats plant aus dem, was tatsächlich erledigt wurde, statt aus alten Plänen — und setzt keine Aufgabe an, die längst getan ist. Zweites Zeichen: eine liegengebliebene Folgeaufgabe wird von der Person übernommen, die als nächste im Garten ist, und nicht zum zweiten Mal von derselben erfahrenen Gärtnerin.

## Assumptions

- Bedienoberfläche auf Deutsch. Die Quelle nennt keine Sprache; die Gemeinschaft kommuniziert deutsch.
- Die Abhak-Spur genügt als Historie. Ein separates Protokollformat wird nicht gefordert.
- Die Schwelle für die Überfällig-Markierung ist auf drei Wochen gesetzt. Entschieden wurde „nach einigen Wochen"; ein konkreter Wert ist nötig, damit downstream gebaut werden kann.

## Open Questions

- Gibt es eine leichte Erkennungshilfe für Neue, die keine Dokumentation pro Beet bedeutet? Aktuell Non-goal, weil keine tragfähige Lösung gefunden wurde.

