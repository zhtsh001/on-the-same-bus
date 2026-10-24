# 同车 · On the Same Bus

A short, text-only game about how two strangers interpret each other—and how those interpretations shape what happens between them.

**[Play in English](https://along-the-way-jam-1023.fitcat.chatgpt.site/en.html) · [中文试玩](https://along-the-way-jam-1023.fitcat.chatgpt.site/) · [中文说明](README.zh-CN.md)**

## Why I made this

I wanted to express an idea through the rules of a game: the world we experience is partly shaped by what we expect to find in it. When we meet another person, we see their actions but have limited access to their circumstances and intentions. We act on an interpretation; they interpret our response and act in turn.

A stranger moves away. Are they uncomfortable with me, making room for me, or simply dealing with a numb leg? A small action can support several explanations. Some things are responses to us; some have nothing to do with us. We often cannot tell which.

I wanted the player to encounter this through ordinary decisions—moving a bag, looking away, making space, returning something—rather than a series of obvious moral dilemmas. Neither person fully sees the other. Each also has a life outside the encounter.

This interest is connected to a wider concern about weakened empathy and the difficulty of understanding one another. The game brings that concern down to a brief everyday meeting between strangers. The experience I hope the ending makes possible is: **“There was another possible explanation. I want to understand what happened differently.”**

## How the game expresses that idea

You sit beside a stranger on a night bus. At most moments, you choose a tentative interpretation before choosing an action. The NPC then forms its own interpretation, predicts your next behavior, and acts. Its chosen action becomes what you observe next.

Your private interpretation is never sent to the NPC. The connection runs through your action: what you do becomes evidence for the other person. The NPC has a fixed personal situation established at the start, so its actions can also have independent reasons.

The story ends as soon as both people acknowledge an exchange, or when one leaves without establishing contact. Making contact is not scored as a better ending. The final review reveals the NPC's recorded alternatives and choices alongside yours, including what it predicted and what you actually did next.

```text
NPC action → your interpretation → your action
           → NPC interpretation → prediction → action → ...
                                     ↓
                       End-of-game review of both records
```

## What is implemented

- Chinese and English text interfaces.
- Up to eight scene nodes and three fixed starting circumstances.
- Preset player actions, with a separate interpretation step at key moments.
- Gemini-generated NPC interpretations, predictions, selections, and short rationales.
- Rule-constrained NPC actions, validated before the state advances.
- End-of-game review, JSON export, and revisiting an earlier node.
- An explicitly labeled offline rules mode when no model backend is available.

The framework determines environmental events, available actions, visible action text, and ending rules. Gemini selects behavior within those boundaries. Each NPC turn uses **one structured model request**, rather than independent calls for every mental step. The records are fictional character judgments, not a transcript of a model's hidden reasoning.

## Run locally

Requires Python 3.9 or newer. The local server uses only the Python standard library.

```sh
cd prototype
python3 server.py
```

Enter your own Gemini API credential at the hidden prompt, then open:

- Chinese: <http://127.0.0.1:8766/>
- English: <http://127.0.0.1:8766/en.html>

`GEMINI_API_KEY` can also be supplied through your environment; `GAME_GEMINI_MODEL` optionally overrides the default `gemini-2.5-flash`. The example environment file documents variable names only; the server does not automatically load `.env` files.

For offline play, open `prototype/dist/index.html` or serve `prototype/dist` with a static server. Offline decisions are rules-based and are labeled as such. Model failures during a connected session pause the turn instead of silently replacing it with an offline result.

## Development

Node.js is needed for the checks; there are no npm dependencies.

```sh
python3 prototype/build_languages.py
node prototype/test.cjs
node prototype/test_languages.cjs
```

The language builder derives the English files from the shared Chinese source and translation dictionaries. Keep generated files in sync after changing text or rules.

| Path | Purpose |
|---|---|
| `prototype/dist/game.js` | World state, choices, legal actions, validation, records |
| `prototype/dist/app.js` | Player flow, model requests, endings, review and export |
| `prototype/server.py` | Local Gemini gateway, prompt, response schema |
| `prototype/worker/gateway.js` | Hosted Worker gateway |
| `prototype/scripts/build_hosted.py` | Embed static assets and backend into a deployable Worker |
| `prototype/i18n/` | English translation dictionaries |
| [Design notes](docs/DESIGN.zh-CN.md) | Current design in Chinese |
| [Full pipeline report](docs/PIPELINE.zh-CN.md) | Implementation workflow, data flow, and gaps |

Hosted builds are optional. They need your own hosting configuration and server-side `GEMINI_API_KEY` secret. The original deployment identity, credentials, and generated hosting bundle are not included in this repository. Publishing changes is separate from local edits.

## Prototype boundaries

Version 0.4 is an experiment, not a finished game or a validated psychological model. Some scene timing, positional continuity, and ending edge cases remain. Choosing different private interpretations while taking the same action does not change the NPC input. Noticing an action does not guarantee understanding it.

The game state lives in browser memory and resets on refresh. The downloaded record includes the NPC's initial circumstances; the on-screen review does not yet present those circumstances in full. There is no cross-session learning or persistent NPC personality training. Hosted rate limiting is best-effort and is not a spending cap.

Do not commit API keys. Requests in Gemini mode are sent to Google's Gemini service and are subject to the account's quotas and billing. No application database stores playthroughs.

## Authorship and development

Game concept and creative direction: **Tristan Zhang**. The implementation and documentation were developed with AI assistance. This repository preserves the distinction between the intended experience and what the current prototype actually implements.
