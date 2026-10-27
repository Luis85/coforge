import { describe, expect, it } from "vitest";
import { parseCommand } from "../../../features/coforge/domain/commands";
import { viewerHelp } from "../../../features/coforge/domain/viewer-help";
import { defaultCommunityEnvironment } from "../../../features/coforge/domain/community-environment";
import { defaultEconomyRules } from "../../../features/coforge/domain/population";
describe("viewer system help", () => {
  it("offers onboarding and concise topic replies before registration, using community vocabulary", () => {
    expect(parseCommand("!help requests")).toEqual({
      type: "help",
      topic: "requests",
    });
    const environment = {
      ...defaultCommunityEnvironment(),
      actorName: "Citizen",
      currencyName: "crowns",
    };
    const replies = ["start", "requests", "progress", "community"].map(
      (topic) => viewerHelp(topic, environment, defaultEconomyRules()),
    );
    expect(replies[0]).toContain("!register");
    expect(replies[0]).toContain("Citizen");
    expect(replies[1]).toContain("!context");
    expect(replies[2]).toContain("streamer review");
    expect(replies[3]).toContain("crowns");
    for (const reply of replies)
      expect([...reply].length).toBeLessThanOrEqual(500);
    expect(parseCommand("!help unknown-topic").type).toBe("invalid");
  });
});
