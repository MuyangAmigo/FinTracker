import EmbeddedPostgres from "embedded-postgres";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { privatePath } from "./normalize.js";
const directory = process.env.LOCAL_DATABASE_DIR,
  password = process.env.LOCAL_DATABASE_PASSWORD;
if (!directory || !password)
  throw new Error(
    "Set LOCAL_DATABASE_DIR outside the repository and LOCAL_DATABASE_PASSWORD",
  );
const database = new EmbeddedPostgres({
  databaseDir: privatePath(directory),
  user: "fintracker",
  password,
  port: Number(process.env.LOCAL_DATABASE_PORT ?? "55432"),
  persistent: true,
  authMethod: "scram-sha-256",
  postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
  onError: () => console.error("Local PostgreSQL reported an error"),
});
if (!existsSync(join(directory, "PG_VERSION"))) await database.initialise();
await database.start();
const client = database.getPgClient();
await client.connect();
try {
  const result = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = 'fintracker'",
  );
  if (!result.rowCount) await database.createDatabase("fintracker");
} finally {
  await client.end();
}
if (process.env.LOCAL_CONNECTION_FILE) {
  writeFileSync(
    privatePath(process.env.LOCAL_CONNECTION_FILE),
    JSON.stringify({
      DATABASE_URL: `postgresql://fintracker:${encodeURIComponent(password)}@127.0.0.1:${process.env.LOCAL_DATABASE_PORT ?? "55432"}/fintracker`,
      LOCAL_DATABASE_DIR: directory,
      LOCAL_DATABASE_PASSWORD: password,
    }),
    { mode: 0o600 },
  );
}
console.log(
  "Private PostgreSQL is ready on localhost. Stop this command to shut it down.",
);
async function stop() {
  await database.stop();
  process.exit(0);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
