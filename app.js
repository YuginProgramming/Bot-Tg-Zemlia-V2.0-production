import TelegramBot from 'node-telegram-bot-api';
import { anketaListiner } from './anketa.js';
import { dataBot } from './values.js';
import { postingLots, autoPosting } from './postingLot.js';
import { sequelize } from './models/sequelize.js';
import { logger } from './logger/index.js';

const bot = new TelegramBot(dataBot.telegramBotToken, { polling: true });
const admin = new TelegramBot(dataBot.adminBot, { polling: true });
export { bot, admin };

const main = async () => {
  const models = {
      list:  [
          'users'
      ]
  };
  // DB
  const configTables = models.list;
  const dbInterface = sequelize.getQueryInterface();
  try {
    const checks = await Promise.all(configTables.map(configTable => {
        return dbInterface.tableExists(configTable);
    }));
    const result = checks.every(el => el === true);
    console.log(result)
    if (!result) {
        // eslint-disable-next-line no-console
        console.error(`🚩 Failed to check DB tables`);
        throw (`Some DB tables are missing`);
    }
    logger.info('DB connected.');
  } catch (error) {
    console.error(`🚩 egfrsgs ${error}` );

  }
  

}; 

main();


anketaListiner();
postingLots();
setInterval(() => {
    autoPosting();
  }, dataBot.autopostingTimer);