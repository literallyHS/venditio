import { NextRequest } from "next/server";
import { getAgent, recreateAgent } from "../../../../server/agent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Strategy = "low" | "medium" | "high";
type ControlBody = {
  action?: string;
  options?: { startingCash?: number; strategy?: Strategy };
};

export async function POST(req: NextRequest) {
  const agent = getAgent();
  const body = (await req.json().catch(() => ({}))) as ControlBody;
  const action = (body?.action as string)?.toLowerCase();
  if (action === "start") {
    await agent.start();
    return Response.json({ ok: true, status: "started" });
  }
  if (action === "stop") {
    agent.stop();
    return Response.json({ ok: true, status: "stopped" });
  }
  if (action === "reset") {
    agent.reset(body?.options ?? {});
    if (body?.options?.strategy) agent.setStrategy(body.options.strategy);
    return Response.json({ ok: true, status: "reset" });
  }
  if (action === "recreate" || action === "reload_symbols") {
    const wasRunning = agent.getState().isRunning;
    const strategy = agent.getState().strategy;
    const startingCash =
      body?.options?.startingCash ?? agent.getState().cashBalance;
    recreateAgent({
      strategy,
      startingCash,
      resumeRunning: wasRunning,
    });
    return Response.json({ ok: true, status: "recreated" });
  }
  if (action === "sell_all" || action === "liquidate") {
    agent.liquidateAll();
    return Response.json({ ok: true, status: "liquidated" });
  }
  if (action === "set_strategy") {
    const s = body?.options?.strategy;
    if (s === "low" || s === "medium" || s === "high") {
      agent.setStrategy(s);
      return Response.json({ ok: true, status: "strategy_set", strategy: s });
    }
    return Response.json(
      { ok: false, error: "invalid_strategy" },
      { status: 400 }
    );
  }
  return Response.json({ ok: false, error: "invalid_action" }, { status: 400 });
}
