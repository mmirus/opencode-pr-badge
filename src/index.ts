import { Plugin } from "@opencode/plugin"
import { commandRunner, createLookup } from "./lookup"
import { Badge } from "./rpc"

export default Plugin.define({
  id: "pr-badge",
  async setup(context) {
    const lookup = createLookup(commandRunner(context.location.directory))
    const lifetime = new AbortController()
    const registration = await context.rpc.register(Badge, {
      current: (_input, call) => lookup(AbortSignal.any([lifetime.signal, call.signal])),
    })
    return async () => {
      lifetime.abort()
      await registration.dispose()
    }
  },
})
