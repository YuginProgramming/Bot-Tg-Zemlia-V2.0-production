import { Sequelize } from 'sequelize';

export const sequelize = new Sequelize(
    'zemlekup',
    'root',
    'root',
    {
    host: 'localhost',
    dialect: 'mysql',
    port: 8889
});


  
