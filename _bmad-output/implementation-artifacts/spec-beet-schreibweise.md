---
title: 'Eine Schreibweise je Beet, auf Ernte und Wellness'
type: 'feature'
created: '2026-10-26'
status: 'draft'
baseline_commit: 'ccaafde26302b093187b9f1314e5ec40bfe34d6d'
review_loop_iteration: 0
context: ['spec-ernte-nach-beet.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Der Ort ist Freitext und wird Zeichen für Zeichen verglichen. `42`, `Beet 42` und `B42` sind damit drei Beete, und die Gliederung nach Beet zerfällt. Die reale Liste vom 26.10.2026 mischt `6`, `B2`, `16/17`, `TU`, `Sector C`, `XY`.

**Approach:** Eine Nummer meint immer ein Beet. Die App schreibt den Ort in eine feste Form, bevor er gespeichert wird, und vorhandene Zeilen werden einmal in dieselbe Form gebracht. Gilt für Ernte **und** Wellness (Entscheid Manuel, 26.10.2026, Punkt C).

## Boundaries & Constraints

**Always:**
- Feste Form `Beet {Nummer}`: `42`, `Beet 42`, `beet 42`, `B42`, `B 42` werden zu `Beet 42`; `16/17` zu `Beet 16/17`; `B2` zu `Beet 2` (Entscheid: B2 = Beet 2).
- `Beet` kommt **nur vor eine reine Nummer** (Ziffern, auch `16/17`, auch mit vorangestelltem `B`). Jede andere Bezeichnung (`Sector C`, `XY`, `Tunnel`, `Tunnel 2`) überschreibt das vorbelegte `Beet ` und bleibt, wie sie geschrieben ist (Entscheid Manuel, 26.10.2026). Einzige Umschreibung ohne Nummer: `TU` wird zu `Tunnel` (Entscheid: TU = Tunnel).
- Die Vorbelegung `Beet ` im Ortsfeld bleibt (`ORT_VORGABE`, auf Ernte und Wellness schon heute) und ist überschreibbar.
- Die Regel steht an **einer** Stelle in `src/lib/` und wird von beiden actions und der einmaligen Umschreibung gelesen.
- Die einmalige Umschreibung vorhandener Zeilen ist eine Migration, vor dem Ausrollen mit Sicherung (`scripts/backup.sh`).

**Ask First:** Jede Form, die nicht in der Matrix steht.

**Never:** Gross/Klein von Namen ohne Nummer ändern (`Sector C` bleibt `Sector C`); eine Beet-Tabelle.

## I/O & Edge-Case Matrix

| Scenario | Input | Gespeichert |
|----------|-------|-------------|
| Nur Nummer | `42` | `Beet 42` |
| Schon richtig | `Beet 42` | `Beet 42` |
| Kürzel | `B2` | `Beet 2` |
| Doppelbeet | `33/34` | `Beet 33/34` |
| Tunnel | `TU`, `Tunnel 2` | `Tunnel`, `Tunnel 2` |
| Ohne Nummer | `Sector C`, `XY` | unverändert |
| Leer | `Beet ` | null |

</frozen-after-approval>

## Offene Fragen

1. ~~**`Sector C` und `XY`**~~ — geklärt am 26.10.2026: Bezeichnungen ohne Nummer überschreiben `Beet` und bleiben unverändert (Manuel).
2. ~~**Wellness**~~ — bestätigt am 26.10.2026 (Manuel): Wellness wird gleich vereinheitlicht wie die Ernte — beim Eintragen, beim Ändern einer Behandlung und in der einmaligen Umschreibung vorhandener Zeilen. Danach fallen `42` und `Beet 42` auch im Tagebuch, in `Steht wieder an` und im Archiv auf ein Beet. `spec-wellness-tagebuch-gebuendelt.md` (_Never_: „Normalisieren ... beim Bündeln") bleibt wörtlich richtig, weil nicht beim Bündeln, sondern beim Speichern vereinheitlicht wird; der Eintrag dort bekommt beim Bau einen Verweis hierher.

## Spec Change Log

