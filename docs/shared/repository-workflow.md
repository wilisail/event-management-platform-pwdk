# Repository workflow

Updated: 19 October 2026.

## Workflow and access

| Branch | Working arrangement |
| --- | --- |
| `feature-1` | Rizky can push and develop his full frontend/backend feature freely. This branch is excluded from the active protection rule. |
| `feature-2` | Wili's frontend/backend work; updates reserved for the owner account. |
| `integration` | Combined testing and integration; updates and merges coordinated by Wili. |
| `main` | Shared reference/release branch; updates and merges coordinated by Wili. |

Rizky opens a pull request from feature 1, or asks Wili to open it from his branch. Wili checks the diff, runs relevant checks with coding-agent assistance and merges the intended changes. Each builder keeps ownership of their feature implementation.

Required approving reviews are zero. There is no mandatory third reviewer or requirement for Rizky to approve Wili's own changes. Peer feedback remains available when useful. Coding-agent review supports the builders; it is not an independent human approval.

## Active branch rule

The [importable ruleset](repository-ruleset.json) targets only `main`, `integration` and `feature-2`. It restricts creation, updates, deletion and force pushes for ordinary collaborators and requires their changes to be proposed through pull requests.

The active rule uses the **Repository admin** role with an **Always allow** bypass. The verified owner account `wilisail` has that role; `MRizkyAnugraha` has Write access and is not included in this bypass. Any additional repository admin would also inherit the role bypass. This preserves the owner's current direct-update and merge access, including routine documentation and integration work. The owner can override the included protections; this is an explicit exception, not mandatory peer review.

GitHub's checked collaborator permissions are `wilisail: admin` and `MRizkyAnugraha: write`. The repository is public: branch protection controls updates and merges, not visibility. The rule does not restrict file edits inside feature 1's own branch; the integration review determines what enters the shared branches.

**Verified status, 19 October 2026: branch protection is active.** GitHub reports `main`, `integration` and `feature-2` as protected, while `feature-1` remains unprotected. The active [saved branch ruleset](https://github.com/wilisail/event-management-platform-pwdk/rules/25387179) includes exactly those three branch refs, with no exclusions. It has creation, update, deletion and force-push restrictions, plus a pull-request requirement with zero required approvals. Only Repository admin has an Always allow bypass; no Write-role or app bypass was added.

Rizky can push freely to `feature-1` and propose changes to the protected branches through pull requests. His Write role does not permit him to update or merge into the protected branches under this rule; Wili's admin bypass preserves direct updates and merges. The earlier unintended tag ruleset is no longer listed.

The name's `feature-2` suffix refers to the feature 2 branch being protected alongside the shared branches; it is not a version number. The target type and matching patterns determine what is protected. [repository-ruleset.json](repository-ruleset.json) remains an importable template; the saved GitHub ruleset is the authority for enforcement.

## GitHub Actions

GitHub Actions is optional for these access rules. A workflow can automatically install dependencies, run tests/type checks and build the application on pushes or pull requests, showing results and logs. This supports the course's CI/CD module and reduces repeated manual checking.

There are currently no GitHub Actions workflow files in this repository and no required CI status checks. Automation has not been enabled by this workflow note. A later CI change can start with informational checks; making checks mandatory is a separate setting. Deploying an application also requires an explicitly configured deployment workflow.

References: [GitHub branch rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets), [ruleset administration](https://docs.github.com/en/rest/repos/rules#create-a-repository-ruleset), [GitHub Actions](https://docs.github.com/en/actions/get-started/understand-github-actions).
