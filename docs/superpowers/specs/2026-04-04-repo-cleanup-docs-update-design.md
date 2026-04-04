# Repo Cleanup & Documentation Update

**Date**: 2026-04-04
**Status**: Approved

## Problem

The repo is both an open-source project and a showcase webapp. Internal development files (`docs/development/`, `docs/superpowers/`) are publicly visible and tracked in git. The `QUICK_START.md` is an obsolete bootstrapping guide. The `USER_GUIDE.md` references barcode scan behavior that was just changed.

## Solution

### 1. Add internal directories to .gitignore and remove from tracking

Add to `.gitignore`:
```
docs/development/
docs/superpowers/
```

Remove from git tracking (keep local files):
```bash
git rm --cached -r docs/development/ docs/superpowers/
```

This removes 21 tracked files from the public repo without deleting them locally.

### 2. Move QUICK_START.md to docs/private/

Move `docs/guides/QUICK_START.md` to `docs/private/QUICK_START.md` as historical reference. The file is an obsolete bootstrapping guide from the project's initial phase (references "current progress: 10%", week 1 tasks, etc.) and is superseded by the README.

### 3. Update USER_GUIDE.md

In the "Metodo 2: Scansione Barcode" section (lines 90-99):
- Remove point 6: "Se il barcode ha trovato note aggiuntive, la sezione 'Dettagli aggiuntivi' si aprirà automaticamente" — this behavior was removed in the collapsible UX fix
- Add a note about verifying quantity after barcode scan

### 4. README.md — no changes needed

The README describes features at a high level and does not mention accordion/collapsible details. No update required.

## Scope

- No code changes
- Only .gitignore, git tracking, and markdown documentation
- No changes to app behavior

## Files affected

- `.gitignore` — add 2 directory exclusions
- `docs/development/*` — remove from tracking (21 files)
- `docs/superpowers/*` — remove from tracking (2 files)
- `docs/guides/QUICK_START.md` — move to `docs/private/`
- `docs/guides/USER_GUIDE.md` — update barcode scan section
