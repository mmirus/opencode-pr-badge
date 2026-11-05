import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { commandRunner, createLookup, type Run } from "../src/lookup"
import { parsePullRequest } from "../src/model"

const pr = { number: 123, url: "https://github.com/example/project/pull/123" }
const signal = () => new AbortController().signal

function fixture() {
  const calls: { command: string; args: string[] }[] = []
  const state = { branch: "feature", response: JSON.stringify([{ ...pr, headRefName: "feature" }]), fail: false }
  const run: Run = async (command, args) => {
    calls.push({ command, args })
    if (command === "git") return state.branch
    if (state.fail) throw new Error("GitHub unavailable")
    return state.response
  }
  return { calls, state, run }
}

test("looks up the exact branch with argument arrays and caches GitHub results", async () => {
  const f = fixture()
  let time = 0
  const lookup = createLookup(f.run, () => time)
  expect(await lookup(signal())).toEqual(pr)
  expect(f.calls[1]).toEqual({
    command: "gh",
    args: ["pr", "list", "--head", "feature", "--state", "open", "--limit", "1", "--json", "number,url,headRefName"],
  })
  expect(await lookup(signal())).toEqual(pr)
  expect(f.calls.filter((call) => call.command === "gh")).toHaveLength(1)
  time = 60_000
  await lookup(signal())
  expect(f.calls.filter((call) => call.command === "gh")).toHaveLength(2)
})

test("a branch change bypasses the cache and hides the old PR", async () => {
  const f = fixture()
  const lookup = createLookup(f.run)
  await lookup(signal())
  f.state.branch = "other"
  expect(await lookup(signal())).toBeNull()
  expect(f.calls.filter((call) => call.command === "gh")).toHaveLength(2)
})

test("does not publish a lookup completed after a checkout", async () => {
  const f = fixture()
  const lookup = createLookup(async (command, args, signal) => {
    const result = await f.run(command, args, signal)
    if (command === "gh") f.state.branch = "other"
    return result
  })
  expect(await lookup(signal())).toBeNull()
})

test.each(["[]", "not JSON", "{}", '[{"number":123,"url":"javascript:alert(1)","headRefName":"feature"}]'])(
  "hides missing or malformed results: %s",
  async (response) => {
    const f = fixture()
    f.state.response = response
    expect(await createLookup(f.run)(signal())).toBeNull()
  },
)

test("caches failures and retries after a minute", async () => {
  const f = fixture()
  let time = 0
  const lookup = createLookup(f.run, () => time)
  f.state.fail = true
  expect(await lookup(signal())).toBeNull()
  expect(await lookup(signal())).toBeNull()
  expect(f.calls.filter((call) => call.command === "gh")).toHaveLength(1)
  f.state.fail = false
  time = 60_000
  expect(await lookup(signal())).toEqual(pr)
})

test("non-repositories and detached HEAD do not invoke GitHub", async () => {
  let calls = 0
  const lookup = createLookup(async () => {
    calls++
    throw new Error("not a branch")
  })
  expect(await lookup(signal())).toBeNull()
  expect(calls).toBe(1)
})

test("cancelled lookups do not publish or cache a PR", async () => {
  const f = fixture()
  const controller = new AbortController()
  const lookup = createLookup(async (command, args, signal) => {
    const result = await f.run(command, args, signal)
    if (command === "gh") controller.abort()
    return result
  })
  expect(await lookup(controller.signal)).toBeNull()
})

test("command runner respects cwd and reports failures", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pr-badge-test-"))
  try {
    const run = commandRunner(directory)
    expect((await run(process.execPath, ["-e", "console.log(process.cwd())"], signal())).trim()).toBe(directory)
    await expect(run(process.execPath, ["-e", "process.exit(1)"], signal())).rejects.toThrow()
    const controller = new AbortController()
    controller.abort()
    await expect(run(process.execPath, ["-e", "setInterval(() => {}, 1000)"], controller.signal)).rejects.toThrow()
  } finally {
    await rm(directory, { recursive: true })
  }
})

test("accepts enterprise URLs but rejects credentials, invalid IDs, and unsafe links", () => {
  expect(parsePullRequest({ number: 1, url: "https://github.example.com/team/repo/pull/1" })).not.toBeNull()
  for (const value of [
    null,
    {},
    { ...pr, number: -1 },
    { ...pr, number: "123" },
    { ...pr, url: "http://github.com/example/project/pull/123" },
    { ...pr, url: "https://user:password@github.com/example/project/pull/123" },
    { ...pr, url: "https://github.com/example/project/pull/456" },
  ]) {
    expect(parsePullRequest(value)).toBeNull()
  }
})
