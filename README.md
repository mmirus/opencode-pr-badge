# OpenCode PR badge

Shows a short GitHub pull request link, such as **#123**, in the OpenCode V2
terminal prompt footer. The badge remains visible without the sidebar.

## Requirements

- OpenCode 2.2.5 or later with TUI plugin support.
- Git and GitHub CLI (`gh`) on the OpenCode **server's** PATH.
- GitHub CLI authenticated for the repository (`gh auth login`).

GitHub Enterprise works through GitHub CLI's existing authentication and repository
configuration. The plugin does not store credentials.

## Install from a local clone

Add the repository's absolute path to `plugins` in your OpenCode
`opencode.json` or `opencode.jsonc`. Preserve existing plugin entries:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["/absolute/path/to/opencode-pr-badge"],
}
```

Use the server configuration, not `cli.json`: the package includes both a server
part and a TUI part. OpenCode loads both parts from this entry. For a remote
server, install the clone on the server.

Configuration changes reload automatically. Use `/reload` to force a reload.

## Behavior

- Looks up open PRs, including drafts, whose head branch matches the session's
  current branch. If several PRs match, displays the first GitHub CLI result.
- Checks the branch every five seconds and reacts to OpenCode VCS updates.
  GitHub results, including failures and missing PRs, are cached for 60 seconds.
- Queries GitHub from the session's server-side directory, including worktrees.
- Hides the badge outside a Git branch, when no open PR exists, or when GitHub CLI
  fails. Closed and merged PRs are excluded.
- Adds a terminal hyperlink to the PR URL. Opening the link depends on the
  terminal's hyperlink support and modifier-key behavior.
- Runs read-only Git and GitHub CLI commands without a shell. Commands time out
  after ten seconds; plugin disposal cancels pending work.

The plugin sends the repository and branch to GitHub through GitHub CLI. The
plugin does not send file contents or conversation messages.

## Development

Install [Bun](https://bun.sh), then run:

```sh
bun install
bun run typecheck
bun run test
```

Tests use synthetic repository names and mocked GitHub results. No GitHub account
or network access is needed to run the tests after dependencies are installed.
