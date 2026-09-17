# Data Model & Source Mapping

This document describes the normalized event schema produced by
`scripts/log_case.py`, how source-specific field names map onto it, how
correlation is resolved, how fingerprints/evidence locators are computed, and
known caveats. Cross-referenced against official Microsoft documentation.

## Normalized event fields (stored per event in `case.db` / batch JSONL)

| Field | Type | Meaning |
|---|---|---|
| `event_time` | ISO8601 string or null | Best-effort parsed timestamp, converted to UTC **only if** the source included an explicit offset/`Z`. Otherwise stored as parsed local wall-clock time with `tz_known=false`. |
| `event_time_raw` | string or null | The original, unparsed timestamp value, kept for audit. |
| `tz_known` | bool | Whether the source timestamp carried explicit timezone info. See timezone caveat below. |
| `correlation_id` | string or null | See "Correlation precedence" below. |
| `parent_id` | string or null | Immediate parent operation/step, if present. |
| `request_id` | string or null | Request-scoped identifier (Dataverse `RequestId`), kept separately from `correlation_id`. |
| `duration_ms` | float or null | Duration in milliseconds. See "Duration units" below. |
| `constructor_duration_ms` | float or null | Dataverse plugin constructor duration, if present. |
| `success` | bool or null | Explicit success flag, or inferred `false` when an exception is present and no explicit flag exists. `null` = unknown. |
| `severity` | string or null | Normalized to `Verbose`/`Information`/`Warning`/`Error`/`Critical`. |
| `telemetry_type` | string | `plugintrace`, `exception`, `request`, `dependency`, `trace`, `log`, or inferred fallback. |
| `operation_name` | string or null | Logical operation/request name. |
| `message_text` | string or null | Free-text message (may be multiline). |
| `exception_type` | string or null | Exception/problem type identifier. |
| `exception_text` | string or null | Full exception details / stack trace (multiline preserved verbatim). |
| `plugin_type` | string or null | Dataverse plugin `TypeName`. |
| `message_name` | string or null | Dataverse SDK message (e.g. `Update`, `Create`). |
| `primary_entity` | string or null | Dataverse `PrimaryEntity` logical name. |
| `plugin_step_id` | string or null | Dataverse `PluginStepId`. |
| `mode` | string or null | `Sync` or `Async`. |
| `depth` | int or null | Dataverse plugin pipeline depth. |
| `role_name` | string or null | Application Insights cloud role name (service/app identity). |
| `result_code` | string or null | HTTP/result status code, if present. |
| `target` | string or null | Dependency/request target (e.g. URL, host). |
| `source_event_id` | string or null | Source-native event/item ID, if present. |
| `source_kind` | string | File-type the record was parsed from (`json`, `jsonl`, `csv`, `log`/`txt`). |

Every normalized event also retains the **original raw record** (`raw_json`)
for full traceability back to source content.

## Source field mappings (aliases)

`log_case.py` resolves each normalized field using a **first-match** alias
list (case-insensitive), so a case can mix Dataverse Plugin Trace Log CSV
exports, Application Insights JSON/JSONL exports, and Log Analytics KQL table
exports without manual reconciliation.

| Normalized field | Recognized source aliases |
|---|---|
| `correlation_id` | `CorrelationId` (Dataverse), `operation_Id` / `OperationId` (Application Insights / Log Analytics) |
| `parent_id` | `operation_ParentId` / `OperationParentId` / `ParentId` |
| `request_id` | `RequestId` |
| `event_time_raw` | `timestamp` (AI), `TimeGenerated` (Log Analytics), `CreatedOn` (Dataverse), `time`, `date` |
| `duration_ms` | `PerformanceExecutionDuration` (Dataverse, already ms), `duration` (AI, ms), `DurationMs` (Log Analytics) |
| `constructor_duration_ms` | `PerformanceConstructorDuration` |
| `success` | `success` / `Success` |
| `severity` | `severityLevel` / `SeverityLevel` (AI numeric 0–4), `severity`, `level` (text) |
| `telemetry_type` | `itemType` / `type` (AI: `request`/`exception`/`trace`/`dependency`) |
| `operation_name` | `operation_Name`, `name` |
| `message_text` | `message`, `MessageBlock` (Dataverse) |
| `exception_type` | `exceptionType`, `problemId`/`ProblemId` |
| `exception_text` | `ExceptionDetails` (Dataverse), `exceptions`, `outerMessage`, `stackTrace` |
| `plugin_type` | `TypeName` (Dataverse) |
| `message_name` | `MessageName` (Dataverse) |
| `primary_entity` | `PrimaryEntity` (Dataverse) |
| `plugin_step_id` | `PluginStepId` (Dataverse) |
| `mode` | `Mode` (Dataverse: `0`=Sync, `1`=Async) |
| `depth` | `Depth` (Dataverse) |
| `role_name` | `cloud_RoleName` / `AppRoleName` (AI) |
| `result_code` | `resultCode` / `ResultCode` |
| `target` | `target` / `Target` |

Reference: PluginTraceLog entity fields (`CorrelationId`, `RequestId`,
`PluginStepId`, `TypeName`, `MessageName`, `PrimaryEntity`, `Depth`, `Mode`,
`PerformanceConstructorDuration`, `PerformanceExecutionDuration`,
`ExceptionDetails`, `MessageBlock`):
<https://learn.microsoft.com/power-apps/developer/data-platform/reference/entities/plugintracelog>

Tracing/logging can consume significant storage and should be enabled only
for troubleshooting, then disabled again:
<https://learn.microsoft.com/power-apps/developer/data-platform/logging-tracing>

Application Insights data model, correlation semantics (`operation_Id` shared
across a logical operation, `operation_ParentId` for the immediate parent),
and common telemetry tables/fields:
<https://learn.microsoft.com/azure/azure-monitor/app/data-model-complete>
<https://learn.microsoft.com/azure/azure-monitor/app/data-model-complete#context>

Failure and performance/transaction diagnosis workflow (percentile-based,
not fixed thresholds):
<https://learn.microsoft.com/azure/azure-monitor/app/failures-performance-transactions>

## Correlation precedence

When resolving `correlation_id`, the first non-empty value wins, in this
order:

1. `CorrelationId` (Dataverse Plugin Trace Log) — most specific to a single
   Dataverse pipeline execution chain.
2. `operation_Id` / `OperationId` (Application Insights / Log Analytics) —
   shared by every telemetry item belonging to one logical operation.
3. `RequestId` — used only as a fallback correlation key when no
   operation-level ID exists; note that in Dataverse, `RequestId` is
   per-request and may differ from `CorrelationId` across a pipeline with
   multiple plugin steps sharing one correlation but distinct requests, so it
   is deliberately given lower precedence.

`parent_id` is resolved from `operation_ParentId`/`ParentId` and represents
the **immediate** parent only (not the whole ancestor chain); reconstructing
a full call tree requires following `parent_id` links across the correlated
event set.

## Duration units

- Dataverse `PerformanceExecutionDuration` / `PerformanceConstructorDuration`
  are documented in milliseconds.
- Application Insights `duration` (requests/dependencies) is in
  milliseconds; Log Analytics table exports commonly expose the same value
  as `DurationMs`.
- The tool does **not** attempt unit conversion beyond alias resolution; if a
  non-standard export uses seconds, flag this explicitly as a caveat rather
  than silently rescaling.

## Fingerprinting (fuzzy grouping) vs. deduplication (exact)

- **`content_hash`** (exact dedup key): SHA-256 over the canonical JSON
  (sorted keys) of the *raw* record. Used to collapse byte-identical events
  re-appearing across overlapping exports; a `duplicate_count` is
  incremented on the original event rather than inserting a new row.
- **`fingerprint`** (fuzzy clustering key): SHA-256 over a template built
  from `telemetry_type`, `exception_type`, a normalized version of
  `exception_text`/`message_text` (GUIDs and digit runs replaced with
  `<guid>`/`<n>` placeholders), `plugin_type`, `message_name`, and
  `primary_entity`. Used to group "the same kind of problem" across many
  events with different IDs/timestamps/counters, e.g. to report "this
  timeout occurred 47 times" instead of 47 separate findings.

## Evidence locators

Every finding must cite at least one evidence locator with:
`event_id` (internal DB id, stable within a case), `source_file` (original
ingested file path), `correlation_id`, and `event_time`. This allows a
reviewer to trace any claim back to `batch show --batch-id <id>` or the
original file/line.

## Caveats

- **Timezone**: source timestamps frequently omit timezone information
  (common for Dataverse Plugin Trace Log CSV exports and some Application
  Insights exports depending on query/tool). `tz_known=false` on an event
  means the timestamp is stored as parsed wall-clock time with no offset
  applied — do not assume UTC or local time without independent
  confirmation from the user or export metadata.
- **Sampling**: an ingested file may represent a filtered/paged export
  (e.g. a bounded KQL query window). The tool has no way to know whether the
  provided data is the full population; always state the known time range
  (`overview.time_range`) and avoid extrapolating beyond it.
- **Mixed duration semantics**: comparing Dataverse plugin execution
  duration against Application Insights request duration conflates two
  different measurement boundaries (plugin-internal vs. end-to-end HTTP);
  treat cross-source performance comparisons as directional, not exact.
