---
name: dataverse-ce-app-doku
description: >
  Erstellt oder aktualisiert eine vollständige technische Onboarding-
  Dokumentation für Dynamics 365 CE / Dataverse Model-Driven Apps aus einem
  Solution-Export und dem ORBIS.ProcessDoc-/ORBIS.PluginDoc-Repository oder
  dessen Export. Der Standard-Output ist eine Markdown-Datei mit direkt
  eingebetteten Mermaid-Diagrammen; optional wird eine lokale HTML-Ansicht
  erzeugt. Verwenden bei Anfragen zu Dataverse-App-Dokumentation,
  Dynamics-365-CE-Dokumentation, Model-Driven-App-Dokumentation,
  ORBIS.ProcessDoc, ORBIS.PluginDoc, Solution-Dokumentation, FormScripting,
  Datenmodell, Plugins, Workflows, Business Rules, Ribbon, Security oder ALM.
version: 1.1.0
argument-hint: "[solution.zip] [ORBIS.ProcessDoc-Repo oder PluginDoc-Export] [output-dir] [--modus=technisch|kunde]"
license: Local use only. No warranty. Customer data stays local.
---

# Dataverse CE App Documentation

Du erstellst eine belastbare technische Onboarding-Dokumentation für eine
Dynamics 365 CE / Dataverse Model-Driven App. Kommuniziere mit dem Nutzer auf
Deutsch; technische Bezeichner bleiben in der Originalsprache.

## Verbindliche Methodik laden

Rufe vor Analyse, Planung oder Dateierzeugung immer zuerst das Tool
`dataverse_ce_app_doku_guidelines` auf. Seine gegen den echten Quellcode von
ORBIS.PluginDoc verifizierten Richtlinien sind die verbindliche Detailmethodik
für:

- erwartete Eingaben und den Umgang mit fehlenden Quellen,
- Solution- und FormXml-Analyse,
- Live-Lauf oder Wiederverwendung eines ORBIS.PluginDoc-Exports,
- Plugins, Classic/Modern Workflows, Business Rules und Scripts,
- Abgleich von Script-Dependencies mit Form- und Ribbon-Events,
- 19-Kapitel-Gliederung, ADRs und Mermaid-Diagramme,
- Markdown-, HTML- und optionale PDF-Ausgabe.

Falls das Tool nicht verfügbar ist, brich nicht ab. Arbeite mit den
Mindestregeln und dem Workflow dieser Datei weiter und kennzeichne in der
Dokumentation, dass die erweiterte ORBIS.PluginDoc-Methodik nicht geladen
werden konnte.

## Zwei Ausgabemodi

Diese Skill unterstützt zwei Liefergegenstände; das Tool `dataverse_ce_app_doku_guidelines`
enthält die volle Methodik zu beiden:

- **Modus „technisch" (Standard)** — 19-Kapitel-Onboarding-Dokumentation für
  übernehmende Entwickler (Datenmodell, FormScripting, Ribbon, Plugins,
  Workflows, Business Rules, Security, ALM …).
- **Modus „kunde"** — beratungsfähige Kunden-Rollout-Dokumentation
  (Management Summary, Lösungsarchitektur, Security-Konzept mit
  Berechtigungsmatrix, Datenmodell, Geschäftsprozesse, Customizing-Übersicht,
  Automatisierungen, Rollout-relevante Informationen, Betriebskonzept, offene
  Punkte). Aktivieren, wenn der Auftrag Wissensübergabe an ein Kundenteam,
  Security-Konzept oder Rollout-Vorbereitung nennt (z. B. als Senior D365 CE
  Solution Architect/Functional Consultant). Ergebnisdatei z. B.
  `kundendokumentation.md`.

Bei Unklarheit den Nutzer fragen, welcher Modus gewünscht ist, statt zu raten.

## Erwartete Eingaben

Primär werden zwei Quellen benötigt:

1. Ein unmanaged oder managed Dataverse-Solution-Export (`.zip`) der Default-
   oder Ziel-Solution. Eine bereits entpackte Solution ist ebenfalls zulässig.
2. Das ORBIS.ProcessDoc-/ORBIS.PluginDoc-Repository plus Live-Zugang zu
   Dataverse oder ein vorhandener Export aus `outputMarkdown.md` und den
   zugehörigen `*.mmd`-Dateien.

Optional können Webresource-Quellcode, vorhandene Architekturunterlagen,
Deployment-Pipelines und Betriebsdokumentation ergänzt werden.

Fehlende Quellen niemals durch erfundene Inhalte, Zugangsdaten oder
Connection-Strings ersetzen. Fehlende Informationen als `Offener Punkt`
markieren und Quelle, Auswirkung sowie nächsten Erhebungsschritt nennen.

## Nicht verhandelbare Regeln

1. **Standardausgabe ist Markdown.** Erzeuge eine zusammenhängende `doku.md`
   mit nativen `mermaid`-Codeblöcken. Verweise nicht nur auf externe `.mmd`-
   Dateien oder gerenderte Bilder.
2. **HTML ist optional.** Erzeuge eine lokale HTML-Ansicht nur auf Wunsch oder
   wenn sie im Auftrag ausdrücklich enthalten ist.
3. **PDF ist kein Standard.** Die Docker/Pandoc/eisvogel-Pipeline des
   Original-Tools ist nur eine optionale Alternativausgabe.
4. **Keine JS-Funktionsnamen erfinden.** ORBIS.PluginDoc ermittelt
   Webresource-Nutzung über Dataverse-Dependencies; konkrete Handler kommen
   aus FormXml/Ribbon oder aus tatsächlich bereitgestelltem JavaScript.
5. **Quellen kennzeichnen.** Unterscheide je Aussage mindestens zwischen
   Solution, FormXml, Ribbon, ORBIS.PluginDoc, Webresource-Code und
   manueller/Bestandsdokumentation.
6. **Kundendaten lokal halten.** Lade Solution, Tool-Output, Quellcode oder
   Zugangsdaten nicht zu Drittdiensten hoch.
7. **Secrets nicht dokumentieren.** Secure/Unsecure Plugin Configuration,
   Connection Strings, Passwörter und Tokens redigieren. Dokumentiere nur,
   dass eine Konfiguration existiert und wie sie sicher verwaltet wird.
8. **Keine Vollständigkeit ohne Beleg.** Nenne fehlende Komponenten,
   deaktivierte `D365_SHOW_*`-Flags, Filter und nicht verfügbare Live-Daten.

## Workflow

### 1. Intake und Arbeitsverzeichnis

- Prüfe Dateitypen und Verzeichnisstruktur beider Quellen.
- Entpacke Eingaben nur in einen klar benannten lokalen Arbeitsordner.
- Erfasse Solution-Name, Version, Publisher, Managed-Status,
  ORBIS.PluginDoc-Version/Commit und Zeitpunkt des Exports.
- Dokumentiere aktive PluginDoc-Filter und `D365_SHOW_*`-Flags, soweit
  feststellbar.

### 2. Solution analysieren

Extrahiere mindestens:

- Tabellen, Spalten, Datentypen, Required-Level, Keys und Beziehungen,
- Choices/Option Sets und Status-/State-Werte,
- Model-Driven App, Sitemap, Areas, Groups und Subareas,
- Main-/Quick-Create-/Quick-View-Formulare, Tabs, Sections und Controls,
- FormXml-Events, Libraries, Handler, Parameter und Aktivierungsstatus,
- Views, Charts und Dashboards,
- Command Bar/Ribbon Commands, Enable-/Display-Rules und JavaScript-Aktionen,
- Security Roles, Field Security Profiles, Teams und App-Zugriff, soweit im
  Export enthalten,
- Environment Variables, Connection References, Custom APIs und weitere
  integrationsrelevante Komponenten,
- Solution Layering, Dependencies und ALM-relevante Metadaten.

### 3. ORBIS.PluginDoc auswerten

Nutze entweder einen Live-Lauf des bereitgestellten Repositories oder einen
vorhandenen Export. Ein Live-Lauf darf nur mit vom Nutzer bereitgestellten,
lokal gesetzten Zugangsdaten erfolgen.

Erfasse:

- Plugin Assemblies, Types, Steps, Message, Entity, Stage, Mode, Rank,
  Filtering Attributes und Images,
- Classic Workflows inklusive Trigger/Scope und XAML-basiertem Mermaid-Flow,
- Modern Workflows/Power Automate inklusive Trigger, Aktionen,
  Bedingungen, Switches und Foreach-Zweigen,
- Backend Business Rules mit den tatsächlich exportierten Metadaten,
- Script-Webresources und ihre `UsedBy`-/`Uses`-Dependencies.

Übernimm den Inhalt jeder `*.mmd`-Datei in einen nativen Mermaid-Codeblock der
Zieldokumentation. Bereinige nur Darstellungsfehler; ändere nicht stillschweigend
die fachliche Prozesslogik.

### 4. Quellen korrelieren

- Verbinde Tabellen/Spalten mit Formularen, Views, Plugins, Workflows und
  Business Rules.
- Verbinde Script-Dependencies mit FormXml-Handlern und Ribbon Commands.
- Markiere Referenzen, die nur in einer Quelle vorkommen.
- Kennzeichne verwaiste, deaktivierte oder potenziell obsolete Komponenten
  als Befund, nicht automatisch als Löschkandidat.
- Leite Integrationspunkte und technische Abhängigkeiten mit Quellenbeleg ab.

### 5. Dokumentation erzeugen

Je nach gewähltem Modus (siehe oben) eine von zwei Gliederungen befüllen; beide
sind in `dataverse_ce_app_doku_guidelines` vollständig beschrieben.

**Modus „technisch"** — die `doku.md` soll mindestens diese Kapitel enthalten:

1. Dokumentstatus und Scope
2. Executive Summary
3. Systemkontext und Architektur
4. Solution- und App-Struktur
5. Datenmodell
6. Tabellen, Spalten und Choices
7. Formulare und FormScripting
8. Ribbon/Command Bar
9. Views, Charts und Dashboards
10. Plugins
11. Classic Workflows
12. Modern Workflows/Power Automate
13. Business Rules
14. Webresources und Dependencies
15. Integrationen und Schnittstellen
16. Security und Berechtigungen
17. ALM, Deployment und Konfiguration
18. Betrieb, Fehleranalyse und Testkonzept
19. ADRs, Risiken, offene Punkte und Onboarding-Checkliste

**Modus „kunde"** — die `kundendokumentation.md` soll diese Kapitel enthalten:

1. Management Summary
2. Lösungsarchitektur
3. Security-Konzept (Sicherheitsmodell, Berechtigungsmatrix, Feld-/
   Datensicherheit, Rollout-/Governance-Empfehlungen)
4. Datenmodell (je Tabelle: Zweck, Ownership, Beziehungen, Schlüssel-/
   Pflichtfelder, kundenspezifische Felder)
5. Geschäftsprozesse (je Prozess: Zweck, Auslöser, Schritte, Rollen, Tabellen,
   Sonderlogiken, Abhängigkeiten)
6. Customizing-Übersicht (Formulare, Ansichten, Business Rules, BPFs,
   Dashboards, Apps, JavaScript, Plug-ins, Custom APIs, Power-Automate-Flows)
7. Automatisierungen (Workflows, Power Automate, Plug-ins, Trigger, Aktionen,
   Fehlerbehandlung)
8. Rollout-relevante Informationen
9. Betriebskonzept
10. Offene Punkte und Empfehlungen

In beiden Modi mindestens Mermaid-Diagramme für:

- Systemkontext,
- relevantes Datenmodell/ER-Modell,
- zentrale Prozessabläufe,
- Plugin-/Workflow-Ausführung, wenn daraus ein verständlicher Ablauf
  abgeleitet werden kann.

Große Datenmodelle nach Domänen aufteilen und zusätzlich ein übersichtliches
Gesamtbild liefern. In Mermaid keine Secrets, personenbezogenen Beispieldaten
oder instanzspezifischen URLs aufnehmen.

### 6. Optionalen HTML-Viewer erzeugen

Wenn HTML verlangt wird:

- `doku.md` bleibt die Single Source of Truth.
- Verwende lokale, vendorte JavaScript-Abhängigkeiten statt CDNs.
- Rendere Markdown und Mermaid clientseitig.
- Erzeuge Inhaltsverzeichnis, Suche und Zoom für Diagramme.
- Unterstütze lokalen Serverbetrieb und direktes `file://`-Öffnen.
- Prüfe UTF-8-Darstellung und Navigation.

### 7. Qualität sichern

- Prüfe, dass alle erwarteten Kapitel vorhanden sind.
- Prüfe jeden Mermaid-Codeblock auf Syntax.
- Suche nach nicht redigierten Secrets und Zugangsdaten.
- Prüfe Stichproben gegen jede Eingangsquelle.
- Liste Abdeckung, Filter, Annahmen und offene Punkte explizit auf.
- Entferne temporäre Extraktionsdaten nur, wenn sie eindeutig zu diesem Lauf
  gehören und nicht mehr für Nachvollziehbarkeit oder Übergabe benötigt werden.

## Abschlussausgabe

Nenne den Pfad zur erzeugten `doku.md` und gegebenenfalls zur HTML-Ansicht.
Fasse nur wesentliche Abdeckungslücken und blockierende offene Punkte zusammen.
Behaupte keine vollständige Dokumentation, wenn eine der beiden Primärquellen
oder relevante PluginDoc-Komponententypen fehlen.
