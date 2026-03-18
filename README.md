# roqson_core

Roqson custom app for ERPNext / Frappe.

This repo is now the main source of truth for the app’s custom logic, frontend behavior, fixtures, and local development workflow.

## Recommended Workflow

Use this order:

1. make changes locally
2. run `roqson refresh`
3. refresh localhost
4. verify the change
5. commit and push
6. validate in staging
7. move to production only after approval

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

## What `roqson refresh` Does

It runs the local update steps needed to make changes reflect reliably:

- rebuild app assets
- sync workspace / fixture changes
- clear cache

Use it as the default command during development and workshops.

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
9. verify the local site runs
10. install the `roqson` helper command from this repo

Rules:
- prefer safe, non-destructive commands
- explain any blocker clearly before changing course
- if database port conflicts exist, resolve them pragmatically
- assume this machine is for development only
```

## Notes

- The app is now suitable for normal local-first development.
- Fresh install and migrate have been proven locally.
- The repo is the source of truth for the main runtime layer.
- Some work still continues around QA, visual polish, and seed/reference data completeness.
