# Skulder genoptræning

Installérbar web-app (PWA) til iPhone med genoptræningsprogrammet fra Coach Nicky.

- **I dag:** dagens øvelser, stræk først og styrke bagefter. Flueben pr. sæt og side (H/V).
- **Timere:** automatisk pause efter hvert sæt og holdetimer til stræk, med bip.
- **Påmindelser:** gentagende begivenheder med alarm i iPhone-kalenderen (.ics).
- **Overblik:** stribe, gennemførelse 7/28 dage, kalender og smerteforløb til opfølgning.
- **Program:** redigér dosering, dage og instruktioner. Tilføj Nickys videoer pr. øvelse.
- **Data:** alt gemmes lokalt på telefonen. Backup/gendannelse som JSON.

Videoer og billeder gemmes kun på telefonen (IndexedDB) og ligger bevidst ikke i repoet,
da GitHub Pages-sider er offentligt tilgængelige.

## Udvikling

```bash
npm install
npm run dev      # lokal udvikling
npm test         # unit tests
npm run build    # typecheck + produktionsbuild i dist/
```

## Deploy

GitHub Actions bygger, tester og deployer til GitHub Pages ved push til `main`.
Engangsopsætning: *Settings → Pages → Source: GitHub Actions*.

## Struktur

| Mappe | Indhold |
|---|---|
| `src/domain` | Typer, program, fremskridt, validering/migrering, kalendergenerering. Ren logik, fuldt testet. |
| `src/storage` | Persistens (localStorage for state, IndexedDB for medier). |
| `src/ui` | Visninger, timer og DOM-hjælpere. |
| `public` | Manifest, service worker (offline) og ikoner. |
