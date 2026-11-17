# 🎅 Secret Santa Generator

A one-page Secret Santa name draw. Open `index.html` in any browser, no install needed.

## Features
- Add people (one per line, optional wishlist after a dash: `Linh - books, green tea`)
- Random draw: nobody draws themselves, and everyone forms one gift loop
- Reveal by **passing the phone** or by sending each person a **private code**
- Anyone with a code can open this page, tap **I have a code** and see only their own match
- Editable event details (date, time, place, budget, note)

## Organizer controls
Tap the ornament next to the title 3 times quickly (or press **Shift+O**) to open the hidden organizer panel:
forced pairs, exclusions, the full results list, and an optional passcode.

## Two modes
| Where it runs | Mode |
|---|---|
| GitHub Pages / local file | **Offline:** names, rules and results are saved only in the organizer's browser; friends use private codes |
| claude.ai artifact | **Shared live:** friends sign in, join, write their own wishlist and see only their own match |

## Publish with GitHub Pages
Settings → Pages → Deploy from branch → `main` / root. Your page will be at
`https://<username>.github.io/<repo>/`. Paste that link into the organizer panel so it's added to every code message.

> Codes are scrambled, not encrypted. Fine for a friendly gift exchange; don't use them for real secrets.
