import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { calendarApiPlugin } from "./server/calendarApiPlugin";
import { slackApiPlugin } from "./server/slackApiPlugin";
import { studioStorePlugin } from "./server/studioStorePlugin";

export default defineConfig({
  plugins: [react(), calendarApiPlugin(), slackApiPlugin(), studioStorePlugin()],
  server: {
    port: 5173,
  },
});
