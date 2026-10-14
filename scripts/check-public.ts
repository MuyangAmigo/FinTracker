import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
function scan(directory: string) {
  for (const file of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, file.name);
    if (file.isDirectory()) {
      scan(path);
      continue;
    }
    if (
      /\.(csv|xlsx|db|sqlite|dump|pem)$/i.test(file.name) ||
      /local\.settings\.json|private-import|private-data/i.test(path)
    )
      throw new Error(`Private file in public artifact: ${path}`);
    if (!/\.(html|js|json|txt|map)$/i.test(file.name)) continue;
    const text = readFileSync(path, "utf8");
    if (
      /postgres(?:ql)?:\/\/|-----BEGIN .*PRIVATE KEY-----|(?:AccountKey|SharedAccessKey)=[A-Za-z0-9+/]{20}/.test(
        text,
      )
    )
      throw new Error(`Server credentials in public artifact: ${path}`);
  }
}
if (!existsSync("out"))
  throw new Error("Build the static export before checking public artifacts");
scan("out");
console.log(
  "Static export contains no database URLs, credential files, or financial source files.",
);
