import axios from "axios";
import { LuaTool } from "lua-cli";
import { z } from "zod";

const websiteReaderInputSchema = z.object({
    url: z.string().min(1).describe("HTTP or HTTPS website URL to read and inspect"),
});

type WebsiteReaderInput = z.infer<typeof websiteReaderInputSchema>;

const BLOCK_TAGS = [
    "script",
    "style",
    "noscript",
    "svg",
    "canvas",
    "iframe",
    "template",
];

function decodeHtmlEntities(value: string): string {
    const namedEntities: Record<string, string> = {
        amp: "&",
        apos: "'",
        gt: ">",
        lt: "<",
        nbsp: " ",
        quot: "\"",
    };

    return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
        if (entity.startsWith("#x")) {
            const codePoint = Number.parseInt(entity.slice(2), 16);
            return codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
        }

        if (entity.startsWith("#")) {
            const codePoint = Number.parseInt(entity.slice(1), 10);
            return codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
        }

        return namedEntities[entity] ?? match;
    });
}

function normalizeWhitespace(value: string): string {
    return decodeHtmlEntities(value)
        .replace(/\s+/g, " ")
        .trim();
}

function stripTags(value: string): string {
    return normalizeWhitespace(value.replace(/<[^>]+>/g, " "));
}

function removeNonContentHtml(html: string): string {
    return BLOCK_TAGS.reduce((current, tagName) => {
        const pattern = new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, "gi");
        return current.replace(pattern, " ");
    }, html.replace(/<!--[\s\S]*?-->/g, " "));
}

function extractTagText(html: string, tagName: string, limit: number): string[] {
    const results: string[] = [];
    const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi");
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(html)) && results.length < limit) {
        const text = stripTags(match[1]);
        if (text && !results.includes(text)) {
            results.push(text);
        }
    }

    return results;
}

function parseAttributes(tag: string): Record<string, string> {
    const attributes: Record<string, string> = {};
    const pattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(tag))) {
        attributes[match[1].toLowerCase()] = decodeHtmlEntities(match[3] ?? match[4] ?? match[5] ?? "");
    }

    return attributes;
}

function extractMetaContent(html: string, names: string[]): string {
    const allowedNames = new Set(names.map((name) => name.toLowerCase()));
    const pattern = /<meta\b[^>]*>/gi;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(html))) {
        const attributes = parseAttributes(match[0]);
        const metaName = (attributes.name ?? attributes.property ?? "").toLowerCase();
        const content = attributes.content;

        if (content && allowedNames.has(metaName)) {
            return normalizeWhitespace(content);
        }
    }

    return "";
}

function extractInteractiveLabels(html: string, limit: number): string[] {
    const results: string[] = [];
    const pattern = /<(a|button)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(html)) && results.length < limit) {
        const text = stripTags(match[2]);
        if (text && text.length <= 80 && !results.includes(text)) {
            results.push(text);
        }
    }

    return results;
}

function extractVisibleText(html: string): string {
    const contentHtml = removeNonContentHtml(html)
        .replace(/<(br|hr)\b[^>]*>/gi, "\n")
        .replace(/<\/(p|div|section|article|header|footer|li|h[1-6]|nav|main|aside)>/gi, "\n");

    return stripTags(contentHtml).slice(0, 6000);
}

function inferPageSignals(html: string, ctaLabels: string[], headings: string[]): string[] {
    const signals: string[] = [];

    if (/<meta\b[^>]*name=["']viewport["'][^>]*>/i.test(html)) {
        signals.push("includes viewport metadata for responsive rendering");
    }

    if (/<nav\b/i.test(html)) {
        signals.push("has a dedicated navigation region");
    }

    if (/<form\b/i.test(html)) {
        signals.push("has at least one form for enquiries or data capture");
    }

    if (ctaLabels.length > 0) {
        signals.push(`visible calls to action: ${ctaLabels.slice(0, 5).join(", ")}`);
    }

    if (headings.length > 0) {
        signals.push(`visible page structure: ${headings.slice(0, 5).join(" | ")}`);
    }

    return signals;
}

function getErrorReason(error: unknown, url: string): string {
    if (axios.isAxiosError(error)) {
        if (error.response) {
            return `Could not access ${url}. HTTP ${error.response.status} ${error.response.statusText}`.trim();
        }

        if (error.code === "ECONNABORTED") {
            return `Could not access ${url}. The request timed out.`;
        }

        return `Could not access ${url}. ${error.message}`;
    }

    if (error instanceof Error) {
        return `Could not access ${url}. ${error.message}`;
    }

    return `Could not access ${url}. Unknown error.`;
}

function normalizeWebsiteUrl(rawUrl: string): { url?: string; reason?: string } {
    const trimmedUrl = rawUrl.trim();
    const candidateUrl = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmedUrl)
        ? trimmedUrl
        : `https://${trimmedUrl}`;

    try {
        const parsedUrl = new URL(candidateUrl);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
            return { reason: "Only HTTP and HTTPS website URLs can be accessed." };
        }

        return { url: parsedUrl.toString() };
    } catch {
        return { reason: `Invalid website URL: ${rawUrl}` };
    }
}

export default class WebsiteReaderTool implements LuaTool<typeof websiteReaderInputSchema> {
    name = "website_reader";
    description = "Read a website URL and return accessible, visible page evidence for design comparison.";
    inputSchema = websiteReaderInputSchema;

    async execute(input: WebsiteReaderInput) {
        const normalized = normalizeWebsiteUrl(input.url);
        if (!normalized.url) {
            return {
                accessible: false,
                url: input.url,
                reason: normalized.reason,
            };
        }

        try {
            const response = await axios.get<string>(normalized.url, {
                headers: {
                    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
                    "User-Agent": "RevampEmailAgent/1.0 (+https://revamp)",
                },
                maxRedirects: 5,
                responseType: "text",
                timeout: 15000,
                validateStatus: (status) => status >= 200 && status < 400,
            });

            const html = typeof response.data === "string" ? response.data : String(response.data);
            const title = extractTagText(html, "title", 1)[0] ?? "";
            const description = extractMetaContent(html, ["description", "og:description", "twitter:description"]);
            const h1 = extractTagText(html, "h1", 8);
            const h2 = extractTagText(html, "h2", 12);
            const h3 = extractTagText(html, "h3", 8);
            const interactiveLabels = extractInteractiveLabels(html, 40);
            const ctaLabels = interactiveLabels.filter((label) =>
                /\b(book|call|contact|get|start|quote|demo|learn|more|enquire|schedule|request|buy|shop|apply|view|discover|try)\b/i.test(label)
            );
            const headings = [...h1, ...h2, ...h3];

            return {
                accessible: true,
                url: normalized.url,
                inputUrl: input.url,
                finalUrl: response.request?.res?.responseUrl ?? response.config.url ?? normalized.url,
                httpStatus: response.status,
                title,
                metaDescription: description,
                headings: {
                    h1,
                    h2,
                    h3,
                },
                interactiveLabels: interactiveLabels.slice(0, 20),
                callsToAction: ctaLabels.slice(0, 12),
                pageSignals: inferPageSignals(html, ctaLabels, headings),
                visibleTextSample: extractVisibleText(html),
            };
        } catch (error) {
            return {
                accessible: false,
                url: normalized.url,
                inputUrl: input.url,
                reason: getErrorReason(error, normalized.url),
            };
        }
    }
}
