import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const stages = [
  {
    name: "Unit Tests",
    args: ["run", "test:unit"],
  },
  {
    name: "Production Build",
    args: ["run", "build"],
  },
  {
    name: "End-to-End Regression Suite",
    args: ["run", "test:e2e:runner"],
  },
];

function runStage(stage) {
  return new Promise((resolve, reject) => {
    console.log(`\n==> ${stage.name}`);

    const child = spawn(npmCommand, stage.args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${stage.name} failed with exit code ${code ?? "unknown"}.`));
    });
  });
}

for (const stage of stages) {
  await runStage(stage);
}

console.log("\nAll tests passed.");
