import { LuaSkill } from "lua-cli";
import FindBusinessWebsitesTool from "./tools/FindBusinessWebsitesTool";

const businessFinderSkill = new LuaSkill({
    name: "business-finder",
    description: "Find local businesses in a target area and identify their website URLs.",
    context: `
Use this skill when the user asks for businesses, leads, prospects, companies, or service providers in a specific area.

The find_business_websites tool searches Foursquare Places using a business query and area. Ask for the missing business type or area if the user's request does not include both. Prefer returning businesses with website URLs unless the user explicitly wants all matching businesses.

When presenting results, include the business name, website URL, area/address, phone number when available, and Foursquare URL when useful. If some businesses were omitted because they did not have website URLs, briefly mention that.
`,
    tools: [new FindBusinessWebsitesTool()],
});

export default businessFinderSkill;
