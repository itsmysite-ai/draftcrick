import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from root .env file
config({ path: resolve(__dirname, "../../.env") });

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
