# Documentation

This directory contains public project documentation.

## Structure

### `/guides/`
User-facing documentation and guides:
- **USER_GUIDE.md** - Complete user manual for readers on GitHub. The app carries the same guide at `/guida` (`src/pages/GuidePage.tsx`); both keep the same sections in the same order, checked by `src/pages/__tests__/userGuideParity.test.tsx`. The test compares section titles and FAQ questions, not the text: a change to one guide goes into the other by hand.
- **privacy.md** - Privacy policy and data handling
- **PHASE_6_LAUNCH_CHECKLIST.md** - Launch preparation checklist

## Contributing

When adding new documentation:
- **User guides** → `/guides/`
- **Contributor setup** → root-level docs such as `CONTRIBUTING.md`
- **Internal/sensitive docs** → keep them out of the public repository

Keep documentation up-to-date as features and implementations evolve.
