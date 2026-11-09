# Private owner chat

The floating chat is hidden from anonymous visitors. Server endpoints require an Auth.js encrypted session for GitHub account ID **75132410** (`jdmiami`); changing local storage or adding a URL flag cannot unlock it. The GitHub access token stays in an encrypted, HttpOnly session cookie and is omitted from public session responses. Sign-in expires after eight hours.

## One-time sign-in setup

1. Create a GitHub OAuth App at https://github.com/settings/applications/new.
2. Name: **Neuroflux Owner Assistant**.
3. Homepage: **https://neuroflux-rig.vercel.app**.
4. Authorization callback URL: **https://neuroflux-rig.vercel.app/api/auth/callback/github**.
5. In Vercel project settings → Environment Variables, add **AUTH_GITHUB_ID** (the Client ID) and **AUTH_GITHUB_SECRET** (the Client Secret), for **Production only**. Do not paste the secret into chat, a GitHub issue, or source control.
6. **AUTH_SECRET** must be a cryptographically random value of at least 32 characters; **AUTH_URL** is `https://neuroflux-rig.vercel.app`. These are server-side values. A change to Vercel environment variables needs a new deployment.
7. Open **https://neuroflux-rig.vercel.app/owner.html**, sign in as `jdmiami`, then open the app. Other accounts are rejected. The CHAT button appears beside the thumb area; in Landscape Take it mirrors with the selected hand.

The OAuth App requests `repo` scope so the owner can create improvement issues and explicitly dispatch the repository workflow. Review GitHub's consent screen. The rest of Neuroflux remains public.

## Use the conversation

Describe a desired live adjustment or an app improvement. Chat replies use the existing Gemini setup, trying the configured primary Flash model and labeling a fallback. Only sanitized app settings are sent, with your messages; camera frames, audio, media files, names of local recordings, API keys and screenshots are not automatically attached. Conversation text is kept in memory for this page session, not stored as a public conversation archive.

Live actions need an explicit **APPLY** click. Actions that open hardware or begin a recording have their own permission prompts/countdown. Undo is available for supported settings and refuses to overwrite later manual edits. The guide/walkthrough toggle stays off. Camera stack recommendations are rejected if the stack changes before Apply.

For app changes, review/edit the proposed request, then choose **SAVE REQUEST TO GITHUB**. This posts an issue visible to anyone with access to the repository. **PREPARE DRAFT CHANGE** separately dispatches a developer job. It does not wake the current ChatGPT conversation and does not deploy production code.

## Enable the developer job

1. Add **GEMINI_API_KEY** as a GitHub Actions repository secret at https://github.com/jdmiami/neuroflux-rig/settings/secrets/actions. Use your existing Google AI Studio key; do not put it in an issue, chat, or committed file.
2. In repository Settings → Actions → General, enable Actions and allow GitHub Actions to create pull requests. The workflow requests contents/pull-request write permissions and issue read permission.
3. Only workflow dispatches from `jdmiami` run, and the issue must also belong to that immutable owner ID and carry the owner-request prefix.

The workflow reads the approved issue, uses Gemini to generate bounded source edits, runs `npm test` and `npm run build` inside a network-disabled container with no provider/GitHub credentials, then checks the generated diff. The isolated workspace has no repository credentials, workflow environment files, or writable dependencies; only validated build outputs are copied back before the trusted publishing step, then opens a **draft PR**. Draft branches begin with `owner/`; Vercel automatic deployments are disabled for `owner/**`, so generated changes do not execute in a secret-bearing Vercel preview before review. Existing tests, auth, owner assistant, dependencies, API routes, workflows and build/deployment configuration cannot be edited by the generator. Unsupported requests fail for manual development.

Review the diff and test results on GitHub. Merge only the concrete change you approve; merging into main uses the existing production deployment. A failing model, unsupported edit, failed test or disabled repository permission stops the job. It never merges automatically.

## Validation limits

Local tests verify real Auth.js session decryption/identity restrictions, origin checks, strict live-action validation, draft-edit boundaries and the owner-only UI with mocked server replies. A real GitHub OAuth round trip and developer job need the one-time configuration above. No test creates an actual GitHub issue or dispatches a paid model job automatically.
