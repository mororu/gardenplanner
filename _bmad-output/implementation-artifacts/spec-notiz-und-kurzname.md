---
title: 'Notiz an der Erntezeile und Kurzname je Person'
type: 'feature'
created: '2026-10-26'
status: 'draft'
baseline_commit: 'ccaafde26302b093187b9f1314e5ec40bfe34d6d'
review_loop_iteration: 0
context: ['spec-ernte-nach-beet.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** (a) Was jemand zur Ernte weiss, hat keinen Platz: „frühe Sorte, sehr gross, pflücken und evtl. kurz einfrieren", „wenig", „zuerst" (Liste vom 26.10.2026). (b) Auf der Erntekarte soll stehen, wer eingetragen hat; im Garten gibt es zwei Personen mit gleichem Vornamen und gleichem Anfangsbuchstaben des Nachnamens. `members.name` ist ein einziges Feld, ein Nachname lässt sich daraus nicht verlässlich lesen.

**Approach:** (a) Eine freiwillige Notiz an der Erntezeile. (b) Ein freiwilliger Kurzname je Person, gepflegt in der Verwaltung (Entscheid Manuel, 26.10.2026: Kurzname statt automatischer Ableitung).

## Boundaries & Constraints

**Always:**
- `harvests.notiz`: nullbar, leer = null, Längengrenze in TypeScript neben `ERNTE_HOECHSTLAENGE`. Im Eintragen-Formular ein freiwilliges Feld; auf der Karte klein unter der Kultur. **Später änderbar** an der Karte (eigene action, jedes aktive Mitglied darf, wie Umstufen; leeren entfernt die Notiz) — Entscheid Manuel, 26.10.2026.
- `members.kurzname`: nullbar. Leer gilt das erste Wort von `name`. In der Verwaltung beim Aufnehmen und Umbenennen setzbar.
- Die Verwaltung **warnt**, wenn zwei aktive Personen denselben angezeigten Kurznamen haben; sie weist nicht ab.
- Beide Spalten per Migration, vor dem Ausrollen Sicherung.
- Der Kurzname ersetzt den Namen **überall**, wo die Oberfläche eine Person nennt (Entscheid Manuel, 26.10.2026). Die Fundstellen werden vor dem Bau aus dem Baum gesucht, nicht von Hand aufgezählt (R2); die Verwaltung selbst zeigt weiter den vollen Namen.

**Ask First:** Eine Fundstelle, an der der volle Name nötig scheint (z. B. Rückfragen, Archiv).

**Never:** Den Nachnamen aus `name` ableiten.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output |
|----------|--------------|-----------------|
| Kein Kurzname | `Manuel Agner` | `Manuel` |
| Kurzname gesetzt | `Nici Müller`, Kurzname `Nici Mü` | `Nici Mü` |
| Doppelt | zwei aktive `Nici` ohne Kurzname | Warnung in der Verwaltung |
| Notiz leer | `` | keine Notizzeile |

</frozen-after-approval>

## Offene Fragen

1. ~~**Notiz ändern**~~ — geklärt am 26.10.2026: ja, später änderbar.
2. ~~**Kurzname überall?**~~ — geklärt am 26.10.2026: ja, überall.

## Spec Change Log

