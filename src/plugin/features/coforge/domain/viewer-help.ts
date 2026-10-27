import type { CommunityEnvironment } from "./community-environment";
import type { EconomyRules } from "./population";
export type ViewerHelpTopic = "start" | "requests" | "progress" | "community";
export const DEFAULT_VIEWER_HELP =
  "Welcome to The Hood: we build a game together with chat and AI. Your role: Agent. Join with !register, then use !projects to choose a game. Suggest features, report bugs, add context and vote. Ideas go through screening, scoring, planning, AI building and streamer review. More: !help requests · !help progress · !help community.";
export function viewerHelp(
  topic: string,
  environment: CommunityEnvironment,
  rules: EconomyRules,
): string {
  if (topic === "requests")
    return "Register first with !register. Find project IDs with !projects. Use !request CFP-001 <feature> (5-minute cooldown), !bug CFP-001 <bug>, or !context CF-101 <extra details>. Context appends to an open request and sends it back to screening. Keep the original request ID for !vote and !status. CFP-001 is an example; use your streamer’s project ID.";
  if (topic === "progress")
    return "Requests move through screening → RICE scoring → planning → AI building → streamer review. Use !status CF-101 to track a request and !vote CF-101 to support it (one vote per viewer). Screening is not acceptance; the streamer reviews changes before accepting them. New !context sends an open request back to screening. Nothing in chat automatically merges or releases the game.";
  if (topic === "community")
    return `${environment.actorName} rewards: each live chat-presence minute earns ${rules.coinsPerMinute} ${environment.currencyName} + ${rules.xpPerMinute} XP. Screened feature: ${rules.screenedXp} XP + ${rules.screenedReputation} reputation. Accepted: ${rules.acceptedXp} XP + ${rules.acceptedReputation} reputation. !me: stats · !ranks: names and XP thresholds. Chat presence does not verify video watch time.`;
  return DEFAULT_VIEWER_HELP.replace(
    "Your role: Agent.",
    `Your role: ${environment.actorName}.`,
  );
}
export function helpTopic(input: string): ViewerHelpTopic | null {
  const aliases: Record<string, ViewerHelpTopic> = {
    "1": "start",
    "2": "requests",
    "3": "progress",
    "4": "community",
    start: "start",
    system: "start",
    requests: "requests",
    context: "requests",
    progress: "progress",
    community: "community",
    ranks: "community",
  };
  return aliases[input.toLowerCase()] ?? null;
}
