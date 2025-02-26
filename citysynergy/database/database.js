// Database connection and initialization

const { Sequelize } = require('sequelize');
const config = require('../config/config');
const mysql = require('mysql2/promise');

const sequelize = new Sequelize(
    config.database.name,
    config.database.user,
    config.database.password,
    {
        host: config.database.host,
        port: config.database.port,
        dialect: 'mysql',
        logging: false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

const createDatabase = async () => {
    try {
        console.log('Attempting to create database if it does not exist...');
        const connection = await mysql.createConnection({
            host: config.database.host,
            port: config.database.port,
            user: config.database.user,
            password: config.database.password
        });

        await connection.query(`CREATE DATABASE IF NOT EXISTS ${config.database.name}`);
        await connection.end();
        console.log(`Database ${config.database.name} created or already exists`);
    } catch (error) {
        console.error('Error creating database:', error);
        throw error;
    }
};

module.exports = {
    sequelize,
    createDatabase
};
