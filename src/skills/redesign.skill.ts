import { LuaSkill } from "lua-cli";
import RedesignWithV0Tool from "./tools/RedesignWithV0Tool";

const redesignSkill = new LuaSkill({
    name: "redesign-website",
    description:
        "Takes a redesign prompt produced by scrape-website and asks v0 to generate a redesigned version of the site.",
    context: `Use this skill AFTER scrape-website has produced a redesign_prompt.
Pass that prompt straight through as 'redesign_prompt'. Include the 'original_url' when available so v0 has the context of the site being replaced.
Requires the V0_API_KEY environment variable.`,
    tools: [new RedesignWithV0Tool()],
});

export default redesignSkill;
