import { LuaTool } from "lua-cli";
import { z } from "zod";

export default class PRTool implements LuaTool {
    name = "PR tool";
    description = "Generates github pull requests";
    
    inputSchema = z.object({
        input: z.string().describe("what change are we making?")
    });

    async execute(input: z.infer<typeof this.inputSchema>) {
        return { result: `Processed: ${input.input}` };
    }
}
