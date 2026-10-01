import { startBackground, type BackgroundChrome } from "./background-service.ts";
import { extensionApi } from "./webext.ts";

startBackground(extensionApi() as unknown as BackgroundChrome);
