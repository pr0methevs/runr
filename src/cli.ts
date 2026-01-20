#!/usr/bin/env node
import { main } from "./index.js";
import { log } from "@clack/prompts";

main().catch((error) => {
    log.error(String(error));
    process.exit(1);
});
