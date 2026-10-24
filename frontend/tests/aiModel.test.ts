import OpenAI from "openai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { aiModel, jsonCompletion } from "../src/lib/server/aiModel";

const ok = (content: string) => ({ choices: [{ message: { content } }] });
const client = (create: (p: Record<string, unknown>) => unknown) => ({ chat: { completions: { create: vi.fn(create) } } }) as never as Pick<OpenAI, "chat"> & { chat: { completions: { create: ReturnType<typeof vi.fn> } } };
const msgs = [{ role: "user" as const, content: "hi" }];

afterEach(() => {
  delete process.env.OPENAI_MODEL;
  delete process.env.OPENAI_REASONING_EFFORT;
});

describe("jsonCompletion", () => {
  it("uses gpt-6-luna in JSON mode with no reasoning and no temperature by default", async () => {
    const c = client(async () => ok("{}"));
    expect(await jsonCompletion(c, msgs, { temperature: 0.7 })).toBe("{}");
    const params = c.chat.completions.create.mock.calls[0][0];
    expect(params).toMatchObject({ model: "gpt-6-luna", reasoning_effort: "none", response_format: { type: "json_object" } });
    expect(params).not.toHaveProperty("temperature");
  });

  it("can be switched in the environment, and older models keep their temperature", async () => {
    process.env.OPENAI_MODEL = "gpt-4o";
    expect(aiModel()).toBe("gpt-4o");
    const c = client(async () => ok("{}"));
    await jsonCompletion(c, msgs, { temperature: 0.7 });
    const params = c.chat.completions.create.mock.calls[0][0];
    expect(params).toMatchObject({ model: "gpt-4o", temperature: 0.7 });
    expect(params).not.toHaveProperty("reasoning_effort");
    process.env.OPENAI_MODEL = "gpt-6-luna";
    process.env.OPENAI_REASONING_EFFORT = "low";
    await jsonCompletion(c, msgs);
    expect(c.chat.completions.create.mock.calls[1][0].reasoning_effort).toBe("low");
  });

  it("retries once on gpt-4o when OpenAI rejects the model, but not for other failures", async () => {
    const rejected = new OpenAI.BadRequestError(400, { message: "model not found" }, "model not found", new Headers());
    const c = client(async (p) => { if (p.model === "gpt-6-luna") throw rejected; return ok('{"a":1}'); });
    expect(await jsonCompletion(c, msgs)).toBe('{"a":1}');
    expect(c.chat.completions.create.mock.calls.map((call) => call[0].model)).toEqual(["gpt-6-luna", "gpt-4o"]);

    const down = client(async () => { throw new Error("network down"); });
    await expect(jsonCompletion(down, msgs)).rejects.toThrow("network down");
    expect(down.chat.completions.create).toHaveBeenCalledTimes(1);
  });
});
