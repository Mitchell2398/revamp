import { LuaSkill } from "lua-cli";
import SendEmailTool from "./tools/SendEmailTool";
import WebsiteReaderTool from "./tools/WebsiteReaderTool";

const emailOutreachSkill = new LuaSkill({
    name: "email-outreach-skill",
    description: "Website comparison and cold outreach email sending for Revamp redesigns.",
    context: `Use this skill only for the Revamp email-agent workflow.

Required workflow:
1. Use website_reader once for old_website_url.
2. Use website_reader once for new_website_url.
3. If either website_reader result has accessible=false, do not draft or send an email. Return status="blocked" with the access reason.
4. Compare only visible and reasonable evidence returned by website_reader.
5. Draft a concise outreach email from Finn at Revamp.
6. Use send_email with recipient_email, subject_line, and email_body.
7. Return only the required output fields copied from send_email: status, recipient_email, subject_line, email_body, send_confirmation, and reason when blocked. Do not include provider internals.

Never claim speed, SEO, conversion, accessibility, analytics, or performance improvements unless the tool output directly supports that claim.`,
    tools: [new WebsiteReaderTool(), new SendEmailTool()],
});

export default emailOutreachSkill;
