import type { CommunityEnvironment } from "./community-environment";
import type { EconomyRules } from "./population";
export type ViewerHelpTopic = "start" | "requests" | "progress" | "community";
export const DEFAULT_VIEWER_HELP =
  "Welcome to The Hood: we build a game together with chat and AI. Your role: Agent. Join with !register, then use !projects to choose a game. Suggest features, report bugs, add context and vote. Ideas go through screening, scoring, planning, AI building and streamer review. Rewards: !shop · !odds <lootbox-id> · !redeem <reward-id> · !lootbox <id>. Command fees and rewards are configured by the streamer. More: !help requests · !help progress · !help community.";
export function viewerHelp(
  topic: string,
  environment: CommunityEnvironment,
  rules: EconomyRules,
): string {
  if (topic === "requests")
    return "Register first with !register. Find public project IDs with !projects. Use !request <project-id> <feature> (5-minute cooldown), !bug <project-id> <bug>, or !context <request-id> <details>. Context appends to an open request and returns it to screening. Keep the request ID for !vote and !status. Only the streamer's public projects accept viewer requests.";
  if (topic === "progress")
    return "Public requests move through screening → RICE scoring → planning → AI building → streamer review. Use !status <request-id> to track a request and !vote <request-id> to support it (one vote per viewer). Screening is not acceptance; the streamer reviews changes before accepting them. New !context returns an open request to screening. Nothing in chat automatically merges or releases the game.";
  if (topic === "community")
    return `${environment.actorName} rewards: each observed live chat-presence minute earns ${rules.coinsPerMinute} ${environment.currencyName} + ${rules.xpPerMinute} registered-only XP. Currency can be earned before registration; subscriber total rates may differ. !shop lists item + command fees; !odds <id> shows weighted outcomes. Screened feature: ${rules.screenedXp} XP + ${rules.screenedReputation} reputation. Accepted: ${rules.acceptedXp} XP + ${rules.acceptedReputation} reputation. !me: stats · !ranks: names and XP thresholds. Chat presence does not verify video watch time.`;
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
