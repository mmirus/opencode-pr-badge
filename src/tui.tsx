import { Plugin, usePlugin } from "@opencode/plugin/tui"
import { createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js"
import { type PullRequest } from "./model"
import { createPoller } from "./poll"
import { Badge } from "./rpc"

function PullRequestBadge(props: { sessionID?: string }) {
  const context = usePlugin()
  const [pr, setPr] = createSignal<PullRequest | null>(null)
  const location = createMemo(() =>
    props.sessionID
      ? context.data.session.get(props.sessionID)?.location
      : (context.location ?? context.data.location.default()),
  )

  createEffect(() => {
    const target = location()
    if (target) context.data.location.vcs.info(target)?.branch.current
    setPr(null)
    if (!target) return
    const poller = createPoller(
      (signal) =>
        context.client.rpc(Badge).current(
          {},
          {
            location: target,
            signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
          },
        ),
      setPr,
    )
    void poller.refresh()
    const timer = setInterval(() => void poller.refresh(), 5_000)
    onCleanup(() => {
      clearInterval(timer)
      poller.stop()
    })
  })

  return (
    <Show when={pr()}>
      {(value) => (
        <text fg={context.theme.markdown.link} flexShrink={0} wrapMode="none">
          <a href={value().url}>#{value().number}</a>
        </text>
      )}
    </Show>
  )
}

export default Plugin.define({
  id: "pr-badge.tui",
  setup(context) {
    return context.ui.slot({
      append: "prompt.footer.status",
      render: (input) => <PullRequestBadge sessionID={input.sessionID} />,
    })
  },
})
