import axios from "axios";
import { env, LuaTool } from "lua-cli";
import { z } from "zod";

const sendEmailInputSchema = z.object({
    recipient_email: z.string().email().describe("Recipient email address"),
    subject_line: z.string().min(1).max(120).describe("Short outreach email subject line"),
    email_body: z.string().min(1).max(8000).describe("Plain text email body to send"),
});

type SendEmailInput = z.infer<typeof sendEmailInputSchema>;

function getEnv(firstKey: string, ...fallbackKeys: string[]): string | undefined {
    for (const key of [firstKey, ...fallbackKeys]) {
        const value = env(key);
        if (value) {
            return value;
        }
    }

    return undefined;
}

function hasHeaderInjection(value: string): boolean {
    return /[\r\n]/.test(value);
}

function getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const responseData = error.response?.data;
        if (responseData && typeof responseData === "object") {
            const maybeMessage = "message" in responseData ? responseData.message : undefined;
            if (typeof maybeMessage === "string") {
                return maybeMessage;
            }
        }

        return error.message;
    }

    return error instanceof Error ? error.message : "Unknown email provider error";
}

export default class SendEmailTool implements LuaTool<typeof sendEmailInputSchema> {
    name = "send_email";
    description = "Send a plain-text cold outreach email through the configured outbound email provider.";
    inputSchema = sendEmailInputSchema;

    async execute(input: SendEmailInput) {
        if (hasHeaderInjection(input.recipient_email) || hasHeaderInjection(input.subject_line)) {
            return {
                status: "blocked",
                recipient_email: input.recipient_email,
                subject_line: input.subject_line,
                email_body: input.email_body,
                send_confirmation: "",
                reason: "Email was blocked because the recipient or subject contained newline characters.",
            };
        }

        const dryRun = getEnv("EMAIL_DRY_RUN") === "true";
        const from = getEnv("EMAIL_FROM", "RESEND_FROM_EMAIL", "SEND_EMAIL_FROM");
        const replyTo = getEnv("EMAIL_REPLY_TO", "RESEND_REPLY_TO", "SEND_EMAIL_REPLY_TO");
        const resendApiKey = getEnv("RESEND_API_KEY");
        const webhookUrl = getEnv("SEND_EMAIL_WEBHOOK_URL");

        if (!from) {
            return {
                status: "blocked",
                recipient_email: input.recipient_email,
                subject_line: input.subject_line,
                email_body: input.email_body,
                send_confirmation: "",
                reason: "No outbound sender is configured. Set EMAIL_FROM before sending.",
            };
        }

        if (hasHeaderInjection(from) || (replyTo ? hasHeaderInjection(replyTo) : false)) {
            return {
                status: "blocked",
                recipient_email: input.recipient_email,
                subject_line: input.subject_line,
                email_body: input.email_body,
                send_confirmation: "",
                reason: "Email was blocked because EMAIL_FROM or EMAIL_REPLY_TO contained newline characters.",
            };
        }

        if (!resendApiKey && !webhookUrl) {
            return {
                status: "blocked",
                recipient_email: input.recipient_email,
                subject_line: input.subject_line,
                email_body: input.email_body,
                send_confirmation: "",
                reason: "No outbound email provider is configured. Set RESEND_API_KEY or SEND_EMAIL_WEBHOOK_URL.",
            };
        }

        if (dryRun) {
            return {
                status: "blocked",
                recipient_email: input.recipient_email,
                subject_line: input.subject_line,
                email_body: input.email_body,
                send_confirmation: "",
                reason: `EMAIL_DRY_RUN is true. Dry run only; would send via ${resendApiKey ? "Resend" : "webhook"}.`,
            };
        }

        if (resendApiKey) {
            try {
                const response = await axios.post(
                    "https://api.resend.com/emails",
                    {
                        from,
                        to: [input.recipient_email],
                        subject: input.subject_line,
                        text: input.email_body,
                        ...(replyTo ? { reply_to: replyTo } : {}),
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${resendApiKey}`,
                            "Content-Type": "application/json",
                        },
                        timeout: 15000,
                    }
                );

                return {
                    status: "sent",
                    recipient_email: input.recipient_email,
                    subject_line: input.subject_line,
                    email_body: input.email_body,
                    send_confirmation: `Email sent successfully via Resend${response.data?.id ? ` (${response.data.id})` : ""}`,
                    provider: "resend",
                    provider_response: response.data,
                };
            } catch (error) {
                return {
                    status: "blocked",
                    recipient_email: input.recipient_email,
                    subject_line: input.subject_line,
                    email_body: input.email_body,
                    send_confirmation: "",
                    reason: `Resend rejected the email. ${getErrorMessage(error)}`,
                };
            }
        }

        if (webhookUrl) {
            try {
                const webhookSecret = getEnv("SEND_EMAIL_WEBHOOK_SECRET");
                const response = await axios.post(
                    webhookUrl,
                    {
                        from,
                        to: input.recipient_email,
                        subject: input.subject_line,
                        text: input.email_body,
                        replyTo,
                    },
                    {
                        headers: {
                            "Content-Type": "application/json",
                            ...(webhookSecret ? { Authorization: `Bearer ${webhookSecret}` } : {}),
                        },
                        timeout: 15000,
                    }
                );

                return {
                    status: "sent",
                    recipient_email: input.recipient_email,
                    subject_line: input.subject_line,
                    email_body: input.email_body,
                    send_confirmation: "Email sent successfully via webhook",
                    provider: "webhook",
                    provider_response: response.data,
                };
            } catch (error) {
                return {
                    status: "blocked",
                    recipient_email: input.recipient_email,
                    subject_line: input.subject_line,
                    email_body: input.email_body,
                    send_confirmation: "",
                    reason: `Email webhook rejected the email. ${getErrorMessage(error)}`,
                };
            }
        }
    }
}
