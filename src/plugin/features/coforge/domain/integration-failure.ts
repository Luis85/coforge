export type IntegrationFailureKind =
  "authorization" | "permission" | "rate" | "service" | "uncertain" | "delivery" | "validation";
/** Adapters supply a safe explanation and a classified outcome; raw provider causes stay outside application code. */
export class IntegrationFailure extends Error {
  constructor(
    readonly kind: IntegrationFailureKind,
    message: string,
  ) {
    super(message);
    this.name = "IntegrationFailure";
  }
}
