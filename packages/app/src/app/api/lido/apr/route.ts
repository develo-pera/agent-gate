import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch(
      "https://eth-api.lido.fi/v1/protocol/steth/apr/last",
      {
        next: { revalidate: 300 }, // cache 5 minutes
      },
    );
    if (!res.ok) {
      return NextResponse.json({ apr: 3.5, source: "fallback" });
    }
    const data = await res.json();
    return NextResponse.json({
      apr: data.data?.apr || 3.5,
      source: "lido",
    });
  } catch {
    return NextResponse.json({ apr: 3.5, source: "fallback" });
  }
}
