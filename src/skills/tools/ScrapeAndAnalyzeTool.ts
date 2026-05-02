import { LuaTool, AI } from "lua-cli";
import { z } from "zod";
import axios from "axios";

const READER_BASE = "https://r.jina.ai/";

export default class ScrapeAndAnalyzeTool implements LuaTool {
    name = "scrape_and_analyze";
    description =
        "Fetch a website by URL, summarise what it does, list specific design/UX/content problems, and produce a focused redesign prompt that another tool can hand to v0.";

    inputSchema = z.object({
        url: z
            .string()
            .url()
            .describe("Full URL of the site to audit, including https://"),
        focus: z
            .string()
            .optional()
            .describe(
                "Optional emphasis for the audit, e.g. 'conversion', 'accessibility', 'modern SaaS look'."
            ),
    });

    async execute(input: z.infer<typeof this.inputSchema>) {
        const { url, focus } = input;

        const markdown = await fetchAsMarkdown(url);
        const trimmed = markdown.slice(0, 12000);

        const system = `You audit websites and produce briefs for a design tool.
Be concrete. No fluff. Prefer specific issues over generic advice.`;

        const userPrompt = `Audit the page below and return STRICT JSON of this shape:
{
  "summary": string,            // one short sentence: what the site is and who it's for
  "issues": string[],           // 3-5 specific problems with the current design
  "fixes": string[],            // 3-5 concrete fixes, each maps to an issue (same order)
  "redesign_prompt": string     // SHORT prompt for v0. Tell it to redesign ONLY the header, body, and footer of this single landing page using Next.js + Tailwind. Name the business, list 3-5 must-keep facts (services, phone, location), and one line each on what the header / body / footer should contain. ~80-120 words total. Do NOT request multi-page sites, sub-pages, forms, CMS, or extra components.
}

URL: ${url}
${focus ? `Audit focus: ${focus}\n` : ""}
Page (Markdown extracted via reader proxy, may be truncated):
"""
${trimmed}
"""

Return ONLY the JSON object, no prose, no code fences.`;

        const raw = await AI.generate(system, [{ type: "text", text: userPrompt }]);
        const parsed = parseJson(raw);

        return {
            url,
            summary: parsed.summary,
            issues: parsed.issues,
            fixes: parsed.fixes,
            redesign_prompt: parsed.redesign_prompt,
            scraped_chars: markdown.length,
        };
    }
}

async function fetchAsMarkdown(url: string): Promise<string> {
    // Jina Reader: GET https://r.jina.ai/<full-url> returns clean Markdown.
    // It handles TLS quirks, anti-bot, and JS rendering server-side, which
    // sidesteps the lua sandbox's stripped-down axios (no http adapter,
    // no httpsAgent support).
    const res = await axios.get(READER_BASE + url, {
        timeout: 45000,
        maxContentLength: 5_000_000,
        responseType: "text",
        transformResponse: [(d) => d],
        headers: {
            Accept: "text/plain, text/markdown, */*",
            "X-Return-Format": "markdown",
        },
    });
    const body = typeof res.data === "string" ? res.data : String(res.data);
    if (!body.trim()) {
        throw new Error(`Reader proxy returned empty body for ${url}`);
    }
    return body;
}

function parseJson(raw: string): {
    summary: string;
    issues: string[];
    fixes: string[];
    redesign_prompt: string;
} {
    const cleaned = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "");
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) {
        throw new Error(`AI response was not JSON: ${raw.slice(0, 200)}`);
    }
    return JSON.parse(cleaned.slice(start, end + 1));
}
