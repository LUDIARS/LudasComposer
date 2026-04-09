#!/usr/bin/env node
/**
 * dev-bg.mjs — バックグラウンドで npm run dev を起動し、PID ファイルを書き出す。
 *
 * Usage:
 *   node scripts/dev-bg.mjs        # 起動 (up)
 *   node scripts/dev-bg.mjs stop   # 停止 (down)
 *   node scripts/dev-bg.mjs logs   # ログ表示
 */
import { spawn, execSync } from "node:child_process";
import {
  readFileSync, writeFileSync, unlinkSync, existsSync,
  openSync, statSync, createReadStream, watch,
} from "node:fs";

const PID_FILE = ".ars.pid";
const LOG_FILE = ".ars.log";
const command = process.argv[2] || "start";

function start() {
  const out = openSync(LOG_FILE, "a");
  const child = spawn("npm", ["run", "dev"], {
    detached: true,
    stdio: ["ignore", out, out],
    shell: true,
  });
  child.unref();
  writeFileSync(PID_FILE, String(child.pid));
  console.log(`Ars started (PID: ${child.pid}) — logs: npm run logs`);
}

function stop() {
  if (!existsSync(PID_FILE)) {
    console.log("No PID file found. Is Ars running?");
    return;
  }
  const pid = readFileSync(PID_FILE, "utf-8").trim();
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } else {
      process.kill(Number(pid), "SIGTERM");
    }
    console.log(`Stopped PID ${pid}`);
  } catch {
    console.log(`Process ${pid} not found (already stopped?)`);
  }
  try { unlinkSync(PID_FILE); } catch { /* ignore */ }
}

function logs() {
  if (!existsSync(LOG_FILE)) {
    console.log("No log file found. Start with: npm run up");
    return;
  }
  const stream = createReadStream(LOG_FILE, { encoding: "utf-8" });
  stream.pipe(process.stdout);
  stream.on("end", () => {
    let pos = statSync(LOG_FILE).size;
    watch(LOG_FILE, () => {
      const newSize = statSync(LOG_FILE).size;
      if (newSize > pos) {
        const s = createReadStream(LOG_FILE, { start: pos, encoding: "utf-8" });
        s.pipe(process.stdout, { end: false });
        pos = newSize;
      }
    });
  });
}

switch (command) {
  case "start": start(); break;
  case "stop": stop(); break;
  case "logs": logs(); break;
  default: console.log("Usage: node scripts/dev-bg.mjs [start|stop|logs]");
}
