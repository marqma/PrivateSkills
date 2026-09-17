---
name: dataverse-code-review
description: >
  Reviews Microsoft Dataverse and Dynamics 365 changes with a strict,
  evidence-driven focus on correctness, security, performance, and pragmatic
  maintainability. Covers C# plug-ins and Custom APIs, TypeScript model-driven
  app scripts, PCF controls, solution metadata, registration, ALM, tests, and
  analyzer output. Use for Dataverse code review, D365 PR review, plug-in
  review, Custom API review, TypeScript web-resource review, PCF review,
  Solution Checker triage, or Power Platform quality gates.
version: 1.0.0
license: Private use.
---

# Dataverse Code Review

Review like a senior Dataverse engineer. Optimize in this order:

1. Correctness and data integrity
2. Security and authorization
3. Transaction safety and performance
4. Reliability and observability
5. Maintainability
6. Style only when it creates a concrete cost

The best review is precise, actionable, and small. Do not propose a framework,
architecture rewrite, ADR, abstraction, or new dependency unless the current
change creates a demonstrated need.

## Evidence rules

- Inspect changed source, tests, project configuration, and relevant unpacked
  solution/registration metadata. Source alone cannot prove that stage, mode,
  filtering attributes, images, impersonation, or dependencies are correct.
- Publish only findings introduced or exposed by the change.
- A blocking finding requires a concrete failure path and high confidence.
- Do not infer runtime registration from class names.
- Do not report style preferences as defects.
- If evidence is incomplete, state a verification request instead of a finding.
- Never claim a build, test, analyzer, or Solution Checker result that was not run.

## Review workflow

1. Determine the changed behavior and acceptance criteria.
2. Identify C# plug-ins/Custom APIs, TypeScript web resources, PCF controls,
   tests, manifests, and solution metadata affected by the change.
3. Run the smallest repository-native checks that cover the change:
   - C#: build, focused tests, configured Roslyn/.NET analyzers.
   - TypeScript/PCF: clean install when needed, type-check, type-aware ESLint,
     focused Jest/Vitest tests, and production build.
   - Solution: Power Apps Solution Checker when a package is available; preserve
     its SARIF/raw report and cite rule IDs.
4. Trace each potential issue from input/registration through behavior to impact.
5. Report findings by severity and confidence. Keep optional improvements separate.

## C# plug-ins and Custom APIs

### Correctness and transaction safety

- Verify message, primary table, stage, mode, `Target` type, required attributes,
  image names/columns, and Custom API input/output types against registration.
- For Update, remember that `Target` contains changed attributes only. Prefer a
  minimal pre/post image over a redundant retrieve.
- Keep plug-ins stateless. Mutable instance/static fields must not hold context,
  services, entities, or per-execution state; immutable constants are fine.
- Review `CreateOrganizationService` identity explicitly. Elevation or use of
  SYSTEM requires a concrete authorization justification.
- Expected user-facing failures use `InvalidPluginExecutionException`; unexpected
  failures retain diagnostic context and are not swallowed.
- Do not use `Depth > 1` as a generic recursion guard. Prevent the actual re-entry
  using filtering attributes, changed-value checks, and targeted updates.
- Flag fire-and-forget work, `Task.Run`, `Task.WhenAll`, `Parallel.*`, threads,
  and concurrent organization-service calls inside plug-ins.
- Flag `ExecuteMultipleRequest` and `ExecuteTransactionRequest` inside plug-ins;
  batching belongs in external clients/workers.

### Security

- No secrets, tokens, connection strings, customer URLs, or credentials in code,
  client bundles, solution XML, traces, exceptions, or process arguments.
- Unsecure plug-in configuration is not secret storage. Prefer managed identity
  and external secret storage where supported; otherwise use secure step config.
- UI visibility is not authorization. Verify caller privileges, impersonation,
  Custom API privilege configuration, ownership, sharing, and field security.
- Do not trace complete `Target`/image payloads, headers, tokens, FetchXML values,
  or personal data.

### Performance

- Treat the two-minute sandbox timeout as a failure ceiling, never a target.
  Synchronous paths need a much smaller, requirement-based latency budget.
- Require Update filtering attributes and inspect duplicate/overlapping steps.
- Reject `ColumnSet(true)`, `AllColumns = true`, broad queries, and unbounded loops.
  Retrieve only attributes actually consumed.
- Do not flag every retrieve: flag it when images/Target already contain the data,
  selection is broad, or cardinality is unbounded.
- Avoid unnecessary updates to the same row and unchanged attributes.
- Synchronous external I/O needs explicit short timeouts and a transaction-safe
  failure strategy. Do not add retries by default; move long or nontransactional
  work to async processing or an external worker.

### Observability

- Trace diagnostic facts: plug-in type, message, stage, correlation/request ID,
  and elapsed checkpoints. Do not duplicate every event across tracing systems.
- Keep `ITracingService` for essential diagnostics. Use Dataverse/Application
  Insights telemetry for durable signals when configured.

## TypeScript web resources and PCF

- Use `executionContext.getFormContext()`, supported Client API, and `Xrm.WebApi`;
  flag `Xrm.Page`, `window.top`, unsupported form DOM access, and synchronous XHR.
- Do not retain form/execution context across async boundaries. Reacquire or copy
  only stable values needed after `await`.
- Every Web API query specifies required `$select` fields, bounds collection
  retrieval, handles paging where needed, and handles Promise rejection.
- PCF `updateView` is repeatable, handles temporary null values, and avoids Web API,
  refresh, render, or `notifyOutputChanged` storms.
- PCF `destroy` removes listeners/observers/timers, closes resources, and unmounts
  rendered roots. Test lifecycle and output-notification behavior.
- Use type-aware ESLint and strict TypeScript settings appropriate to the project.
  Exclude generated manifest types and compiled bundles from handwritten-code review.
- Deploy production builds only. Justify heavy dependencies with measured bundle
  or runtime impact.
- No sensitive data in local/session storage. Preserve keyboard, labeling, focus,
  and accessibility behavior.

## ALM and solution metadata

- Development changes originate in unmanaged Dev solutions; downstream delivery
  uses managed artifacts and automated pipelines.
- Review component additions/deletions, dependencies, publisher ownership,
  environment-variable definitions, connection references, plug-in step/image
  metadata, Custom API metadata, and duplicate registrations.
- Solution Checker is the Dataverse-specific static-analysis baseline. Combine it
  with repository-configured analyzers; do not invent an exhaustive local ruleset.
- Block new Critical/High checker issues. Baseline existing findings and ratchet
  Medium findings deliberately; informational findings are not automatically fatal.
- CI uses workload identity/service principals and secret stores, not personal
  credentials or username/password authentication.

## Testing standard

- Test changed behavior and risks, not an arbitrary percentage.
- Plug-ins: happy path, missing/partial Target, image contract, wrong registration,
  changed/unchanged values, identity-sensitive behavior, expected exceptions, and
  regression paths.
- Custom APIs: parameter type/absence, authorization, every successful output
  branch, and failure translation.
- PCF: init/update/destroy lifecycle, repeated updates, null input, output
  notifications, cleanup, accessibility, and regressions.
- Add a small environment-level smoke test where registration, security, solution
  import, or platform behavior cannot be proven by unit tests.
- Fake Xrm Easy is optional community tooling, not a mandatory architecture choice.

## Severity

- **Critical**: exploitable authorization bypass, credential exposure, destructive
  data corruption, or injection.
- **High**: incorrect transaction/pipeline behavior, unsupported concurrency,
  recursion, broad privilege elevation, severe query/bulk pattern, or a
  production-breaking ALM defect.
- **Medium**: realistic reliability/performance defect, missing cleanup/error
  handling, or missing tests for changed critical logic.
- **Low**: maintainability issue with a concrete future cost.
- **Suggestion**: optional or stylistic improvement; never blocks.

## Output

Lead with the decision: `Approve`, `Changes requested`, or `Cannot verify`.
Then list findings ordered by severity and confidence:

| # | Severity | Confidence | Location | Problem and Dataverse impact | Smallest safe fix | Verification |
|---|---|---|---|---|---|---|

For each finding cite exact path/line or solution component and include the
concrete evidence. Put low-confidence questions and optional suggestions in
separate sections. If no defects are found, explicitly say so and name checks
that were not run.

## Sources

- Microsoft PowerApps samples:
  https://github.com/microsoft/PowerApps-Samples
- Microsoft Power CAT code components:
  https://github.com/microsoft/powercat-code-components
- Microsoft Power Platform Actions:
  https://github.com/microsoft/powerplatform-actions
- Microsoft Power Platform Build Tools:
  https://github.com/microsoft/powerplatform-build-tools
- GitHub awesome-copilot review instructions:
  https://github.com/github/awesome-copilot
- Dataverse plug-in best practices:
  https://learn.microsoft.com/power-apps/developer/data-platform/best-practices/business-logic/
- PCF best practices:
  https://learn.microsoft.com/power-apps/developer/component-framework/code-components-best-practices
