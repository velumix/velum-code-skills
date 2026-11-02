# Velum Code skills

The community skill directory for [Velum Code](https://github.com/velumix/VelumCode), maintained by **Velumix**. Every skill is a public GitHub repository with a `SKILL.md` file at its root.

## Find a skill

Open **Skills → Browse** in Velum Code. Search the directory, choose a skill, read its full instructions, and install. Skills are pinned to the listed commit, send their text to your chosen provider only on turns where you turn them on, and never run code.

## Publish your skill

1. Push `SKILL.md` (and optionally `velum-skill.json` for exact name, version and tags) to your public GitHub repository.
2. In Velum, choose **Publish your skill**, paste the repository URL, and check it.
3. Continue to the prefilled GitHub submission, confirm you maintain the skill, and submit.
4. A maintainer reads the instructions and applies **approved**. GitHub Actions validates the pinned files and updates `catalog.json`, which the app reads.

You can also [submit directly on GitHub](https://github.com/velumix/velum-code-skills/issues/new?template=skill.yml). The same flow publishes an update. Existing installations stay pinned until their users review an update.

No token is pasted into Velum. GitHub handles the author's sign-in and final submission. Listings do not imply a security audit or a verified publisher; the app always shows the full instructions before installation.

## For maintainers

Read the complete `SKILL.md` at the exact submitted commit: instructions become part of the agent's prompt for everyone who installs the skill, so check for prompt-injection patterns, requests to exfiltrate data or bypass approvals, misleading descriptions, and license/ownership. Apply **approved** only after reviewing. The workflow checks that the approver has repository write access. Editing an approved issue does not republish it: remove the label, review again and reapply it. A body changed before validation fails publication. Successful submissions receive **published**; failures receive **needs-fix**, with details in the Actions run. The workflow replaces the previous status label after a retry.

Entries in `entries/` are approved snapshots; `catalog.json` is generated from them. Duplicate IDs and repositories, invalid manifests and oversized files are rejected. To remove a listing, delete its entry in a reviewed pull request and run `node scripts/catalog.mjs generate`. To publish directly as a maintainer, use the workflow's Run workflow form with a repository and reviewed commit.

```sh
npm test
npm run check
```

The app caches the directory for one hour, offers Refresh, and retains a saved copy for outages. The directory contains metadata only; skill text is fetched separately during installation review.

[Build a skill](https://github.com/velumix/VelumCode/blob/main/docs/skills.md) · [Current catalog](catalog.json) · [Submission status](https://github.com/velumix/velum-code-skills/issues)
