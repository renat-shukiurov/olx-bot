const dotenv = require('dotenv');
const jsdom = require("jsdom");
const axios = require("axios");
const { JSDOM } = jsdom;
const MongoClient = require("mongodb").MongoClient;

dotenv.config()
const token = process.env.TG_API_TOKEN || "";
const channelName = process.env.TG_CHANNEL_NAME || "";
const mongoUser = process.env.MONGODB_USER || "";
const mongoPass = process.env.MONGODB_PASS || "";
const mongoConnUrl = `mongodb://${mongoUser}:${mongoPass}@database:27017/`;


const GetAdvertsTable = async (url) => {
    const res = await axios(url);
    const dom = new JSDOM(res.data);

    const is404 = dom.window.document.getElementsByClassName('emptynew')
    if (is404.length) return

    const table = dom.window.document.getElementById('offers_table')
    if (!table) return

    return table;

}
const isStoredAdvert = async (url) => {
    const client = await MongoClient.connect(mongoConnUrl, { useNewUrlParser: true })
        .catch(err => { console.log(err); });

    if (!client) return;

    try {
        const db = client.db("olx-bot");
        const collection = db.collection("adverts");
        return await collection.findOne({url})
    } catch (err) {
        console.log(err);
    } finally {
        client.close()
    }
}
const saveAdvert = async (keyUrl, valueUrl) => {
    const client = await MongoClient.connect(mongoConnUrl, { useNewUrlParser: true })
        .catch(err => { console.log(err); });

    if (!client) return;

    try {
        const db = client.db("olx-bot");
        const collection = db.collection("adverts");
        const data = {searchUrl: keyUrl, url: valueUrl}
        return await collection.insertOne(data);
    } catch (err) {
        console.log(err);
    } finally {
        client.close()
    }
}
const sendNotification = async (msg, photo) => {

    try {
        const res = await axios.get(`https://api.telegram.org/bot${token}/sendPhoto?`,
            { params:
                    {
                        chat_id: '@' + channelName,
                        photo,
                        parse_mode: "HTML",
                        caption: msg
                    }
            });

    }
    catch (e) {
        console.log(e)
    }
}
const getAdvertObj = (row) => {

    const linkItem = row.querySelectorAll('.title-cell a').item(0);
    return {
        href: linkItem.href,
        title: linkItem.textContent.trim(),
        img: row.querySelectorAll('.photo-cell img').item(0).src,
        price: row.querySelectorAll('.price').item(0).textContent.trim(),
        city: row.querySelectorAll('.bottom-cell span').item(0).textContent.trim()
    }

}

const run = () => {
    const searchUrls = [
        "https://www.olx.ua/uk/nedvizhimost/kvartiry/dolgosrochnaya-arenda-kvartir/kolomyya/?search%5Bdist%5D=5",
        "https://www.olx.ua/uk/nedvizhimost/posutochno-pochasovo/kolomyya/?search%5Bdist%5D=5"
    ]
    for (const searchUrl of searchUrls) {
        GetAdvertsTable(searchUrl)
            .then( async table => {
                if(!table) return;

                let rows = table.rows;
                if(!rows) return;

                for (let i = 0; i < rows.length; i++) {
                    const linkItem = rows[i].querySelectorAll('.title-cell a').item(0);
                    if(!linkItem) continue;

                    const advert = getAdvertObj(rows[i]);
                    if (! await isStoredAdvert(advert.href)) {
                        const msg = `Нове оголошення у місті <b>${advert.city}</b>\n<a href="${advert.href}">${advert.title}</a> \n\nЦіна <b>${advert.price}</b> \n\n<a href="${searchUrl}">Збережений пошук</a>`;
                        await sendNotification(msg, advert.img);
                        await saveAdvert(searchUrl, advert.href);
                    }
                }
            })
    }
}

run();
setInterval(() => run(), 60000);
