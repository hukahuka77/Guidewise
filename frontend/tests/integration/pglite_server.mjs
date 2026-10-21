// In-process Postgres (PGlite) on a fixed port with the production-like schema, for native-routes.sh.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || 5440);
const db = await PGlite.create();
await db.exec(fs.readFileSync(path.join(here, "..", "helpers", "schema.sql"), "utf8"));
// The "owner" test user is on the pro plan; "other" has no profile (no plan).
await db.exec("insert into profiles (user_id, plan) values ('11111111-1111-4111-8111-aaaaaaaaaaaa', 'pro')");
// Next dev bundles each route separately, so several modules each hold one connection.
const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 10 });
await server.start();
console.log(`pglite listening on ${port}`);
