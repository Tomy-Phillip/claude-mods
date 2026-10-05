# claude-mods

A Claude Code plugin marketplace with my mods.

## explorai-loading

While Claude works, shows the Explorai logo above the prompt. The logo fills with the Explorai colors as Claude completes the items of its task list (over time when there is no list), with a dancer beside it.

Needs Claude Code 2.1.287 or later, in a terminal (the VS Code chat panel doesn't draw mods). The band is 93 columns wide.

## Install

This repository is private: you need access to it, and GitHub access on your machine (`gh auth login`).

```
claude plugin marketplace add Tomy-Phillip/claude-mods
claude plugin install explorai-loading@claude-mods
```

Then start a new `claude` session. `/plugin` shows `1 mod active · explorai-loading`.

To update: `claude plugin marketplace update claude-mods`, then `claude plugin update explorai-loading@claude-mods`.

To review what the mod can do before installing, clone the repository and run `claude plugin validate plugins/explorai-loading`: it hooks prompts, turns, the task tools and the band above the prompt, and calls only the clock and the interface. It reads no files and makes no network requests.

## Develop

```
claude plugin validate plugins/explorai-loading
claude plugin test plugins/explorai-loading
```

`plugins/explorai-loading/bake_logo.py` and `bake_sprite.py` regenerate `hooks/logo.ts` and `hooks/sprite.ts` from the images.
