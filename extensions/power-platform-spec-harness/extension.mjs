import { joinSession } from "@github/copilot-sdk/extension";

const CONSTITUTION = `# Project Constitution â€“ Power Platform / D365 CE

> Defined once per project (skill: \`pp-constitution\`). All subsequent specs, plans
> and implementations MUST be verifiable against these principles.
> Based on the **ORBIS Power Platform Guidelines** (extension \`power-platform-wiki\`).

## 1. Environment Strategy

Recommended (4 environments):

| Environment | Type | Purpose | Solution Mode |
|---|---|---|---|
| Dev | Sandbox | Development | unmanaged |
| CI | Sandbox | Continuous Integration, sprint reviews | managed |
| Test | Sandbox | UAT | managed |
| Prod | Production | Operations | managed |

- Minimum: 3 environments (Dev/Test/Prod). CI optional but recommended.
- Development happens **exclusively** in Dev. Direct changes in Test/Prod are forbidden.
- Each environment has its own PAC auth profile (\`pac auth create\`).
- Service account for environment provisioning; Dynamics 365 Administrator role in M365.
- Respect scale groups (environments in the same Azure region); synchronize refresh cadence in PPAC.
- **Managed Environments** (Test/Prod, license permitting): enable solution checker
  enforcement, sharing limits, usage insights and IP firewall â€“ reduces the need for
  custom governance tooling and surfaces platform-native recommendations.
- **Backup & disaster recovery**: rely on Dataverse's automatic backups (point-in-time
  restore, typically 7-28 days depending on license) for Prod; before high-risk changes
  (major upgrades, bulk data operations) trigger an on-demand backup. Document the
  restore procedure and RPO/RTO expectations once per project (short note in
  \`docs/adr/\` if they deviate from the platform default).

## 2. Solution Strategy

- **One Solution Approach**: a single project solution. Exception: custom connectors
  in their own solution.
- Managed/unmanaged strategy: unmanaged in Dev, managed in all downstream environments.
- **Environment Variables**: only *definitions* in the solution; *values* are maintained
  via deployment settings. No secrets in values (use Key Vault).
- Version format: \`Major.Minor.Build.Revision\` â€“ Major/Minor manual, Build via pipeline.
- Connection references are mandatory for all external connections
  (name: \`publisher_ConnectorName\`).

## 3. Naming Conventions (ORBIS)

General:
- Always create from within the solution (publisher prefix).
- Display names: "Distributor Account" (articles like "of", "the" lowercase).
- Technical names: PascalCase without prefix, camelCase with prefix.
- **One publisher per environment**; prefix customer-specific (not \`orb_\`, not \`new_\`).

| Artifact | Convention | Example |
|---|---|---|
| Publisher | Name: \`[Customer]\`, prefix customer-specific | \`cts\` |
| Solution | Display: \`[Customer] Solution Name\`, Name: \`[Customer]SolutionName\` | \`ContosoCustomerEngagement\` |
| Table (logical) | \`prefix_singular\` | \`cts_inquiry\` |
| Alternate key | Schema name of columns + \`_key\` | \`cts_inquiryid_key\` |
| Relationship N:1 | \`[entity]s_[lookup]_[target]\` | \`cts_inquirys_customerid_account\` |
| Relationship N:N | \`[entity1]s[entity2]s\` | \`cts_inquirysaccounts\` |
| Business rule | \`[Customer] Description\` | \`Contoso Validate due date\` |
| View | Entity name in the name | \`Inquiry â€“ Overdue inquiries\` |
| Main form | \`[Customer] [Entity]\` | \`Contoso Inquiry\` |
| Quick view form | \`[Customer] [Lookup] on [Entity]\` | \`Contoso Customer on Inquiry\` |
| Security role | \`[Customer] [Role] [Base\\\\|Addon]\` | \`Contoso Clerk Base\` |
| Web resource | lower case, entity name, resolution for images | \`cts_/inquiry/form.js\` |
| Cloud flow | \`[Table] / [Event] / [Description]\` | \`Inquiry / Scheduled / Escalate overdue\` |
| Plugin | \`Namespace.Feature.Operation\` | \`Cts.Inquiry.PreValidateCreate\` |

**Column suffixes (mandatory):**

| Type | Suffix | Example |
|---|---|---|
| Lookup | \`id\` | \`cts_supplieraccountid\` |
| Option set | \`code\` | \`cts_typecode\` |
| Multi option set | \`codes\` | \`cts_tagcodes\` |
| Rollup | \`roll\` | \`cts_totalroll\` |
| Calculated | \`calc\` | \`cts_fullnamecalc\` |
| Power Fx | \`fx\` | \`cts_typefxcode\` |
| Two option | \`flag\` / \`is\` / \`has\` | \`cts_issupplier\` |
| Multiple text | \`multi\` | \`cts_descriptionmulti\` |
| Date | \`date\`, \`from\`, \`to\` in the name | \`cts_duedate\` |

## 4. Low-Code before Code-First

Order of implementation preference (earlier = preferred):

1. Configuration (business rules, views, forms)
2. Power Automate (declarative)
3. Power Fx / commanding
4. PCF controls (TypeScript)
5. Plugins / custom APIs (C#) â€“ only with ADR justification

**Plugin ground rules (ORBIS):**
- C# .NET Framework 4.6.2 (max. supported version), \`ORBIS.Core.Plugin\` NuGet.
- Sandbox-compatible: no SQL, reflection, registry, filesystem, IP-based calls.
- Prefer late binding (\`new Entity()\`); early binding only in customer projects with
  limited properties.
- Minimal triggering attributes; async where possible; respect the 2-minute timeout.
- No global/static context/service variables, no ILMerge, no mega-assemblies.

## 5. Security & Compliance

- **Ground rule: NEVER put sensitive information in source code or committed files** â€“
  no connection strings, passwords, tokens, API keys, certificates.
- Plugins: secure configuration + \`ORBIS.Core.Plugin.Cryptography\` / \`ORBIS.CryptTool\`.
- Frontend (JS/TS/PCF/form scripts): client code is ALWAYS visible â†’ no secrets;
  move logic with secrets to the backend (custom API, plugin, Azure Function).
- Secure configuration stores (in order): Azure Key Vault â†’ Dataverse environment
  variables with Key Vault integration â†’ managed identities â†’ secured app settings.
- Least-privilege security roles (Base + Addon pattern); FLS for sensitive columns.
- DLP policies: connector usage must match the tenant DLP policy; new connectors
  require governance approval.
- PII fields are marked in the spec and receive auditing + FLS.

## 6. Quality & Documentation

- Solution checker without errors (error severities are blocking) before every export.
- Unit tests with 80%+ coverage for plugins; FakeXrmEasy for complex tests.
- **Performance**: features that touch high-volume tables (>50k rows) or run in
  bulk (import, integration) get an explicit performance check (pp-test-dataverse) â€“
  plugin execution budget, API/throttling limits, indexed filter columns.
- Every feature has spec, plan and tasks in the repo (\`specs/<feature>/\`).
- Architecture decisions as ADRs (\`docs/adr/\`).
- Translations: base language **EN**; maintain labels for all languages
  (export/import translation files). Clarify base currency with the customer.

## 7. ALM & Source Control

- Solution-as-code: \`pac solution unpack\` â€“ the unpacked solution directory is the
  single source of truth; binary \`.zip\` files are not committed (except as build artifacts).
- Branching: \`main\` (prod-ready, locked by policies), \`feature/*\` per requirement.
- Deployment exclusively via pipelines (Power Platform Pipelines or Azure DevOps).
- Connection updates via \`pac connection update\`; in production a service principal
  (NEVER personal users for productive connections).

## 8. Quality Assurance & Review

- **Four-eyes principle**: no merge without a documented review (skill \`pp-review-code\`).
  Reviewer â‰  author; Copilot-generated artifacts are always reviewed by a human.
- **Prerequisites** (ORBIS): reviews/tests are part of the effort estimation;
  main branches locked by policies; PR platform (Azure DevOps/GitHub).
- **Review process**: isolate large features into small tasks â†’ branch from main â†’
  PR â†’ assign reviewer â†’ keep ownership (set a time frame).
- **Best practices**: constructive/positive, isolated features (max. 60 min review at a
  time), build/test before review, automation (ESLint, static analysis).
- **Review protocol**: per PR from \`templates/pr-review-template.md\` to
  \`reviews/<feature-slug>/PR-<number>.md\`.
- **Finding severities**: \`BLOCKER\` (fix before merge), \`MAJOR\` (fix before prod),
  \`MINOR\` (follow-up). No approval with an open BLOCKER â€“ exceptions only via ADR.
- **Review gate before converge**: \`pp-converge-validate\` may only set "Converged"
  after a documented review result.

## 9. Decisions & ADR

- **ADR mandatory** for: code-first instead of low-code (Â§4), deviation from this
  constitution, new external integrations, fundamental data model decisions,
  security-relevant decisions.
- **Stored in a dedicated area**: \`docs/adr/\` with index (\`docs/adr/README.md\`),
  template \`templates/adr-template.md\`, maintained by skill \`pp-adr-governance\`.
- ADRs are never deleted â€“ status: Proposed â†’ Accepted | Rejected |
  Superseded by ADR-NNN.
- Every ADR contains verification criteria against which \`pp-converge-validate\` validates.

## 10. Continuous Improvement (Lessons Learned)

- **Capture**: every phase and any skill can record a lesson (errors, inefficiencies,
  what worked well, gaps, improvement ideas) via skill \`pp-lessons-learned\` into the
  durable store \`lessons/lessons-index.jsonl\`.
- **Apply**: skill \`pp-skill-updater\` periodically triages \`new\` lessons and updates
  the harness (skills, templates, checklists, constitution clarifications, diagrams).
- **Cadence**: capture anytime; triage/apply weekly or before a release.
- **Traceability**: every applied change lists the files it changed (\`appliedTo\`);
  lessons are never deleted.
- **Limits**: improvement never weakens security (Â§5) or quality gates (Â§6, Â§8);
  bigger structural changes go through an ADR (Â§9).
`;

const OVERVIEW = `Power Platform / Dynamics 365 CE Spec-Driven Code Factory - Process Overview

Phases: Specify -> Plan -> Tasks -> Implement (Dataverse/App/Flow/Plugin/PCF/JS) ->
Test -> Review (QA gate) -> Converge/Validate -> Export -> Git Integration ->
Deploy (Pipeline) -> Monitor/Telemetry -> Continuous Improvement (Lessons Learned).

Governance: ADRs for key decisions (docs/adr/), QA reviews (reviews/), lessons
captured continuously and triaged by pp-skill-updater to keep the harness improving.

Use section='skills-list' to see all 20 skills, section='skill' with a skill name
for its full content, or section='constitution' for the binding project rules.`;

const SKILLS = {
  "pp-adr-governance": `---
name: pp-adr-governance
description: "Records important decisions as Architecture Decision Records and maintains the ADR index. WHEN: ADR, architecture decision, document decision, important decision, trade-off, evaluate alternatives, code-first justification, ADR index. Anytime; MANDATORY on deviation from the constitution (e.g. plugin instead of flow)."
---

# pp-adr-governance

Documents important decisions traceably and permanently in the ADR area.

## When is an ADR mandatory?

- Code-first component (plugin, custom API, PCF) instead of low-code (Constitution Â§4)
- Deviation from a constitution principle
- New external integration / new connector
- Fundamental data model decisions (ownership, cascading behavior, N:N)
- Security-relevant decisions (FLS, impersonation, secret handling)

## Mission

1. **Create ADR** â€“ from \`templates/adr-template.md\` to
   \`docs/adr/ADR-<NNN>-<kebab-title>.md\`; sequential number (see index)
2. **Maintain status** â€“ Proposed â†’ Accepted | Rejected | Superseded by ADR-NNN
3. **Update index** â€“ add a row to \`docs/adr/README.md\`
   (table: No., title, status, date, feature)
4. **Link** â€“ reference the ADR from the plan (\`plan.md\` Â§1/Â§4) and the review
   protocol; name the affected feature slug in the ADR

## Rules

- One ADR = one decision. No collection ADRs.
- Document options with trade-offs â€“ a decision without a considered
  alternative is not valid.
- The "Verification criteria" section is mandatory: \`pp-converge-validate\` checks against it.
- ADRs are never deleted â€“ rejected/superseded ones stay marked with their status.
`,
  "pp-constitution": `---
name: pp-constitution
description: "Defines the ALM/governance principles (constitution) for a Power Platform / D365 CE project. WHEN: project start, 'constitution', governance rules, environment strategy, naming conventions, DLP policies, ALM principles. ONCE per project - before pp-specify. Aligned with ORBIS guidelines."
---

# pp-constitution

Establishes the binding principles of a Power Platform project.
Corresponds to \`/speckit-constitution\` from spec-kit. Based on ORBIS guidelines.

## Mission

Create or update \`constitution/pp-constitution.md\` with:

1. **Environment strategy** â€“ Dev (unmanaged), CI/Test/Prod (managed), PAC auth profiles
2. **Solution strategy** â€“ One Solution Approach (exception: custom connectors),
   versioning, connection references & environment variable *definitions* only
3. **Naming conventions** â€“ ORBIS rules incl. column suffixes, relationship/flow/role naming
4. **Low-code before code-first** â€“ order: configuration â†’ flow â†’ Power Fx â†’ PCF â†’ plugin
   (plugin/PCF only with ADR)
5. **Security & DLP** â€“ never secrets in code, least privilege, Key Vault, connector governance
6. **Quality** â€“ solution checker without errors before export, ADR obligation, 80%+ plugin coverage
7. **ALM** â€“ solution-as-code (\`pac solution unpack\`), PR obligation, deployments via pipeline only

## Rules

- Every rule must be **verifiable** (no "should ideally").
- A later spec/plan contradicting the constitution â†’ error in \`pp-converge-validate\`.
- Template: \`constitution/pp-constitution.md\` in this harness.
`,
  "pp-converge-validate": `---
name: pp-converge-validate
description: "Validates the implementation against spec, plan, tasks, constitution, review and ADRs (convergence). WHEN: 'converge', validate, reconcile, check completeness, solution checker, spec coverage, definition of done, go/no-go for deployment. PHASE 6, after implementation, tests and review."
---

# pp-converge-validate

Checks whether implementation and specification have converged. Corresponds to
\`/speckit-converge\`. Only at "Converged" may deployment start.

## Checklist (all items must be green)

1. **Spec coverage** â€“ every acceptance criterion from \`spec.md\` is fulfilled and
   evidenced by a test or manual proof
2. **Task completeness** â€“ all tasks in \`tasks.md\` checked off
3. **Solution checker** â€“ 0 errors (severity Error/Critical) in the project solution;
   store the report as an artifact (\`artifacts/checker/\`)
4. **Constitution compliance** â€“ ORBIS naming, publisher prefix, environment variable
   definitions / connection references, no secrets, DLP-compliant connectors
5. **Review gate (Â§8)** â€“ documented PR review in \`reviews/<feature-slug>/\` with the
   decision "Approved"; no open BLOCKER or MAJOR
6. **ADR completeness (Â§9)** â€“ every mandatory decision has an ADR in \`docs/adr/\`
   with an index entry; code-first components link their ADR; ADR verification
   criteria are met
7. **Tests** â€“ unit and UI tests green; results documented in the repo/artifacts
8. **Repo sync** â€“ the unpacked solution is current (\`Sync-SolutionToRepo.ps1\`
   without diffs to the workspace)
9. **Lessons captured (Â§10)** â€“ any errors, inefficiencies or notable wins from this
   feature were logged via \`pp-lessons-learned\`; confirm none were left unrecorded

## Result

- **Converged** â†’ review "Approved" present â†’ release for deployment
  (\`pp-export-solution\` â†’ \`pp-deploy-pipeline\`)
- **Not converged** â†’ list of deviations referencing spec/plan/tasks;
  back to \`pp-tasks-breakdown\` or the affected \`pp-implement-*\` skills

## Rules

- No release "with known issues" without a documented exception in an ADR.
- Every deviation is named with the concrete artifact (table, flow, form).
`,
  "pp-deploy-pipeline": `---
name: pp-deploy-pipeline
description: "Sets up and runs CI/CD deployments: Power Platform Pipelines or Azure DevOps/GitHub Actions with PAC CLI. WHEN: deployment, pipeline, deploy to test, deploy to prod, CI/CD, Azure DevOps, GitHub Actions, Power Platform Pipelines, import managed solution. AFTER pp-git-integration."
---

# pp-deploy-pipeline

Deploys the managed solution to test and prod environments â€“ exclusively automated.

## Mission

1. **Choose the pipeline variant**
   - Power Platform Pipelines (configurative, maker-friendly) â€“ host environment + pipelines app
   - Azure DevOps YAML / GitHub Actions (full control) â€“ templates under \`pipelines/\`
2. **Build stage** â€“ \`pac solution pack\` (managed) from \`solution/\`,
   version from \`harness.config.json\` + build number, solution checker as a gate
3. **Deploy test** â€“ \`pac solution import --path <managed.zip>\` with
   environment variable values for test; then UI/regression tests (pp-test-dataverse)
4. **Deploy prod** â€“ manual approval gate; on-demand backup before major
   upgrades/bulk data changes (Constitution Â§1); import with upgrade (not
   stage-and-update for major); verify connection references after import
5. **Rollback** â€“ keep the previous managed version as an artifact; on failure:
   import the old version as an update, or restore the on-demand backup for
   data-impacting failures
6. **Deployment notes** â€“ summarize what changed and why (link PR/release tag);
   Power Platform Pipelines can auto-generate these from the solution diff

## Rules

- No manual imports to Test/Prod (Constitution Â§7).
- Secrets/connection values only from pipeline variable groups / Key Vault â€“
  never commit them to YAML.
- In production use a service principal for connections â€“ never personal users.
- Every prod deployment references the PR / release tag.
- After a successful prod import: tag the version in the repo (\`v<version>\`).
- Script: \`scripts/Import-Solution.ps1 -TargetEnvironment test|prod -Managed\`.
`,
  "pp-export-solution": `---
name: pp-export-solution
description: "Exports the solution from the Dev environment (managed/unmanaged) via PAC CLI. WHEN: export solution, pac solution export, export from Dev, create managed solution, before deployment. AFTER pp-converge-validate, BEFORE pp-git-integration / pp-deploy-pipeline."
---

# pp-export-solution

Exports the project solution from Dev â€“ unmanaged (for the repo) and managed (for deployment).

## Mission

1. **Precondition** â€“ \`pp-converge-validate\` = Converged; solution checker green
2. **Versioning** â€“ increase via \`pac solution version\` / online version per
   Constitution Â§2 (build part via pipeline)
3. **Export unmanaged** â€“ for source control:
   \`\`\`powershell
   pac solution export --path <out>\\\\<solution>.zip --name <solution> --managed false
   \`\`\`
4. **Export managed** â€“ for downstream environments:
   \`\`\`powershell
   pac solution export --path <out>\\\\<solution>_managed.zip --name <solution> --managed true
   \`\`\`
5. **Artifacts** â€“ stored under \`artifacts/\`; the managed zip is the deployment artifact

## Rules

- Export ONLY from the Dev environment defined in the constitution, never from Test/Prod.
- Before export: solution checker green (skill pp-converge-validate).
- Do not commit \`.zip\` files (see \`.gitignore\` rules in pp-git-integration) â€“
  they are build artifacts.
- Script: \`scripts/Export-Solution.ps1 -Managed/-Unmanaged\`.
`,
  "pp-git-integration": `---
name: pp-git-integration
description: "Synchronizes the solution as code into the Git repo: pac solution unpack/pack, repo structure, branching, PR. WHEN: unpack, pack, solution to repo, build solution from repo, Git structure, solution-as-code, PR for solution. AFTER pp-export-solution, BEFORE pp-deploy-pipeline."
---

# pp-git-integration

Turns the solution into real source code (solution-as-code).

## Mission

1. **Unpack** â€“ after unmanaged export:
   \`\`\`powershell
   pac solution unpack --zipfile <solution>.zip --folder solution\\\\ --packagetype Unmanaged
   \`\`\`
   The \`solution/\` directory (per \`harness.config.json\` â†’ \`paths.solutionUnpack\`)
   is the single source of truth.
2. **Repo structure** â€“ \`solution/\` (unpacked), \`specs/\`, \`tests/\`, \`artifacts/\`
   (gitignored), pipeline definitions, \`docs/adr/\`, \`reviews/\`
3. **\`.gitignore\`** â€“ \`artifacts/\`, \`*.zip\`, \`bin/\`, \`obj/\`, \`node_modules/\`
4. **Branching & PR** â€“ \`feature/<slug>\` per requirement; the PR contains: unpacked
   solution diffs + spec/plan/tasks; review mandatory via \`pp-review-code\` (Constitution Â§8)
5. **Pack** â€“ rebuild a deployable zip from the repo:
   \`\`\`powershell
   pac solution pack --zipfile artifacts\\\\<solution>.zip --folder solution\\\\ --packagetype Managed
   \`\`\`

## Rules

- NEVER commit binary zips; NEVER work directly on \`main\`.
- Do not manually edit unpacked XML files, except for documented conflict resolution.
- Scripts: \`scripts/Sync-SolutionToRepo.ps1\` (exportâ†’unpackâ†’commit), pack in the pipeline.
- Merge conflicts in solution XML: the Dev environment is the reference â€“ merge changes
  there and re-export.
`,
  "pp-implement-app": `---
name: pp-implement-app
description: "Implements model-driven apps in D365 CE to ORBIS standards: forms, views, sitemap, command bar/ribbon. WHEN: build form, create view, model-driven app, sitemap, ribbon/command bar button, customize MDA. PHASE 2, after pp-implement-dataverse."
---

# pp-implement-app

Implements the UI layer for model-driven apps.

## Mission

For each UI task from \`tasks.md\`:

1. **Forms** â€“ main form & quick view/create; fields per spec, logically grouped
   sections/tabs, header for status values; visibly mark PII fields.
   Naming: main form \`[Customer] [Entity]\`, quick view \`[Customer] [Lookup] on [Entity]\`
2. **Views** â€“ system views per spec (columns, filter, sorting) with entity name in the
   name; quick find view with relevant search fields
3. **Model-driven app** â€“ sitemap: areas/groups/subareas by business structure;
   include only needed tables
4. **Commanding (ribbon)** â€“ prefer modern commanding designer; Power Fx rules
   instead of JavaScript where possible (Constitution Â§4)

## Rules

- Do not copy redundant standard views â€“ adapt existing ones.
- Form performance: max. 75 fields per form, few subgrids (â‰¤ 5), collapsible tabs.
- Test responsive behavior (web + mobile).
- Dependency: schema tasks (pp-implement-dataverse) must be complete.
- After implementation: sync changes to the repo (\`Sync-SolutionToRepo.ps1\`).
`,
  "pp-implement-dataverse": `---
name: pp-implement-dataverse
description: "Implements the Dataverse data model to ORBIS standards: tables, columns with suffix conventions, relationships, alternate keys, business rules, security roles (Base+Addon). WHEN: create table, add column, relationship, alternate key, business rule, security role, choices, data model. PHASE 1."
---

# pp-implement-dataverse

Implements the planned data model in the Dev environment (unmanaged, in the project solution).

## Mission

For each schema task from \`tasks.md\`:

1. **Tables** â€“ logical name \`<prefix>_<entity>\`; primary field; deliberate ownership;
   **no custom table if a standard one exists** (Constitution Â§3)
2. **Columns with suffix convention (mandatory)** â€“ see Constitution Â§3:
   lookup \`...id\`, option set \`...code\`, multi option set \`...codes\`, rollup \`...roll\`,
   calculated \`...calc\`, Power Fx \`...fx\`, two option \`...flag/is/has\`,
   multiple text \`...multi\`, date with \`date/from/to\`
3. **Alternate keys** â€“ schema name of columns + \`_key\` (e.g. \`cts_inquiryid_key\`)
4. **Relationships** â€“ N:1 as \`[entity]s_[lookup]_[target]\`, N:N as \`[entity1]s[entity2]s\`;
   deliberately choose cascading behavior (referential vs. parental) + document it
5. **Business rules** â€“ check before flows (Constitution Â§4); name \`[Customer] Description\`
6. **Security roles** â€“ **Base + Addon pattern**: \`[Customer] [Role] Base|Addon\`
   (e.g. \`Contoso Clerk Base\`); least privilege
7. **Translations** â€“ base language EN; maintain labels in all languages

## Tools

- Maker portal / app designer for manual steps
- \`pac solution\` for export/unpack after implementation
- Schema changes become visible in the unpacked solution XML (diff in PR)

## Rules

- NEVER work in the default solution â€“ always in the project solution
  (One Solution Approach, Constitution Â§2).
- Use the publisher prefix consistently (not \`orb_\`, not \`new_\`).
- PII fields: enable auditing + check FLS (Constitution Â§5).
- After each schema task: sync to repo (\`scripts/Sync-SolutionToRepo.ps1\`).
- Done = task checked off in \`tasks.md\` + change committed to the repo.
`,
  "pp-implement-flow": `---
name: pp-implement-flow
description: "Implements Power Automate cloud flows to ORBIS standards: naming (Table / Event / Description), connection references, Try/Catch/Finally with scopes, trigger conditions. WHEN: build flow, cloud flow, automation, trigger, approval, notification, declarative data integration. PHASE 3."
---

# pp-implement-flow

Implements declarative automation with Power Automate (ORBIS standards).

## Mission

For each automation task from \`tasks.md\` planned as a flow:

1. **Naming (mandatory)** â€“ \`[Table] / [Event(s)] / [Description]\`
   Examples: \`Inquiry / Create Update / Close case if statistical\`,
   \`Account / OnDemand / Deactivate account\`, \`Child Flow / Process passed contact and send email\`
2. **Solution-aware** â€“ ALWAYS create the flow from within the solution (then no
   secondary owner needed); if outside: multiple owners, never the whole organization
3. **Connections & references** â€“ FIRST create connection(s) and connection reference(s)
   in the solution; name \`publisher_ConnectorName\`;
   **NEVER a personal user for productive connections** â†’ service principal for
   Dataverse in production; updates via \`pac connection update\`
4. **Trigger** â€“ prefer Dataverse triggers; "Select columns" for conditional triggers;
   "Settings/Trigger conditions" for pre-checks (avoids unnecessary runs)
5. **Steps** â€“ short description as name, keep original action title and extend it,
   "Add a note" for details
6. **Exception handling (mandatory)** â€“ Try/Catch/Finally with **scopes**;
   use the error handling template; notify a **Teams channel** instead of email
7. **Terminate rules** â€“ Failed only in the catch scope, Cancelled in IF blocks,
   Succeeded in the finally scope. Warning: Terminate in a branch ends the whole flow!

## Rules

- No infinite trigger loops: set trigger condition / select columns.
- Long runs (> 30 days) or complex transaction logic â†’ plugin instead of flow
  (ADR, Constitution Â§4).
- No secrets in plain text â€“ only environment variables (secret type / Key Vault).
- Environment variables: only definitions in the solution, values via deployment settings.
- Done = flow activated, test run documented, repo synchronized.
`,
  "pp-implement-js": `---
name: pp-implement-js
description: "Implements form scripting and web resources in TypeScript for model-driven apps. WHEN: form script, OnLoad, OnChange, OnSave, web resource, Xrm API, JavaScript on form, ribbon rule JS. PHASE 2, use sparingly (Power Fx / business rules first)."
---

# pp-implement-js

Implements client-side logic on forms â€“ TypeScript-first, as web resources.

## Mission

1. **TypeScript project** â€“ folder \`webresources/\`, use \`@types/xrm\`,
   build via esbuild/webpack to JS web resources
2. **Events** â€“ OnLoad, OnChange (per field), OnSave (with \`getEventArgs().preventDefault()\`
   on validation errors); register events in the form designer or by code
   (with execution context as first parameter)
3. **Xrm API** â€“ \`formContext\` instead of the deprecated \`Xrm.Page\`; \`Xrm.WebApi\` for
   data operations (async/await)
4. **Ribbon/commanding** â€“ declarative enable/display rules where possible;
   JS actions only for complex logic

## Rules

- NO unsupported DOM access (no \`document.getElementById\` on form fields).
- Async code on OnSave only with \`preventDefaultOnError\` / async OnSave pattern.
- Every web resource belongs in the solution and the repo (unpacked).
- Linting (ESLint) clean; \`no-console\` active.
- No secrets in client code (client code is always visible â€“ Constitution Â§5).
`,
  "pp-implement-pcf": `---
name: pp-implement-pcf
description: "Implements PCF controls (Power Apps Component Framework) in TypeScript/React. WHEN: PCF, custom control, own UI control, virtual control, TypeScript component, React control, dataset control, field control. ONLY when standard UI is insufficient. PHASE 2."
---

# pp-implement-pcf

Builds custom UI components with the Power Apps Component Framework.

## Prerequisite

- Check: standard control, canvas app embedding or custom page is not sufficient
  (Constitution Â§4) â€“ brief justification in plan/ADR.

## Mission

1. **Scaffolding** â€“ \`pac pcf init --namespace <Prefix> --name <Control> --template
   field|dataset --framework react --run-npm-install\`
2. **Manifest** â€“ \`ControlManifest.Input.xml\`: property types, resource paths,
   feature-usage (only needed features)
3. **Implementation** â€“ cleanly implement \`init/updateView/destroy/getOutputs\`;
   React: use Fluent UI 9; no direct DOM access outside the container
4. **Localization** â€“ resx resources instead of hardcoded text
5. **Build & push** â€“ \`pac pcf push\` to the Dev environment; then bind the control
   to the field/dataset

## Rules

- Keep \`updateView\` idempotent; no state mutation outside \`notifyOutputChanged\`.
- Performance: no heavy libraries without justification; watch bundle size.
- ESLint clean (\`npm run lint\`), unit tests with Jest/React Testing Library where sensible.
- No secrets in the client bundle (client code is always visible â€“ Constitution Â§5).
- Sync control version in the manifest with the solution version.
`,
  "pp-implement-plugin": `---
name: pp-implement-plugin
description: "Implements Dataverse plugins and custom APIs in C# to ORBIS standards (ORBIS.Core.Plugin, .NET 4.6.2, late binding, sandbox). WHEN: plugin, C# code, custom API, server-side logic, complex transaction, performance-critical logic, flow not sufficient. ONLY with ADR justification (Constitution Â§4). PHASE 3."
---

# pp-implement-plugin

Implements server-side .NET logic (plugins, custom APIs) to ORBIS standards â€“
last escalation level per Constitution Â§4 (low-code before code-first).

## Prerequisite

- ADR present justifying why business rule / flow / Power Fx is not sufficient
  (e.g. complex transaction, performance, batch processing).

## Mission (ORBIS rules)

1. **Project** â€“ .NET Framework **4.6.2** (max. supported version),
   use \`ORBIS.Core.Plugin\` NuGet, signed assembly, one assembly per entity/topic
   (no mega-assemblies)
2. **Plugin class** â€“ inherit from \`PluginBase\`, keep \`Execute(IContext context)\` short:

   \`\`\`csharp
   using Microsoft.Xrm.Sdk;
   using ORBIS.Core.Plugin;
   using ORBIS.Core.Plugin.Extensions;

   namespace [YourNamespace]
   {
       public class [YourPlugin] : PluginBase, IPlugin
       {
           public override void Execute(IContext context)
           {
               var target = context.Images.GetTarget();
               target["name"] = "Sample value";
           }
       }
   }
   \`\`\`
3. **Binding** â€“ **prefer late binding** (\`new Entity()\`); early binding only in
   customer projects and only with limited properties
4. **Sandbox compatibility** â€“ NO: SQL, reflection, registry, filesystem, IP-based calls
5. **Registration** â€“ message/stage/mode; **minimal triggering attributes** (mandatory);
   async where possible; respect the **2-minute timeout**
6. **Configuration** â€“ JSON/XML in unsecure/secure configuration; sensitive values in
   **secure configuration** + \`ORBIS.Core.Plugin.Cryptography\` (Constitution Â§5)
7. **Error handling** â€“ \`InvalidPluginExecutionException\` with a business-readable message;
   **no excessive tracing**, but use \`ITracingService\` for diagnostic paths

## Don'ts (ORBIS)

- No global/static variables holding context/service
- No ILMerge
- No \`var\` for basic data types
- No LINQ for direct data queries
- No depth dependency

## Rename/delete a plugin (ORBIS procedure)

1. Changes in the project â†’ 2. increase assembly version â†’ 3. build â†’
4. register in DEV as a NEW assembly â†’ 5. re-register steps â†’
6. remove old assembly â†’ 7. deploy managed solution as an **Upgrade** (not Update)

## Rules

- Unit tests with 80%+ coverage; FakeXrmEasy for complex tests (skill pp-test-dataverse).
- No synchronous external web calls (timeout) â†’ async or Azure Function/custom API.
- Registration belongs in the solution (visible unpacked in the repo).
`,
  "pp-lessons-learned": `---
name: pp-lessons-learned
description: "Captures experience as structured lessons from inputs, outputs, errors and results across the whole process. WHEN: lesson, lessons learned, retro, retrospective, what went wrong, what went well, error happened, inefficiency, improvement idea, log experience, capture learning. ANYTIME - called by any phase, any skill, or a human after a notable event."
---

# pp-lessons-learned

Captures experience so the harness continuously improves (Constitution Â§10).
Every notable event can become a lesson.

## When to capture

- An **error** occurred (build fail, checker violation, failed import, review BLOCKER)
- An **inefficiency** appeared (wasted turns, rework, slow path)
- Something **worked well** (reinforce and repeat it)
- A **gap** was found (missing skill/template/rule)
- A concrete **improvement** idea came up

## Mission

For each lesson, record it in the durable store:

1. **Log it** â€“ append one JSON object per line to \`lessons/lessons-index.jsonl\`
   (preferably via \`scripts/Add-Lesson.ps1\`). Required fields:
   \`id\` (LESSON-NNN, next free number), \`date\`, \`feature\`, \`phase\`, \`skill\`, \`type\`,
   \`context\` (input), \`outcome\` (output/result/error), \`recommendation\`, \`status: new\`.
   Optional: \`rootCause\`, \`appliedTo\`.
2. **Optional detail** â€“ for non-trivial lessons also create
   \`lessons/entries/LESSON-<NNN>-<slug>.md\` with a short narrative
   (situation â†’ what happened â†’ what to change).
3. **Keep it factual** â€“ describe observable input/output, not blame.

## Lesson quality bar

- \`context\` and \`outcome\` must be concrete enough for \`pp-skill-updater\` to act on.
- \`recommendation\` must name a concrete change (which skill/template/checklist and what).
- One lesson = one learning. Split multi-part events.

## Rules

- Never store secrets, credentials or PII in lessons (Constitution Â§5).
- Do not decide application here â€“ capture only; \`pp-skill-updater\` triages and applies.
- Link the feature slug and the originating skill so trends are visible.
`,
  "pp-monitor-telemetry": `---
name: pp-monitor-telemetry
description: "Sets up operations monitoring: Application Insights, plugin trace logs, flow analytics. WHEN: monitoring, telemetry, Application Insights, trace log, analyze flow runs, production errors, observability, alerting. AFTER the first prod deployment."
---

# pp-monitor-telemetry

Makes the solution observable in operations.

## Mission

1. **Application Insights** â€“ link the Dataverse environment to App Insights
   (Environment â†’ Settings â†’ Application Insights); plugin/workflow telemetry
   lands there automatically
2. **Plugin tracing** â€“ \`ITracingService\` in plugins (pp-implement-plugin) fills
   trace logs; queryable in App Insights as \`traces\` (KQL)
3. **Flow analytics** â€“ evaluate run history, error rates and duration per flow;
   recurring errors â†’ new requirement/bug in the harness
4. **Alerts** â€“ App Insights alerts: plugin error rate, slow requests,
   flow error rate; notify the operations team
5. **Feedback loop** â€“ insights flow back as new requirements into
   \`pp-specify\` (ALM cycle); recurring production errors are additionally logged as
   lessons via \`pp-lessons-learned\` (phase \`operate\`)

## Rules

- No PII in trace messages or custom properties (Constitution Â§5).
- Store standard KQL queries in the repo (\`docs/queries/\`).
- Monitoring configuration is part of the definition of done for prod features.
`,
  "pp-plan-solution": `---
name: pp-plan-solution
description: "Creates the technical solution plan (architecture) for a specified D365 CE feature. WHEN: 'plan', architecture, data model, choose app type, flow vs plugin decision, plan connectors, security design. AFTER pp-specify, BEFORE pp-tasks-breakdown. ORBIS-aligned."
---

# pp-plan-solution

Translates a business spec into the technical Power Platform architecture.
Corresponds to \`/speckit-plan\`. Follows ORBIS architecture guidelines.

## Mission

Create \`specs/<feature-slug>/plan.md\` from \`templates/solution-plan-template.md\`:

1. **Architecture overview** â€“ Mermaid diagram: apps, Dataverse, flows, plugins, integrations
2. **Data model** â€“ tables (logical names with publisher prefix), columns with type/required
   and ORBIS suffix conventions, relationships (1:N, N:N), alternate keys, business rules
3. **Apps** â€“ model-driven (default for D365 CE) vs. canvas, sitemap structure
4. **Automation** â€“ per rule: **low-code before code-first** (Constitution Â§4).
   Order: business rule â†’ cloud flow â†’ Power Fx â†’ PCF â†’ plugin.
   Every code-first component needs a justification or ADR.
5. **Integrations** â€“ connectors, custom APIs; every external system with
   connection reference + environment variable definition
6. **Security** â€“ security roles (Base + Addon pattern), FLS for sensitive columns,
   DLP-compliant connectors, Key Vault for secrets
7. **Test strategy** â€“ unit (FakeXrmEasy), UI (Playwright), acceptance tests from spec ACs

## Rules

- Every plan reference to a spec element must be traceable (cite AC IDs).
- Violations of the constitution must be documented and justified in the plan.
- Environment variable *definitions* and connection references MUST be planned for all
  external connections (values only via deployment settings).
- One Solution Approach â€“ justify any additional solution.
`,
  "pp-review-code": `---
name: pp-review-code
description: "Performs the mandatory QA/code review before merge: checks the PR against the ORBIS checklist, spec conformance, security, constitution compliance. WHEN: review, code review, PR review, QA, quality assurance, four-eyes principle, merge approval, checklist. AFTER pp-implement-*, BEFORE pp-converge-validate and before every merge."
---

# pp-review-code

Enforces the four-eyes principle (Constitution Â§8). No merge without a documented review.

## Mission

For every pull request:

1. **Create review protocol** â€“ from \`templates/pr-review-template.md\`, stored at
   \`reviews/<feature-slug>/PR-<number>.md\`
2. **Work through the checklist** â€“ \`templates/code-review-checklist.md\`:
   spec conformance (ACs met?), constitution (ORBIS naming, prefix, environment
   variables, no secrets, DLP), solution diff plausibility (unpacked XMLs),
   code quality (plugins: tracing/exceptions; JS: no DOM hacks; PCF: updateView
   idempotent), tests present and green
3. **Document findings** â€“ classify findings by severity:
   - \`BLOCKER\` â€“ must be fixed before merge
   - \`MAJOR\` â€“ fix before prod deployment
   - \`MINOR\` â€“ follow-up task allowed
4. **Decision** â€“ \`Approved\` (no open BLOCKER/MAJOR) or \`Changes requested\`
   with concrete feedback per finding (artifact + line/location)

## Rules

- Reviewer != author (four-eyes principle); Copilot-generated artifacts are always
  reviewed by a human.
- ORBIS best practices: constructive and positive wording, ask open questions, praise
  good solutions; review max. 60 minutes at a time; code was built and tested before
  the review; use automation (ESLint, static analysis).
- Every spec acceptance criterion is recorded in the review protocol with a status
  (met / open / n.a.).
- Solution XML diffs: check for unwanted deletions and foreign components.
- No approval with an open BLOCKER â€“ no exceptions without an ADR.
- The result is referenced as mandatory evidence in \`pp-converge-validate\`.
- Every BLOCKER/MAJOR finding is also logged as a lesson via \`pp-lessons-learned\`
  (type \`error\` or \`improvement\`) so the review itself teaches the harness.
`,
  "pp-skill-updater": `---
name: pp-skill-updater
description: "Triages captured lessons and automatically updates the harness (skills, templates, checklists, constitution, diagrams) so it improves over time. WHEN: skill updater, update skills, apply lessons, triage lessons, improve harness, self-improve, run improvement loop, before release. AFTER pp-lessons-learned has collected lessons; run weekly or before a release."
---

# pp-skill-updater

Turns captured lessons into concrete harness improvements. This is the self-learning
loop of the harness (Constitution Â§10).

## Mission

Read \`lessons/lessons-index.jsonl\`, triage every lesson with \`status: new\`, and apply
justified changes to the harness itself.

1. **Triage** â€“ for each \`new\` lesson decide:
   - \`applied\` â€“ a concrete, safe improvement â†’ make the change
   - \`rejected\` â€“ out of scope, contradicts the constitution, or unsafe â†’ record why
   - keep \`new\` â€“ needs more evidence or a human decision
2. **Apply** â€“ edit the affected artifacts named in \`appliedTo\` or derived from the
   recommendation: skills (\`skills/*/SKILL.md\`), templates, checklists
   (\`templates/code-review-checklist.md\`), constitution (only small clarifications â€“
   never weaken Â§5 security), scripts, diagrams.
3. **Record** â€“ update each applied lesson: set \`status: applied\`, \`appliedBy:
   pp-skill-updater\`, \`appliedAt: <date>\`, and fill \`appliedTo\` with the changed files.
4. **Report** â€“ summarize: N lessons triaged, X applied (list files changed),
   Y rejected (with reasons), Z still open.

## Change principles

- **Small, surgical edits** â€“ refine a rule, add a checklist item, clarify a step;
  do not rewrite whole files for one lesson.
- **Constitution changes are conservative** â€“ only clarify or add; never remove a
  security/quality gate. Propose bigger changes as an ADR instead (Â§9).
- **Verifiable** â€“ after editing, re-run \`scripts/Test-Harness.ps1\` and keep it at 0 errors.
- **Reinforce the good** â€“ \`worked-well\` lessons become explicit guidance
  (a line in the relevant skill), not just praise.

## Rules

- Every applied change must be traceable: the lesson lists the files it changed.
- If a lesson implies a **new** recurring pattern across multiple events, propose a
  checklist item or template change rather than a one-off note.
- If a lesson requires new capability, record it as a \`gap\` and flag it in the report â€“
  do not invent large new features silently.
- Never delete lessons. Rejected lessons keep their reason in the record.
`,
  "pp-specify": `---
name: pp-specify
description: "Creates a business feature specification for D365 CE / Power Platform from a requirement. WHEN: new requirement, 'specify', user story, acceptance criteria, process flow, clarify business need. AFTER pp-constitution, BEFORE pp-plan-solution."
---

# pp-specify

Turns a raw business requirement into a verifiable feature specification.
Corresponds to \`/speckit-specify\`.

## Mission

Create \`specs/<feature-slug>/spec.md\` from \`templates/feature-spec-template.md\` with:

1. **Business goal** â€“ 2â€“3 sentences, no technology
2. **Process flow** â€“ Mermaid diagram (flowchart) of the business process
3. **User stories & acceptance criteria** â€“ each AC individually verifiable (Given/When/Then-ready)
4. **Affected Dataverse artifacts** â€“ which tables/forms/views are meant
   (no technical names yet)
5. **Roles & permissions** â€“ business view
6. **PII marking** â€“ mark personal data fields (Constitution Â§5)
7. **Non-goals** â€“ explicit scope boundary
8. **Open questions** â€“ listed until clarified

## Rules

- No technical implementation details (no column types, no flow definitions).
- Every user story must have at least one verifiable acceptance criterion.
- PII fields MUST be marked.
- Only set "Ready" when no open questions remain.
- Use ORBIS requirements templates (\`templates/requirements/\`) for typed requirements.
`,
  "pp-tasks-breakdown": `---
name: pp-tasks-breakdown
description: "Breaks a solution plan into executable, dependency-ordered implementation tasks. WHEN: 'tasks', derive tasks, sprint planning, implementation order, what to build in which order. AFTER pp-plan-solution, BEFORE pp-implement-*."
---

# pp-tasks-breakdown

Breaks the plan into atomic, independently verifiable tasks. Corresponds to \`/speckit-tasks\`.

## Mission

Create \`specs/<feature-slug>/tasks.md\` from \`templates/tasks-template.md\`.

## Structure rules

- **Order:** schema (Dataverse) â†’ UI (apps/forms/scripts) â†’ automation
  (flows/plugins) â†’ quality (tests/checker) â†’ deployment
- Each task: \`T-NN: <verb> <object> <context>\` â€“ implementable in â‰¤ 1 day
- Dependencies explicitly documented at the end (\`T-02 â† T-01\`)
- Each task references the responsible skill (\`pp-implement-*\`)

## Task categories

| Category | Skill | Examples |
|---|---|---|
| Schema | pp-implement-dataverse | tables, columns, relationships, business rules, roles |
| UI | pp-implement-app, pp-implement-js, pp-implement-pcf | forms, views, sitemap, ribbons, form scripts, PCF |
| Automation | pp-implement-flow, pp-implement-plugin | cloud flows, plugins, custom APIs |
| Quality | pp-test-dataverse, pp-converge-validate | unit/UI tests, solution checker |
| Review | pp-review-code | PR review against checklist |
| Deployment | pp-export-solution, pp-git-integration, pp-deploy-pipeline | export, unpack, PR, pipeline deploy |

## Rules

- No task without an acceptance criterion (implicit: linked AC from the spec).
- Mark parallelizable tasks (e.g. UI tasks after schema completion).
- The last task is always the deployment to test incl. UAT approval.
`,
  "pp-test-dataverse": `---
name: pp-test-dataverse
description: "Creates and runs tests: unit tests for plugins (FakeXrmEasy), UI tests (Playwright), acceptance tests from spec criteria. WHEN: write tests, FakeXrmEasy, Playwright, UI test, test plugin, regression test, acceptance test. PHASE 4, before pp-converge-validate."
---

# pp-test-dataverse

Secures the solution with tests â€“ derived from the acceptance criteria of the spec.

## Test levels

1. **Unit tests (plugins)** â€“ FakeXrmEasy (v9 package for Dataverse):
   mock the plugin context, set target/images, verify service calls;
   every plugin task from \`tasks.md\` needs at least a happy path + an error case.
   Target: 80%+ coverage (ORBIS).
2. **UI tests (model-driven app)** â€“ Playwright:
   - login via stored storage state (set up MFA-safe)
   - critical paths: create record â†’ business rules â†’ verify flow trigger
   - selectors: \`data-id\` attributes of MDA controls, no CSS classes
3. **Acceptance tests** â€“ one executable check per spec AC (manually scripted or
   automated); the result is referenced in \`pp-converge-validate\`
4. **Performance tests** (only for high-volume/bulk features, Constitution Â§6) â€“
   load a representative data volume (>50k rows) in a test environment, measure
   plugin execution time against the 2-minute sandbox budget, verify filtered
   views/queries use indexed columns, and check for API throttling limits
   (bulk create/update via \`ExecuteMultiple\`/batch instead of row-by-row calls).

## Rules

- Tests run against a dedicated test/UAT environment, never against prod.
- Create test data deterministically and clean it up (setup/teardown).
- Flaky UI tests: explicit waits (\`expect(locator).toBeVisible()\`), no \`waitForTimeout\`.
- Test projects in the repo: \`tests/unit/\`, \`tests/ui/\`.
`
};

const SKILL_NAMES = ['pp-adr-governance', 'pp-constitution', 'pp-converge-validate', 'pp-deploy-pipeline', 'pp-export-solution', 'pp-git-integration', 'pp-implement-app', 'pp-implement-dataverse', 'pp-implement-flow', 'pp-implement-js', 'pp-implement-pcf', 'pp-implement-plugin', 'pp-lessons-learned', 'pp-monitor-telemetry', 'pp-plan-solution', 'pp-review-code', 'pp-skill-updater', 'pp-specify', 'pp-tasks-breakdown', 'pp-test-dataverse'];

joinSession({
  tools: [
    {
      name: "pp_harness",
      description: "Power Platform Spec-Kit Harness - D365 CE spec-driven code factory (ORBIS-aligned, self-improving). Returns the constitution, a skill guide, or the process overview.",
      parameters: {
        type: "object",
        properties: {
          section: {
            type: "string",
            enum: ["constitution", "skill", "overview", "skills-list"],
            description: "What to return"
          },
          skill: {
            type: "string",
            description: "Skill name when section='skill' (e.g. 'pp-implement-flow')"
          }
        },
        required: ["section"]
      },
      handler: async ({ section, skill }) => {
        if (section === "constitution") return CONSTITUTION;
        if (section === "overview") return OVERVIEW;
        if (section === "skills-list") return SKILL_NAMES.join("\n");
        if (section === "skill") {
          if (!skill || !SKILLS[skill]) {
            return "Unknown skill '" + skill + "'. Available: " + SKILL_NAMES.join(", ");
          }
          return SKILLS[skill];
        }
        return "Unknown section. Use one of: constitution, skill, overview, skills-list";
      }
    }
  ]
});