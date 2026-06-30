# Winning Ads Refresh Routine

Keeps `data/winning-ads.json` grounded in **real** Meta Ad Library data. Run weekly
(scheduled trigger) or manually. The app reads this file at startup; it never queries
Meta directly (a static keyless frontend cannot — an access token is an API key and
must never ship in the browser, and the Ad Library web UI requires a logged-in
session + blocks cross-origin fetches).

So the live data lives here: a server-side / agent-side routine refreshes the baked
JSON, and the app consumes it.

## Steps

For each sector key in `data/winning-ads.json`
(`fashion, fitness, beauty, tech, food, home, education, finance`):

1. Use the **/browse** skill (gstack) to open the Meta Ad Library:
   `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TR&media_type=all`
   Search representative brands / keywords for the sector (e.g. fashion → "moda",
   "giyim"; fitness → "fitness", "online koçluk"; etc.).
2. Identify ads that signal **winners**: long run time (still active after weeks/months),
   many variants of the same creative, high engagement. Long-running active ads are the
   strongest public proxy for "this is converting" — losers get paused fast.
3. For each winner extract: advertiser, the hook (first line), the copy structure
   (PAS / BAB / Social-Proof / Authority / etc.), the psychological triggers used, and
   the offer components present.
4. Rewrite that into the file's schema (templates use `{brand} {product} {result}
   {proof} {o1} {o2}` slots so the app adapts them to each user's brand). Trigger keys
   must match `AdmiralEngine.TRIGGERS`; offer keys must match
   `AdmiralEngine.OFFER_COMPONENTS`.
5. Refresh each sector's `insights[]` with 2-3 current, observed patterns.

## Finish

- Set `updated` to today's date (YYYY-MM-DD).
- Keep `source` honest about provenance.
- Validate: `node -e "JSON.parse(require('fs').readFileSync('data/winning-ads.json','utf8'))"`.
- Keep 1-3 winners per sector. Quality over volume.

## Schema

```json
{
  "version": "1.0",
  "source": "...", "updated": "YYYY-MM-DD",
  "sectors": {
    "<sector>": {
      "insights": [ { "tr": "...", "en": "..." } ],
      "winners": [ {
        "advertiser": "...", "structure": "PAS|BAB|...",
        "hook_tr": "...", "hook_en": "...",
        "triggers": ["socialproof", "scarcity"],
        "offerComponents": ["sartlar", "hiz"],
        "template_tr": "... {brand} {product} {result} {o1} {o2} {proof} ...",
        "template_en": "...",
        "why": { "tr": "...", "en": "..." }
      } ]
    }
  }
}
```
