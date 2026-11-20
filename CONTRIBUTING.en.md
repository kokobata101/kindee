# Contributing to KinDee

Thanks for helping! Everything is welcome: typo fixes, food data, translations, bug fixes and new features.
(ไทย: [CONTRIBUTING.md](CONTRIBUTING.md))

KinDee is licensed **GPL-3.0-or-later**. By submitting a contribution you agree it is released under the same license.
Please also read the [Code of Conduct](CODE_OF_CONDUCT.md).

## Where to start

| I want to help with | Do this |
|---|---|
| **Food data** | Edit `src/data/foods.ts` ([how](#adding-or-fixing-foods)) |
| **Verifying food values against the official Thai table** | See [docs/food-verification.md](docs/food-verification.md) (Thai; a worksheet and a compare script are provided) |
| **Translations** | See [docs/TRANSLATING.md](docs/TRANSLATING.md) |
| **Bugs / features** | See [workflow](#workflow) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| **Testing on a real phone** | Especially barcode scanning with a real camera and the real Open Food Facts API (never tested yet). Open an issue with your results |

## Setup

Requires Node.js 20+.

```bash
npm install
npm run dev          # dev server
npm run typecheck    # strict TypeScript (unused variables/parameters are errors)
npm test             # unit + database tests (vitest)
```

Browser tests (e2e) use Playwright, which is intentionally not in `dependencies`:

```bash
npm install --no-save playwright && npx playwright install chromium
npm run build && npx vite preview --port 4173 &
node e2e/run.mjs food               # one scenario at a time (see e2e/scenarios/)
for s in onboarding food schedule track insights profile share offline scan quick combo english; do node e2e/run.mjs $s; done
```

> Running `node e2e/run.mjs` with no scenario does nothing. The `scan` scenario needs a fake camera video first:
> `node e2e/make-barcode-video.mjs 885100112233 e2e/fixtures/barcode.y4m`

## Workflow

1. Open an issue first for big features or visible behavior/design changes (small fixes can go straight to a PR).
2. Branch from `main` with a descriptive name, e.g. `fix/water-goal-rounding`.
3. Write the code **and tests**.
4. Before opening a PR: `npm run typecheck`, `npm test`, and the relevant e2e scenarios must pass.
5. In the PR, explain *why*, not just *what*. Add screenshots for UI changes.

## Project standards

- **Every user-visible string goes through `t('…')`** and gets an English entry in `src/i18n/en.ts` (a test fails if you forget). Thai is the source language and is used directly as the key.
- **Calculation logic lives in `src/lib/` as pure functions**, separate from React, so it is easy to test. Health formulas need tests and a citable source. No magic numbers.
- **Database writes go through `src/db/repo.ts` only**; multi-table writes must be in a transaction.
- **Changing the data shape means bumping the Dexie version** (`src/db/db.ts`), updating `src/db/backup.ts` so old backups still restore, and adding an upgrade test.
- **User data never leaves the device.** No analytics, no tracking. The only network call is Open Food Facts (barcode number only, when the user scans). New network calls need an issue discussion first and must be disclosed on the About screen.
- **No paywalls, no locked features.**
- **Be honest in docs and UI**: anything claimed to work must be covered by a test; say plainly what hasn't been tested.
- **Don't copy copyrighted data** (e.g. food tables that forbid redistribution) into the repo without permission.

### Adding or fixing foods

Each row in `src/data/foods.ts`:

```
[id, thaiName, englishName, emoji, serving, grams, kcal, protein, carb, fat, category]
['b010', 'ข้าวมันไก่', 'chicken rice', '🍗', '1 จาน', 350, 585, 26, 70, 22, 'dish']
```

- All values are **per 1 serving**. Use the next free id in the category and never change an existing id (users' diaries reference them).
- `kcal` must be close to 4×protein + 4×carb + 9×fat (a test checks this).
- Servings look like `<number> <unit>` (e.g. `1 จาน`). A new unit needs an English translation in `src/i18n/en.ts` as `"singular|plural"` (e.g. `"plate|plates"`).
- **Cite your source in the PR** (food table, product label, or how you calculated it).

### New UI text

```tsx
<Button>{t('บันทึก')}</Button>
toast(t('เพิ่ม {n} รายการแล้ว', { n }))
```

then add to `src/i18n/en.ts`: `"เพิ่ม {n} รายการแล้ว": "Added {n} {n?item:items}"` and run `node scripts/i18n-check.mjs`.
See [docs/TRANSLATING.md](docs/TRANSLATING.md).

## Reporting issues

Use the issue templates. For a wrong food value, include the food, serving, the correct value and a reference.
For security/privacy problems (e.g. data leaving the device), don't post details publicly; contact the maintainers directly first.
