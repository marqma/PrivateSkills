# Skill-Dokumentation

Diese Übersicht beschreibt alle Skills im Verzeichnis `skills\`: welche Aufgabe sie erfüllen, mit welchen Prompts bzw. Commands sie typischerweise ausgelöst werden und wie ein Beispiel-Use-Case aussehen kann.

## Überblick

| Skill | Zweck | Typische Auslöser |
|---|---|---|
| `dataverse-ce-app-doku` | Technische Onboarding-Dokumentation für Dynamics 365 CE / Dataverse Model-Driven Apps aus Solution-Export und ORBIS.ProcessDoc-/ORBIS.PluginDoc-Daten erstellen oder aktualisieren. | Dataverse-App-Dokumentation, Dynamics-365-CE-Dokumentation, Model-Driven-App-Dokumentation, ORBIS.ProcessDoc, ORBIS.PluginDoc, Solution-Dokumentation |
| `dataverse-code-review` | Dataverse-/Dynamics-365-Änderungen evidenzbasiert reviewen: C# Plug-ins, Custom APIs, TypeScript Webresources, PCF, Solution-Metadaten, ALM und Tests. | Dataverse Code Review, D365 PR Review, Plug-in Review, Custom API Review, TypeScript Webresource Review, PCF Review |
| `power-platform-log-analyst` | Dataverse Logs, Plugin Trace Logs, .NET Stacktraces und Application-Insights-/Log-Analytics-Exporte lokal analysieren und Berichte erzeugen. | Dataverse-Logs, Plugin Trace Log, Application Insights Export, Log Analytics KQL Export, Root-Cause Report, Performance Regression |
| `web-design-guidelines` | UI-Code gegen die aktuellen Web Interface Guidelines prüfen, inklusive Accessibility-, UX- und Design-Audit. | `review my UI`, `check accessibility`, `audit design`, `review UX`, `check my site against best practices` |

## `dataverse-ce-app-doku`

### Was macht der Skill?

Der Skill erstellt oder aktualisiert eine vollständige technische Onboarding-Dokumentation für eine Dynamics 365 CE / Dataverse Model-Driven App. Der Standard-Output ist eine zusammenhängende Markdown-Datei mit direkt eingebetteten Mermaid-Diagrammen. Optional kann zusätzlich eine lokale HTML-Ansicht erzeugt werden.

Die Dokumentation basiert auf zwei Primärquellen:

1. Dataverse-Solution-Export (`.zip`) oder bereits entpackte Solution.
2. ORBIS.ProcessDoc-/ORBIS.PluginDoc-Repository mit Live-Zugang oder vorhandener ORBIS.PluginDoc-Export mit `outputMarkdown.md` und `*.mmd`-Dateien.

Der Skill dokumentiert unter anderem Solution-Struktur, Datenmodell, Formulare, FormScripting, Ribbon/Command Bar, Views, Dashboards, Plug-ins, Classic Workflows, Modern Workflows, Business Rules, Webresources, Integrationen, Security, ALM, Betrieb, Risiken und offene Punkte.

### Commands und Auslöser

| Command / Prompt | Bedeutung |
|---|---|
| `dataverse-ce-app-doku [solution.zip] [ORBIS.ProcessDoc-Repo oder PluginDoc-Export] [output-dir]` | Erwartetes Argumentmuster für eine vollständige Dokumentation. |
| `Erstelle eine technische Doku für diese Dataverse Solution ...` | Startet die Dokumentation aus Solution-Export und Zusatzquellen. |
| `Aktualisiere die Dynamics 365 CE Dokumentation mit diesem PluginDoc Export ...` | Aktualisiert eine vorhandene Dokumentation anhand neuer PluginDoc-/Solution-Daten. |
| `Dokumentiere FormScripting, Plugins und Workflows dieser Model-Driven App ...` | Fokussiert auf technische Komponenten und Abhängigkeiten. |
| Intern: `dataverse_ce_app_doku_guidelines` | Muss vor Analyse, Planung oder Dateierzeugung geladen werden, sofern verfügbar. Enthält die verbindliche Detailmethodik. |

### Beispiel-Use-Case

Ein Projektteam übernimmt eine bestehende Dynamics 365 Sales-Erweiterung. Es liegen ein Solution-Export und ein ORBIS.PluginDoc-Export vor. Der Skill erzeugt daraus eine `doku.md` mit Systemkontext, Datenmodell, Formular- und Ribbon-Logik, Plug-in-Schritten, Workflow-Diagrammen, Security-Hinweisen, ALM-Informationen und einer Onboarding-Checkliste. Fehlende Informationen, zum Beispiel nicht exportierte Security-Rollen oder fehlende Live-Daten, werden als offene Punkte mit Quelle und nächstem Erhebungsschritt markiert.

## `dataverse-code-review`

### Was macht der Skill?

Der Skill reviewt Microsoft Dataverse- und Dynamics-365-Änderungen wie ein Senior Dataverse Engineer. Der Fokus liegt auf Korrektheit, Datenintegrität, Sicherheit, Transaktionssicherheit, Performance, Zuverlässigkeit, Observability und pragmatischer Wartbarkeit.

Er deckt insbesondere ab:

- C# Plug-ins und Custom APIs.
- TypeScript Webresources für Model-Driven Apps.
- PCF Controls.
- Solution- und Registrierungsmetadaten.
- ALM-, Pipeline- und Solution-Checker-Aspekte.
- Tests und Analyzer-Ergebnisse.

Der Skill meldet nur Befunde, die durch die Änderung eingeführt oder offengelegt werden, und unterscheidet klar zwischen blockierenden Findings, optionalen Verbesserungen und nicht verifizierbaren Punkten.

### Commands und Auslöser

| Command / Prompt | Bedeutung |
|---|---|
| `Review die Dataverse Änderungen in diesem PR ...` | Führt einen evidenzbasierten Review der geänderten Dataverse-Komponenten durch. |
| `Prüfe dieses Plug-in auf Dataverse Best Practices ...` | Fokussiert auf C# Plug-in-Korrektheit, Registrierung, Images, Filtering Attributes, Sicherheit und Performance. |
| `Review die TypeScript Webresource ...` | Prüft Model-Driven-App-Clientcode, Xrm Client API, Web API Queries, Async-Kontext und Fehlerbehandlung. |
| `Review das PCF Control ...` | Prüft PCF Lifecycle, `updateView`, `destroy`, Output Notifications, Ressourcen-Cleanup und Accessibility. |
| `Solution Checker triage ...` | Bewertet Solution-Checker-Ergebnisse, Regel-IDs, Baseline und Blocker. |

### Beispiel-Use-Case

Ein PR ändert ein Account-Update-Plug-in und ergänzt eine TypeScript-Webresource. Der Skill prüft Sourcecode, Tests, Projektkonfiguration und relevante Solution-/Registrierungsmetadaten. Er erkennt beispielsweise, ob ein Update-Plug-in ohne Filtering Attributes registriert wurde, ob `Target` fälschlich vollständige Attribute erwartet, ob `ColumnSet(true)` genutzt wird oder ob clientseitige UI-Sichtbarkeit mit echter Autorisierung verwechselt wird. Das Ergebnis beginnt mit `Approve`, `Changes requested` oder `Cannot verify` und enthält konkrete Findings mit Pfad/Zeile, Dataverse-Auswirkung, kleinstem sicheren Fix und Verifikation.

## `power-platform-log-analyst`

### Was macht der Skill?

Der Skill analysiert lokal Power-Platform-/Dataverse-Telemetrie, um Fehler- und Performance-Ursachen evidenzbasiert zu identifizieren. Er verarbeitet unter anderem:

- Dataverse Plugin Trace Logs.
- Dataverse-Logs.
- .NET Stacktraces.
- Azure Application Insights Exporte.
- Azure Log Analytics / KQL Exporte.
- Gemischte JSON-, JSONL-/NDJSON-, CSV-, LOG- und TXT-Dateien.

Die Verarbeitung erfolgt ausschließlich lokal über `scripts\log_case.py` mit Python-Standardbibliothek. Der Skill nutzt eine persistente SQLite-Fallablage, korrelationsbewusstes Batching und hierarchisches Map/Reduce, damit auch große Datensätze nachvollziehbar analysiert werden können.

### Commands und Auslöser

| Command / Prompt | Bedeutung |
|---|---|
| `power-platform-log-analyst [case-dir] [pfad-zu-logs...]` | Erwartetes Argumentmuster für einen Analysefall. |
| `Analysiere diese Dataverse Plugin Trace Logs ...` | Startet eine lokale Fehleranalyse für Plugin Trace Logs. |
| `Erstelle einen Root-Cause Report aus diesen Application Insights Logs ...` | Konsolidiert Telemetrie zu Ursachen, Impact und Empfehlungen. |
| `Untersuche diese Correlation ID ...` | Fokussiert Analyse auf zusammenhängende Events einer Correlation-/Operation-ID. |
| `Analysiere die Performance Regression ...` | Bewertet Latenzen, Perzentile, Baselines und auffällige Fehlercluster. |

### Lokale Tool-Commands

Alle technischen Operationen laufen über:

```powershell
python scripts\log_case.py <command> --case-dir <verzeichnis> [optionen]
```

| Command | Zweck |
|---|---|
| `python scripts\log_case.py --help` | Zeigt globale Hilfe und verfügbare Commands. |
| `python scripts\log_case.py <command> --help` | Zeigt Hilfe für einen konkreten Command. |
| `python scripts\log_case.py init --case-dir .\case-2024-01 --timezone "unbestätigt"` | Legt einen lokalen Analysefall mit SQLite-Datenbank und Manifest an. |
| `python scripts\log_case.py ingest --case-dir .\case-2024-01 --path .\exports --recursive` | Liest Logdateien/-ordner ein, dedupliziert Events und protokolliert Parse-Probleme. |
| `python scripts\log_case.py overview --case-dir .\case-2024-01` | Liefert Kennzahlen zu Events, Zeitraum, Schweregrad, Fehlerclustern, Quellen und Performance-Perzentilen. |
| `python scripts\log_case.py batch build --case-dir .\case-2024-01 --max-events 200 --max-bytes 250000` | Erzeugt korrelationsbewusste Analyse-Batches. |
| `python scripts\log_case.py batch list --case-dir .\case-2024-01 --pending-only` | Listet noch nicht ausgewertete Batches. |
| `python scripts\log_case.py batch show --case-dir .\case-2024-01 --batch-id batch-00001` | Zeigt Rohdaten eines Batches. |
| `python scripts\log_case.py batch template --case-dir .\case-2024-01 --out batch-00001-summary.json` | Erstellt eine Vorlage für die Batch-Zusammenfassung. |
| `python scripts\log_case.py batch put-summary --case-dir .\case-2024-01 --batch-id batch-00001 --file batch-00001-summary.json` | Speichert und validiert eine Batch-Zusammenfassung. |
| `python scripts\log_case.py reduce build --case-dir .\case-2024-01 --level 1 --max-members 20` | Erstellt hierarchische Reduce-Pakete aus Batch-Summaries. |
| `python scripts\log_case.py reduce template --case-dir .\case-2024-01 --level 1 --out reduce-level-1.json` | Erstellt eine Vorlage für eine Reduce-Zusammenfassung. |
| `python scripts\log_case.py reduce put-summary --case-dir .\case-2024-01 --level 1 --pack-id <pack-id> --file reduce-level-1.json` | Speichert und validiert eine Reduce-Zusammenfassung. |
| `python scripts\log_case.py coverage --case-dir .\case-2024-01` | Prüft den Abdeckungsgrad. Nur bei `full_coverage_achieved: true` darf vollständige Analyse behauptet werden. |
| `python scripts\log_case.py report template --case-dir .\case-2024-01 --out final-report.json` | Erstellt eine Vorlage für den finalen Diagnosebericht. |
| `python scripts\log_case.py report export --case-dir .\case-2024-01 --file final-report.json --out-dir .\case-2024-01\out --formats json,md,html,csv` | Exportiert versandfertige Berichte in JSON, Markdown, HTML und CSV. |

### Beispiel-Use-Case

Nach einem Deployment melden Nutzer sporadische Fehler beim Speichern von Opportunities. Es liegen Plugin Trace Logs und ein Application-Insights-Export vor. Der Skill legt einen Case an, importiert die Logs, erstellt ein Overview, baut Batches, analysiert Fehlercluster und korreliert Exceptions über Correlation IDs. Im finalen Report trennt er Beobachtung, Hypothese und bestätigte Ursache, nennt Evidence-Locators, bewertet Performance über Perzentile und gibt konkrete Empfehlungen mit Validierung, Risiko und Rollback an.

## `web-design-guidelines`

### Was macht der Skill?

Der Skill prüft UI-Dateien gegen die aktuellen Web Interface Guidelines. Dafür werden die Guidelines vor jedem Review frisch von der offiziellen Quelle geladen und anschließend auf die angegebenen Dateien oder Patterns angewendet.

Geprüft werden typische UI-, UX-, Accessibility- und Design-Regeln. Findings werden im knappen `file:line`-Format ausgegeben, wie es die geladenen Guidelines vorgeben.

### Commands und Auslöser

| Command / Prompt | Bedeutung |
|---|---|
| `web-design-guidelines <file-or-pattern>` | Erwartetes Argumentmuster für eine Prüfung einzelner Dateien oder Patterns. |
| `review my UI` | Prüft angegebene UI-Dateien auf Guideline-Verstöße. |
| `check accessibility` | Fokussiert auf Accessibility-Aspekte wie Labels, Tastaturbedienung, Fokus und Semantik. |
| `audit design` | Prüft Design- und Interface-Regeln. |
| `review UX` | Bewertet UX-relevante Verstöße anhand der Web Interface Guidelines. |
| `check my site against best practices` | Führt einen Best-Practice-Check für die angegebenen UI-Dateien aus. |
| Intern: `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md` | Quelle der jeweils aktuellen Regeln; vor jedem Review frisch abrufen. |

### Beispiel-Use-Case

Ein Team hat eine neue React-Komponente für ein Kundenportal erstellt und möchte vor dem Merge UI- und Accessibility-Probleme finden. Der Skill lädt die aktuellen Web Interface Guidelines, liest zum Beispiel `src\components\CustomerCard.tsx` und `src\pages\Dashboard.tsx`, prüft die Regeln und gibt konkrete Findings mit Datei und Zeile aus.

## Pflegehinweise

- Neue Skills sollten als eigenes Unterverzeichnis unter `skills\` mit einer `SKILL.md` angelegt werden.
- Diese Übersicht sollte aktualisiert werden, wenn ein Skill umbenannt wird, neue Commands erhält oder sein Scope deutlich erweitert wird.
- Commands in dieser Datei sind bewusst als nutzbare Prompt- und CLI-Muster beschrieben. Verbindlich bleibt jeweils die konkrete `SKILL.md` des Skills.
