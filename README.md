# roqson_core

Roqson custom app for ERPNext / Frappe.

This repo is now the main source of truth for the app’s custom logic, frontend behavior, fixtures, and local development workflow.

## Recommended Workflow

Use this order:

1. make changes locally
2. run the right refresh command
3. refresh localhost
4. verify the change
5. commit and push
6. validate in staging
7. move to production only after approval

## Which Command To Use

| If you changed... | Use this command | Why |
|---|---|---|
| Python, JS, CSS, or repo-owned JSON files | `roqson refresh` | Rebuilds/syncs local app state from the repo |
| GUI metadata like adding fields or changing field/form settings in Frappe | `roqson refresh gui` | Exports eligible GUI metadata into fixtures, syncs local, and clears cache |
| Only Python/server-side behavior and no assets | `roqson refresh python` | Fast cache clear for Python-focused work |
| Only JS/CSS/assets | `roqson refresh assets` | Rebuilds frontend assets and clears cache |
| Workspace or fixture sync only | `roqson refresh workspace` | Replays repo-owned local setup without asset build |

Simple rule:

- `roqson refresh` for file/code changes
- `roqson refresh gui` for GUI changes

## Local Development Setup

These instructions are for a manual setup on a new machine.

### 1. Install Dependencies

Required tools:

- Git
- GitHub Desktop
- Node.js
- Yarn
- Python 3.11
- `pipx`
- `uv`
- MariaDB
- Redis
- Frappe Bench

On macOS with Homebrew, the main installs are:

```bash
brew install git node yarn python@3.11 mariadb redis pipx
python3.11 -m pip install --user uv
pipx ensurepath
```

If `bench` is not installed yet:

```bash
pipx install frappe-bench
```

### 2. Prepare Bench

Create a Frappe v15 bench:

```bash
mkdir -p ~/frappe-dev
cd ~/frappe-dev
bench init --frappe-branch version-15 frappe-bench
cd frappe-bench
```

Get ERPNext:

```bash
bench get-app --branch version-15 erpnext
```

### 3. Link This Repo Into Bench

Inside the bench:

```bash
cd ~/frappe-dev/frappe-bench/apps
ln -s /absolute/path/to/roqson_core roqson_core
```

Replace `/absolute/path/to/roqson_core` with the real path to your cloned repo.

### 4. Start Local Services

Start MariaDB and Redis if they are not already running.

Example on macOS:

```bash
brew services start mariadb
brew services start redis
```

Important:

- if port `3306` is already taken by another MySQL install, use a clean MariaDB instance on another port such as `3307`
- make sure you know the MariaDB root password you want to use for the local site

### 5. Create A Local Site

Inside the bench:

```bash
cd ~/frappe-dev/frappe-bench
bench new-site roqson.local --install-app erpnext
bench --site roqson.local install-app roqson_core
```

If your MariaDB is not on the default port, use:

```bash
bench new-site roqson.local --db-host 127.0.0.1 --db-port 3307 --db-root-password YOUR_ROOT_PASSWORD --install-app erpnext
```

Then:

```bash
bench --site roqson.local install-app roqson_core
```

### 6. Enable Local Dev Convenience

```bash
bench --site roqson.local set-config developer_mode 1
bench --site roqson.local set-config local_dev_auto_login 1
bench --site roqson.local set-config local_dev_landing_page /app/home
```

### 7. Run The Local App

Start the bench:

```bash
cd ~/frappe-dev/frappe-bench
bench start
```

Open:

[http://127.0.0.1:8000/app/home](http://127.0.0.1:8000/app/home)

## Install The `roqson` Command

After cloning the repo, install the shorthand command:

```bash
./scripts/install-roqson-command.sh
```

Then restart Terminal if needed and use:

```bash
roqson refresh
```

## Daily Development Flow

1. pull latest changes in GitHub Desktop
2. make or switch to your branch
3. edit files in the repo
4. save the file
5. run:

```bash
roqson refresh
```

6. refresh localhost
7. if correct, commit and push

If you changed metadata through the GUI instead of editing repo files, run:

```bash
roqson refresh gui
```

Then review the fixture changes in git, refresh localhost, and commit if correct.

## What `roqson refresh` Does

It runs the local update steps needed to make changes reflect reliably:

- rebuild app assets
- sync workspace / fixture changes
- clear cache

Use it as the default command during development and workshops.

## What `roqson refresh gui` Does

It is the GUI-safe companion command for metadata changes made inside Frappe.

It will:

- export eligible GUI changes into the app's fixture files
- sync repo-owned local metadata
- clear cache

Use it after changes like:

- adding a custom field
- changing field label / required / hidden / read-only settings
- changing form metadata through Customize Form

Important:

- GUI changes are only portable through git if they are exported into fixture files
- `roqson refresh gui` helps make those changes visible to git
- after running it, always check `git diff` to confirm the expected fixture files changed
- some uncommon GUI changes may still be stored in metadata types outside the current fixture config, so `git diff` remains the safety check

## If You Want To Use An AI Assistant To Set It Up

Use this prompt:

```text
Set up this repo as a local Frappe / ERPNext development environment for roqson_core.

Context:
- Repo path: /absolute/path/to/roqson_core
- Goal: create a working local ERPNext + roqson_core setup for development
- Target: Frappe v15 / ERPNext v15
- Preferred local site name: roqson.local
- If MariaDB port 3306 is occupied, use 3307 instead
- Enable developer mode and local auto-login for localhost
- The repo path may differ on this machine, so detect it from the current workspace or ask only if truly necessary
- Do not assume the repo contains full business seed data such as the exact production Company record

What I need you to do:
1. check for missing dependencies
2. install required dependencies if missing
3. create a Frappe bench
4. install ERPNext
5. link/install roqson_core from the local repo path
6. create the local site
7. install roqson_core
8. configure:
   - developer_mode = 1
   - local_dev_auto_login = 1
   - local_dev_landing_page = /app/home
9. confirm the app hooks are present and active:
   - roqson_core.local_auth.auto_login_administrator in before_request
   - roqson_core.local_auth.redirect_local_dev_to_app in after_request
10. verify the local site runs
11. tell me the exact localhost URL to open first
12. install the `roqson` helper command from this repo
13. if setup wizard or onboarding appears because core site data is missing, do not invent or silently create substitute business records and call it parity; instead:
   - explain exactly what data is missing
   - tell me whether the repo actually contains that data
   - prefer restoring the existing site backup if I want the exact ROQSON company and realistic data
   - only create placeholder bootstrap records if I explicitly approve that tradeoff

Important implementation detail:
- In this repo, local auto-login only triggers on local requests that are not under /app
- So the first URL to open should usually be http://127.0.0.1:8000/ or http://127.0.0.1:8000/login
- That first request should establish the Administrator session and then redirect to /app/home
- A fresh install can be useful for code iteration, but it is not proof that the repo contains the exact staging/master data

Rules:
- prefer safe, non-destructive commands
- explain any blocker clearly before changing course
- if database port conflicts exist, resolve them pragmatically
- assume this machine is for development only
- do not assume a hardcoded filesystem path
- do not create a new Company, Chart of Accounts, or other business master data as a silent substitute for the existing ROQSON setup
```

## Notes

- The app is now suitable for normal local-first development.
- Fresh install and migrate have been proven locally.
- The repo is the source of truth for the main runtime layer.
- Some work still continues around QA, visual polish, and seed/reference data completeness.
