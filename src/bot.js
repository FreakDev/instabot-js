const Bot = require('instagrambotlib')
const config = require ("./botconfig");

module.exports = function runbot () {
    let bot = new Bot(config);
    bot.start();
}