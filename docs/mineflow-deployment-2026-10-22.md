# MineFlow portfolio release

- Portfolio entry: https://sunset377.github.io/AI-/
- Interactive demo: https://sunset377.github.io/AI-/mineflow/
- Source release: MineFlow commit `1a3bb5a898a641ead4a1698c7112e3fe135e0fe2` (separate local source repository).
- Build: run `npm run build -- --base=/AI-/mineflow/ --outDir <portfolio>/public/mineflow` in the MineFlow `web` directory, then build this portfolio with `--base=/AI-/`.
- `public/mineflow` contains only the compiled browser app, synthetic research output and third-party notices. The project thumbnail is an actual screenshot of this app.
- Existing portfolio content and assets were retained; unfinished work in the original local checkout was excluded.

Local validation before release: 76 MineFlow unit tests, 5 local-server tests, 10 desktop/mobile browser workflow tests; 12 portfolio deployment/entry tests and 31 existing interview/storyboard tests passed. Desktop 1440px and mobile 390px entry buttons, popup, project card and resource loading also passed. No paid provider calls were made.

This is a job-portfolio simulation, not an official company system. Each visitor has independent localStorage data; there is no server-side account system, cross-device dispatch, driver app, live GPS or weighbridge. Do not enter real driver or mine data. GitHub Pages serves this static client over HTTPS; local-server and Netlify response-header settings do not apply here.

Rollback: revert this release commit on main and allow the existing Pages workflow to publish again. This removes only the MineFlow addition.
