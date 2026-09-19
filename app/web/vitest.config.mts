import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));
const serverOnlyStub = fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url));

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    // 통합 테스트가 같은 DB 를 쓰므로 파일 간 병렬 실행을 끈다
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": src,
      // `import "server-only"` 는 RSC 밖에서 throw 하므로 테스트에서는 빈 모듈로 대체
      "server-only": serverOnlyStub,
    },
  },
});
