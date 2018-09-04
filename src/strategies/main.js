/**
 * MODE: likemode_classic
 * =====================
 * Select random hashtag from config list and like 1 random photo (of last 20) | 400-600 like/day.
 *
 * @author:     Patryk Rzucidlo [@ptkdev] <support@ptkdev.io> (https://ptkdev.it)
 * @license:    This code and contributions have 'GNU General Public License v3'
 * @version:    0.5
 * @changelog:  0.1 initial release
 *              0.2 new pattern with webdriverio
 *              0.5 new pattern with puppeteer
 *
 */

const path = require("path")
const instagrambotlibPath = path.dirname(require.resolve("instagrambotlib"));
var JsonDB = require('node-json-db');

const Manager_state = require(instagrambotlibPath + "/modules/common/state").Manager_state;
class Likemode_classic extends Manager_state {
    constructor(bot, config, utils) {
        super();
        this.bot = bot;
        this.config = config;
        this.utils = utils;
        this.LOG_NAME = "eib";
        this.Manager_state = require(instagrambotlibPath + "/modules/common/state").Manager_state;
        this.STATE = require(instagrambotlibPath + "/modules/common/state").STATE;
        this.STATE_EVENTS = require(instagrambotlibPath + "/modules/common/state").EVENTS;
        this.Log = require(instagrambotlibPath + "/modules/logger/Log");
        this.cache_hash_tags = [];
        this.log = new this.Log(this.LOG_NAME, this.config);
        this.source = this.config.comment_mode.comments.source;

        this.commentRate = this.config.comment_mode.rate;
        this.followRate = this.config.follow_mode.rate;

        this.account = this.config.instagram_username;
        this.url_instagram = "https://www.instagram.com/";
        this.account_url = `${this.url_instagram}${this.account}`;

        this.jsonDb = new JsonDB("follow_db", true, true);

        let dateString = '1970-00-01'
        try {
            dateString = this.jsonDb.getData('/lastCheck');
        } catch (e) {}
        this.lastUnfollowCheckDate = new Date(dateString);

        this.openedDays = this.config.opened_days
        this.openedHours = this.config.opened_hours

        this.cache_profile_stats = {
            username: '',
            followers: 0,
            following: 0
        }
    }

    /**
     * Open account page
     * @return {Promise<void>}
     */
    async open_account_page(account_url = null) {
        this.log.info(`current account ${this.account}`);

        if (account_url === null) {
            account_url = this.account_url;
        } 

        try {
            await this.bot.goto(account_url);
        } catch (err) {
            this.log.error(`goto ${err}`);
        }

        await this.utils.sleep(this.utils.random_interval(4, 8));

        await this.utils.screenshot(this.LOG_NAME, "account_page");
    }

    /**
     * Scroll followers
     * @return {Promise<Promise<*>|Promise<Object>|*|XPathResult>}
     */
    async scroll_followers() {
        this.log.info("scroll action");

        await this.bot.waitForSelector("div[role=\"dialog\"] > div:nth-child(3)");
        return this.bot.evaluate(() => {
            return new Promise((resolve) => {
                let shouldContinue = true;
                let account_count = document.querySelectorAll('div[role=\"dialog\"] > div:nth-child(3) li').length;
                console.log('**** ', account_count, ' ****')
                let newCount;
                let timer = setInterval(() => {
                    document.querySelector("div[role=\"dialog\"] > div:nth-child(3)").scrollBy(0, 5000);
                    console.log("scroll")
                    setTimeout(() => {
                        newCount = document.querySelectorAll('div[role=\"dialog\"] > div:nth-child(3) li').length
                        console.log(newCount)
                        shouldContinue = account_count != newCount
                        if (shouldContinue === false) {
                            clearInterval(timer);
                            resolve();
                        } else {
                            account_count = newCount
                        }    
                    }, 500);
                }, 2500);
            });
        });
    }

    /**
     *
     * @return {Promise<void>}
     */
    async get_followers() {
        this.log.info("get followers");

        if (this.cache_hash_tags.length <= 0) {
            let selector_followers_count = "main header section ul li:nth-child(2) a";
            await this.bot.waitForSelector(selector_followers_count);
            let area_count_followers = await this.bot.$(selector_followers_count);
            await area_count_followers.click();

            // scroll
            await this.scroll_followers(this.bot);

            try {
                let followers = await this.bot.$$eval("div[role=\"dialog\"] > div:nth-child(3) li > div > div > a", hrefs => hrefs.map((a) => {
                    return a.href;
                }));

                await this.utils.sleep(this.utils.random_interval(10, 15));

                if (this.utils.is_debug())
                    this.log.debug(`array followers ${followers}`);

                return followers;

            } catch (err) {
                this.log.error(`get url followers error ${err}`);
                await this.utils.screenshot(this.LOG_NAME, "get_url_followers_error");
            }
        }
    }

    async unfollow() {
        this.log.info('unfollow ' + this.bot.url())
        const unfollow_elem = "main header:nth-child(1) button";
        const confirm_unfollow_elem = "div[role=\"dialog\"] > div button:nth-child(1)";

        // click follow
        await this.bot.waitForSelector(unfollow_elem);
        let unfollowButton = await this.bot.$(unfollow_elem);
        await unfollowButton.click();

        this.utils.sleep(this.utils.random_interval(1, 2));

        try {
            await this.bot.waitForSelector(confirm_unfollow_elem)
            let confirmUnfollowButton = await this.bot.$(confirm_unfollow_elem);
            await confirmUnfollowButton.click();    
        } catch(e) {
            this.log.debug(e)
        }

        this.utils.sleep(this.utils.random_interval(1, 2));

    }

    async check_unfollow() {
        this.log.info('check unfollow')

        try {
            let now = new Date()
            if (now.getTime() - this.lastUnfollowCheckDate.getTime() < (24 * 60 * 60 * 1000)) {
                this.log.info('last check done in less than 24 hours')
                return;
            }

            this.lastUnfollowCheckDate = new Date();
            this.jsonDb.push('/lastCheck', this.lastUnfollowCheckDate.getFullYear() + '-' + (this.lastUnfollowCheckDate.getMonth() + 1).toString().padStart(2, '0') + '-' + this.lastUnfollowCheckDate.getDate().toString().padStart(2, '0'))

            await this.open_account_page();

            let data = [];
            try {
                data = this.jsonDb.getData('/followers')
            } catch(e) {}
            if (!data.length) {
                data = await this.get_followers();
            }
            this.jsonDb.push('/followers', data);

            let toCheck = this.jsonDb.getData("/following").filter(function (profile) {
                let fromDate = new Date(profile.following_date)
                let now = new Date()
                let followedSinceDays = ((now.getTime() - fromDate.getTime()) / (24*60*60*1000))
                if (followedSinceDays > 3) {
                    if (list.indexOf(profile.url) === -1) {
                        return true
                    }
                }
                return false;
            }, this)
        
            let i = 0;
            while(i < toCheck.length) {
                let profile = toCheck[i];
                await this.open_account_page(profile.url);
    
                await this.unfollow()
                i ++;
            }
    
            let followingData = this.jsonDb.getData("/following")

            if (followingData.length) {
                this.jsonDb.push('/following', followingData.filter(follower => {
                    return toCheck.findIndex(el => el.url === follower.url) === -1
                }))    
            }
        } catch(e) {
            this.log.debug(e)
            console.log(e)
        }
    }


    /**
     * Get photo url from cache
     * @return {string} url
     */
    get_photo_url() {
        let photo_url = "";
        do {
            photo_url = this.cache_hash_tags.pop();
        } while ((typeof photo_url === "undefined" || photo_url.indexOf("tagged") === -1) && this.cache_hash_tags.length > 0);

        return photo_url;
    }

    /**
     * likemode_classic: Open Hashtag
     * =====================
     * Get random hashtag from array and open page
     *
     */
    async like_open_hashtagpage() {
        let hashtag_tag = this.utils.get_random_hash_tag();
        this.log.info(`current hashtag  ${hashtag_tag}`);

        try {
            await this.bot.goto("https://www.instagram.com/explore/tags/" + hashtag_tag + "/");
        } catch (err) {
            this.log.error(`goto ${err}`);
        }

        await this.utils.sleep(this.utils.random_interval(4, 8));

        await this.utils.screenshot(this.LOG_NAME, "last_hashtag");
    }

    /**
     * likemode_classic: Open Photo
     * =====================
     * Open url of photo and cache urls from hashtag page in array
     *
     */
    async like_get_urlpic() {
        this.log.info("like_get_urlpic");

        let photo_url = "";

        if (this.cache_hash_tags.length <= 0) {
            try {
                this.cache_hash_tags = await this.bot.$$eval("article a", hrefs => hrefs.map((a) => {
                    return a.href;
                }));

                await this.utils.sleep(this.utils.random_interval(10, 15));

                if (this.utils.is_debug())
                    this.log.debug(`array photos ${this.cache_hash_tags}`);

                photo_url = this.get_photo_url();

                this.log.info(`current photo url ${photo_url}`);
                if (typeof photo_url === "undefined")
                    this.log.warning("check if current hashtag have photos, you write it good in config.js? Bot go to next hashtag.");

                await this.utils.sleep(this.utils.random_interval(4, 8));

                await this.bot.goto(photo_url);
            } catch (err) {
                this.cache_hash_tags = [];
                this.log.error(`like_get_urlpic error ${err}`);
                await this.utils.screenshot(this.LOG_NAME, "like_get_urlpic_error");
            }
        } else {
            photo_url = this.get_photo_url();

            this.log.info(`current photo url from cache ${photo_url}`);
            await this.utils.sleep(this.utils.random_interval(4, 8));

            try {
                await this.bot.goto(photo_url);
            } catch (err) {
                this.log.error(`goto ${err}`);
            }
        }
        await this.utils.sleep(this.utils.random_interval(4, 8));
    }

    async get_nb_followers() {
        return parseInt(await this.bot.evaluate(() => document.querySelector("main header ul li:nth-child(2) span").innerText.replace(',', '')));
    }

    async get_nb_following() {
        return parseInt(await this.bot.evaluate(() => document.querySelector("main header ul li:nth-child(3) span").innerText.replace(',', '')));
    }

    async fetch_profile_stats() {
        const currentUrl = this.bot.url()

        try {
            // find author profile url
            const author_elem = "main article:nth-child(1) header:nth-child(1) a";

            await this.bot.waitForSelector(author_elem);
            let authorLinkElem = await this.bot.$(author_elem);
            let authorLink = await authorLinkElem.getProperty('href');
            let authorProfileUrl = authorLink._remoteObject.value;

            await this.utils.sleep(this.utils.random_interval(2, 3));
            await this.bot.waitForSelector(author_elem);
            await this.utils.sleep(this.utils.random_interval(4, 8));
            
            // let author = await this.bot.$(author_elem);
            // console.log(await this.bot.$(author_elem));

            // let authorLinkElem = await this.bot.evaluate( () => (document.querySelector("main article:nth-child(1) header:nth-child(1) a") ))
            let newUrl = authorProfileUrl;
    
            await this.bot.goto(newUrl);
    
            await this.utils.sleep(this.utils.random_interval(2, 3));
        
            let username = newUrl.substr(0, newUrl.length - 1)
            username = username.substr(username.lastIndexOf('/'))

            this.cache_profile_stats = {
                username,
                followers: await this.get_nb_followers(),
                following: await this.get_nb_following()
            };

            console.log(this.cache_profile_stats);
        
        } catch(e) {
            this.log.error(e)
            console.log(e)
        }

        await this.bot.goto(currentUrl)
        await this.utils.sleep(this.utils.random_interval(4, 8));    

    }

    /**
     * likemode_classic: Love me
     * =====================
     * Click on heart and verify if instagram not (soft) ban you
     *
     */
    async like_click_heart() {
        this.log.info("try heart like");

        try {
            let btnSelector = "main article:nth-child(1) section:nth-child(1) button:nth-child(1)"
            let button = await this.bot.$(btnSelector);
            let heart = await this.bot.evaluate(() => document.querySelector("main article:nth-child(1) section:nth-child(1) button:nth-child(1) span").className);

            await this.bot.waitForSelector(btnSelector);

            if (heart.indexOf('filled') === -1) {
                await button.click();
                this.log.info("<3");    
            } else {
                this.log.info("already liked")
            }
            this.emit(this.STATE_EVENTS.CHANGE_STATUS, this.STATE.OK);
        } catch (err) {
            if (this.utils.is_debug())
                this.log.debug(err);

            this.log.warning("</3");
            this.emit(this.STATE_EVENTS.CHANGE_STATUS, this.STATE.ERROR);
        }

        await this.utils.sleep(this.utils.random_interval(4, 8));
        await this.utils.screenshot(this.LOG_NAME, "last_like_after");
    }

    get_random_comment() {
        // if array is empty
        if (this.source.length === 0) return "";
        return this.source[Math.floor(Math.random() * this.source.length)];
    }
    /**
     * Get random comment from config file
     * @return string
     */
    get_comment() {
        this.log.info(`type source comments is ${this.config.comment_mode.comments.type}`);
        switch (this.config.comment_mode.comments.type) {
            case "array":
                return this.get_random_comment();
            default:
                this.log.error("source comments not found");
                return "";
        }
    }

    /**
     * Check exist element under photo
     * @return {Promise<void>}
     */
    async check_leave_comment() {
        let nick_under_photo = `main article:nth-child(1) div:nth-child(3) div:nth-child(3) ul li a[title="${this.config.instagram_username}"]`;
        if (this.is_ok()) {
            try {
                let nick = await this.bot.$(nick_under_photo);

                if (nick !== null) {
                    this.emit(this.STATE_EVENTS.CHANGE_STATUS, this.STATE.OK);
                } else {
                    this.emit(this.STATE_EVENTS.CHANGE_STATUS, this.STATE.ERROR);
                }

                if (this.is_error()) {
                    this.log.warning("Failed...");
                    this.log.warning("error bot :( not comment under photo, now bot sleep 5-10min");
                    this.log.warning("You are in possible soft ban... If this message appear all time stop bot for 24h...");
                    await this.utils.sleep(this.utils.random_interval(60 * 5, 60 * 10));
                } else if (this.is_ok()) {
                    this.log.info("OK");
                }
            } catch (err) {
                if (this.utils.is_debug())
                    this.log.debug(err);
                this.emit(this.STATE_EVENTS.CHANGE_STATUS, this.STATE.ERROR);
            }
        } else {
            this.log.warning("Failed...");
            this.log.warning("You like this previously, change hashtag ig have few photos");
            this.emit(this.STATE_EVENTS.CHANGE_STATUS, this.STATE.READY);
        }
    }

    /**
     * commentmode_classic: Love me
     * =====================
     * leave a comment under the photo
     *
     */
    async comment() {
        this.log.info("try leave comment");
        let comment_area_elem = "main article:nth-child(1) section:nth-child(5) form textarea";

        try {
            let textarea = await this.bot.$(comment_area_elem);
            if (textarea !== null) {
                this.emit(this.STATE_EVENTS.CHANGE_STATUS, this.STATE.OK);
            } else {
                this.emit(this.STATE_EVENTS.CHANGE_STATUS, this.STATE.ERROR);
            }

            if (this.is_ok()) {
                await this.bot.waitForSelector(comment_area_elem);
                let button = await this.bot.$(comment_area_elem);
                await button.click();
                await this.bot.type(comment_area_elem, this.get_comment(), { delay: 100 });
                await button.press("Enter");
            } else {
                this.log.info("bot is unable to comment on this photo");
                this.emit(this.STATE_EVENTS.CHANGE_STATUS, this.STATE.ERROR);
            }
        } catch (err) {
            if (this.utils.is_debug()) {
                this.log.debug(err);
            }
            this.log.info("bot is unable to comment on this photo");
            this.emit(this.STATE_EVENTS.CHANGE_STATUS, this.STATE.ERROR);
        }

        await this.utils.sleep(this.utils.random_interval(4, 8));

        this.bot.reload();

        await this.utils.sleep(this.utils.random_interval(4, 8));

        await this.utils.screenshot(this.LOG_NAME, "last_comment");

        await this.utils.sleep(this.utils.random_interval(4, 8));
        await this.check_leave_comment();

        await this.utils.sleep(this.utils.random_interval(2, 5));
        await this.utils.screenshot(this.LOG_NAME, "last_comment_after");
    }


    async follow () {
        this.log.info("try to follow");

        // find author profile url
        const author_elem = "main article:nth-child(1) header:nth-child(1) a";
        const follow_elem = "main article:nth-child(1) header:nth-child(1) button";

        await this.bot.waitForSelector(author_elem);
        let authorLinkElem = await this.bot.$(author_elem);
        let authorLink = await authorLinkElem.getProperty('href');
        let authorProfileUrl = authorLink._remoteObject.value;

        // click follow
        await this.bot.waitForSelector(follow_elem);
        let followButton = await this.bot.$(follow_elem);
        await followButton.click()

        const today = new Date()
        let profile = {
            url: authorProfileUrl,
            following_date: today.getFullYear() + '-' + (today.getMonth() + 1).toString().padStart(2, '0') + '-' + today.getDate().toString().padStart(2, '0')
        }

        let followingData = null
        try {
            followingData = this.jsonDb.getData("/following")
        } catch (e) {
            this.log.debug(e)
        }

        if (followingData && followingData.length && followingData.findIndex(el => el.url === profile.url) === -1)
            this.jsonDb.push("/following[]", profile);
        else
            this.jsonDb.push("/following", [profile]);

        this.log.info("follow ok");
    }

    isInOpennedHours (dateToCheck) {
        const lt = (dtc, ref) => {
            return dtc.getHours() < ref[0];
        }
        const gt = (dtc, ref) => {
            return dtc.getHours() > ref[0] || (dtc.getHours() == ref[0] && dtc.getMinutes() > ref[1]);
        }

        return (this.openedDays.length === 0 || this.openedDays.indexOf(dateToCheck.getDay()) !== -1) && (this.openedHours.length === 0 || this.openedHours.filter(range => {
            return gt(dateToCheck, range[0]) && lt(dateToCheck, range[1])
        }).length > 0)
    }

    /**
     * LikemodeClassic Flow
     * =====================
     *
     */
    async start() {
        this.log.info("e_insta_bot");

        let today = "";
        let t1, t2, sec, sec_min, sec_max;
        sec_min = parseInt(86400 / this.config.bot_likeday_max);
        sec_max = parseInt(86400 / this.config.bot_likeday_min);

        let stats = {
            likes: 0,
            comments: 0,
            follow: 0
        }

        do {
            today = new Date();
            t1 = new Date(today.getFullYear(), today.getMonth(), today.getDate(), today.getHours(), today.getMinutes(), today.getSeconds());

            this.log.info("loading... " + new Date(today.getFullYear(), today.getMonth(), today.getDate(), today.getHours(), today.getMinutes(), today.getSeconds()));
            this.log.info("cache array size " + this.cache_hash_tags.length);

            this.log.info("----------------------------------");
            this.log.info(" STATS");
            this.log.info("----------------------------------");
            this.log.info("likes : " + stats.likes);
            this.log.info("comments : " + stats.comments);
            this.log.info("follow : " + stats.follow);
            this.log.info("----------------------------------");

            if (!this.isInOpennedHours(today)) {
                this.log.info('Sorry, we\'re closed')
                await this.utils.sleep(this.utils.random_interval(5 * 60, 15 * 60));
                continue;
            }

            await this.check_unfollow();

            if (this.cache_hash_tags.length <= 0)
                await this.like_open_hashtagpage();

            await this.utils.sleep(this.utils.random_interval(4, 8));

            await this.like_get_urlpic();
            await this.utils.sleep(this.utils.random_interval(4, 8));

            await this.fetch_profile_stats();

            await this.like_click_heart();
            stats.likes++

            await this.utils.sleep(this.utils.random_interval(1, 3));

            let randomRate;

            randomRate = this.utils.random_interval(0, 100) / 1000;
            if (randomRate <= this.commentRate) {
                await this.comment();
                stats.comments++
            }
            
            await this.utils.sleep(this.utils.random_interval(1, 3));
            
            randomRate = this.utils.random_interval(0, 100) / 1000;
            if (randomRate <= this.followRate) {
                await this.follow();
                stats.follow++
            }

            if (this.cache_hash_tags.length < 9) //remove popular photos
                this.cache_hash_tags = [];

            today = new Date();
            t2 = new Date(today.getFullYear(), today.getMonth(), today.getDate(), today.getHours(), today.getMinutes(), today.getSeconds());
            sec = Math.abs((t1.getTime() - t2.getTime()) / 1000);

            if (sec < sec_min && this.get_status() === 1) {
                this.log.info("seconds of loop " + sec + "... for miss ban bot wait " + (sec_min - sec) + "-" + (sec_max - sec));
                await this.utils.sleep(this.utils.random_interval(sec_min - sec, sec_max - sec));
            } else {
                this.cache_hash_tags = [];
            }
        } while (true);
    }

}

module.exports = (bot, config, utils) => { return new Likemode_classic(bot, config, utils); };