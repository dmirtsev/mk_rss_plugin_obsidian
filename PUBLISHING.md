# Publishing To Obsidian

This file covers the first submission of `MK Import RSS` to the official Obsidian Community Plugins directory.

## Current status

- `manifest.json` exists in the repository root.
- `README.md` exists in the repository root.
- `LICENSE` exists in the repository root.
- `versions.json` exists in the repository root.
- The release archive is built with `npm run package`.
- The plugin id is `mk-import-rss`.
- GitHub Actions is configured for CI and release automation.

## Before the first submission

- [ ] Confirm the GitHub repository is public.
- [ ] Confirm `manifest.json` contains the correct `id`, `name`, `author`, `description`, and `version`.
- [ ] Confirm `version` follows `x.y.z`.
- [ ] Confirm `README.md` explains what the plugin does and how to install it.
- [ ] Run the local verification steps.
- [ ] Create a git tag that exactly matches `manifest.json.version`.
- [ ] Push the tag to GitHub.
- [ ] Wait for the GitHub Actions `Release` workflow to succeed.
- [ ] Fork `obsidianmd/obsidian-releases`.
- [ ] Add the plugin entry to the end of `community-plugins.json`.
- [ ] Open a `Community Plugin` pull request.

## Local verification

```bash
npm ci
npm run check
npm run package
```

If the version changes, update:

- `manifest.json`
- `versions.json`

## GitHub Release

The release workflow automatically creates a GitHub Release and uploads:

- `main.js`
- `manifest.json`
- `styles.css` if it exists
- the release zip archive

The tag must exactly match the version in `manifest.json`.

Example:

- `manifest.json` -> `"version": "0.1.2"`
- git tag -> `0.1.2`
- GitHub Release -> `0.1.2`

Commands:

```bash
git tag 0.1.2
git push origin 0.1.2
```

## community-plugins.json entry

Use this prepared entry:

- `submission/community-plugin-entry.json`

Add it to the end of the `community-plugins.json` array.

## Suggested PR title

```text
Add plugin: MK Import RSS
```

## Suggested PR body

Use this prepared text:

- `submission/obsidian-pr-body.md`

## After opening the PR

- Wait for automated validation.
- If the PR becomes `Ready for review`, wait for manual review.
- If validation fails, fix the problem and update the release.
- Do not open a second PR for the same first submission.

## After approval

- The plugin will appear in the Community Plugins directory.
- You can then share this install link:

```text
obsidian://show-plugin?id=mk-import-rss
```

## Notes

- Obsidian reads `README.md` and `manifest.json` from the GitHub repository.
- Obsidian downloads `main.js`, `manifest.json`, and `styles.css` from GitHub Releases.
- Future versions do not require a new PR in `obsidian-releases`; publish a new GitHub Release instead.
