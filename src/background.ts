import { startBackground, type BackgroundChrome } from "./background-service.ts";

startBackground(chrome as unknown as BackgroundChrome);
