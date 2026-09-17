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

## Worauf achten
| Bereich | Prüfpunkte |
|---------|-----------|
| Security | Keine Credentials im Code |
| Performance | Keine premature Optimierung, Interface-Calls in Loops prüfen |
| Patterns | Wiederholende Patterns parametrisieren |
| Struktur | Logische Einheiten, kurze Methoden |
| Komplexität | Ein Satz sollte Zweck beschreiben können |
| Tests | Unit Tests, 80%+ Coverage |
| Lesbarkeit | Sinnvolle Namen, konsistenter Style |
| Dead Code | Ungenutzten Code komplett entfernen |

## Abschluss
- PR nicht lange offen lassen
- Reviewer kann direkt abschließen wenn keine Kommentare
- Entwickler fixt bei Kommentaren`,

        "plugins": `# Plugin Development Guidelines (ORBIS)

## Allgemeine Regeln
- C# .NET 4.6.2 (max. unterstützte Version)
- ORBIS.Core.Plugin NuGet verwenden
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
- 2-Minuten Timeout beachten
- Minimale triggering attribute filters
- JSON/XML für Konfiguration
- Unit Tests, 80%+ Coverage
- FakeXrmEasy bei komplexen Tests

## Don'ts
- Keine globalen/static Variablen mit Context/Service
- Kein ILMerge
- Keine Mega-Assemblies
- Kein exzessives Tracing
- Kein var für Basis-Datentypen
- Kein LINQ für direkte Datenabfragen
- Keine Depth-Abhängigkeit

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
- [ ] Error Handling vorhanden
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
`
    };

    const componentSpecific = {
        plugin: `
## Plugin-spezifische Checks
- [ ] .NET 4.6.2 verwendet
- [ ] ORBIS.Core.Plugin verwendet
- [ ] Sandbox-kompatibel
- [ ] Execute() kurz und prägnant
- [ ] Minimale triggering attributes
- [ ] Async wo möglich
- [ ] 2-Minuten Timeout beachtet
- [ ] Unit Tests vorhanden (80%+)
- [ ] Keine globalen/static Variablen
- [ ] Kein ILMerge
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
