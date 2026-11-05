import { expect, test } from "bun:test"
import { createPoller } from "../src/poll"

const pr = { number: 123, url: "https://github.com/example/project/pull/123" }

test("publishes a badge and clears the badge on errors", async () => {
  const values: unknown[] = []
  let fail = false
  const poller = createPoller(
    async () => {
      if (fail) throw new Error("disconnected")
      return pr
    },
    (value) => values.push(value),
  )
  await poller.refresh()
  fail = true
  await poller.refresh()
  expect(values).toEqual([pr, null])
  poller.stop()
})

test("prevents overlapping requests and discards results after disposal", async () => {
  const values: unknown[] = []
  let resolve!: (value: unknown) => void
  let signal!: AbortSignal
  let calls = 0
  const poller = createPoller(
    (input) => {
      calls++
      signal = input
      return new Promise((done) => {
        resolve = done
      })
    },
    (value) => values.push(value),
  )
  const pending = poller.refresh()
  await poller.refresh()
  expect(calls).toBe(1)
  poller.stop()
  expect(signal.aborted).toBe(true)
  resolve(pr)
  await pending
  await poller.refresh()
  expect(values).toEqual([])
  expect(calls).toBe(1)
})
