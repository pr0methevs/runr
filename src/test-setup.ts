import { mock, jest } from "bun:test";

// For bun test compatibility
if (typeof (jest as any).unstable_mockModule === "undefined") {
    (jest as any).unstable_mockModule = mock.module;
}
