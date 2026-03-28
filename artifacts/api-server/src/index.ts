import app from "./app";
import { logger } from "./lib/logger";
import { getConfig, validateStartupEnv } from "./lib/config";
import { initTelegramBot } from "./services/telegramBot";
import { startScheduler } from "./jobs/scheduler";
import { runRiskEngineTests } from "./services/riskEngine";

const rawPort = process.env["PORT"];

if (!rawPort) {
  logger.error("❌ PORT 环境变量未设置，无法启动服务");
  process.exit(1);
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  logger.error(`❌ PORT 值不合法："${rawPort}"，无法启动服务`);
  process.exit(1);
}

validateStartupEnv();
getConfig();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "服务器启动监听失败");
    process.exit(1);
  }

  logger.info({ port }, "服务器已启动");
  runRiskEngineTests();
  initTelegramBot();
  startScheduler();
});
