#!/usr/bin/env node
/**
 * Bump extension version in package.json, package-lock.json, and manifest.json.
 * Usage: node scripts/bump-version.mjs --minor|--major|--patch
 * Prints the new version to stdout and writes GitHub Actions outputs when present.
 */

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function parseArgs(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  if (flags.has("--major")) return "major";
  if (flags.has("--patch")) return "patch";
  if (flags.has("--minor")) return "minor";
  throw new Error("Usage: node scripts/bump-version.mjs --minor|--major|--patch");
}

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) throw new Error(`Expected X.Y.Z semver, got: ${version}`);
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function bump(version, kind) {
  const v = parseSemver(version);
  if (kind === "major") return `${v.major + 1}.0.0`;
  if (kind === "patch") return `${v.major}.${v.minor}.${v.patch + 1}`;
  return `${v.major}.${v.minor + 1}.0`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function setGithubOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

const kind = parseArgs(process.argv.slice(2));
const packagePath = resolve(root, "package.json");
const lockPath = resolve(root, "package-lock.json");
const manifestPath = resolve(root, "manifest.json");

const pkg = readJson(packagePath);
const lock = readJson(lockPath);
const manifest = readJson(manifestPath);

const current = pkg.version;
if (manifest.version !== current) {
  throw new Error(`manifest.json version (${manifest.version}) != package.json (${current})`);
}
if (lock.version !== current) {
  throw new Error(`package-lock.json version (${lock.version}) != package.json (${current})`);
}

const next = bump(current, kind);

pkg.version = next;
manifest.version = next;
lock.version = next;
if (lock.packages?.[""]) {
  lock.packages[""].version = next;
}

writeJson(packagePath, pkg);
writeJson(lockPath, lock);
writeJson(manifestPath, manifest);

setGithubOutput("version", next);
setGithubOutput("previous", current);
setGithubOutput("kind", kind);

process.stdout.write(`${next}\n`);
