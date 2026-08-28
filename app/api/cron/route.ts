import { NextResponse } from "next/server";
import { runScheduledFetch } from "@/lib/news/scheduler";

export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  // Deny access unless CRON_SECRET is set AND matches the auth header
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runScheduledFetch();

    return NextResponse.json({
      message: "Scheduled fetch completed",
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      { error: "Cron job failed", detail: String(error) },
      { status: 500 }
    );
  }
}
