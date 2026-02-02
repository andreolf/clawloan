import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const skillPath = path.join(process.cwd(), "..", "skills", "clawloan", "SKILL.md");
    const content = fs.readFileSync(skillPath, "utf-8");
    
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
      },
    });
  } catch {
    return NextResponse.json({ error: "Skill file not found" }, { status: 404 });
  }
}
