import { bot, admin } from "./app.js";
import { writeGoogle, readGoogle } from './crud.js';
import { dataBot, ranges } from './values.js';
import { getLotContentByID } from './interval.js';
import { logger } from './logger/index.js';
import { keyboards } from './language_ua.js';
import { findUsersByStatus, userIsBanUpdate, findUserByChatId, deleteUserByChatId } from './models/users.js';

const filterKeyboard = async (chatId, filterName, range) => {
  const stateValues = await readGoogle(range);
  const lotsStatus = await readGoogle(ranges.statusColumn);
  const lotsStatusData = lotsStatus.slice(1)
  console.log(lotsStatusData);
  
  const statesList = stateValues
  .slice(1)
  .filter((value, index, self) => lotsStatusData[index] === 'new' && value !== undefined && self.indexOf(value) === index)
  .sort((a, b) => {
    const countA = stateValues.filter(value => value === a).length;
    const countB = stateValues.filter(value => value === b).length;
    return countB - countA;
  });
  console.log(statesList)
  const result = [];
  const chunkSize = 3; 

  for (let i = 0; i < statesList.length; i += chunkSize) {
    const chunk = statesList.slice(i, i + chunkSize);
    const row = chunk.map(state => ({
      text: state,
      callback_data: `state${state}`
    }));
    result.push(row);
  };

  bot.sendMessage(chatId, `Виберіть ${filterName}:`, { reply_markup: { inline_keyboard: result } });

  console.log(result);  
}



const autoPosting = async () => {
  const statusValues = await readGoogle(ranges.statusColumn);
  const pendingLots = statusValues
    .map((value, index) => value === "pending" ? index + 1 : null)
    .filter(value => value !== null);
  const contentPromises = pendingLots.map(el => getLotContentByID(el));
  const lotsContent = await Promise.all(contentPromises);
  for (let index = 0; index < lotsContent.length; index++) {
    const element = lotsContent[index];
    const lotNumber = pendingLots[index];
    try {
      const postedLot = await bot.sendMessage(dataBot.channelId, element, { reply_markup: keyboards.channelKeyboard });
      await sendLotToRegistredCustomers(element, lotNumber);
      if (postedLot) {
        try {
          const statusChangeResult = await writeGoogle(ranges.statusCell(lotNumber), [['new']]);
          const postingMessageIDResult = await writeGoogle(ranges.message_idCell(lotNumber), [[postedLot.message_id]]);
          if (statusChangeResult && postingMessageIDResult) {
            logger.info(`Lot #${lotNumber} successfully posted`);  
          }
        } catch (error) {
          logger.warn(`Lot #${lotNumber} posted. But issues with updating sheet. !PLEASE CHECK! spreadsheet data. Error ${error}`);
        }
      }
    } catch (error) {
      logger.warn(`Something went wrong on autoposting lot #${lotNumber}. Error ${error}`);
    }
  }
};


const userMenegment = () => {
  admin.on('message', async (message) => {
    const text = message.text;
    const command = text.split(' ');
    switch (command[0]) {
      case 'update': 
        if (command[1] === 'ban') {
          const boolean = command[3] === '1' || command[3] === 'true' ? true : false;
          const banUpdated = await userIsBanUpdate(command[2], boolean);
          admin.sendMessage(message.chat.id, `User ${banUpdated} Ban status updated.`);
        }
        break;
      case 'find':
        const data = await findUserByChatId(command[1]);
        const string = JSON.stringify(data);
        admin.sendMessage(message.chat.id, string);
        break;
      case 'delete':
        const response = await deleteUserByChatId(command[1])
        if (response) {
          admin.sendMessage(message.chat.id, `User ${command[1]} delated`);
        } else {
          admin.sendMessage(message.chat.id, `User ${command[1]} delating fail`);
        }
        
        break; 
    }
  })
}

const postingLots = () => {
  admin.on('message', async (message) => {
        if (message.text < 9999999 && message.text != 1) {
          try {
            const rowNumber = parseInt(message.text);
            const lot = await readGoogle(ranges.postContentLine(rowNumber));
            if (lot && lot.length > 0) {
              const message = lot.join('\n')
              .replace(/^/, '\u{1F4CA} ') // add diagramm in 1 line 
              .replace(/^.*\n.*\n.*\n.*\n/, '$&\u{1F69C} '); // add tractor in 4 line
              const sentMessage = await bot.sendMessage(dataBot.channelId, message, { reply_markup: keyboards.channelKeyboard });
              await sendLotToRegistredCustomers(message, rowNumber);
              await writeGoogle(ranges.message_idCell(rowNumber), [[sentMessage.message_id]]);
            }
          } catch (error) {
            console.error(error);
          }
        }
    });
};

const sendAvaliableToChat = async (chatId, bot) => {
  const readedStatus = await readGoogle(ranges.statusColumn);
  const newRows = readedStatus
    .map((value, index) => value === "new" ? index + 1 : null)
    .filter(value => value !== null);
  const contentPromises = newRows.map(rowNumber => readGoogle(ranges.postContentLine(rowNumber)));
  const rowDataArray = await Promise.all(contentPromises);
  rowDataArray.forEach((element, index) => {
      const rowNumber = newRows[index];
      const rowText = `\u{1F4CA} ${element[0]} \n ${element[1]} \n ${element[2]} \n ${element[3]} \n \u{1F69C} ${element[4]}`;; // Adds a smiley emoji
      bot.sendMessage(chatId, rowText, { reply_markup: { inline_keyboard: [[{ text: "Купити ділянку", callback_data: `${rowNumber}` }]] } });
  });
};

const sendFiltredToChat = async (chatId, callback_data, searchRange) => {
  const cuttingCallbackData= (cuttedWord) => {
    const regex = /state(.+)/i;
    const match = cuttedWord.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
    return null;
  };
  
  const searchWord = cuttingCallbackData(callback_data);
  const readedValues = await readGoogle(searchRange);
  const lotsStatus = await readGoogle(ranges.statusColumn);

  const matchedLots = readedValues
  .map((value, index) => value === searchWord && lotsStatus[index] === 'new' ? index + 1 : null)
  .filter(value => value !== null);
  const contentPromises = matchedLots.map(el => getLotContentByID(el));
  const lotsContent = await Promise.all(contentPromises);
  lotsContent.forEach((element, index) => {
    const rowNumber = matchedLots[index];
    bot.sendMessage(chatId, element, { reply_markup: { inline_keyboard: [[{ text: "Купити ділянку", callback_data: `${rowNumber}` }]] } });
  });
}

const sendLotToRegistredCustomers = async (message, lotNumber) => {
  const users = await findUsersByStatus(true);
  const usersChatId = users.map(el => el.chat_id);
  const reminderPromises = usersChatId.map(el => 
    bot.sendMessage(el, message, { reply_markup: { inline_keyboard: [[{ text: "Купити ділянку", callback_data: `${lotNumber}` }]] } })
  );
  const remindMessages = await Promise.all(reminderPromises);
  logger.info(`${remindMessages.length} користувачів отримали нагадування про новий лот`);
}

export { postingLots, sendAvaliableToChat, autoPosting, filterKeyboard, sendFiltredToChat, userMenegment }
