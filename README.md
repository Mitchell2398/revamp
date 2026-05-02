# Email Agent Branch

This branch turns the starter Lua agent into a Revamp cold outreach agent. It uses two custom tools:

- `website_reader`: opens a website URL and returns visible page evidence.
- `send_email`: sends a plain-text outreach email through Resend or a custom webhook.

The full agent workflow is:

1. Read the old website with `website_reader`.
2. Read the new website with `website_reader`.
3. Compare only the evidence returned by those tool calls.
4. Draft a short email from Finn at Revamp.
5. Send the email with `send_email`.
6. Return a JSON result showing whether the email was sent or blocked.

## Setup

Install dependencies if needed:

```bash
npm install
```

Create a local environment file:

```bash
cp env.example .env
```

Do not commit `.env`. It can contain real API keys.

## Email Configuration

The `send_email` tool will block instead of pretending an email was sent when required email settings are missing.

Minimum required settings:

```bash
EMAIL_FROM="Finn from Revamp <finn@your-domain.com>"
EMAIL_REPLY_TO="finn@your-domain.com"
```

Then configure one outbound provider.

Option 1: Resend

```bash
RESEND_API_KEY="your-resend-api-key"
```

Option 2: custom webhook

```bash
SEND_EMAIL_WEBHOOK_URL="https://your-email-service.example/send"
SEND_EMAIL_WEBHOOK_SECRET="optional-webhook-secret"
```

For local testing without actually sending the email:

```bash
EMAIL_DRY_RUN=true
```

Important: dry run still needs `EMAIL_FROM` and either `RESEND_API_KEY` or `SEND_EMAIL_WEBHOOK_URL`. The tool checks those first so it can prove which provider path would be used.

## Run The Agent

Build and compile:

```bash
npm run build
lua compile
```

Start an interactive chat:

```bash
lua chat
```

Example input to give the agent:

```json
{
  "old_website_url": "https://example-old.com",
  "new_website_url": "https://example-new.com",
  "recipient_email": "hello@example.com"
}
```

Expected successful shape:

```json
{
  "status": "sent",
  "recipient_email": "hello@example.com",
  "subject_line": "A fresh take on your website",
  "email_body": "Hi there, I'm Finn from Revamp...",
  "send_confirmation": "Email sent successfully via Resend"
}
```

Expected blocked shape:

```json
{
  "status": "blocked",
  "recipient_email": "hello@example.com",
  "subject_line": "",
  "email_body": "",
  "send_confirmation": "",
  "reason": "Could not access new_website_url. No email was sent."
}
```

## Tool 1: `website_reader`

File: `src/skills/tools/WebsiteReaderTool.ts`

Purpose: read a public HTTP or HTTPS website and return evidence the agent can safely use when comparing the old and new sites.

Input:

```json
{
  "url": "https://example.com"
}
```

What it does:

- Adds `https://` when the user enters a bare domain like `example.com`.
- Rejects non-HTTP URLs.
- Follows redirects.
- Times out after 15 seconds.
- Extracts title text, meta description, headings, buttons, links, calls to action, page structure signals, and a visible text sample.

Successful output includes fields like:

```json
{
  "accessible": true,
  "url": "https://example.com/",
  "finalUrl": "https://www.example.com/",
  "httpStatus": 200,
  "title": "Example",
  "metaDescription": "Example description",
  "headings": {
    "h1": ["Main heading"],
    "h2": ["Section heading"],
    "h3": []
  },
  "interactiveLabels": ["Contact", "Learn more"],
  "callsToAction": ["Contact"],
  "pageSignals": ["includes viewport metadata for responsive rendering"],
  "visibleTextSample": "Visible page text..."
}
```

Blocked output includes:

```json
{
  "accessible": false,
  "url": "https://example.com/",
  "inputUrl": "example.com",
  "reason": "Could not access https://example.com/. The request timed out."
}
```

Test it directly:

```bash
lua test
```

Then choose `website_reader` and provide JSON like:

```json
{
  "url": "https://example.com"
}
```

## Tool 2: `send_email`

File: `src/skills/tools/SendEmailTool.ts`

Purpose: send the final plain-text outreach email through the configured outbound provider.

Input:

```json
{
  "recipient_email": "hello@example.com",
  "subject_line": "A fresh take on your website",
  "email_body": "Hi there, I'm Finn from Revamp..."
}
```

What it does:

- Validates that `recipient_email` is a real email-shaped value.
- Blocks newline characters in the recipient, subject, sender, and reply-to fields to prevent email header injection.
- Requires `EMAIL_FROM`.
- Uses Resend when `RESEND_API_KEY` is set.
- Uses the custom webhook when `SEND_EMAIL_WEBHOOK_URL` is set and Resend is not set.
- Blocks when `EMAIL_DRY_RUN=true` so no real email is sent.
- Returns `status="sent"` only after the provider accepts the request.

Successful output:

```json
{
  "status": "sent",
  "recipient_email": "hello@example.com",
  "subject_line": "A fresh take on your website",
  "email_body": "Hi there, I'm Finn from Revamp...",
  "send_confirmation": "Email sent successfully via Resend"
}
```

Blocked output:

```json
{
  "status": "blocked",
  "recipient_email": "hello@example.com",
  "subject_line": "A fresh take on your website",
  "email_body": "Hi there, I'm Finn from Revamp...",
  "send_confirmation": "",
  "reason": "EMAIL_DRY_RUN is true. Dry run only; would send via Resend."
}
```

Test it directly:

```bash
lua test
```

Then choose `send_email` and provide JSON like:

```json
{
  "recipient_email": "hello@example.com",
  "subject_line": "A fresh take on your website",
  "email_body": "Hi there, I'm Finn from Revamp. I had a look at the redesigned version of your site..."
}
```

## Safety Rules

The agent and tools are intentionally conservative:

- If either website cannot be accessed, no email is sent.
- The agent must not invent performance, SEO, analytics, conversion, accessibility, or backend claims.
- The agent should compare only visible evidence returned by `website_reader`.
- `send_email` blocks when configuration is missing, dry run is enabled, or the provider rejects the request.
- Real secrets should live in `.env`, not in Git.

## Useful Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Type-check and compile the TypeScript project |
| `lua compile` | Compile the Lua agent configuration |
| `lua test` | Test individual tools interactively |
| `lua chat` | Run the full agent interactively |
| `lua push` | Upload the agent to Lua |
| `lua deploy` | Deploy the uploaded agent |
| `lua logs` | View execution logs |
