module.exports = {
    // InstagramBot.js Configs
    "debug": true,
    "login": true,
    "ui": false, // only for social-manager-tools

    // Instagram Account
    "instagram_username": "********", // without @
    "instagram_password": "********",
    "instagram_hashtag": ["faitmaison", "cuisinemaison", "instafood", "instagourmand"], //without #
    "instagram_pin": "sms", //method to receive pin (email or sms)

    // Puppeteer Configs
    // "chrome_headless": false,
    "chrome_options": ["--disable-gpu", "--no-sandbox", "--window-size=1920x1080"],
    "executable_path": "", // example for Mac OS: /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome

    // LOG
    "pin_path":"./node_modules/instagrambotlib/loginpin.txt",
    "log_path":"./node_modules/instagrambotlib/logs/debug.log",
    "logerr_path":"./node_modules/instagrambotlib/logs/errors.log",
    "screenshot_path":"./node_modules/instagrambotlib/logs/screenshot/",
    "log": {
        "drivers": ["console"], // slack or console
        "screenshot": false,  // disable or enable screenshot in logs folder
        "channels": {
            "console": "",
            "slack": {
                "webhook": ""
            }
        }
    },

    // -- custom --

    "extend_strategies": __dirname + "/strategies/index.js",
    "bot_mode": "e_insta_bot",

    // if empty == 24/7
    "opened_days": [1, 2, 3, 4, 5], // monday to friday
    "opened_hours": [
        [[10, 0], [13, 30]],
        [[14, 30], [18, 30]]
    ],

    "chrome_headless": false,

    "follow_mode": {
        "rate": 25,
        "min_followers": 10,
        "max_followers": 5000
    },

    "comment_mode": {
        "rate": 40,
        "min_followers": 10,
        "max_followers": 5000,
        "comments": {
            "type": "array",
            "source": ["Wahou!", "ça fait envie!", "j'adore"],
        }
    }

};
