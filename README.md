# release-comment-issues-gh-action

A GitHub Action to automatically comment on issues once a release is published.

It parses PRs from the release body based on a pattern, then fetches issues that these PRs closed, and posts a comment to these issues.

## Usage

```yml
name: "Automation: Notify issues for release"
on:
  release:
    types:
      - published
  workflow_dispatch:
    inputs:
      version:
        description: Which version to notify issues for
        required: false

# This workflow is triggered when a release is published
jobs:
  release-comment-issues:
    runs-on: ubuntu-20.04
    name: 'Notify issues'
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Get version
        id: get_version
        run: echo "version=${{ github.event.inputs.version || github.event.release.tag_name }}" >> $GITHUB_OUTPUT

      - name: Comment on linked issues that are mentioned in release
        if: steps.get_version.outputs.version != ''
        uses: getsentry/release-comment-issues-gh-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          version: ${{ steps.get_version.outputs.version }}
```

By default, it will parse PRs from the release in the following format:

```
([#13527](https://github.com/getsentry/sentry-javascript/pull/13527))
```

Where the owner & repo comes from where the action is run.

You can also define a `changelog_pr_mode: SIMPLE_ROUND_BRACKETS` input, which will instead lead to it parsing PRs in the format `(#13527)`.