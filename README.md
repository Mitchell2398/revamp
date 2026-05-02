# Revamp Business Website Finder

Revamp is a Lua AI Agent that finds businesses in a target area and returns their website URLs using Foursquare Places.

## 🚀 Quick Start

```bash
# 1. Configure Foursquare Places
export FOURSQUARE_API_KEY="your-api-key"

# 2. Test your agent (sandbox mode)
lua chat

# Example prompt:
# Find 10 dentists in Galway and list their website URLs

# 3. Deploy to production
lua push all --force --auto-deploy
```

## 📁 Project Structure

```
your-project/
├── src/
│   └── index.ts          # Your agent configuration
├── lua.skill.yaml        # State manifest (IDs + versions only; auto-managed)
├── package.json          # Dependencies
└── tsconfig.json         # TypeScript config
```

## Business Finder Tool

The agent includes a `business-finder` skill with a `find_business_websites` tool. It accepts:

- `businessQuery`: the business type or search query, such as `dentists` or `accountants`
- `area`: the city, neighborhood, postcode, or region to search
- `limit`: optional result count, up to 50
- `includeBusinessesWithoutWebsite`: optional flag for including businesses that do not have a returned website URL

The tool returns normalized business results with names, website URLs, addresses, phone numbers, Foursquare URLs, ratings, and place IDs when available.

## 🛠️ Creating Additional Tools

### 1. Create the tool file

```bash
mkdir -p src/skills/tools
```

Create `src/skills/tools/GreetingTool.ts`:

```typescript
import { LuaTool } from "lua-cli";
import { z } from "zod";

export default class GreetingTool implements LuaTool {
    name = "greet_user";
    description = "Generate a personalized greeting";
    
    inputSchema = z.object({
        name: z.string().describe("The name of the person to greet")
    });

    async execute(input: z.infer<typeof this.inputSchema>) {
        return { 
            greeting: `Hello, ${input.name}! How can I help you today?` 
        };
    }
}
```

### 2. Create a skill to group your tools

Create `src/skills/greeting.skill.ts`:

```typescript
import { LuaSkill } from "lua-cli";
import GreetingTool from "./tools/GreetingTool";

const greetingSkill = new LuaSkill({
    name: "greeting-skill",
    description: "Tools for greeting users",
    context: "Use these tools when the user wants to be greeted",
    tools: [new GreetingTool()],
});

export default greetingSkill;
```

### 3. Add the skill to your agent

Update `src/index.ts`:

```typescript
import { LuaAgent } from "lua-cli";
import greetingSkill from "./skills/greeting.skill";

const agent = new LuaAgent({
    name: `My Agent`,
    persona: `You are a friendly assistant.`,
    skills: [greetingSkill],
});
```

### 4. Test it!

```bash
lua test      # Test the tool directly
lua chat      # Chat with your agent
```

## 📖 Essential Commands

| Command | Purpose |
|---------|---------|
| `lua test` | Test individual tools interactively |
| `lua chat` | Interactive chat with your agent |
| `lua compile` | Compile your code |
| `lua push` | Upload to server |
| `lua deploy` | Deploy to production |
| `lua logs` | View execution logs |

## 🎯 Want Examples?

Initialize a new project with example code:

```bash
mkdir my-project-with-examples && cd my-project-with-examples
lua init --with-examples
```

This includes:
- ✅ 30+ example tools
- ✅ Example webhooks (HTTP endpoints)
- ✅ Example scheduled jobs
- ✅ Example pre/post processors
- ✅ Working e-commerce flow (products, baskets, orders)

## 📚 Learn More

- **Documentation:** https://docs.heylua.ai
- **Examples:** https://docs.heylua.ai/examples
- **API Reference:** https://docs.heylua.ai/api

## 💡 Tips

1. **Use Zod schemas** - They provide type safety and help the AI understand your tool inputs
2. **Write clear descriptions** - The AI reads these to decide when to use your tools
3. **Test in sandbox first** - Use `lua chat` with sandbox mode before deploying
4. **Keep tools focused** - Each tool should do one thing well

---

*Built with [Lua CLI](https://www.npmjs.com/package/lua-cli)*
