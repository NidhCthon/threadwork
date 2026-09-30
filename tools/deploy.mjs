// Deploy Threadwork to the Lightsail Foundry box (SPEC.md section 9).
//
//   node tools/deploy.mjs               first install or a manifest change: restarts Foundry
//   node tools/deploy.mjs --no-restart  JS/CSS only: files are served from disk, players just reload
//   node tools/deploy.mjs --force       restart even though people are connected
//
// It ships the committed HEAD only (git archive), so uncommitted edits and the
// dev tools never reach the server. The pattern follows Ultra Silvam's deploy.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SSH_HOST = process.env.FOUNDRY_SSH ?? "foundry";
const MODULES = "/var/lib/foundryvtt/Data/modules";
const SERVICE = "foundryvtt";
const ID = "threadwork";
const SHIPPED = ["module.json", "LICENSE", "README.md", "THIRD_PARTY_NOTICES.md", "scripts", "styles"];

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const noRestart = args.has("--no-restart");
const force = args.has("--force");

const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8" }).trim();
const ssh = (script) => execFileSync("ssh", ["-o", "BatchMode=yes", SSH_HOST, script], { encoding: "utf8" });

const dirty = git("status", "--porcelain", "--", ...SHIPPED);
if (dirty) {
  console.error(`Uncommitted changes in shipped files; commit them first, since only HEAD is deployed:\n${dirty}`);
  process.exit(1);
}
const { version } = JSON.parse(git("show", "HEAD:module.json"));
const sha = git("rev-parse", "--short", "HEAD");

// A restart drops everyone at the table.
if (!noRestart) {
  const peers = ssh(`sudo ss -tnH state established '( sport = :443 )' | awk '{print $4}' | sed 's/:[0-9]*$//' | sort -u`)
    .split("\n").map((s) => s.trim()).filter(Boolean);
  if (peers.length && !force) {
    console.error(
      `${peers.length} connection(s) to Foundry right now:\n  ${peers.join("\n  ")}\n` +
      "Restarting drops them. Re-run with --force once you know that is fine, " +
      "or --no-restart if this deploy changes only scripts or styles."
    );
    process.exit(1);
  }
}

// scp reads a Windows drive letter as a remote host, so paths handed to it are
// relative and the working directory does the addressing.
const staging = resolve(root, ".deploy");
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
git("archive", "--format=tar.gz", `--prefix=${ID}/`, "-o", `.deploy/${ID}.tgz`, "HEAD", ...SHIPPED);
execFileSync("scp", ["-q", `${ID}.tgz`, `${SSH_HOST}:/tmp/${ID}.tgz`], { cwd: staging, stdio: "inherit" });

const remote = `
set -euo pipefail
STAGE=/tmp/${ID}.staging
DEST=${MODULES}/${ID}
rm -rf "$STAGE" && mkdir -p "$STAGE"
tar -xzf /tmp/${ID}.tgz -C "$STAGE"
${noRestart ? "" : `systemctl stop ${SERVICE}`}
# Never leave a rollback copy inside Data/modules: Foundry treats every
# directory there as a module and logs it as invalid on each startup.
rm -rf /tmp/${ID}.previous
if [ -d "$DEST" ]; then mv "$DEST" /tmp/${ID}.previous; fi
cp -a "$STAGE/${ID}" "$DEST"
chown -R --reference=/var/lib/foundryvtt "$DEST"
rm -rf "$STAGE" /tmp/${ID}.tgz
${noRestart ? "" : `systemctl start ${SERVICE}`}
echo "deployed: $(grep -m1 '"version"' "$DEST/module.json")"
`;
console.log(ssh(`sudo bash -s <<'REMOTE_EOF'\n${remote}\nREMOTE_EOF`).trim());
rmSync(staging, { recursive: true, force: true });

if (!noRestart) {
  // Give Foundry time to come up and relaunch its world, then show anything alarming.
  execFileSync(process.execPath, ["-e", "setTimeout(() => {}, 15000)"]);
  const log = ssh(`sudo journalctl -u ${SERVICE} --since '-1 min' --no-pager | grep -iE 'error|warn|invalid|${ID}' | tail -20 || true`).trim();
  console.log(log ? `Recent log lines worth a look:\n${log}` : "No errors or warnings in the log since the restart.");
}
console.log(`Threadwork ${version} (${sha}) is on ${SSH_HOST}${noRestart ? "; players need to reload" : ""}.`);
