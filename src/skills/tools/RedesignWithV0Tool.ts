import { LuaTool, env } from "lua-cli";
import { z } from "zod";
import axios from "axios";

const V0_ENDPOINT = "https://api.v0.dev/v1/chats";

export default class RedesignWithV0Tool implements LuaTool {
    name = "redesign_with_v0";
    description =
        "Send a redesign prompt (typically produced by scrape_and_analyze) to the v0 Platform API and return the generated chat URL, live preview URL, and generated files. Note: full-site generations typically take 2-5 minutes — the request blocks until v0 finishes.";

    inputSchema = z.object({
        redesign_prompt: z
            .string()
            .min(20)
            .describe(
                "The full redesign brief. Usually the 'redesign_prompt' field from scrape_and_analyze."
            ),
        original_url: z
            .string()
            .url()
            .optional()
            .describe("The URL of the site being redesigned, for context."),
        system: z
            .string()
            .optional()
            .describe(
                "Optional override for the system prompt sent to v0."
            ),
    });

    async execute(input: z.infer<typeof this.inputSchema>) {
        const apiKey = env("V0_API_KEY");
        if (!apiKey) {
            throw new Error(
                "V0_API_KEY is not set. Add it to your .env or lua.skill.yaml."
            );
        }

        const prompt = (input.redesign_prompt ?? "").trim();
        if (prompt.length < 20) {
            throw new Error(
                "redesign_prompt is missing or too short. Pass the 'redesign_prompt' field returned by scrape_and_analyze."
            );
        }

        const message = input.original_url
            ? `Redesign the website at ${input.original_url}.\n\n${prompt}`
            : prompt;

        const system =
            input.system ??
            "You are an expert Next.js + Tailwind designer. Generate ONLY a single landing page with three components: header, body, footer. Keep it minimal — one file (app/page.tsx) plus a layout if strictly needed. No multi-page routes, no CMS, no forms beyond a simple contact link. Optimise for fast generation.";

        try {
            const res = await axios.post(
                V0_ENDPOINT,
                { message, system,
                modelConfiguration: {
                    modelId: "v0-mini"
                }
                },
                {
                    // v0 chats.create blocks until the full generation completes;
                    // the official SDK uses fetch() with no timeout. Multi-page
                    // redesigns commonly take 2-5 min, so we allow up to 10.
                    timeout: 3000000,
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            const chat = res.data ?? {};
            const files: Array<{ name: string; content: string }> =
                chat?.latestVersion?.files ?? [];

            return {
                chat_id: chat.id,
                web_url: chat.webUrl,
                demo_url: chat?.latestVersion?.demoUrl,
                status: chat?.latestVersion?.status,
                file_count: files.length,
                files: files.map((f) => ({ name: f.name, content: f.content })),
                original_url: input.original_url,
            };
        } catch (e: any) {
            if (e?.response) {
                const body = truncate(
                    typeof e.response.data === "string"
                        ? e.response.data
                        : JSON.stringify(e.response.data)
                );
                throw new Error(
                    `v0 API ${e.response.status} ${e.response.statusText}: ${body}`
                );
            }
            if (e?.code === "ETIMEDOUT" || /timeout/i.test(e?.message ?? "")) {
                throw new Error(
                    "v0 generation exceeded the 10 minute client timeout. The chat may still have been created server-side — check https://v0.app/chats for an in-progress chat with this prompt, then call this tool again with a shorter brief if needed."
                );
            }
            throw e;
        }
    }
}

function truncate(s: string, n = 600): string {
    return s.length > n ? s.slice(0, n) + "…" : s;
}
