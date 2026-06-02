import fs from "fs";
import path from "path";

const START_FILE = path.join(process.cwd(), ".longrun_start");

export function startClock() {
  const startTime = Date.now();
  fs.writeFileSync(START_FILE, String(startTime), "utf8");
  console.log(`[TIME-GUARD] Clock started at ${new Date(startTime).toISOString()}`);
  console.log(`[TIME-GUARD] 200-minute session begins NOW!`);
  return startTime;
}

export function elapsedMinutes(): number {
  if (!fs.existsSync(START_FILE)) {
    return 0;
  }
  const startTime = Number(fs.readFileSync(START_FILE, "utf8") || 0);
  const elapsed = (Date.now() - startTime) / 60000;
  return elapsed;
}

export function elapsedTime(): { minutes: number; seconds: number; formatted: string } {
  const totalMinutes = elapsedMinutes();
  const minutes = Math.floor(totalMinutes);
  const seconds = Math.floor((totalMinutes - minutes) * 60);
  const formatted = `${minutes}m ${seconds}s`;
  return { minutes, seconds, formatted };
}

export function stopClock() {
  if (fs.existsSync(START_FILE)) {
    const elapsed = elapsedMinutes();
    fs.unlinkSync(START_FILE);
    console.log(`[TIME-GUARD] Clock stopped after ${elapsed.toFixed(2)} minutes`);
  }
}

export function getStatus(): string {
  const elapsed = elapsedMinutes();
  const remaining = Math.max(0, 200 - elapsed);
  return `Elapsed: ${elapsed.toFixed(1)}m | Remaining: ${remaining.toFixed(1)}m | Target: 200m`;
}

const command = process.argv[2];

if (command === "start") {
  startClock();
} else if (command === "status") {
  console.log(getStatus());
} else if (command === "elapsed") {
  console.log(elapsedMinutes().toFixed(2));
} else if (command === "stop") {
  stopClock();
} else if (command) {
  console.log("Usage: tsx scripts/time-guard.ts [start|status|elapsed|stop]");
}
