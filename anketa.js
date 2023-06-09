import { bot } from "./app.js";
import { ranges } from './values.js';
import { writeGoogle, readGoogle } from './crud.js';
import { checkStatus, editingMessage, getLotContentByID } from './interval.js';
import { phrases, keyboards } from './language_ua.js';
import { sendAvaliableToChat, filterKeyboard, sendFiltredToChat } from './postingLot.js';
import { logger } from './logger/index.js';
import { 
  updateRecentMessageByChatId,
  updateChatStatusByChatId,
  createNewUserByChatId,
  updateUserByChatId,
  findUserByChatId
} from './models/users.js'

export const anketaListiner = async() => {
    bot.setMyCommands([
      {command: '/start', description: 'Почати'},
      {command: '/list', description: 'Показати усі доступні лоти'},
      {command: '/filter', description: 'Відфільтрувати лоти по областям'},
    ]);

    bot.on("callback_query", async (query) => {
      const action = query.data;
      const chatId = query.message.chat.id;
      const userInfo = await findUserByChatId(chatId);
      
      
      const checkRegex = (string) => {
        const regex = /state\p{L}+/gu;
        return regex.test(string);
      }

      if (userInfo?.isBan) {
        await bot.sendMessage(chatId, `Ваш акаунт заблоковано`);
        return
      } else if(!isNaN(Number(action))) {
        let selectedLot = query.data;
        const choosenLotStatus = await readGoogle(ranges.statusCell(selectedLot));
        if (choosenLotStatus[0] === 'new') {
          try {
            await writeGoogle(ranges.statusCell(selectedLot), [['reserve']]);
            logger.info(`USER_ID: ${chatId} reserved lot#${selectedLot}`);
            await updateChatStatusByChatId(chatId, '');
          } catch (error) {
            logger.warn(`Impossible reserve lot#${selectedLot}. Error: ${err}`);
          }
          try {
            await writeGoogle(ranges.user_idCell(selectedLot), [[`${chatId}`]]);
          } catch (error) {
            logger.warn(`Impossible to write chatId#${chatId} to sheet. Error: ${err}`);
          }
          checkStatus(selectedLot, chatId);
          await updateUserByChatId(chatId, { lotNumber: selectedLot });
          if (userInfo.isAuthenticated) {
            const message = await bot.sendMessage(chatId, `Раді вас знову бачити ${userInfo.firstname}`, { reply_markup: keyboards.finishOrder });
            await updateRecentMessageByChatId(chatId, message.message_id);  
          } else {
            const message = await bot.sendMessage(chatId, phrases.contactRequest, { reply_markup: keyboards.contactRequestInline });
            await updateRecentMessageByChatId(chatId, message.message_id);  
          }
        } else bot.sendMessage(chatId, phrases.aleadySold);
      } else if(checkRegex(action)) {
        await sendFiltredToChat(chatId, action, ranges.stateColumn);
      }
      switch (action) {
        case '/start':
          bot.deleteMessage(chatId, userInfo.recentMessage).catch((error) => {logger.warn(`Помилка видалення повідомлення: ${error}`);});
          const message3 = bot.sendMessage(chatId, phrases.greetings, { reply_markup: keyboards.listInline });
          await updateRecentMessageByChatId(chatId, message3.message_id);
          break;
        case '/filter': 
          await filterKeyboard(chatId, 'Область', ranges.stateColumn);
          break;
        case '/list':
          bot.deleteMessage(chatId, userInfo.recentMessage).catch((error) => {logger.warn(`Помилка видалення повідомлення: ${error}`);});
          await sendAvaliableToChat(chatId, bot);
          break;
        case '/autocontact':
          bot.deleteMessage(chatId, userInfo.recentMessage).catch((error) => {logger.warn(`Помилка видалення повідомлення: ${error}`);});
          const message = await bot.sendMessage(chatId, `Для користувачів Telegram WEB` , {
            reply_markup: { inline_keyboard: [[{ text: 'Ввести контакти', callback_data: '/manualcontact' }]] },
          });
          bot.sendMessage(chatId, 'Натисніть на кнопку "Легко поділитися номером" щоб ми отримали доступ до вашого номеру телефону' ,{ reply_markup: { keyboard: [[{ text: 'Легко поділитися номером', request_contact: true, } ]], resize_keyboard: true, one_time_keyboard: true }});  
          await updateRecentMessageByChatId(chatId, message.message_id);
          break;
        case  '/manualcontact':
          bot.deleteMessage(chatId, userInfo.recentMessage).catch((error) => {logger.warn(`Помилка видалення повідомлення: ${error}`);});
          await updateChatStatusByChatId(chatId, 'phoneManual')
          const message1 = await bot.sendMessage(chatId, phrases.phoneRules, {
            reply_markup: { inline_keyboard: [[{ text: 'Почати спочатку', callback_data: '/start' }]] },
          });
          await updateRecentMessageByChatId(chatId, message1.message_id);
          break;
        case '/comleate':
          bot.deleteMessage(chatId, userInfo.recentMessage).catch((error) => {logger.warn(`Помилка видалення повідомлення: ${error}`);});
          const status = await readGoogle(ranges.statusCell(userInfo.lotNumber));
          if (status[0] === 'reserve') {
            try {
              await writeGoogle(ranges.statusCell(userInfo.lotNumber), [['done']]);
              await writeGoogle(ranges.userNameCell(userInfo.lotNumber), [[userInfo.firstname]]);
              await writeGoogle(ranges.userPhoneCell(userInfo.lotNumber), [[userInfo.contact]]);
              await editingMessage(userInfo.lotNumber);
              const soldLotContent = await getLotContentByID(userInfo.lotNumber);
              await bot.sendMessage(chatId, phrases.thanksForOrder(userInfo.firstname));
              await bot.sendMessage(chatId, soldLotContent); 
              logger.warn(`USER_ID: ${chatId} comleate order`);
              await updateUserByChatId(chatId, 
              { 
                isAuthenticated: true,
                lotNumber: null,
              }) 
            } catch (error) {
              logger.error(`Something went wrong on finishing order for lot#${userInfo.lotNumber} from customer ${chatId}. Error: ${error}`);
            }
          } else {
            bot.sendMessage(chatId, phrases.aleadySold);
          }
          
        break;
      }
    })
    
    bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const userInfo = await findUserByChatId(chatId);
      if (userInfo?.isBan) {
        await bot.sendMessage(chatId, `Ваш акаунт заблоковано`);
        return
      } else if (msg.contact) {
        bot.deleteMessage(chatId, userInfo.recentMessage).catch((error) => {logger.warn(`Помилка видалення повідомлення: ${error}`);});
        const userData = await updateUserByChatId(chatId, { 
          firstname: msg.contact.first_name,
          contact: msg.contact.phone_number,
        });
        
        const message = await bot.sendMessage(chatId, phrases.dataConfirmation(userData.contact, userData.firstname), { 
          reply_markup: keyboards.inlineConfirmation });
        await updateRecentMessageByChatId(chatId, message.message_id);

      } else if (userInfo?.chatStatus === 'phoneManual') {
        bot.deleteMessage(chatId, userInfo.recentMessage).catch((error) => {logger.warn(`Помилка видалення повідомлення: ${error}`);});
        await updateUserByChatId(chatId, { contact: msg.text, chatStatus: 'nameManual' });
        const message = await bot.sendMessage(chatId, phrases.nameRequest);
        await updateRecentMessageByChatId(chatId, message.message_id)
      } else if (userInfo?.chatStatus === 'nameManual') {
        bot.deleteMessage(chatId, userInfo.recentMessage).catch((error) => {logger.warn(`Помилка видалення повідомлення: ${error}`);});
        const message = await bot.sendMessage(chatId, phrases.dataConfirmation(userInfo.contact, msg.text), {
          reply_markup: keyboards.inlineConfirmation });
        await updateRecentMessageByChatId(chatId, message.message_id)
        await updateUserByChatId(chatId, {
          firstname: msg.text,
          chatStatus: '',
          recentMessage: message.message_id,
        })
      }

      switch (msg.text) {
        case '/filter': 
          filterKeyboard(chatId, 'Область', ranges.stateColumn);
          break;
        case '/start':
          if (!userInfo) await createNewUserByChatId(chatId);
          const message = await bot.sendMessage(msg.chat.id, phrases.greetings, { reply_markup: keyboards.listInline });
          await updateRecentMessageByChatId(chatId, message.message_id);
          break;
        case 'Зробити замовлення':
        case '/list':
          await sendAvaliableToChat(msg.chat.id, bot);
          break;
      };
  });
};