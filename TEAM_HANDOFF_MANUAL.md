# ERPNext Custom App Working Manual

## Summary

We moved the Roqson customizations out of a fragile “live-site-only” setup and into a real custom app.

This changes how we work:

- we now develop mainly in code, not inside the live site
- we test locally first
- we push to staging only after local validation
- the app is now much more reproducible and easier to maintain

## What We Did

We set up a local ERPNext/Frappe development environment and connected it to the `roqson_core` custom app.

We then moved the main custom behavior into the app itself:

- backend logic
- frontend behavior for major screens
- workspaces
- roles and role profiles
- fixtures needed for setup

We also proved that a fresh site can now install the app and complete migration successfully.

## What Changed In Practice

Before:

- many changes lived only in the site database
- local setup was hard to trust
- testing often depended on staging

Now:

- most important logic lives in the GitHub repo
- local development is usable
- staging is no longer the first place to test
- changes are easier to track, review, and roll back

## New Working Model

Use this order:

1. Make changes locally
2. Test locally
3. Push code to GitHub
4. Let the team review if needed
5. Move to staging
6. Move to production only after staging is approved

## What You Can Do Now

- work on the custom app in code
- change Python logic
- change frontend behavior
- change CSS and UI
- add or improve screens and flows
- test most changes locally before pushing

## What You Should Not Do

- do not treat staging as the main development environment
- do not rely on manual “quick fixes” inside the site unless absolutely necessary
- do not assume a site-only change is safe unless it is exported back into the app
- do not change production first

## What Is Already Solid

- local site is working
- admin auto-login is working for local development
- main custom screens are app-owned
- database Server Scripts are no longer required for normal runtime
- database Client Scripts are no longer required for normal runtime
- fresh install and migrate now work on a clean local site

## What Is Still Ongoing

- visual polish
- workflow-by-workflow QA
- seed/reference data checks on fresh sites
- final cleanup of any remaining rough edges

This means the platform is ready for normal development, but not “finished forever.”

## How To Set It Up For Yourself

### What You Need

- GitHub access to the repo
- GitHub Desktop
- the local development dependencies from the playbook
- the bench/environment folder prepared on your machine

If you are not setting up the full dev environment yourself, ask for a working local clone and the bench path.

### GitHub Desktop Setup

1. Clone the `roqson_core` repository
2. Open it in GitHub Desktop
3. Keep your branch up to date with the main branch
4. Create a branch for every task
5. Make your code changes in your editor
6. Commit in small, clear commits
7. Push your branch
8. Open a pull request if needed

## Local Setup Overview

At a high level:

1. Clone the repo
2. Make sure the local Frappe bench exists
3. Link/install `roqson_core` into the bench
4. Use the local site
5. Run the bench normally while developing

If your machine does not already have the bench set up, use the local setup playbook rather than improvising.

## Best Practices

- keep changes in the app, not only in the site
- test locally before pushing
- keep commits small
- avoid mixing UI polish and business logic in one commit
- document one-off setup decisions
- if a change affects workflows, test the actual workflow, not just the page load
- if you must change a live site record, make sure the repo remains the source of truth afterward

## GitHub Workflow

- one branch per task
- one purpose per pull request
- clear commit messages
- avoid large mixed changes unless necessary

Good examples:

- `fix receipt apply-to filtering`
- `refactor trips form handlers`
- `update order form table styling`

## Local Testing Expectations

Before pushing, do a quick check of the affected flow.

Examples:

- if you changed `Order Form`, create or edit an order locally
- if you changed `Receipt`, test the related customer flow
- if you changed `Trips`, test the trip form behavior
- if you changed CSS, test the affected screens on the local site

## What To Do If Something Looks Wrong

- first check whether it is a local cache issue
- then check whether the change was made in the app or only in site data
- then confirm the local bench is running the latest code
- then ask whether the issue is runtime logic, fixture/setup, or just UI

This matters because the fix path is different for each one.

## Simple Rule Of Thumb

If the change is supposed to last, it should live in the custom app.

## Team Takeaway

The migration is far enough along that the team can now work in a normal software workflow:

- local first
- code first
- GitHub first
- staging second
- production last

That is the main change.
