# Documentation

This directory contains public project documentation.

## Structure

### `/guides/`
User-facing documentation and guides:
- **USER_GUIDE.md** - Complete user manual for readers on GitHub. The app carries the same guide at `/guida` (`src/pages/GuidePage.tsx`); both keep the same sections in the same order, checked by `src/pages/__tests__/userGuideParity.test.tsx`. The test compares section titles and FAQ questions, not the text: a change to one guide goes into the other by hand.
- **DEPLOY.md** - Deploying the PWA on Netlify and the database, Edge Functions, secrets and cron on Supabase
- **privacy.md** - «Come entro implementa il GDPR»: what the code stores, how data export and account deletion work, which third parties receive data. It is not the privacy policy: that one is hosted on LegalBlink and linked from the app footer
- **PHASE_6_LAUNCH_CHECKLIST.md** - Historical launch checklist from early 2026, not kept up to date

## Contributing

When adding new documentation:
- **User guides** → `/guides/`
- **Contributor setup** → root-level docs such as `CONTRIBUTING.md`
- **Internal/sensitive docs** → keep them out of the public repository

Keep documentation up-to-date as features and implementations evolve.
