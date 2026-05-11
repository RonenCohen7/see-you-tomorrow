# Contributing and GitHub backup

## Creating the GitHub repository (first time)

1. Sign in to GitHub as [RonenCohen7](https://github.com/RonenCohen7/).
2. Create a **new** repository: [github.com/new](https://github.com/new).
   - **Owner:** RonenCohen7  
   - **Repository name:** `see-you-tomorrow` (recommended; no spaces)  
   - **Visibility:** Private (recommended for internal / pre-production code)  
   - Do **not** initialize with README, .gitignore, or license (this repo already has them).
3. On your machine, from the project root:

   ```bash
   git init
   git add -A
   git status   # confirm .env is NOT listed
   git commit -m "chore: initial import See You Tomorrow monorepo"
   git branch -M main
   git remote add origin git@github.com:RonenCohen7/see-you-tomorrow.git
   # or HTTPS:
   # git remote add origin https://github.com/RonenCohen7/see-you-tomorrow.git
   git push -u origin main
   ```

If `git remote add` fails because `origin` already exists, use `git remote set-url origin <url>` instead.

## Updating the backup after changes

GitHub stores **source code** and **history**, not your live MongoDB data.

1. Review changes: `git diff` and `git status`.
2. Commit with a **clear message** (this is the primary “what changed” explanation):

   - Prefer a short subject line, optional body for details.  
   - Examples:  
     - `feat(calendar): show parking allocations on day view`  
     - `fix(auth): refresh token expiry handling`  
     - `docs: update seed instructions in README`

   You may write the subject in **Hebrew or English**; stay consistent within a team.

3. Push: `git push`.

4. For larger or release-worthy updates, add a bullet under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md), then commit with e.g. `docs: changelog entry for parking calendar`.

## Commit message convention (suggested)

| Prefix   | Use for |
|----------|---------|
| `feat`   | New user-visible behavior |
| `fix`    | Bug fixes |
| `docs`   | README, comments, changelog only |
| `chore`  | Tooling, deps, formatting, no behavior change |
| `refactor` | Internal code change, same behavior |

Scope in parentheses is optional: `feat(location): parking reservations API`.

## Security

Never commit `.env`, API keys, or production secrets. The root `.gitignore` excludes `.env`; if you add new secret files, ignore them before committing.
