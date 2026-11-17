# Task 2: Continuous integration

## Theory

**Continuous integration (CI)** means every change is built and tested automatically, on a clean machine, before it is merged. "Works on my machine" stops being an argument: the pipeline is the referee.

### Vocabulary

- **Workflow**: a YAML file in `.github/workflows/` describing jobs that run on events (`pull_request`, `push`, `schedule`).
- **Job / step / runner**: jobs run on runners (fresh VMs). Steps are commands or reusable **actions**.
- **Required status check**: a branch protection rule that blocks merging until named jobs are green.
- **Branch protection / rulesets**: rules on `main`, such as no direct pushes, PR required, checks required, linear history, and no force push.
- **Artifacts**: files a job keeps, such as test results, coverage reports or an SBOM.
- **Caching**: reusing the NuGet package cache between runs (`actions/setup-dotnet` with `cache: true`, which needs lock files from Task 1).

### Pipeline security (CI is an attack surface)

- Set `permissions:` to the minimum at the top of every workflow (`contents: read`) and grant more per job only when needed. The default token can be too powerful.
- **Pin third-party actions to a full commit SHA**, not a tag. Tags can be moved to malicious code. Dependabot (Task 3) keeps the SHAs updated.
- Never run untrusted PR code with secrets. Use `pull_request`, not `pull_request_target`, for builds.
- Secrets live in GitHub **Environments** or repository secrets, never in YAML.
- Add a `timeout-minutes` so a hung job doesn't burn minutes.

### What a good .NET CI job checks, in order (fast to slow)

1. Restore with locked mode.
2. Format check.
3. Build with warnings as errors.
4. Unit tests, then integration tests (Task 4) with coverage.
5. Vulnerable package check: `dotnet list package --vulnerable --include-transitive` fails if there are findings.
6. Docker image build, so a broken Dockerfile fails the PR rather than the deploy.

## How the repo does it today

- There is no `.github` folder. Nothing runs automatically, and `main` is unprotected.

## Exercise

1. Create `.github/workflows/ci.yml` triggered on `pull_request` and `push` to `main`, with `permissions: contents: read`.
2. Job `build-test`: checkout → `setup-dotnet` using `global.json` → restore (locked) → format check → build → test with `--collect:"XPlat Code Coverage"` → upload test results.
3. Add a step that fails when vulnerable packages are reported. Hint: grep the command output for `has the following vulnerable packages`.
4. Job `docker`: build all three images without pushing (`docker/build-push-action` with `push: false`).
5. Pin every action by SHA, with the version as a trailing comment.
6. In GitHub settings, protect `main`: require a PR, require `build-test` and `docker`, block force pushes, and require branches to be up to date.
7. Open a PR containing a deliberate formatting error and a failing test. Watch both get blocked.

## Done when

- [ ] Every PR shows a green or red CI result within about 10 minutes.
- [ ] Direct pushes to `main` are rejected.
- [ ] Workflows have least-privilege `permissions` and SHA-pinned actions.
- [ ] A broken Dockerfile, a format error, a warning and a failing test each block a merge (demonstrated once).

## Notes

- The repo has one Dockerfile (`backend/Dockerfile`, the API), so the `docker` job builds one image, not three.
- The E2E tests run in `build-test`: they start Postgres with `docker run`, which works on `ubuntu-latest`.
- Actions are pinned to the commit SHA of their latest release, with the tag as a trailing comment.
- `concurrency` cancels superseded runs on the same branch to save minutes.
