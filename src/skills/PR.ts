import { LuaSkill } from "lua-cli";
import PRTool from "./tools/pr";

export default new LuaSkill({
    name: "PR",
    description: "Used to create and merge github pull requests",
    context: "Use these tools when...",
    tools: [new PRTool()],
});
