# Repository workflow

Updated: 19 October 2026.

## Intended workflow and access

| Branch | Working arrangement |
| --- | --- |
| `feature-1` | Rizky can push and develop his full frontend/backend feature freely. This branch is excluded from the prepared protection rule. |
| `feature-2` | Wili's frontend/backend work; updates reserved for the owner account. |
| `integration` | Combined testing and integration; updates and merges coordinated by Wili. |
| `main` | Shared reference/release branch; updates and merges coordinated by Wili. |

Rizky opens a pull request from feature 1, or asks Wili to open it from his branch. Wili checks the diff, runs relevant checks with coding-agent assistance and merges the intended changes. Each builder keeps ownership of their feature implementation.

Required approving reviews are zero. There is no mandatory third reviewer or requirement for Rizky to approve Wili's own changes. Peer feedback remains available when useful. Coding-agent review supports the builders; it is not an independent human approval.

## Prepared branch rule

The [importable ruleset](repository-ruleset.json) targets only `main`, `integration` and `feature-2`. It restricts creation, updates, deletion and force pushes for ordinary collaborators and requires their changes to be proposed through pull requests.

The prepared rule uses the **Repository admin** role with an **Always allow** bypass. The verified owner account `wilisail` has that role; `MRizkyAnugraha` has Write access and is not included in this bypass. Any additional repository admin would also inherit the role bypass. This preserves the owner's current direct-update and merge access, including routine documentation and integration work. The owner can override the included protections; this is an explicit exception, not mandatory peer review.

GitHub's checked collaborator permissions are `wilisail: admin` and `MRizkyAnugraha: write`. The repository is public: branch protection controls updates and merges, not visibility. The rule does not restrict file edits inside feature 1's own branch; the integration review determines what enters the shared branches.

**Verified status, 19 October 2026: branch protection is not active yet.** The saved [ruleset](https://github.com/wilisail/event-management-platform-pwdk/rules/25385272), named `protect-shared-and-feature-2`, is Active but targets **tags**: `refs/tags/main`, `refs/tags/integration` and `refs/tags/feature-2`. Its Repository admin / Always allow bypass and creation, update, deletion and force-push restrictions are saved. Those tag targets do not protect the branches with the same names; all three intended branches remain unprotected.

To apply the intended configuration, use Settings → Rules → Rulesets → New ruleset → **New branch ruleset**. Add only `main`, `integration` and `feature-2` as included branch patterns, keep Repository admin / Always allow, and enable creation, update, deletion and force-push restrictions plus Require a pull request before merging with zero required approvals. Leave other requirements off. Disable or delete the unintended tag ruleset, then verify the new saved branch ruleset. The repository tools used here can read rulesets but cannot administer them.

The name's `feature-2` suffix refers to the feature 2 branch being protected alongside the shared branches; it is not a version number. The name is a label: the target type and matching patterns determine what is protected. Committing the JSON below does not activate it; [repository-ruleset.json](repository-ruleset.json) remains a template for the intended branch rule.

## GitHub Actions

GitHub Actions is optional for these access rules. A workflow can automatically install dependencies, run tests/type checks and build the application on pushes or pull requests, showing results and logs. This supports the course's CI/CD module and reduces repeated manual checking.

There are currently no GitHub Actions workflow files in this repository and no required CI status checks. Automation has not been enabled by this workflow note. A later CI change can start with informational checks; making checks mandatory is a separate setting. Deploying an application also requires an explicitly configured deployment workflow.

References: [GitHub branch rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets), [ruleset administration](https://docs.github.com/en/rest/repos/rules#create-a-repository-ruleset), [GitHub Actions](https://docs.github.com/en/actions/get-started/understand-github-actions).
