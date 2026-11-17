# Task 1: Code standards and static analysis

## Theory

**Why be strict in code?** Many security bugs are ordinary bugs: a null that should not be null, a forgotten `await`, a culture-dependent string comparison, a disposable that is never disposed. The compiler and analyzers find these for free, but only if their warnings **fail the build**. A warning that is allowed to pass soon gets ignored along with all the others.

### The .NET toolbox

| Tool | What it does |
|---|---|
| `Directory.Build.props` | MSBuild properties shared by every project under a folder. Set rules once. |
| `<Nullable>enable</Nullable>` | Makes null a type-level concept: `string` vs `string?`. |
| `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` | A warning breaks the build. |
| `<AnalysisLevel>latest-recommended</AnalysisLevel>` | Turns on the built-in .NET (CA) code-quality analyzers at a sensible level. |
| `<EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>` | IDE style rules (IDExxxx) also run in `dotnet build`, so CI enforces them. |
| `.editorconfig` | Formatting and naming rules plus per-rule severity. The single source of style truth. |
| `dotnet format --verify-no-changes` | Fails if code is not formatted according to `.editorconfig`. |
| `Directory.Packages.props` (Central Package Management) | Every NuGet version is declared once. Ends version drift like `Hosting 10.0.12` vs `10.0.14`. |
| `global.json` | Pins the SDK version so your laptop, CI and Docker build the same way. |
| `packages.lock.json` + `RestoreLockedMode` | Restores exactly the dependency graph you reviewed, including transitive packages. |
| Security analyzers | The CA rules include security rules (CA2xxx, CA3xxx, CA5xxx: SQL injection, weak crypto, insecure deserialization). |

### Rules worth knowing by name

- **CA2007 / ConfigureAwait**: library code already uses `ConfigureAwait(false)`. Decide per project.
- **CA1305 / CA1309 / CA1310**: culture-safe formatting and string comparison. These matter for Latvian text.
- **CA2000**: dispose objects. `HttpResponseMessage` and `JsonDocument` are the usual suspects.
- **CA5350/CA5351**: weak cryptography.
- **CA2100**: SQL built from strings. EF protects you, but `FromSqlRaw` doesn't.

### Strict, but pragmatic

Turning everything on in one go produces hundreds of errors. The professional approach:
1. Enable the settings and see the full list.
2. Fix the real issues.
3. For rules you deliberately reject, set the severity to `none` in `.editorconfig` **with a comment explaining why**.
4. Never use a blanket `#pragma warning disable` without a reason in the same line.

## How the repo does it today

- Nullable appears to be on per project, but there is no `Directory.Build.props`, `.editorconfig`, `global.json` or central package management.
- Package versions have drifted between projects.
- Style is consistent by habit, not by enforcement.

## Exercise

1. Add `backend/global.json` pinning the SDK version you have installed (`dotnet --version`), with `rollForward: latestFeature`.
2. Add `backend/Directory.Build.props` with `Nullable`, `ImplicitUsings`, `TreatWarningsAsErrors`, `AnalysisLevel=latest-recommended`, `EnforceCodeStyleInBuild`, `RestorePackagesWithLockFile`. Build and collect the errors.
3. Add `backend/.editorconfig`. Start from `dotnet new editorconfig`, then make the existing style explicit: file-scoped namespaces, `var`, the `using` order, private fields as `_camelCase`.
4. Fix the warnings. Keep a short "rule decisions" table in Notes for every rule you turn off and why.
5. Move every package version into `Directory.Packages.props`, aligning `Microsoft.Extensions.*` to one version.
6. Run `dotnet format --verify-no-changes` and make it pass.
7. Commit the generated `packages.lock.json` files.

## Done when

- [x] `dotnet build -warnaserror` passes with analyzers on.
- [x] `dotnet format --verify-no-changes` passes.
- [x] No `Version=` attributes remain in any `.csproj`.
- [x] Every disabled rule has a written reason.
- [x] Lock files are committed, and `dotnet restore --locked-mode` succeeds.

## Notes

### Rule decisions

| Rule | Severity | Scope | Why |
|---|---|---|---|
| CA1848 (LoggerMessage delegates) | none | all | Logging is low-volume (upload rejections, worker failures). Source-generated log methods add boilerplate for no measurable gain. |
| CA1707 (no underscores in names) | none | Govori.Tests, Govori.E2ETests | Test names read as sentences (`Counts_single_and_phrase_fillers`). |
| All analyzers | n/a | `**/Migrations/*.cs` | EF-generated code, marked `generated_code = true`. |

### Fixed rather than suppressed

- CA1875: `Regex.Matches(...).Count` → `Regex.Count` (SpeechAnalyzer).
- CA1725: `OnModelCreating(ModelBuilder b)` → `modelBuilder` to match the base.
- CA2016: forwarded `CancellationToken` to EF calls in the attempt and `/me` endpoints.
- CA1305: invariant-culture `ToString` in E2E multipart forms.
- CA1711 / CA1051 / CA1861: renamed `ApiCollection` → `ApiTestGroup`, made `FakeEvaluator.Calls` a read-only property, used a collection expression.
- MSB3277: Npgsql 10.0.3 pulled EF Core 10.0.4 while EF Design used 10.0.13. EF Core is now pinned to 10.0.13 through `CentralPackageTransitivePinningEnabled`.

### Style choices in .editorconfig

- `var` everywhere (warning), file-scoped namespaces (warning), `_camelCase` private fields (warning).
- `System` usings first, no blank lines between using groups. Final newline required.
- The Dockerfile copies the shared build files and lock files and restores with `--locked-mode`.
