import { Rpc } from "@opencode/plugin/rpc"

export const Badge = Rpc.define({
  id: "pr-badge",
  methods: {
    current: {
      input: { type: "object", additionalProperties: false },
      output: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            properties: { number: { type: "integer" }, url: { type: "string" } },
            required: ["number", "url"],
            additionalProperties: false,
          },
        ],
      },
    },
  },
  events: {},
})
