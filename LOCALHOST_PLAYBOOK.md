# LOCALHOST PLAYBOOK FOR AGENTIC LLMS

This file is written for an agentic LLM that is helping a user set up `roqson_core` for local development on a Frappe/ERPNext bench.

The purpose is:

- help the LLM decide what it can do itself
- make clear what the user must do manually
- reduce back-and-forth
- create a fast localhost workflow so the user no longer needs to push to GitHub and wait for Frappe Cloud deploys just to test CSS or Python changes

This file is not a general Frappe tutorial. It is a practical execution guide for this repo and this project.

## Primary Objective

Set up a local Frappe v15 + ERPNext environment where `roqson_core` can run on localhost for fast iteration.

Target result:

- local bench exists
- local site exists
- `erpnext` is installed
- `roqson_core` is installed from this repo
- the agent can help the user iterate on CSS/Python locally

## Local Repo Path

Current expected local repo path:

```text
/Users/kodimagadia/Documents/ROQSON-Agentic-Dev/roqson_core
```

## Core Rule For The Agent

Default behavior:

- do as much as possible yourself
- only stop for the user when you are blocked by a true external dependency, secret, password, OS privilege, downloaded backup file, or visual browser verification

Do not ask vague open-ended questions.

When you need user intervention, ask for one concrete thing only.

## What The Agent Can Usually Do

If shell access and normal local permissions are available, the agent can usually do all of these:

- inspect this repo
- audit the machine for required tooling
- check versions of Python, Node, Redis, MariaDB/MySQL, yarn/npm, and bench
- install bench if the environment already supports it
- create a new bench
- fetch Frappe and ERPNext
- install this app from the local repo path
- create a local site
- install apps on the site
- set developer mode
- run `bench start`
- inspect build output and logs
- troubleshoot import/module/version issues
- edit local files in this repo
- run local migrations

## What The User Must Usually Do

The user is required for these categories unless the environment already supports unattended execution:

- OS-level package installs requiring admin privileges
- database root password entry
- site admin password choice if interactive
- obtaining a staging/production backup from Frappe Cloud
- telling the agent where backup files are stored
- browser login and visual verification
- any decision involving secrets or external credentials

## What The Agent Must Not Assume

Do not assume:

- Bench is already installed
- MariaDB is installed and running
- Redis is installed and running
- Node/Yarn versions are correct
- the user has a local Frappe bench already
- the local site has the same data as staging
- DB-resident Client Scripts and Server Scripts are already mirrored locally

## Project-Specific Reality

This project is not purely app-code driven.

Important behavior also exists in:

- Client Scripts stored in the site database
- Server Scripts stored in the site database
- custom fields
- workflow records
- site data

Therefore localhost can be useful immediately for:

- app CSS
- Python modules
- hook changes
- fixtures

But localhost will not perfectly match staging unless site state is also restored or mirrored.

Important:

- the repo does not guarantee full business master data or exact staging records
- a fresh install may still be missing the real `Company` record and other site data
- if the user expects the exact existing ROQSON company and realistic business state, a staging backup restore is required
- the agent must not silently create substitute Company/master-data records and present them as equivalent to the existing site

## Recommended Execution Order For The Agent

Follow this exact order.

### Phase 1: Audit The Machine

The agent should first check:

- `python3 --version`
- `node --version`
- `npm --version`
- `yarn --version`
- `redis-server --version`
- `mysql --version` or `mariadb --version`
- `bench --version`

Also inspect whether Homebrew or other package managers are available if needed.

### Phase 2: Decide The Setup Path

The agent should choose one of two paths:

- Path A: fresh local site
- Path B: local site restored from staging backup

Use this rule:

- If the user only needs fast CSS/Python iteration, Path A is acceptable.
- If the user needs realistic DocType behavior/data/workflows, prefer Path B.
- If the user expects the exact existing ROQSON company or production-like master data, Path B is required.

### Phase 3: Build The Bench

For Frappe v15 / ERPNext v15, the local bench should use matching major versions.

Typical flow:

```bash
mkdir -p ~/frappe-dev
cd ~/frappe-dev
bench init frappe-bench --frappe-branch version-15
cd frappe-bench
bench get-app erpnext --branch version-15
bench get-app roqson_core file:///Users/kodimagadia/Documents/ROQSON-Agentic-Dev/roqson_core
```

### Phase 4: Create The Local Site

Typical flow:

```bash
bench new-site roqson.local
bench --site roqson.local install-app erpnext
bench --site roqson.local install-app roqson_core
bench --site roqson.local set-config developer_mode 1
bench --site roqson.local set-config local_dev_auto_login 1
bench --site roqson.local set-config local_dev_landing_page /app/home
```

Important constraints for Path A:

- Path A is a clean local bootstrap, not a staging clone
- if ERPNext setup wizard appears because no Company exists, that does not mean the repo is broken
- it means site data is missing from the blank install
- the agent must explain this clearly
- the agent must not invent a new ROQSON company unless the user explicitly agrees to a temporary placeholder bootstrap

### Phase 5: Run Localhost

Typical flow:

```bash
bench start
```

Then the user should open localhost in a browser.

### Phase 6: Optional Backup Restore

If realistic local data is required, restore a site backup after or during site creation.

Typical flow:

```bash
bench new-site roqson.local
bench --site roqson.local restore /absolute/path/to/database.sql.gz
bench --site roqson.local install-app erpnext
bench --site roqson.local install-app roqson_core
bench --site roqson.local migrate
bench start
```

The exact restore details depend on what Frappe Cloud backup files the user has.

## Required User Checkpoints

These are the moments where the agent should stop and explicitly ask for user input.

### Checkpoint 1: Missing System Dependencies

Stop and ask the user only if:

- MariaDB is not installed
- Redis is not installed
- Node/Yarn is not installed
- bench is not installed
- OS-level permissions are required to continue

Ask like this:

```text
I’m blocked by missing system dependencies: [list]. I can continue as soon as these are installed, or if you want, I can give you the exact install commands for your machine.
```

### Checkpoint 2: Interactive Passwords

Stop and ask the user only if:

- `bench new-site` requires DB root credentials
- site admin password needs to be chosen interactively

Ask like this:

```text
The next step needs a database/root or site password entered interactively. Please complete that prompt, then tell me when it’s done.
```

### Checkpoint 3: Backup Files

Stop and ask the user only if Path B is chosen and backup files are not already available locally.

Ask like this:

```text
To make localhost match staging more closely, I need the staging backup files. Tell me the local file paths once you’ve downloaded them from Frappe Cloud.
```

### Checkpoint 4: Browser Verification

Stop and ask the user only when the local site is running and visual confirmation is required.

Ask like this:

```text
The local site is up. Please open it in the browser and tell me whether [specific page or behavior] looks correct.
```

## What The Agent Should Prefer For This Repo

For `roqson_core`, the agent should recommend this workflow:

1. Use localhost for app CSS and Python work.
2. Use `roqson.py` when remote Client Scripts / Server Scripts must still be inspected or updated.
3. Avoid using Frappe Cloud deploys for fast UI iteration.
4. Use Frappe Cloud only after local validation.

## Localhost Benefits The Agent Should Explain

The agent should clearly tell the user why localhost is better:

- CSS changes can be validated quickly
- Python changes can be tested faster
- there is no Git push/deploy wait loop
- browser refresh is much faster than Frappe Cloud deploys
- cache/build weirdness is easier to debug locally

## Localhost Limitations The Agent Should Explain

The agent should also clearly explain:

- localhost will not automatically include site-specific DB scripts
- fixtures alone may not fully recreate staging behavior
- backups are needed for realistic data/state
- backups are needed for the exact existing Company and business master data
- remote `roqson.py` workflows may still be necessary for DB-resident scripts

## Repo-Specific Notes

Relevant files in this repo include:

- [roqson_core/hooks.py](/Users/kodimagadia/Documents/ROQSON-Agentic-Dev/roqson_core/roqson_core/hooks.py)
- [roqson_core/public/css/roqson_core.css](/Users/kodimagadia/Documents/ROQSON-Agentic-Dev/roqson_core/roqson_core/public/css/roqson_core.css)
- [roqson.py](/Users/kodimagadia/Documents/ROQSON-Agentic-Dev/roqson_core/roqson.py)
- [pyproject.toml](/Users/kodimagadia/Documents/ROQSON-Agentic-Dev/roqson_core/pyproject.toml)
- [requirements.txt](/Users/kodimagadia/Documents/ROQSON-Agentic-Dev/roqson_core/requirements.txt)
- [setup.py](/Users/kodimagadia/Documents/ROQSON-Agentic-Dev/roqson_core/setup.py)

The app package is under:

```text
roqson_core/
```

The CSS entry point currently used by hooks is:

```text
/assets/roqson_core/css/roqson_core.css
```

## Prompts The User Can Give An Agentic LLM

These prompts are meant for tools like Gemini CLI, Claude Code, Codex CLI, Cursor agents, or similar shell-capable coding agents.

### Prompt: audit only

```text
Audit this machine for local Frappe v15 + ERPNext development for the repo at /Users/kodimagadia/Documents/ROQSON-Agentic-Dev/roqson_core. Check Python, Node, yarn/npm, MariaDB/MySQL, Redis, and bench. Do not install anything yet. Tell me exactly what is missing and which items require my manual intervention.
```

### Prompt: full localhost setup

```text
Set up a local Frappe v15 + ERPNext bench for the repo at /Users/kodimagadia/Documents/ROQSON-Agentic-Dev/roqson_core. Install roqson_core from the local path, create a local site, install erpnext and roqson_core, and get it running on localhost. Only stop when you need a password, OS-level install, backup file, or browser verification from me.
```

### Prompt: restore backup locally

```text
I want localhost to behave as closely as possible to staging. Help me restore a staging backup into a local Frappe bench site, then install erpnext and roqson_core and verify the site boots. Only ask me for the backup file paths, passwords, or browser verification.
```

### Prompt: localhost UI iteration

```text
Use my local Frappe bench to help me iterate on roqson_core/public/css/roqson_core.css and relevant Python files with fast localhost feedback. Prefer local changes over remote script updates whenever possible. Only ask me for browser verification when a human visual check is actually required.
```

## Agent Decision Rules

The agent should use these rules:

- If blocked by missing OS dependencies, stop and report the exact missing items.
- If bench exists already, reuse it instead of creating a new one unless there is a version mismatch.
- If ERPNext v15 is already present, do not reinstall it unnecessarily.
- If the user has no backup files, proceed with a fresh local site rather than blocking entirely.
- If local validation is sufficient for the user’s immediate task, do not force a backup restore.
- If the task concerns remote Client Scripts or Server Scripts, remind the user that localhost may not reflect DB-resident behavior unless those scripts are mirrored or migrated.
- If the user expects exact business data parity, do not claim a fresh site is equivalent to staging.
- If setup wizard persists because there is no Company on a blank site, explain that this is missing site data, not proof that the repo contains the exact Company record.
- Do not create a new Company or other business master data silently; ask the user whether they want a temporary bootstrap record or a proper backup restore.

## Failure Modes The Agent Should Be Ready For

### Bench install failures

Possible causes:

- missing Python/Node/system packages
- version mismatch
- dependency resolution issues

### Site creation failures

Possible causes:

- MariaDB not running
- wrong DB root credentials
- Redis not running

### App install failures

Possible causes:

- missing imports
- incompatible dependencies
- incorrect branch/version mix

### Local site looks incomplete

Possible cause:

- staging-only DB customizations are not restored locally

The agent should explain this clearly instead of pretending localhost fully matches staging.

## Expected End State

The agent’s work is successful when:

- a local bench exists
- a local site exists
- `erpnext` and `roqson_core` are installed
- localhost is reachable in the browser
- the user can edit local CSS/Python and refresh quickly

## References

These references support the commands and capabilities described here:

- [Gemini CLI GitHub](https://github.com/google-gemini/gemini-cli)
- [Gemini CLI tools](https://geminicli.com/docs/tools/)
- [Gemini CLI shell commands](https://geminicli.com/docs/cli/tutorials/shell-commands/)
- [Install and Setup Bench](https://docs.frappe.io/framework/v14/user/en/tutorial/install-and-setup-bench)
- [Bench Overview](https://docs.frappe.io/framework-copy/bench/overview)
- [Create a Site](https://docs.frappe.io/framework/v14/user/en/tutorial/create-a-site)
- [Bench Commands](https://docs.frappe.io/framework/v14/user/en/bench/bench-commands)
- [Debugging app installs locally](https://docs.frappe.io/cloud/common-issues/debugging-app-installs-locally)
