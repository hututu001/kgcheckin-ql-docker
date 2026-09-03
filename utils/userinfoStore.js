import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

const DEFAULT_USERINFO_FILE = "./data/userinfo.json";

function getUserinfoFile() {
  return resolve(process.env.USERINFO_FILE || DEFAULT_USERINFO_FILE);
}

function loadUserinfo({ allowMissing = false } = {}) {
  if (process.env.USERINFO) {
    return JSON.parse(process.env.USERINFO);
  }

  const file = getUserinfoFile();
  if (!existsSync(file)) {
    if (allowMissing) return [];
    throw new Error(`USERINFO not configured and ${file} does not exist`);
  }

  const raw = readFileSync(file, "utf8").trim();
  if (!raw) {
    if (allowMissing) return [];
    throw new Error(`${file} is empty`);
  }

  return JSON.parse(raw);
}

function saveUserinfoToFile(userinfo) {
  const file = getUserinfoFile();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(userinfo), "utf8");
  return file;
}

export { getUserinfoFile, loadUserinfo, saveUserinfoToFile };
