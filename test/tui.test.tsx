import { expect, test } from "bun:test"
import { PluginContextProvider, type Plugin } from "@opencode/plugin/tui"
import { testRender, type JSX } from "@opentui/solid"
import { createSignal } from "solid-js"
import plugin from "../src/tui"

test("renders a short hyperlink, targets the session location, and clears on checkout", async () => {
  let render!: (input: { sessionID?: string }) => JSX.Element
  let requestLocation: unknown
  const [branch, setBranch] = createSignal("feature")
  let response: unknown = { number: 123, url: "https://github.com/example/project/pull/123" }
  const [directory, setDirectory] = createSignal("/example/project")
  const context = {
    data: {
      session: { get: () => ({ location: { directory: directory() } }) },
      location: { vcs: { info: () => ({ branch: { current: branch() } }) } },
    },
    client: {
      rpc: () => ({
        current: async (_input: unknown, options: { location: unknown }) => {
          requestLocation = options.location
          return response
        },
      }),
    },
    theme: { markdown: { link: "#00aaff" } },
    ui: {
      slot: (claim: { append: string; render: typeof render }) => {
        expect(claim.append).toBe("prompt.footer.status")
        render = claim.render
        return () => {}
      },
    },
  } as unknown as Plugin.Context
  await plugin.setup(context)
  await using setup = await testRender(
    () => <PluginContextProvider value={context}>{render({ sessionID: "session" })}</PluginContextProvider>,
    { width: 30, height: 3 },
  )
  await setup.waitForFrame((frame) => frame.includes("#123"))
  expect(requestLocation).toEqual({ directory: directory() })
  expect(setup.captureCharFrame()).not.toContain("github.com")
  expect(setup.renderer.getLinkAt(0, 0)).toBe("https://github.com/example/project/pull/123")
  response = null
  setBranch("other")
  await setup.waitForFrame((frame) => !frame.includes("#123"))
  let resolve!: (value: unknown) => void
  response = new Promise((done) => {
    resolve = done
  })
  setBranch("pending")
  await setup.flush()
  response = { number: 456, url: "https://github.com/example/other/pull/456" }
  setDirectory("/example/other")
  await setup.waitForFrame((frame) => frame.includes("#456"))
  expect(requestLocation).toEqual({ directory: "/example/other" })
  resolve({ number: 123, url: "https://github.com/example/project/pull/123" })
  await setup.flush()
  expect(setup.captureCharFrame()).toContain("#456")
  expect(setup.captureCharFrame()).not.toContain("#123")
})
