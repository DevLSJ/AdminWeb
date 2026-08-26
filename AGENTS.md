# Repository Working Instructions

## CI/CD Performance Guardrails

For every task, first identify whether it changes any of these areas:

- `frontend/**`, `backend/**`
- `frontend/Dockerfile`, `backend/Dockerfile`, or `.dockerignore`
- `.github/workflows/**`
- `docker-compose.yml` or server deployment scripts

If it does, keep the build and deployment path as small as possible.

- Do not include `node_modules`, `dist`, `.git`, local logs, or other generated
  files in Docker build contexts. Maintain `.dockerignore` files accordingly.
- Preserve dependency-cache-friendly Dockerfile layer order: copy lockfiles and
  dependency manifests before application source, then install dependencies.
- Do not make an unrelated frontend change require a backend image build, or the
  reverse. Prefer path-based job selection when changing CI workflows.
- Deploy and pull only the services affected by the change; avoid pulling the
  database image for ordinary frontend or backend releases.
- Keep Docker Buildx remote caching enabled for image builds. Use separate cache
  scopes for backend and frontend when configuring or changing those caches.
- Avoid per-deploy image pruning unless disk pressure requires it; use scheduled
  cleanup instead.
- Prevent obsolete workflow runs from reaching deployment by using an
  appropriate GitHub Actions concurrency policy.

Before committing CI/CD or container changes, run the relevant build or
validation command and report any trade-offs that affect deployment speed,
availability, or rollback behavior.

## Commit Messages

- Use conventional commit types such as `feat`, `fix`, `docs`, `style`,
  `refactor`, `test`, `chore`, `perf`, `build`, and `ci`.
- Keep the subject concise, imperative, and without a trailing period.
