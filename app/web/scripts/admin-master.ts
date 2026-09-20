import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { prisma } from "../src/lib/db";
import { bootstrapMaster, disableMaster, resetMasterPassword } from "../src/lib/admin-auth/master";

const action = process.argv[2];
async function main() {
  if (!["create", "reset", "disable"].includes(action ?? "")) {
    throw new Error("Usage: pnpm admin:master <create|reset|disable>");
  }
  if (!process.stdin.isTTY) throw new Error("마스터 관리는 대화형 터미널에서 실행해 주세요");
  const database = new URL(process.env.DATABASE_URL ?? "");
  process.stdout.write(`대상 DB: ${database.hostname}${database.pathname}\n`);
  let muted = false;
  const output = new Writable({ write(chunk, encoding, done) {
    if (!muted) process.stdout.write(chunk, encoding);
    done();
  } });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  const password = async (label: string) => {
    process.stdout.write(label);
    muted = true;
    try { return await rl.question(""); }
    finally { muted = false; process.stdout.write("\n"); }
  };
  try {
    if (action === "create" && await prisma.adminUser.findUnique({ where: { id: "master" } })) {
      process.stdout.write("마스터 계정이 이미 있습니다. 변경하지 않았습니다.\n");
      return;
    }
    if (action === "disable") {
      if (await rl.question("마스터를 비활성화하고 모든 관리자 세션을 종료합니다. DISABLE 입력: ") !== "DISABLE") return;
      await disableMaster();
      process.stdout.write("마스터를 비활성화했습니다.\n");
      return;
    }
    const username = action === "create" ? await rl.question("마스터 아이디 (영문·숫자·_, 3~30자): ") : "";
    const nextPassword = await password("비밀번호 (12~128자, 입력 숨김): ");
    if (nextPassword !== await password("비밀번호 확인: ")) throw new Error("비밀번호가 일치하지 않습니다");
    if (action === "create") {
      const created = await bootstrapMaster(username, nextPassword);
      process.stdout.write(created ? "마스터 계정을 생성했습니다. /admin/login에서 로그인하세요.\n" : "이미 생성된 마스터를 유지했습니다.\n");
    } else {
      if (await rl.question("비밀번호 교체와 모든 관리자 세션 종료를 진행합니다. RESET 입력: ") !== "RESET") return;
      await resetMasterPassword(nextPassword);
      process.stdout.write("비밀번호를 교체하고 마스터를 활성화했습니다. 이전 세션은 모두 종료했습니다.\n");
    }
  } finally { rl.close(); }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "마스터 계정 관리를 완료하지 못했습니다");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
