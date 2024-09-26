# size-limit-release

This is a Github Action tied to [size-limit-action](https://github.com/getsentry/size-limit-action) which can be used to add size limit information to a Github release.

## Usage

```yml
name: Add size info to release
on:
  release:
    types:
      - published

# This workflow is triggered when a release is published
# It fetches the size-limit info from the release branch and adds it to the release
jobs:
  release-size-info:
    runs-on: ubuntu-20.04
    name: 'Add size-limit info to release'
    steps:
      # https://github.com/actions-ecosystem/action-regex-match
      - uses: actions-ecosystem/action-regex-match@v2
        id: head_version
        with:
          # Parse version from head ref, which is refs/tags/<tag_name>
          text: ${{ github.head_ref }}
          regex: '^refs\/tags\/([\d.]+)$'

      - name: Get version
        id: get_version
        run: echo "version=${{ steps.head_version.outputs.match }}" >> $GITHUB_OUTPUT

      - name: Update Github Release
        uses: getsentry/size-limit-release@v2
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          version: ${{ steps.get_version.outputs.version }}
          workflow_name: 'build.yml'
```

Note that this will not do anything if it detects that size limit information has already been added to the release.

The v2 tag of this assumes that you upload your size limit data with v4 of the upload-artifacts action. 

If you are uploading data with v3 of upload-artifacts, use the v1 tag.