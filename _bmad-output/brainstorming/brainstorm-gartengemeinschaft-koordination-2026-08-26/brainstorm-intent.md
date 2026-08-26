# Intent: Koordinationswerkzeug für die Gartengemeinschaft

**Quelle:** Brainstorming-Session vom 2026-08-26 (`.memlog.md`, 35 Einträge)
**Status:** Scope konvergiert, bereit für Product Brief / PRD / Spec

---

## Kontext

Gartengemeinschaft mit **20+ Gärtner\*innen**, **40+ Beeten** und **2 Tunneln**. Die Monatsplanung rotiert — jeden Monat plant eine andere Person, was zu tun ist. Gärtner\*innen kommen mal in der Gruppe, mal allein. Koordination läuft heute über Papier, Threema-Chat, Threema-Umfragen und das Gedächtnis von zwei bis drei erfahrenen Personen.

**Ziel:** Koordination ohne Koordinator. Der aktuelle Stand liegt im System, nicht in Köpfen und Chatverläufen.

**Plattform:** mobile-first, Bedienung so einfach, dass sie bei 20 Leuten mit sehr unterschiedlicher Handy-Geduld tatsächlich benutzt wird.

---

## Problemdiagnose

Vier Befunde aus der Session, jeder mit Belegfall:

**1. Planung scheitert am fehlenden Ist-Zustand, nicht an fehlender Mühe.**
Die planende Person sichtete alle vergangenen September-Pläne — ohne vor Ort zu sein. Rückmeldung: *„die Hälfte auf deinem Plan haben wir schon ausgesät."* Alte Pläne dokumentieren **Absicht, nicht Realität**. Was wirklich getan wurde, hat nie jemand festgehalten.

**2. Eine Aufgabe ohne Erkennungshilfe ist für Neue eine Falle.**
*„Beet 25, beim ausgesäten Nüsslisalat jäten"* ist für jemanden in der dritten Woche unbrauchbar — welches Pflänzchen ist der Salat? Das Risiko ist nicht Untätigkeit, sondern **zerstörerisches Handeln**: die Neue rupft die Kultur und traut sich danach an kein Beet mehr.

**3. Der Kernwiderspruch: Die App braucht Input von genau den Leuten, die keinen Nutzen von ihr haben.**
Die Wissensträgerin weiß, was zu tun ist — sie braucht die App nicht, müsste sie aber pflegen. Die Vielen brauchen die App — haben aber kein Wissen, das sie einspeisen könnten.

**4. Chat informiert alle und verpflichtet niemanden.**
Belegfall: Cora entdeckt Blattläuse, behandelt, notiert es auf einem Papierblatt („Wellnessbehandlung für Pflanzen"), setzt eine Chat-Notiz. Eine Woche später hat niemand die Folgebehandlung gemacht — also macht sie die erfahrenste Gärtnerin zum zweiten Mal selbst. **Ein Log löst nichts aus. Eine Broadcast-Nachricht an 20 Leute ist Zuständigkeit für niemanden.** Wo niemand zuständig ist, absorbieren immer dieselben zwei Zuverlässigen die Lücke.

---

## Auflösung — die tragende Produktidee

**Niemand pflegt. Es wird abgehakt.**

Die Wissensträgerin würde einem falschen To-Do nicht *widersprechen* — sie will nicht die Nervensäge sein. Aber sie würde es **als gemacht notieren**. „Erledigt" hat keine sozialen Kosten, erzielt aber dieselbe Wirkung wie ein Veto: das falsche To-Do ist von der Liste.

**Daraus folgt: eine einzige Geste — Abhaken — erledigt drei Jobs gleichzeitig:**

| Job | Wirkung |
|---|---|
| Fortschritt melden | Die Samstagsgruppe sieht, was schon weg ist |
| Falsches korrigieren | Was längst getan ist, verschwindet ohne Diskussion |
| Historie bauen | Die Abhak-Spur *ist* das Protokoll — genau die Quelle, die der Planung fehlte |

Punkt 3 ist der Hebel: die Historie entsteht als **Abfallprodukt**, ohne jeden Dokumentationsaufwand.

### Leitregel für jede Design-Entscheidung

> **Das System darf nie mehr verlangen als die kleinste Handlung, die schon von sich aus ein Motiv hat.**

Dokumentieren hat kein Motiv. Abhaken hat eins — es erspart die nächste Diskussion. Aufwand, der *pro Pflanze und pro Beet* anfällt, skaliert bei 40+ Beeten in etwas, das niemand macht. Das ist ein K.o.-Kriterium, kein Detail.

---

## Drei Verbindlichkeitsstufen

Der zentrale strukturelle Befund: Aufgaben sind **nicht** alle gleich. Es gibt drei Typen, die nicht vermischt werden dürfen.

| Stufe | Beispiel | Name? | Horizont | Heute gelöst durch |
|---|---|---|---|---|
| **To-Do-Pool** | jäten, ernten | nein — wer auch immer kommt | jetzt | Monatsplan auf Papier, Chat |
| **Dienstplan** | Tränkeplan | ja, verbindlich | 3 Monate im Voraus, Wochenrotation | bestehende Aufteilung |
| **Einzelaufgabe mit Anmeldung** | Setzlinge abholen | ja, freiwillig belegt | unregelmässig, kurzfristig | Threema-Umfrage |

Dienstplan und To-Do-Pool berühren sich an **genau einer** Stelle: die App muss mir sagen *„diese Woche bist du dran."*

Quer zu allen dreien: **Referenz-Sheets** — Nachschlagewissen, kein Aufgaben-Ding.

---

## Scope (MoSCoW)

### MUST — das MVP

1. **Offene To-Dos sehen** — App auf, Liste da, keine Login-Hürde. *Das eine Feature: „die meisten möchten wissen, was zu tun ist."*
2. **Abhaken** — die einzige Geste, für alle sofort sichtbar
3. **Monatsplan in die App eintragen** — die planende Person tippt ihren Plan dorthin statt auf Papier; netto **null** Mehraufwand, nur eine andere Oberfläche
4. **Ad-hoc To-Do erfassen** — wer im Feld etwas entdeckt oder erledigt, trägt es ein. Ohne das veraltet die Liste innerhalb einer Woche (Wetter, Schädlinge)
5. **Tränke-Dienstplan mit Namen** + Hinweis „diese Woche bist du dran"
6. **Setzlinge als verbindliche Einzelaufgabe mit Anmeldung** — ersetzt die Threema-Umfrage

### SHOULD

7. **Referenz-Sheets ablegen** — gute Nachbarn (Mischkultur), Starkzehrer. Einmal geschrieben, kein Pflegeaufwand pro Beet

### COULD

8. **Folge-To-Do („wieder wann?")** — eine Behandlung heute erzeugt automatisch das To-Do in 7 Tagen
9. **Historie als eigene Ansicht** — entsteht aus dem Abhaken ohnehin
10. **Tauschmechanik im Dienstplan** — Urlaub, Krankheit im 3-Monats-Horizont

### WON'T this time — bewusst ausgeschlossen

11. **Erkennungshilfe für Neue** — das Nüsslisalat-Problem bleibt offen; die Foto-Route wurde als zu aufwendig verworfen, eine leichtere Lösung existiert noch nicht
12. **Beet-, Mischkultur- und Platzplanung** — zurückgestellt
13. **Beet-Biografien / Pflanzendokumentation** — verworfen: Aufwand pro Pflanze ist das K.o.-Kriterium

---

## Zwei Beobachtungen für die Umsetzung

**Verbindlichkeit schlägt Komfort.** Jedes MUST ist eine Stelle, an der heute Verantwortung diffus ist (Threema-Umfrage, Chat-Notiz, Papierblatt, Gedächtnis). Jedes COULD ist Komfort-Automatik. Deshalb ist „Setzlinge" ein MUST und „Folge-To-Do" nur ein COULD. **Das Produkt ist kein Gartenplaner — es ist ein Verbindlichkeitswerkzeug.** Der Projektname führt in die Irre.

**Das gesamte Adoptionsrisiko sitzt in einer einzigen Geste.** Fünf der sechs MUST-Punkte existieren heute bereits als Praxis und werden lediglich verschoben. **Neu ist nur das Abhaken.** Wenn sich das einbürgert, funktioniert alles; wenn nicht, ist die App nur eine hübschere Ablage. Diese Wette ist billig testbar — notfalls einen Monat mit einer Kreidetafel am Gartenhaus, bevor eine Zeile Code entsteht.

---

## Offene Fragen

- Wie wird im Dienstplan **getauscht**, wenn jemand in seiner zugeteilten Woche in den Ferien ist? (läuft heute vermutlich per Chat)
- Was passiert mit To-Dos, die **monatelang niemand abhakt** — verfallen, eskalieren, sichtbar altern?
- Gibt es eine **leichte** Erkennungshilfe für Neue, die nicht Dokumentation pro Beet bedeutet?
- **Koexistenz mit Threema:** ersetzt die App die Umfragen ganz, oder laufen beide parallel?
