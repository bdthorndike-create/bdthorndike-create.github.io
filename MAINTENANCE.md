# HeatCostCalc maintenance runbook

Site: https://bdthorndike-create.github.io (GitHub Pages, repo `bdthorndike-create/bdthorndike-create.github.io`)
Generator: `build.mjs` (Node, no dependencies). Output goes to `dist/`, which is copied to the repo root.

## Rebuild and publish
1. `SITE_URL=https://bdthorndike-create.github.io node build.mjs`
2. Copy everything in `dist/` over the repo root (keep `google8d15034ae41a2d04.html`, which verifies Search Console).
3. Commit and push to `main`. Pages redeploys in 1-2 minutes.

## Refresh data (about monthly in winter)
| What | Where in build.mjs | Source |
|---|---|---|
| Heating oil, propane, natural gas, electricity defaults | `SYSTEMS` prices; natural gas is $/therm = $/Mcf ÷ 10.36 | EIA Winter Fuels Outlook (STEO), published each October |
| State electricity rates | `ELEC` object, cents/kWh | EIA Electric Power Monthly, Table 5.6.A |
| Kerosene, pellets, cordwood | `SYSTEMS` prices | Rough estimates; replace with a sourced figure if one is found |
| "Prices last reviewed" date | About page text | Update whenever prices change |

After changing numbers, also re-check the worked examples in the guides (they are computed in code, but the text about oil at $5.26 and break-evens is generated from `SYSTEMS`, so a rebuild updates them).

## Quality checks before pushing
- Every internal link resolves; every page has one title, one h1, one canonical.
- All Amazon links contain `tag=earthazoid-20`.
- Hand-check one calculation: cost per MMBtu = price / (BTU per unit x efficiency / 1,000,000).

## Accounts (owner only)
- Google Search Console: sitemap at /sitemap.xml
- Amazon Associates: tag `earthazoid-20`; the site must be listed under Manage Your Websites. Needs 3 qualifying sales in 180 days to keep a new account open.
- AdSense: apply once there is steady traffic; paste the script where `build.mjs` has the `ADSENSE` comment.
