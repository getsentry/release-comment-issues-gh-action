import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";

const RELEASE_COMMENT_HEADING =
  "## A PR closing this issue has just been released 🚀";

type Mode = "" | "SIMPLE_ROUND_BRACKETS";

async function run() {
  const { getInput } = core;

  const githubToken = getInput("github_token");
  const version = getInput("version");
  const mode = (getInput("changelog_pr_mode") || "") as Mode;

  if (!githubToken || !version) {
    core.debug("Skipping because github_token or version are empty.");
    return;
  }

  const { owner, repo } = context.repo;

  const octokit = getOctokit(githubToken);

  const release = await octokit.request(
    "GET /repos/{owner}/{repo}/releases/tags/{tag}",
    {
      owner,
      repo,
      tag: version,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  const prNumbers = extractPrsFromReleaseBody(release.data.body, {
    repo,
    owner,
    mode,
  });

  if (!prNumbers.length) {
    core.debug("No PRs found in release body.");
    return;
  }

  core.debug(`Found PRs in release body: ${prNumbers.join(", ")}`);

  const linkedIssues = await Promise.all(
    prNumbers.map((prNumber) =>
      getLinkedIssuesForPr(octokit, { repo, owner, prNumber })
    )
  );

  for (const pr of linkedIssues) {
    if (!pr.issues.length) {
      core.debug(`No linked issues found for PR #${pr.prNumber}`);
      continue;
    }

    core.debug(
      `Linked issues for PR #${pr.prNumber}: ${pr.issues
        .map((issue) => issue.number)
        .join(",")}`
    );

    for (const issue of pr.issues) {
      if (
        await hasExistingComment(octokit, {
          repo,
          owner,
          issueNumber: issue.number,
        })
      ) {
        core.debug(`Comment already exists for issue #${issue.number}`);
        continue;
      }

      const body = `${RELEASE_COMMENT_HEADING}\n\nThis issue was referenced by PR #${pr.prNumber}, which was included in the [${version} release](https://github.com/${owner}/${repo}/releases/tag/${version}).`;

      core.debug(`Creating comment for issue #${issue.number}`);

      await octokit.rest.issues.createComment({
        repo,
        owner,
        issue_number: issue.number,
        body,
      });
    }
  }
}

function extractPrsFromReleaseBody(
  body: string,
  { repo, owner, mode }: { repo: string; owner: string; mode: Mode }
) {
  // Different modes result in different regexes:
  // 1. By default, we look for full links to PRs in the same repo
  //    This is the safest, and captures e.g. this: ([#13527](https://github.com/getsentry/sentry-javascript/pull/13527))
  // 2. If the mode is set to SIMPLE_ROUND_BRACKETS, we look for PR numbers in round brackets
  //    E.g. (#13527)
  //    Note that there may be false positives, but if we do not find a matching issue nothing bad happens either

  const regex =
    mode === "SIMPLE_ROUND_BRACKETS"
      ? /\(#(\d+)\)/gm
      : new RegExp(
          `\\[#(\\d+)\\]\\(https:\\/\\/github\\.com\\/${owner}\\/${repo}\\/pull\\/(?:\\d+)\\)`,
          "gm"
        );
  const prNumbers = Array.from(
    new Set([...body.matchAll(regex)].map((match) => parseInt(match[1])))
  );

  return prNumbers.filter((number) => !!number && !Number.isNaN(number));
}

async function getLinkedIssuesForPr(
  octokit: ReturnType<typeof getOctokit>,
  { repo, owner, prNumber }: { repo: string; owner: string; prNumber: number }
) {
  const res = (await octokit.graphql(
    `
query issuesForPr($owner: String!, $repo: String!, $prNumber: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $prNumber) {
      id
      closingIssuesReferences (first: 50) {
        nodes {
          id
          number
        }
      }
    }
  }
}`,
    {
      prNumber,
      owner,
      repo,
    }
  )) as {
    repository?: {
      pullRequest?: {
        closingIssuesReferences: {
          nodes: { id: string; number: number }[];
        };
      };
    };
  };

  const issues = res.repository?.pullRequest?.closingIssuesReferences.nodes;

  return {
    prNumber,
    issues,
  };
}

async function hasExistingComment(
  octokit: ReturnType<typeof getOctokit>,
  {
    repo,
    owner,
    issueNumber,
  }: { repo: string; owner: string; issueNumber: number }
) {
  const { data: commentList } = await octokit.rest.issues.listComments({
    repo,
    owner,
    issue_number: issueNumber,
  });

  return commentList.some((comment) =>
    comment.body.startsWith(RELEASE_COMMENT_HEADING)
  );
}

run();
