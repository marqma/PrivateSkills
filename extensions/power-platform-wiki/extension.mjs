// Extension: power-platform-wiki
// Power Platform Wiki Guidelines - ORBIS Best Practices für Requirements Engineering, Development, Code Reviews und Architecture Reviews

import { joinSession } from "@github/copilot-sdk/extension";

const session = await joinSession({
    tools: [
        {
            name: "power_platform_guidelines",
            description: "ORBIS Power Platform Guidelines - Zugriff auf Best Practices, Naming Conventions, ALM, Security und Code Review Richtlinien für Power Platform Projekte",
            parameters: {
                type: "object",
                properties: {
                    topic: {
                        type: "string",
                        description: "Das Thema zu dem Guidelines benötigt werden",
                        enum: [
                            "code-review",
                            "plugins",
                            "security",
                            "naming",
                            "alm",
                            "cloud-flows",
                            "canvas-apps",
                            "dataverse",
                            "power-pages",
                            "architecture",
                            "all"
                        ]
                    },
                    detail_level: {
                        type: "string",
                        description: "Detailgrad der Antwort",
                        enum: ["summary", "detailed", "full"],
                        default: "detailed"
                    }
                },
                required: ["topic"]
            },
            handler: async (args) => {
                const guidelines = getGuidelines(args.topic, args.detail_level || "detailed");
                return guidelines;
            }
        },
        {
            name: "power_platform_review_checklist",
            description: "Code Review und Architecture Review Checkliste für Power Platform Projekte basierend auf ORBIS Best Practices",
            parameters: {
                type: "object",
                properties: {
                    review_type: {
                        type: "string",
                        description: "Art des Reviews",
                        enum: ["code", "architecture", "security", "full"],
                        default: "full"
                    },
                    component_type: {
                        type: "string",
                        description: "Komponenten-Typ für spezifische Checks",
                        enum: ["plugin", "cloud-flow", "canvas-app", "pcf", "webresource", "solution", "all"],
                        default: "all"
                    }
                }
            },
            handler: async (args) => {
                return getReviewChecklist(args.review_type || "full", args.component_type || "all");
            }
        },
        {
            name: "power_platform_requirements_template",
            description: "Template für Requirements Engineering im Power Platform Kontext - hilft bei der Strukturierung von Anforderungen",
            parameters: {
                type: "object",
                properties: {
                    requirement_type: {
                        type: "string",
                        description: "Art der Anforderung",
                        enum: ["functional", "non-functional", "technical", "integration", "data-migration"],
                        default: "functional"
                    },
                    include_estimation: {
                        type: "boolean",
                        description: "Ob Aufwandsschätzungs-Richtlinien enthalten sein sollen",
                        default: true
                    }
                }
            },
            handler: async (args) => {
                return getRequirementsTemplate(args.requirement_type || "functional", args.include_estimation !== false);
            }
        }
    ],
});

function getGuidelines(topic, detailLevel) {
    const guidelines = {
        "code-review": `# Code Review Guidelines (ORBIS Power Platform)

## Ziele
- Code-Qualität verbessern
- Fehler nach Deployment minimieren
- Wissen teilen und Mentoring
- Konsistente Codebase

## Voraussetzungen
1. Reviews und Tests müssen Teil der initialen Aufwandsschätzung sein
2. Plattform mit Pull Requests (Azure DevOps / GitHub)
3. Main Branches durch Policies gesperrt
4. (Optional) Reviewer durch Policy vordefiniert

## Review-Prozess
1. Große Features in kleinere Tasks isolieren
2. Branch von master/main oder development
3. Pull Request erstellen
4. Reviewer zuweisen (projektbezogen)
5. Verantwortung behalten - Zeitrahmen setzen

## Best Practices
- **Konstruktiv und positiv**: Offene Fragen stellen, Beispiele geben, gute Lösungen loben
- **Klein und kurz**: Isolierte Features, max. 60 Minuten am Stück
- **Wissen**: Vollständiges Verständnis der Anforderung
- **Build und Test**: Vor Review bauen, testen, ausführen
- **Automatisieren**: ESLint, Resharper, statische Analyse nutzen

## Priorität und Evidenz
1. Correctness und Datenintegrität
2. Security und Autorisierung
3. Transaktionssicherheit und Performance
4. Reliability und Observability
5. Wartbarkeit
6. Stil nur bei konkretem Folgeschaden

- Nur Befunde mit konkretem Fehlerpfad, genauer Fundstelle und belastbarer Evidenz melden.
- Niedrige Konfidenz als Prüffrage formulieren, nicht als blockierenden Befund.
- Source, Tests und relevante Solution-/Registrierungsmetadaten gemeinsam prüfen.
- Kleinste sichere Korrektur empfehlen; keine Architekturänderung ohne belegten Bedarf.
- Automatisieren: Solution Checker, konfigurierte Roslyn/.NET-Analyzer,
  TypeScript-Typecheck und type-aware ESLint.

## Dataverse-Risiken
- Pipeline: Message, Tabelle, Stage, Mode, Target und Images stimmen mit der Registrierung überein.
- Security: Ausführungsidentität und Privilegien sind beabsichtigt; keine Secrets oder Payloads im Trace.
- Performance: minimale Spalten, begrenzte Queries, Filtering Attributes und keine Parallel-/Batch-Requests im Plugin.
- TypeScript/PCF: unterstützte Client API, begrenzte Web-API-Abfragen, Lifecycle-Cleanup und keine Render-/Event-Stürme.
- Tests decken geänderte Risiken ab; keine pauschale Coverage-Zahl ersetzt fehlende Assertions.

## Abschluss
- PR nicht lange offen lassen
- Reviewer kann direkt abschließen wenn keine Kommentare
- Entwickler fixt bei Kommentaren`,

        "plugins": `# Plugin Development Guidelines (ORBIS)

## Allgemeine Regeln
- Target Framework und C#-Version aus dem bestehenden Projekt und der aktuell
  unterstützten Dataverse-Runtime ableiten; keine pauschale Versionsvorgabe.
- ORBIS.Core.Plugin verwenden, wenn es Projektstandard und ein konkreter Nutzen ist;
  direkte IPlugin-Implementierungen bleiben zulässig.
- Microsoft Best Practices befolgen
- Sandbox-kompatibel: Keine SQL, Reflection, Registry, Filesystem, IP-basierte Calls

## Code-Beispiel
\`\`\`csharp
using Microsoft.Xrm.Sdk;
using ORBIS.Core.Plugin;
using ORBIS.Core.Plugin.Extensions;

namespace [YourNamespace]
{
    public class [YourPlugin]: PluginBase, IPlugin
    {
        public override void Execute(IContext context)
        {
            var target = context.Images.GetTarget();
            target["name"] = "Sample value";
        }
    }
}
\`\`\`

## Do's
- Late Binding bevorzugen (new Entity())
- Early Binding nur in Kundenprojekten, limitierte Properties
- Asynchrone Operationen wo möglich
- Zwei Minuten sind die Plattformgrenze, kein Performanceziel; synchrone Pfade
  erhalten ein deutlich kleineres, an der Anforderung gemessenes Budget.
- Minimale triggering attribute filters
- JSON/XML für Konfiguration
- Risikobasierte Unit Tests für Pipeline-, Image-, Identity-, Fehler- und Regressionspfade
- Fake Xrm Easy optional; Community-Tooling nicht als Pflichtarchitektur behandeln
- Target + minimale Images vor zusätzlichem Retrieve verwenden
- Query-Spalten explizit auswählen; keine unbeschränkten Abfragen

## Don'ts
- Keine globalen/static Variablen mit Context/Service
- Kein ILMerge
- Keine Mega-Assemblies
- Kein exzessives Tracing
- Keine mutable Context-/Service-/Entity-Daten in Instanz- oder static-Feldern
- Kein Task.Run, Task.WhenAll, Parallel.*, Threads oder Fire-and-forget
- Kein ExecuteMultiple/ExecuteTransaction innerhalb eines Plugins
- Kein ColumnSet(true) / AllColumns
- Keine pauschale Depth-Abhängigkeit als Rekursionsschutz
- Keine synchronen externen Calls ohne expliziten kurzen Timeout

## Plugin umbenennen/löschen
1. Änderungen im Projekt
2. Assembly-Version erhöhen
3. Build
4. In DEV als NEUE Assembly registrieren
5. Steps neu registrieren
6. Alte Assembly entfernen
7. Managed Solution als "Upgrade" deployen (nicht "Update")`,

        "security": `# Security & Credentials Guidelines (ORBIS)

## ⚠️ Grundregel
**NIEMALS sensitive Informationen in Source Code oder committed Files!**

Dazu gehören:
- Connection Strings
- Passwörter
- Access Tokens
- API Keys
- Zertifikate
- Credentials jeder Art

## Dynamics 365 Plugins
- **Secure Configuration** für sensitive Runtime-Werte
- ORBIS.Core.Plugin.Cryptography verwenden
- ORBIS.CryptTool für Verschlüsselung

## Frontend / JavaScript / TypeScript
- Client-seitiger Code ist IMMER sichtbar
- Keine Secrets in JavaScript/TypeScript/PCF/Form Scripts
- Logik mit Secrets in Backend verschieben:
  - Custom API
  - Plugin
  - Azure Function
  - Geschützter Server-Service

## Sichere Konfigurationsspeicher
1. Azure Key Vault (bevorzugt)
2. Dataverse Environment Variables mit Key Vault Integration
3. Managed Identities
4. Gesicherte Application Settings
5. Umgebungsspezifische Config außerhalb Source Control`,

        "naming": `# Naming Conventions (ORBIS)

## Allgemein
- Immer aus Solution heraus erstellen (Publisher Prefix)
- Display Names: "Distributor Account" (außer "of", "the")
- Technical Names: PascalCase ohne Prefix, camelCase mit Prefix

## Komponenten

### Publisher
- Name: [Kunde]
- Prefix: Kundenspezifisch (nicht orb_, nicht new_)
- Nur ein Publisher pro Environment

### Solutions
- Display: [Kunde] Solution Name
- Name: [Kunde]SolutionName

### Tabellen
- Frei wählbar, nie existierende Namen
- Keine Custom Entities wenn Standard existiert

### Spalten
| Typ | Suffix | Beispiel |
|-----|--------|----------|
| Lookup | id | xyz_supplieraccountid |
| Option Set | code | xyz_typecode |
| Multi Option Set | codes | xyz_tagcodes |
| Rollup | roll | xyz_totalroll |
| Calculated | calc | xyz_fullnamecalc |
| Power Fx | fx | xyz_typefxcode |
| Two Option | flag/is/has | xyz_issupplier |
| Multiple Text | multi | xyz_descriptionmulti |

Datum: "date", "from", "to" im Namen

### Alternate Keys
Schemaname der Spalten + "_key"

### Relationships
- N:1: [entity]s_[lookup]_[target]
- N:N: [entity1]s[entity2]s

### Business Rules
[Kunde] Beschreibung

### Views
Entity Name im Namen

### Forms
- Main: [Kunde] [Entity]
- Quick View: [Kunde] [Lookup] on [Entity]

### Security Roles
[Kunde] [Rolle] [Base|Addon]

### Web Resources
Lower case, Entity Name, Resolution bei Bildern

### Workflows
[Tabelle] - Beschreibung

### Cloud Flows
[Tabelle] / [Event] / [Beschreibung]
Beispiel: Incident / Create Update / Close Case if Statistical`,

        "alm": `# ALM - Application Lifecycle Management (ORBIS)

## One Solution Approach
- Eine einzige Project Solution empfohlen
- Ausnahme: Custom Connectors in eigener Solution
- Keine Environment Variable Values in Solution (nur Definitions)

## Environment Strategy

### Minimum (3 Environments)
| Env | Typ | Zweck | Solution State |
|-----|-----|-------|----------------|
| DEV | Sandbox | Entwicklung | unmanaged |
| TEST | Sandbox | UAT | managed |
| PROD | Production | Produktiv | managed |

### Empfohlen (4 Environments)
| Env | Typ | Zweck |
|-----|-----|-------|
| DEV | Sandbox | Entwicklung |
| CI | Sandbox | Continuous Integration, Sprint Reviews |
| TEST | Sandbox | UAT |
| PROD | Production | Produktiv |

## Best Practices
- Service Account für Environment Provisioning
- Dynamics 365 Administrator Rolle in M365
- Scale Groups beachten (gleiche Azure Region)
- Refresh Cadence in PPAC synchronisieren

## Standard Settings
- Base Language: EN
- Base Currency: Mit Kunden klären`,

        "cloud-flows": `# Cloud Flow Guidelines (ORBIS)

## Naming
[Tabelle] / [Event(s)] / [Beschreibung]
Beispiele:
- Incident / Create Update / Automatically close Case
- Account / OnDemand / deactivate account
- Child Flow / process passed contact and send email

## Ownership
- Immer aus Solution erstellen (dann kein Secondary Owner nötig)
- Falls außerhalb: Mehrere Owner, aber nicht ganze Organisation

## Connections
- ZUERST Connection(s) und Connection Reference(s) in Solution erstellen
- Name: publisher_ConnectorName
- **NIEMALS persönlichen User für produktive Connections!**
- Service Principal für Dataverse in Produktion
- pac CLI für Connection Updates: pac connection update

## Trigger
- "Select Columns" für bedingte Trigger
- "Settings/Trigger Conditions" für Vorab-Prüfung

## Steps
- Kurze Beschreibung als Name
- Original Action Title behalten und erweitern
- "Add a note" für Details

## Exception Handling
- Try/Catch/Finally mit Scopes
- Error Handling Template verwenden
- Teams Channel statt E-Mail für Notifications

## Terminate
- Failed: In Catch Scope
- Cancelled: In IF Blocks
- Succeeded: In Finally Scope
⚠️ Terminate in einem Branch beendet ganzen Flow!`,

        "canvas-apps": `# Canvas Apps Guidelines (ORBIS)

## App States
- Loading, Error, Empty, Success States definieren
- Konsistente State-Übergänge

## Variables
- Lokale Variablen: UpdateContext()
- Globale Variablen: Set()
- Collections: ClearCollect(), Collect()
- Naming: var/coll Präfix

## Power FX Good Practices
- Keine harten IDs/Guids
- Keine direkten Datenbank-Calls in Loops
- Concurrent() für parallele Calls
- Filter() statt LookUp in Schleifen
- With() für bessere Lesbarkeit

## Data Performance
- Delegation beachten
- Views für komplexe Abfragen
- Paging bei großen Datenmengen
- Explicit Column Selection

## Screen Design
- Konsistente Abstände
- Responsive Design
- Accessibility beachten`,

        "dataverse": `# Dataverse Guidelines (ORBIS)

## Customizing Conventions
- Managed Solutions in TEST/PROD
- Unmanaged nur in DEV
- Keine direkten Änderungen in PROD

## Environment Variables
- Definitions in Solution
- Values via Deployment Settings
- Keine Secrets in Values (Key Vault verwenden)

## Translations
- Base Language: EN
- Translation Files exportieren/importieren
- Labels für alle Sprachen pflegen

## Datenzugriff und Performance
- Explizite Spaltenauswahl; kein AllColumns und kein fehlendes \$select
- Paging/Begrenzung für Mengenabfragen; keine zeilenweisen Calls in externen Bulk-Clients
- Target und Images nutzen, bevor derselbe Datensatz erneut gelesen wird
- Filtering Attributes für Update-Schritte und doppelte/überlappende Registrierungen prüfen
- Zwei-Minuten-Pluginlimit ist eine Ausfallgrenze, kein zulässiges Latenzbudget

## Security und ALM
- Ausführungsidentität, Custom-API-Privilegien, Rollen, Sharing und FLS explizit prüfen
- Keine vollständigen Entity-Payloads, Tokens oder personenbezogenen Daten protokollieren
- Solution Checker als plattformspezifischen Analyzer in CI ausführen; SARIF aufbewahren
- Neue Critical/High Findings blockieren; bestehende Findings baselinen und kontrolliert abbauen

## Naming
Siehe Naming Conventions`,

        "power-pages": `# Power Pages Guidelines (ORBIS)

## Branching Strategy
- Feature Branches von main
- PR für jedes Feature

## Decisions to take
- Standard vs. Custom Design
- Authentication Provider
- Anonymous Access

## Design and Layouts
- Bootstrap 5 verwenden
- ORBIS CI/CD beachten
- Responsive Design

## Developer Workflow
- PAC CLI für Download/Upload
- Source Control für alle Anpassungen
- Keine direkten Änderungen in PROD

## Naming Conventions
- Web Pages: [Kunde] [Name]
- Page Templates: [Name] Template
- Content Snippets: [Kunde]/[Name]`,

        "architecture": `# Architecture Guidelines (ORBIS)

## Solution Architecture
- One Solution Approach wo möglich
- Custom Connectors separat
- Plugin Assemblies nach Entity/Topic gruppieren

## Integration Patterns
- Dataverse als zentrale Datenquelle
- Azure Functions für komplexe Logik
- Logic Apps für einfache Integrationen
- Service Bus für Entkopplung

## Security Architecture
- Security Roles: Base + Addon Pattern
- Field Level Security wo nötig
- Azure AD Integration
- DLP Policies beachten

## Performance Architecture
- Async Plugins wo möglich
- Caching Strategien
- Batch Processing für große Datenmengen`,

        "all": `# ORBIS Power Platform Guidelines - Übersicht

## Verfügbare Themen
- code-review: Code Review Prozess und Checklisten
- plugins: Plugin Development Best Practices
- security: Security & Credentials
- naming: Naming Conventions für alle Komponenten
- alm: Application Lifecycle Management
- cloud-flows: Power Automate Cloud Flows
- canvas-apps: Canvas App Development
- dataverse: Dataverse Customizing
- power-pages: Power Pages Development
- architecture: Solution Architecture

Verwende das power_platform_guidelines Tool mit dem gewünschten Thema.`
    };

    return guidelines[topic] || guidelines["all"];
}

function getReviewChecklist(reviewType, componentType) {
    const baseChecklist = `# Power Platform Review Checklist (ORBIS)

## Review Type: ${reviewType.toUpperCase()}
## Component Type: ${componentType.toUpperCase()}

---

## Allgemeine Checks
- [ ] Keine Credentials/Secrets im Code
- [ ] Naming Conventions eingehalten
- [ ] Dokumentation aktualisiert
- [ ] Tests vorhanden und erfolgreich
- [ ] Code kompiliert/läuft ohne Fehler
- [ ] Befunde haben konkrete Evidenz, Fundstelle, Impact und kleinste sichere Korrektur
- [ ] Solution-/Registrierungsmetadaten wurden bei Dataverse-Code mitgeprüft
- [ ] Niedrige Konfidenz wird als Prüffrage statt als Blocker behandelt
`;

    const typeSpecific = {
        code: `
## Code Review Checks
- [ ] Logische Einheiten (kurze Methoden)
- [ ] Keine redundanten Code-Blöcke
- [ ] Komplexität angemessen (Ein-Satz-Test)
- [ ] Lesbarkeit gegeben
- [ ] Kein Dead Code
- [ ] Performance: Keine Interface-Calls in Loops
- [ ] Error Handling erhält Diagnosekontext und verschluckt keine Fehler
- [ ] Keine unnötige Abstraktion, Dependency oder Architekturänderung
- [ ] Tests decken geänderte Risiken statt nur eine Coverage-Zahl ab
`,
        architecture: `
## Architecture Review Checks
- [ ] Solution Design dokumentiert
- [ ] One Solution Approach befolgt
- [ ] Umgebungsstrategie eingehalten
- [ ] Security Roles korrekt designt
- [ ] Integration Patterns angemessen
- [ ] Performance Überlegungen dokumentiert
- [ ] Skalierbarkeit berücksichtigt
- [ ] Wartbarkeit gegeben
`,
        security: `
## Security Review Checks
- [ ] Keine hardcoded Credentials
- [ ] Secure Configuration verwendet
- [ ] Keine Secrets in Frontend Code
- [ ] Key Vault für sensitive Daten
- [ ] Managed Identities wo möglich
- [ ] DLP Policies eingehalten
- [ ] Field Level Security wo nötig
- [ ] Audit Logging aktiviert
- [ ] Impersonation/Ausführungsidentität und Privilegien sind begründet
- [ ] Traces enthalten keine vollständigen Payloads, Tokens oder personenbezogenen Daten
`
    };

    const componentSpecific = {
        plugin: `
## Plugin-spezifische Checks
- [ ] Target Framework passt zu Projekt und aktuell unterstützter Runtime
- [ ] ORBIS.Core.Plugin nur bei Projektstandard/konkretem Nutzen
- [ ] Sandbox-kompatibel
- [ ] Message/Tabelle/Stage/Mode/Target stimmen mit Registrierung überein
- [ ] Image-Namen und -Spalten stimmen mit der Verwendung überein
- [ ] Minimale triggering attributes
- [ ] Async wo möglich
- [ ] Synchrone Latenz weit unter der Zwei-Minuten-Ausfallgrenze
- [ ] Target/Images vor redundantem Retrieve genutzt
- [ ] Keine ColumnSet(true), AllColumns oder unbeschränkten Queries
- [ ] Keine mutable Context-/Service-/Entity-Daten in Instanz/static-Feldern
- [ ] Keine Parallelität, Threads, Fire-and-forget oder Batch-Requests
- [ ] Ausführungsidentität/Impersonation explizit geprüft
- [ ] Rekursion ursächlich verhindert, nicht pauschal über Depth
- [ ] Externe Calls haben kurzen Timeout und blockieren keine lange Transaktion
- [ ] Risikobasierte Tests für Pipeline, Images, Identity und Fehlerpfade
`,
        pcf: `
## PCF-spezifische Checks
- [ ] updateView ist wiederholbar und behandelt temporäre null-Werte
- [ ] destroy entfernt Listener, Observer, Timer und gerenderte Roots
- [ ] notifyOutputChanged, refresh, Web API und Rendering werden nicht unnötig ausgelöst
- [ ] Type-aware ESLint, Typecheck, Tests und Production Build sind erfolgreich
- [ ] Generierte Typen und Bundles werden nicht wie handgeschriebener Code bewertet
- [ ] Tastatur, Fokus, Labels und Accessibility bleiben korrekt
- [ ] Keine Secrets oder sensiblen Daten in Bundle/localStorage/sessionStorage
`,
        webresource: `
## TypeScript/Webresource-spezifische Checks
- [ ] executionContext.getFormContext() statt Xrm.Page
- [ ] Kein window.top, unsupported DOM access oder synchrones XHR
- [ ] Form-/Execution-Context wird nicht über async-Grenzen gehalten
- [ ] Xrm.WebApi nutzt \$select, Begrenzung/Paging und Promise-Fehlerbehandlung
- [ ] Keine Secrets im Clientcode und keine Dev-Builds in Dataverse
`,
        "cloud-flow": `
## Cloud Flow Checks
- [ ] Naming Convention: Tabelle / Event / Beschreibung
- [ ] Aus Solution erstellt
- [ ] Connection References verwendet
- [ ] Service Principal für Produktion
- [ ] Trigger Conditions gesetzt
- [ ] Try/Catch/Finally mit Scopes
- [ ] Error Handling implementiert
- [ ] Steps benannt und dokumentiert
`,
        "canvas-app": `
## Canvas App Checks
- [ ] App States definiert
- [ ] Variablen korrekt verwendet
- [ ] Power FX Best Practices
- [ ] Delegation beachtet
- [ ] Responsive Design
- [ ] Accessibility geprüft
`,
        solution: `
## Solution Checks
- [ ] Ein Publisher pro Environment
- [ ] Keine Environment Variable Values in Solution
- [ ] Managed in TEST/PROD
- [ ] Versionierung korrekt
- [ ] Dependencies dokumentiert
`
    };

    let result = baseChecklist;
    
    if (reviewType === "full" || reviewType === "code") {
        result += typeSpecific.code;
    }
    if (reviewType === "full" || reviewType === "architecture") {
        result += typeSpecific.architecture;
    }
    if (reviewType === "full" || reviewType === "security") {
        result += typeSpecific.security;
    }
    
    if (componentType !== "all" && componentSpecific[componentType]) {
        result += componentSpecific[componentType];
    }
    
    result += `
---
## Review Abschluss
- [ ] Alle Kommentare adressiert
- [ ] Follow-up Review bei Bedarf
- [ ] Dokumentation aktualisiert
- [ ] PR zeitnah geschlossen
`;

    return result;
}

function getRequirementsTemplate(requirementType, includeEstimation) {
    const templates = {
        functional: `# Functional Requirement Template (Power Platform)

## Grundinformationen
| Feld | Wert |
|------|------|
| ID | REQ-XXX |
| Titel | |
| Priorität | Hoch/Mittel/Niedrig |
| Status | Draft/Review/Approved |

## Beschreibung
[Was soll das System tun?]

## Akzeptanzkriterien
- [ ] Kriterium 1
- [ ] Kriterium 2
- [ ] Kriterium 3

## Fachlicher Kontext
[Welcher Geschäftsprozess wird unterstützt?]

## Benutzerrollen
[Welche Rollen nutzen diese Funktion?]

## UI/UX Anforderungen
[Wireframes, Mockups, Design Vorgaben]

## Datenmodell
[Betroffene Tabellen und Spalten]

## Geschäftslogik
[Berechnungen, Validierungen, Workflow Schritte]

## Abhängigkeiten
[Von anderen Requirements, Systemen, Daten]

## Offene Fragen
- [ ] Frage 1
- [ ] Frage 2
`,
        "non-functional": `# Non-Functional Requirement Template (Power Platform)

## Grundinformationen
| Feld | Wert |
|------|------|
| ID | NFR-XXX |
| Kategorie | Performance/Security/Usability/Reliability/Scalability |
| Priorität | Hoch/Mittel/Niedrig |

## Beschreibung
[Was ist die Qualitätsanforderung?]

## Messbare Kriterien
| Metrik | Zielwert | Messmethode |
|--------|----------|-------------|
| | | |

## Constraints
[Technische oder fachliche Einschränkungen]

## Betroffene Komponenten
[Welche Teile der Lösung sind betroffen?]
`,
        technical: `# Technical Requirement Template (Power Platform)

## Grundinformationen
| Feld | Wert |
|------|------|
| ID | TEC-XXX |
| Typ | Integration/Data/Security/Infrastructure |
| Technologie | |

## Beschreibung
[Technische Anforderung im Detail]

## Technische Spezifikation
\`\`\`
[Code, Konfiguration, Schema]
\`\`\`

## Schnittstellen
| System | Richtung | Protokoll | Format |
|--------|----------|-----------|--------|
| | | | |

## Sicherheitsanforderungen
[Authentifizierung, Autorisierung, Verschlüsselung]

## Fehlerbehandlung
[Expected Errors, Retry Logic, Fallback]

## Monitoring & Logging
[Was muss überwacht/geloggt werden?]
`,
        integration: `# Integration Requirement Template (Power Platform)

## Grundinformationen
| Feld | Wert |
|------|------|
| ID | INT-XXX |
| Quellsystem | |
| Zielsystem | |
| Richtung | Inbound/Outbound/Bidirectional |

## Datenfluss
[Beschreibung des Datenflusses]

## Datenmapping
| Quellfeld | Zielfeld | Transformation |
|-----------|----------|----------------|
| | | |

## Trigger
[Was löst die Integration aus?]

## Frequenz
[Real-time, Batch, Scheduled]

## Fehlerbehandlung
[Retry, Dead Letter, Notification]

## Volumen
[Erwartete Datenmenge]

## SLA
[Verfügbarkeit, Latenz]
`,
        "data-migration": `# Data Migration Requirement Template (Power Platform)

## Grundinformationen
| Feld | Wert |
|------|------|
| ID | MIG-XXX |
| Quellsystem | |
| Zielsystem | Dataverse |
| Umfang | Vollständig/Teilweise |

## Datenbestand
[Was wird migriert?]

## Datenqualität
[Bekannte Issues, Bereinigungsbedarf]

## Mapping
| Quelle | Ziel | Kommentar |
|--------|------|-----------|
| | | |

## Transformationen
[Berechnungen, Konvertierungen]

## Validierung
[Wie wird die Migration geprüft?]

## Rollback Plan
[Wie wird bei Fehlern vorgegangen?]

## Zeitplan
[Wann findet die Migration statt?]
`
    };

    let template = templates[requirementType] || templates.functional;

    if (includeEstimation) {
        template += `
---

## Aufwandsschätzung (ORBIS Richtlinien)

### Zu berücksichtigen
- [ ] Analyse und Design
- [ ] Implementierung
- [ ] Unit Tests
- [ ] Code Review (siehe Review Guidelines)
- [ ] Dokumentation
- [ ] Deployment und Konfiguration
- [ ] Bugfixing (Puffer)

### Schätzung
| Aktivität | Aufwand (PT) | Bemerkung |
|-----------|--------------|-----------|
| Analyse | | |
| Design | | |
| Implementierung | | |
| Tests | | |
| Review | | |
| Deployment | | |
| **Gesamt** | | |

### Hinweise
- Reviews und Tests müssen Teil der initialen Schätzung sein
- Puffer für unvorhergesehenes einplanen
- Bei Unsicherheit: 3-Punkt-Schätzung (optimistisch, wahrscheinlich, pessimistisch)
`;
    }

    return template;
}
