import { Model, DataTypes } from "sequelize";
import { sequelize } from './sequelize.js';
import { logger } from '../logger/index.js';


class User extends Model {}
User.init({
    chat_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true
    },
    firstname: {
        type: DataTypes.STRING,
        allowNull: true
    },
    lastname: {
        type: DataTypes.STRING,
        allowNull: true
    },
    lotNumber: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    isAuthenticated: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    contact: {
        type: DataTypes.STRING,
        allowNull: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true
    },
    chatStatus: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: ''
    },
    birthdaydate: {
        type: DataTypes.STRING,
        allowNull: true
    },
    recentMessage: {
        type: DataTypes.INTEGER,
        allowNull: true
    }

}, {
    freezeTableName: false,
    timestamps: true,
    modelName: 'users',
    sequelize
});

const createNewUser = async (userData) => {
    let res;
    try {
        res = await User.create({ ...userData });
        res = res.dataValues;
        logger.info(`Created user with id: ${res.id}`);
    } catch (err) {
        logger.error(`Impossible to create user: ${err}`);
    }
    return res;
};

const createNewUserByChatId = async (chat_id) => {
    let res;
    try {
        res = await User.create({ chat_id });
        res = res.dataValues;
        logger.info(`Created user with id: ${res.id}`);
    } catch (err) {
        logger.error(`Impossible to create user: ${err}`);
    }
    return res;
};

const updateUserByChatId = async (chat_id, updateParams) => {
    const res = await User.update({ ...updateParams } , { where: { chat_id } });
    if (res[0]) {
        const data = await findUserByChatId(chat_id);
        if (data) {
            logger.info(`User ${data.chat_id} updated`);
            return data;
        }
        logger.info(`User ${chat_id} updated, but can't read result data`);
    } 
    return undefined;
};

const updateChatStatusByChatId = async (chat_id, chatStatus) => {
    const res = await User.update({ chatStatus } , { where: { chat_id } });
    if (res[0]) {
        const data = await findUserByChatId(chat_id);
        if (data) {
            logger.info(`User ${data.chat_id} updated`);
            return data;
        }
        logger.info(`User ${chat_id} updated, but can't read result data`);
    } 
    return undefined;
};

const updateRecentMessageByChatId = async (chat_id, recentMessage) => {
    const res = await User.update({ recentMessage } , { where: { chat_id } });
    if (res[0]) {
        const data = await findUserByChatId(chat_id);
        if (data) {
            logger.info(`User ${data.chat_id} updated`);
            return data;
        }
        logger.info(`User ${chat_id} updated, but can't read result data`);
    } 
    return undefined;
};

const userLogin = async (chat_id) => {
    const res = await User.update({ isAuthenticated: true }, { where: { chat_id } });
    if (res) logger.info(`User ${chat_id} logging in`);
    return res[0] ? chat_id : undefined;
};

const userLogout = async (chat_id) => {
    const res = await User.update({ isAuthenticated: false }, { where: { chat_id } });
    if (res) logger.info(`User ${chat_id} logging out`);
    return res[0] ? chat_id : undefined;
};


const findUserById = async (id) => {
    const res = await User.findAll({ where: { id: id } });
    if (res.length > 0) return res.map(el => el.dataValues);
    return;
};

const findUsersByStatus = async (isAuthenticated) => {
    const res = await User.findAll({ where: { isAuthenticated } });
    if (res.length > 0) return res.map(el => el.dataValues);
    return;
};

const findUserByChatId = async (chat_id) => {
    const res = await User.findOne({ where: { chat_id: chat_id } });
    if (res) return res.dataValues;
    return res;
};

export {
    User,
    createNewUser,
    updateUserByChatId,
    userLogin,
    userLogout,
    findUserById,
    findUsersByStatus,
    findUserByChatId,
    createNewUserByChatId,
    updateChatStatusByChatId,
    updateRecentMessageByChatId
};   