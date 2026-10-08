// Deploy Threadwork to the Lightsail Foundry box (SPEC.md section 9).
//
//   node tools/deploy.mjs                 install now and restart Foundry (first install, manifest changes)
//   node tools/deploy.mjs --no-restart    install JS/CSS changes in place; players just reload
//   node tools/deploy.mjs --publish-only  only publish to the module server; update from Foundry's Setup
//   node tools/deploy.mjs --force         restart even though people are connected
//
// Every deploy also publishes the release to the box's private module server
// (Caddy on 127.0.0.1:8088, /var/www/foundry-modules/threadwork/) as
// module.json plus module-<version>.zip, the layout the Exalted charms module
// uses. The copy that goes there and into Data/modules has its manifest and
// download pointed at that server, so Foundry's own update check finds new
// releases; the repo's module.json keeps its public GitHub addresses.
//
// It ships the committed HEAD only (git archive), so uncommitted edits and the
// dev tools never reach the server. The pattern follows Ultra Silvam's deploy.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SSH_HOST = process.env.FOUNDRY_SSH ?? "foundry";
const MODULES = "/var/lib/foundryvtt/Data/modules";
const PUBLISH = "/var/www/foundry-modules";
const MODULE_SERVER = "http://127.0.0.1:8088";
const SERVICE = "foundryvtt";
const ID = "threadwork";
const SHIPPED = ["module.json", "LICENSE", "README.md", "THIRD_PARTY_NOTICES.md", "scripts", "styles"];

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const publishOnly = args.has("--publish-only");
const noRestart = publishOnly || args.has("--no-restart");
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
PUB=${PUBLISH}/${ID}
rm -rf "$STAGE" && mkdir -p "$STAGE"
tar --warning=no-timestamp -xzf /tmp/${ID}.tgz -C "$STAGE"

# Point this copy's updates at the private module server.
python3 - "$STAGE/${ID}/module.json" "${MODULE_SERVER}/${ID}" "${version}" <<'PY'
import json, sys
path, base, version = sys.argv[1:]
with open(path, encoding="utf-8") as f:
    manifest = json.load(f)
manifest["manifest"] = f"{base}/module.json"
manifest["download"] = f"{base}/module-{version}.zip"
with open(path, "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)
    f.write("\\n")
PY

# Publish: the zip has the module's files at its root, like the charms zips.
mkdir -p "$PUB"
(cd "$STAGE/${ID}" && python3 -m zipfile -c "$PUB/module-${version}.zip" .)
cp "$STAGE/${ID}/module.json" "$PUB/module.json"
chmod -R a+rX "$PUB"
echo "published: ${MODULE_SERVER}/${ID}/module.json -> ${version}"

${publishOnly ? "" : `
${noRestart ? "" : `systemctl stop ${SERVICE}`}
# Never leave a rollback copy inside Data/modules: Foundry treats every
# directory there as a module and logs it as invalid on each startup.
rm -rf /tmp/${ID}.previous
if [ -d "$DEST" ]; then mv "$DEST" /tmp/${ID}.previous; fi
cp -a "$STAGE/${ID}" "$DEST"
chown -R --reference=/var/lib/foundryvtt "$DEST"
${noRestart ? "" : `systemctl start ${SERVICE}`}
echo "installed: $(grep -m1 '"version"' "$DEST/module.json")"
`}
rm -rf "$STAGE" /tmp/${ID}.tgz
`;
console.log(ssh(`sudo bash -s <<'REMOTE_EOF'\n${remote}\nREMOTE_EOF`).trim());
rmSync(staging, { recursive: true, force: true });

if (!noRestart) {
  // Give Foundry time to come up and relaunch its world, then show anything alarming.
  execFileSync(process.execPath, ["-e", "setTimeout(() => {}, 15000)"]);
  const log = ssh(`sudo journalctl -u ${SERVICE} --since '-1 min' --no-pager | grep -iE 'error|warn|invalid|${ID}' | tail -20 || true`).trim();
  console.log(log ? `Recent log lines worth a look:\n${log}` : "No errors or warnings in the log since the restart.");
}
const next = publishOnly
  ? "Install it from Foundry's Setup screen (Update)."
  : noRestart ? "Players need to reload; a changed manifest takes effect at Foundry's next restart (the nightly backup restarts it)." : "";
console.log(`Threadwork ${version} (${sha}) is on ${SSH_HOST}. ${next}`.trim());
