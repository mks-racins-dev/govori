# Govori Solution Documentation

This document describes the implementation of the foundational engineering tasks for the Govori project.

## Overview

Govori is a speech analysis platform built with:
- **Frontend**: React (TypeScript)
- **Backend**: ASP.NET Core Web API (.NET 10)
- **Database**: PostgreSQL (via EF Core)
- **Storage**: Supabase (production) or local disk (development)
- **AI Services**: OpenAI (transcription), Anthropic Claude (evaluation)

This document tracks the completion of infrastructure, code quality, and CI/CD tasks.

---

## Task 1: Code Standards and Static Analysis ✅ COMPLETED

**Purpose**: Enforce code quality and security through strict compilation settings, analyzers, and formatting rules.

### Implementation

#### 1. SDK Pinning (`backend/global.json`)
```json
{
  "sdk": {
    "version": "10.0.100",
    "rollForward": "latestFeature"
  }
}
```
- Ensures consistent .NET 10 SDK across local dev, CI, and Docker builds
- Prevents "works on my machine" issues caused by different SDK versions

#### 2. Shared Build Configuration (`backend/Directory.Build.props`)
Applied to all projects under `backend/`:
- **Nullable Reference Types**: `<Nullable>enable</Nullable>` — enforces null safety at the type system level
- **Implicit Usings**: `<ImplicitUsings>enable</ImplicitUsings>` — reduces boilerplate
- **Warnings as Errors**: `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` — no warnings slip into production
- **Code Analysis**: `<AnalysisLevel>latest-recommended</AnalysisLevel>` — enables .NET's CA (Code Analysis) rules
- **Build-Time Style Enforcement**: `<EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>` — IDE style rules run in CI
- **Locked Restore**: `<RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>` — reproducible dependency resolution

#### 3. Code Style Rules (`backend/.editorconfig`)
Single source of truth for formatting, naming, and style:
- `var` for all local declarations (enforced with warning)
- File-scoped namespaces
- `_camelCase` for private fields
- Consistent `using` statements (System first, no blank lines)
- Final newline required in all files

#### 4. Central Package Management (`backend/Directory.Packages.props`)
- All NuGet package versions declared once
- Prevents version drift (e.g., `Microsoft.EntityFrameworkCore 10.0.4` in one project vs `10.0.13` in another)
- Transitive pinning enabled for security consistency

#### 5. Lock Files (`backend/**/packages.lock.json`)
- Committed to version control
- `dotnet restore --locked-mode` ensures exact dependency graph reproducibility
- Protects against supply chain attacks by pinning transitive dependencies

#### 6. Rule Decisions
| Rule | Severity | Scope | Reason |
|------|----------|-------|--------|
| CA1848 | none | all | Logging is low-volume; source-generated delegates add boilerplate for no measurable gain |
| CA1707 | none | Govori.Tests, Govori.E2ETests | Test names read as sentences (e.g., `Counts_single_and_phrase_fillers`) |
| All analyzers | n/a | `**/Migrations/*.cs` | EF-generated code, marked with `generated_code = true` |

### Validation

```bash
# Format check (used in CI)
dotnet format --verify-no-changes --no-restore

# Build with warnings as errors
dotnet build --no-restore -c Release -warnaserror

# Locked restore
dotnet restore --locked-mode
```

**Status**: ✅ All checks pass in CI pipeline

---

## Task 2: Continuous Integration ✅ COMPLETED

**Purpose**: Automate building, testing, and validating every change before merge.

### Implementation

#### 1. CI Workflow (`.github/workflows/ci.yml`)

**Triggers**:
- Pull requests to any branch
- Pushes to `main`
- Automatic cancellation of superseded runs (via `concurrency`)

**Permissions**: Minimum privilege (`contents: read`)

**Job 1: `build-test`** (runs on `ubuntu-latest`, timeout 15 min)
1. **Checkout** — latest code from branch
2. **Setup .NET** — uses `backend/global.json` to install exact SDK version
3. **Restore (locked)** — `dotnet restore --locked-mode` ensures reproducibility
4. **Format Check** — `dotnet format --verify-no-changes` enforces code style
5. **Build** — `dotnet build --no-restore -c Release -warnaserror` with warnings as errors
6. **Test** — `dotnet test --no-build -c Release --collect:"XPlat Code Coverage"`
   - Collects code coverage
   - Outputs test results in TRX format
7. **Upload Test Results** — artifacts retained for 14 days
8. **Vulnerable Package Check**
   ```bash
   dotnet list package --vulnerable --include-transitive
   ```
   - Fails if any vulnerable packages are found
   - Blocks merge to prevent deploying known vulnerabilities

**Job 2: `docker`** (runs on `ubuntu-latest`, timeout 15 min)
- Builds the API Docker image without pushing
- Validates that the Dockerfile is correct before PR is merged
- Uses GitHub Actions cache for faster builds

#### 2. Action Pinning
All third-party actions pinned to full commit SHAs (not tags):
```yaml
- uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
- uses: actions/setup-dotnet@0f4a354dd5547a28c70b7853dbd95d5b67886e73 # v6.1.0
```
**Why**: Tags can be moved to malicious code. Pinning to SHAs prevents supply chain attacks.

#### 3. Branch Protection on `main`

**Rules configured**:
- ✅ Require pull request for merges (dismisses stale reviews after new commits)
- ✅ Require status checks: `build-test` and `docker` must pass
- ✅ Require branches to be up to date before merging
- ✅ Block force pushes
- ✅ Enforce linear history (clean git log)

**Result**: Direct pushes to `main` are rejected; all changes go through PR review + CI validation.

#### 4. CI Validation (PR #6)

Demonstrated that CI successfully blocks broken code:
- **Deliberately failing test**: `Assert.True(false)`
- **Formatting error**: Intentional bad indentation
- **Result**: CI blocks merge until code is fixed ✅

### Pipeline Flow

```
PR opened or push to main
        ↓
GitHub Actions triggers workflows
        ↓
┌─────────────────┬───────────────┐
│   build-test    │    docker     │
├─────────────────┼───────────────┤
│ 1. Checkout     │ 1. Checkout   │
│ 2. Setup .NET   │ 2. Setup Docker
│ 3. Restore      │ 3. Build image│
│ 4. Format       │               │
│ 5. Build        │               │
│ 6. Test         │               │
│ 7. Vulnerable?  │               │
└─────────────────┴───────────────┘
        ↓
   Both pass?
        ↓
  ✅ Merge allowed  OR  ❌ Blocked
```

### Validation

```bash
# Check branch protection
gh api repos/maksimsracins/govori/branches/main/protection

# View CI results
gh run list --branch main
gh run view <run-id>
```

**Status**: ✅ CI runs successfully on all PRs and pushes to main

---

## How to Continue

### Local Development

1. **Clone and set up**:
   ```bash
   git clone https://github.com/maksimsracins/govori.git
   cd govori
   dotnet tool restore
   ```

2. **Build and test locally**:
   ```bash
   cd backend
   dotnet build --no-restore -warnaserror
   dotnet format --verify-no-changes
   dotnet test
   ```

3. **Create a feature branch**:
   ```bash
   git checkout -b feature/my-feature
   ```

4. **Before pushing**:
   ```bash
   dotnet format  # Auto-fix formatting
   dotnet build --no-restore -warnaserror
   dotnet test
   git push -u origin feature/my-feature
   ```

### Merge Workflow

1. **Open a PR** to `main`
2. **CI runs automatically** (format, build, tests, Docker build, vulnerable package check)
3. **Review the results**:
   - 🟢 All checks pass → Ready to merge
   - 🔴 Any check fails → Fix locally, push again
4. **Merge** via GitHub UI (requires PR approval from branch protection rules, if configured)

### Adding New Dependencies

1. **Update `backend/Directory.Packages.props`**:
   ```xml
   <PackageVersion Include="Some.Package" Version="1.0.0" />
   ```

2. **Reference in `.csproj`**:
   ```xml
   <PackageReference Include="Some.Package" />
   ```

3. **Restore and lock**:
   ```bash
   dotnet restore
   ```
   (Lock files are auto-generated)

4. **Commit lock files** to version control

---

## Remaining Tasks

- **Task 3**: Dependency updates (Dependabot automation)
- **Task 4**: Integration tests with Docker containers
- **Task 5**: Code coverage tracking and reporting
- **Task 6**: Security scanning and secrets detection

---

## Key Files

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | CI pipeline definition |
| `backend/global.json` | .NET SDK version pinning |
| `backend/Directory.Build.props` | Shared build settings (nullable, analyzers, etc.) |
| `backend/Directory.Packages.props` | Central package version management |
| `backend/.editorconfig` | Code style and formatting rules |
| `backend/**/packages.lock.json` | Locked dependency graphs |

---

## References

- [.NET Code Analyzers](https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/overview)
- [EditorConfig Documentation](https://editorconfig.org/)
- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)
- [GitHub Actions Security Best Practices](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
