import { list, number, oneOf, shape, text } from "./check";

export interface ExecutionLocalAction {
  id: string;
  name: string;
  kind: "message";
  beforeCursor: number;
  order: number;
  instructions: string;
  purpose: "information" | "request";
  recipientId: string;
  body: string;
  inputInvocationIds: string[];
}
const id = text({ min: 1, max: 200, pattern: /^[\w.:/-]+$/ });
export const executionLocalActionCheck = shape(
  {
    id,
    name: text({ min: 1, max: 100 }),
    kind: oneOf(["message"] as const),
    beforeCursor: number({ min: 0, max: 100, integer: true }),
    order: number({ min: 0, max: 40, integer: true }),
    instructions: text({ max: 16000 }),
    purpose: oneOf(["information", "request"] as const),
    recipientId: id,
    body: text({ min: 1, max: 16000 }),
    inputInvocationIds: list(id, { max: 100 }),
  },
  { strict: true },
);
