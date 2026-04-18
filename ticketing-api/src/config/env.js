import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

dotenv.config({ path: path.resolve(projectRoot, ".env") });

if (process.cwd() !== projectRoot) {
  dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false });
}

const clientUrls = (
  process.env.CLIENT_URL ??
  "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const env = {
  port: Number(process.env.PORT ?? 4000),
  clientUrl: clientUrls[0] ?? "http://localhost:5173",
  clientUrls,
  mongoUri:
    process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/paf_ticketing",
  jwtSecret: process.env.JWT_SECRET ?? "ticketing-dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  mongoServerSelectionTimeoutMs: Number(
    process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS ?? 10000
  ),
  uploadDir: process.env.UPLOAD_DIR ?? "../../uploads/ticketing",
};
