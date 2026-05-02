import { LuaSkill } from "lua-cli";
import ScrapeAndAnalyzeTool from "./tools/ScrapeAndAnalyzeTool";

const scrapeSkill = new LuaSkill({
    name: "scrape-website",
    description:
        "Scrapes a website and produces an audit + a redesign prompt suitable for handing to the v0 redesign skill.",
    context: `Use this skill when the user provides a URL and wants to understand what is wrong with the site or wants it redesigned.
Always run this BEFORE the redesign-website skill — its 'redesign_prompt' output is the input the redesign skill expects.
Do not use it for general web search; this is for auditing a single page the user has named.`,
    tools: [new ScrapeAndAnalyzeTool()],
});

export default scrapeSkill;
