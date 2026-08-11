/**
 * ============================================
 * SOTUV MANAGER BOT
 * Telegram orqali sotuv va buyurtmalarni boshqarish boti
 * Texnologiyalar: Node.js + Telegraf
 * ============================================
 */

// Kerakli kutubxonalarni yuklash
const { Telegraf, Markup, Scenes, session } = require('telegraf');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// .env fayldan sozlamalarni yuklash
dotenv.config();

// Bot tokenini va admin ID ni o'qish (Railway avtomatik tarzda process.env ga qo'shadi)
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.error('❌ BOT_TOKEN .env faylda kiritilmagan!');
    process.exit(1);
}

if (!ADMIN_CHAT_ID || ADMIN_CHAT_ID === 'YOUR_ADMIN_CHAT_ID_HERE') {
    console.error('❌ ADMIN_CHAT_ID .env faylda kiritilmagan!');
    process.exit(1);
}

// ============================================
// MA'LUMOTLAR BILAN ISHLASH (data.json)
// ============================================

const DATA_FILE = path.join(__dirname, 'data.json');

/**
 * data.json fayldan ma'lumotlarni o'qish
 * @returns {Object} — { users: [], orders: [] }
 */
function loadData() {
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch (err) {
        // Agar fayl yo'q bo'lsa, yangi yaratamiz
        const defaultData = { users: [], orders: [] };
        saveData(defaultData);
        return defaultData;
    }
}

/**
 * Ma'lumotlarni data.json faylga saqlash
 * @param {Object} data — saqlanadigan ma'lumot
 */
function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Yangi foydalanuvchini ro'yxatga qo'shish (agar yangi bo'lsa)
 * @param {number} userId — Telegram user ID
 * @param {string} username — Telegram username
 */
function addUser(userId, username) {
    const data = loadData();
    // Foydalanuvchi allaqachon ro'yxatda borligini tekshirish
    if (!data.users.find((u) => u.id === userId)) {
        data.users.push({
            id: userId,
            username: username || 'noma\'lum',
            joinedAt: new Date().toISOString(),
        });
        saveData(data);
        return true; // Yangi foydalanuvchi
    }
    return false; // Eski foydalanuvchi
}

/**
 * Yangi buyurtmani saqlash
 * @param {Object} order — buyurtma ma'lumotlari
 */
function addOrder(order) {
    const data = loadData();
    data.orders.push({
        ...order,
        createdAt: new Date().toISOString(),
    });
    saveData(data);
}

// ============================================
// BOT VA SCENE'LARNI SOZLASH
// ============================================

// Botni yaratish
const bot = new Telegraf(BOT_TOKEN);

// ============================================
// BUYURTMA WIZARD SCENE
// Foydalanuvchidan navbatma-navbat ma'lumot olish
// ============================================

const orderWizard = new Scenes.WizardScene(
    'order-wizard',

    // 1-qadam: Ismni so'rash
    async (ctx) => {
        await ctx.reply(
            '📝 *Buyurtma berish*\n\nIltimos, ismingizni kiriting:',
            { parse_mode: 'Markdown' }
        );
        // Wizard ma'lumotlarini saqlash uchun bo'sh obyekt
        ctx.wizard.state.orderData = {};
        return ctx.wizard.next();
    },

    // 2-qadam: Ismni olish va telefon raqamini so'rash
    async (ctx) => {
        if (ctx.message && ctx.message.text === '/start') {
            await ctx.scene.leave();
            return handleStart(ctx);
        }

        const text = ctx.message && ctx.message.text ? ctx.message.text.trim() : '';
        if (!text || text.startsWith('/') || text.length < 2) {
            await ctx.reply('❗ Iltimos, haqiqiy ismingizni so\'z bilan kiriting:');
            return;
        }

        ctx.wizard.state.orderData.name = text;
        await ctx.reply(
            '📱 Telefon raqamingizni kiriting yoki pastdagi tugmani bosing:',
            Markup.keyboard([
                [Markup.button.contactRequest('📱 Raqamni ulashish')]
            ])
                .oneTime()
                .resize()
        );
        return ctx.wizard.next();
    },

    // 3-qadam: Telefon raqamini olish va xizmatni so'rash
    async (ctx) => {
        if (ctx.message && ctx.message.text === '/start') {
            await ctx.scene.leave();
            return handleStart(ctx);
        }

        let phoneNum = '';
        if (ctx.message && ctx.message.contact) {
            phoneNum = ctx.message.contact.phone_number;
        } else if (ctx.message && ctx.message.text) {
            const text = ctx.message.text.trim();
            if (text.startsWith('/')) {
                await ctx.reply('❗ Komanda kiritmang. Raqamingizni yozing yoki tugmani bosing:');
                return;
            }
            phoneNum = text;
        } else {
            await ctx.reply('❗ Iltimos, "📱 Raqamni ulashish" tugmasini bosing yoki raqamingizni yozing:');
            return;
        }

        ctx.wizard.state.orderData.phone = phoneNum;

        // Remove the regular phone keyboard
        await ctx.reply('Rahmat!', { reply_markup: { remove_keyboard: true } });

        // Show inline menu for services
        await ctx.reply(
            '🛠 Qaysi xizmat kerak?\n\nQuyidagilardan birini tanlang:',
            Markup.inlineKeyboard([
                [Markup.button.callback('🤖 Telegram bot yasash', 'service_bot')],
                [Markup.button.callback('🌐 Veb-sayt yasash', 'service_web')],
                [Markup.button.callback('📱 SMM xizmati', 'service_smm')],
            ])
        );
        return ctx.wizard.next();
    },

    // 4-qadam: Xizmatni olish va qo'shimcha izoh so'rash
    async (ctx) => {
        if (ctx.message && ctx.message.text === '/start') {
            await ctx.scene.leave();
            return handleStart(ctx);
        }

        if (ctx.callbackQuery) {
            const serviceMap = {
                service_bot: '🤖 Telegram bot yasash',
                service_web: '🌐 Veb-sayt yasash',
                service_smm: '📱 SMM xizmati',
            };
            ctx.wizard.state.orderData.service = serviceMap[ctx.callbackQuery.data] || ctx.callbackQuery.data;
            await ctx.answerCbQuery();
            await ctx.reply('💬 Qo\'shimcha izoh bormi?\n\n(Agar yo\'q bo\'lsa, "Yo\'q" deb yozing)');
            return ctx.wizard.next();
        }

        const text = ctx.message && ctx.message.text ? ctx.message.text.trim() : '';
        if (!text || text.startsWith('/') || text.length < 2) {
            await ctx.reply('❗ Iltimos, xizmatni tugma orqali tanlang yoki nomini manoli yozing:');
            return;
        }

        ctx.wizard.state.orderData.service = text;
        await ctx.reply('💬 Qo\'shimcha izoh bormi?\n\n(Agar yo\'q bo\'lsa, "Yo\'q" deb yozing)');
        return ctx.wizard.next();
    },

    // 5-qadam: Izohni olish va buyurtmani yakunlash
    async (ctx) => {
        if (ctx.message && ctx.message.text === '/start') {
            await ctx.scene.leave();
            return handleStart(ctx);
        }

        const text = ctx.message && ctx.message.text ? ctx.message.text.trim() : '';
        if (!text || text.startsWith('/')) {
            await ctx.reply('❗ Iltimos, izohni to\'g\'ri matn ko\'rinishida yuboring (yoki "Yo\'q" deb yozing):');
            return;
        }
        ctx.wizard.state.orderData.comment = text;

        const order = ctx.wizard.state.orderData;
        const userId = ctx.from.id;
        const username = ctx.from.username || 'noma\'lum';

        // Buyurtmani data.json ga saqlash
        addOrder({
            userId,
            username,
            ...order,
        });

        // Foydalanuvchiga tasdiqlash xabarini yuborish
        await ctx.reply(
            '✅ *Buyurtmangiz qabul qilindi!*\n\n' +
            'Tez orada aloqaga chiqamiz. Rahmat! 🙏\n\n' +
            `📋 *Buyurtma ma'lumotlari:*\n` +
            `👤 Ism: ${order.name}\n` +
            `📱 Telefon: ${order.phone}\n` +
            `🛠 Xizmat: ${order.service}\n` +
            `💬 Izoh: ${order.comment}`,
            { parse_mode: 'Markdown' }
        );

        // Adminga xabar yuborish
        try {
            await bot.telegram.sendMessage(
                ADMIN_CHAT_ID,
                `🆕 <b>YANGI BUYURTMA!</b>\n\n` +
                `👤 Ism: ${order.name}\n` +
                `📱 Telefon: ${order.phone}\n` +
                `🛠 Xizmat: ${order.service}\n` +
                `💬 Izoh: ${order.comment}\n\n` +
                `📎 Telegram: @${username}\n` +
                `🆔 User ID: ${userId}\n` +
                `🕐 Vaqt: ${new Date().toLocaleString('uz-UZ')}`,
                { parse_mode: 'HTML' }
            );
        } catch (err) {
            console.error('❌ Adminga xabar yuborishda xato:', err.message);
        }

        // Asosiy menyuga qaytish
        await showMainMenu(ctx);

        // Wizarddan chiqish
        return ctx.scene.leave();
    }
);

// Scene'lar uchun stage yaratish
const stage = new Scenes.Stage([orderWizard]);

// Session va stage middleware'larni ulash
bot.use(session());
bot.use(stage.middleware());

// ============================================
// ASOSIY MENYU
// ============================================

/**
 * Asosiy menyuni ko'rsatish
 * Reply keyboard bilan 5 ta tugma
 */
async function showMainMenu(ctx) {
    await ctx.reply(
        '📌 *Asosiy menyu*\n\nQuyidagi tugmalardan birini tanlang:',
        {
            parse_mode: 'Markdown',
            ...Markup.keyboard([
                ['🛠 Xizmatlarimiz', '💰 Narxlar'],
                ['📝 Buyurtma berish', '📞 Bog\'lanish'],
                ['❓ Savollar'],
            ]).resize(),
        }
    );
}

/**
 * Botni ishga tushiruvchi yordamchi funksiya (/start va reset u.) 
 */
async function handleStart(ctx) {
    const isNewUser = addUser(ctx.from.id, ctx.from.username);
    const firstName = ctx.from.first_name || 'do\'stim';

    if (isNewUser) {
        await ctx.reply(
            `🎉 *Assalomu alaykum, ${firstName}!*\n\n` +
            '🏢 *Zamonaviy Yechimlar Bot*ga xush kelibsiz!\n\n' +
            'Biz sizga quyidagi xizmatlarni taklif etamiz:\n' +
            '🤖 Telegram bot yasash\n' +
            '🌐 Veb-sayt yasash\n' +
            '📱 SMM xizmati\n\n' +
            'Quyidagi tugmalardan birini tanlab boshlang! 👇',
            { parse_mode: 'Markdown' }
        );
    } else {
        await ctx.reply(
            `👋 *Qaytganingiz bilan, ${firstName}!*\n\n` +
            'Quyidagi menyudan kerakli bo\'limni tanlang 👇',
            { parse_mode: 'Markdown' }
        );
    }
    await showMainMenu(ctx);
}

bot.start(async (ctx) => {
    // Agar scene da turib bosilsa, oldingidan clean qilish shart emas 
    // chunki scene tashqarisida ishlaydi, baribir
    await handleStart(ctx);
});

// ============================================
// 1-TUGMA: XIZMATLARIMIZ
// ============================================

bot.hears('🛠 Xizmatlarimiz', async (ctx) => {
    await ctx.reply(
        '🛠 *Bizning xizmatlarimiz:*\n\nQuyidagilardan birini tanlang:',
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🤖 Telegram bot yasash', 'detail_bot')],
                [Markup.button.callback('🌐 Veb-sayt yasash', 'detail_web')],
                [Markup.button.callback('📱 SMM xizmati', 'detail_smm')],
            ]),
        }
    );
});

// Xizmatlar haqida batafsil ma'lumot — Telegram bot
bot.action('detail_bot', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
        '🤖 *Telegram Bot Yasash*\n\n' +
        'Sizning biznesingiz uchun bot yasab beramiz!\n\n' +
        '✅ Avtomatik javob beruvchi botlar\n' +
        '✅ Sotuv va buyurtma botlari\n' +
        '✅ CRM integratsiyasi\n' +
        '✅ To\'lov tizimlari bilan bog\'lash\n' +
        '✅ Admin panel va statistika\n\n' +
        '💰 Narx: *200 dollardan* boshlanadi\n' +
        '⏱ Muddat: *3-7 ish kuni*',
        { parse_mode: 'Markdown' }
    );
});

// Xizmatlar haqida batafsil ma'lumot — Veb-sayt
bot.action('detail_web', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
        '🌐 *Veb-sayt Yasash*\n\n' +
        'Zamonaviy veb-sayt yasab beramiz!\n\n' +
        '✅ Landing page va ko\'p sahifali saytlar\n' +
        '✅ Responsive dizayn (mobil moslashgan)\n' +
        '✅ SEO optimizatsiya\n' +
        '✅ Admin panel\n' +
        '✅ Domen va hosting yordam\n\n' +
        '💰 Narx: *300 dollardan* boshlanadi\n' +
        '⏱ Muddat: *7-14 ish kuni*',
        { parse_mode: 'Markdown' }
    );
});

// Xizmatlar haqida batafsil ma'lumot — SMM
bot.action('detail_smm', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
        '📱 *SMM Xizmati*\n\n' +
        'Ijtimoiy tarmoqlarni boshqaramiz!\n\n' +
        '✅ Kontent yaratish va joylashtirish\n' +
        '✅ Target reklama\n' +
        '✅ Auditoriya tahlili\n' +
        '✅ Oylik hisobot\n' +
        '✅ Instagram, Telegram, Facebook\n\n' +
        '💰 Narx: oyiga *150 dollar*\n' +
        '⏱ Shartnoma: *kamida 3 oy*',
        { parse_mode: 'Markdown' }
    );
});

// ============================================
// 2-TUGMA: NARXLAR
// ============================================

bot.hears('💰 Narxlar', async (ctx) => {
    await ctx.reply(
        '💰 *Narxlarimiz:*\n\n' +
        '🤖 *Telegram bot yasash*\n' +
        '└ 200 dollardan boshlanadi\n\n' +
        '🌐 *Veb-sayt yasash*\n' +
        '└ 300 dollardan boshlanadi\n\n' +
        '📱 *SMM xizmati*\n' +
        '└ Oyiga 150 dollar\n\n' +
        '👇 Buyurtma berish uchun quyidagi tugmalarni bosing:',
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🤖 Bot buyurtma berish', 'order_bot')],
                [Markup.button.callback('🌐 Sayt buyurtma berish', 'order_web')],
                [Markup.button.callback('📱 SMM buyurtma berish', 'order_smm')],
            ]),
        }
    );
});

// Narxlar sahifasidan buyurtma berish — xizmat tanlangan holda wizardga kirish
bot.action('order_bot', async (ctx) => {
    await ctx.answerCbQuery();
    // Wizardga kirish va xizmatni oldindan belgilash
    await ctx.scene.enter('order-wizard');
    // Xizmatni avtomatik belgilash uchun state o'rnatish
    ctx.wizard.state.preselectedService = '🤖 Telegram bot yasash';
});

bot.action('order_web', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter('order-wizard');
    ctx.wizard.state.preselectedService = '🌐 Veb-sayt yasash';
});

bot.action('order_smm', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter('order-wizard');
    ctx.wizard.state.preselectedService = '📱 SMM xizmati';
});

// ============================================
// 3-TUGMA: BUYURTMA BERISH
// ============================================

bot.hears('📝 Buyurtma berish', async (ctx) => {
    // Buyurtma wizard'ini boshlash
    await ctx.scene.enter('order-wizard');
});

// ============================================
// 4-TUGMA: BOG'LANISH
// ============================================

bot.hears('📞 Bog\'lanish', async (ctx) => {
    await ctx.reply(
        '📞 *Bog\'lanish uchun:*\n\n' +
        '💬 Telegram: @Jasur_Ulugbekovich17\n' +
        '🔗 Havola: https://t.me/Jasur_Ulugbekovich17\n\n' +
        '📱 Telefon: +998880998803\n\n' +
        '🕘 Ish vaqti: *09:00 — 18:00*\n' +
        '📅 Dushanba — Shanba\n\n' +
        'Sizga yordam berishdan mamnunmiz! 😊',
        { parse_mode: 'Markdown' }
    );
});

// ============================================
// 5-TUGMA: SAVOLLAR (FAQ)
// ============================================

bot.hears('❓ Savollar', async (ctx) => {
    await ctx.reply(
        '❓ *Ko\'p beriladigan savollar:*\n\nQuyidagilardan birini tanlang:',
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('⏱ Qancha vaqtda tayyor?', 'faq_time')],
                [Markup.button.callback('💳 To\'lov qanday?', 'faq_payment')],
                [Markup.button.callback('🛡 Kafolat bormi?', 'faq_warranty')],
            ]),
        }
    );
});

// FAQ javoblari
bot.action('faq_time', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
        '⏱ *Qancha vaqtda tayyor bo\'ladi?*\n\n' +
        'Loyihaning murakkabligiga qarab *3 kundan 14 kungacha* tayyor bo\'ladi.\n\n' +
        '• Oddiy bot: 3-5 kun\n' +
        '• Murakkab bot: 7-10 kun\n' +
        '• Veb-sayt: 7-14 kun\n' +
        '• SMM: doimiy xizmat',
        { parse_mode: 'Markdown' }
    );
});

bot.action('faq_payment', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
        '💳 *To\'lov qanday amalga oshiriladi?*\n\n' +
        'To\'lov ikki bosqichda:\n\n' +
        '1️⃣ *Yarmi oldindan* — ishni boshlash uchun\n' +
        '2️⃣ *Yarmi keyin* — ish tugagandan so\'ng\n\n' +
        '💰 To\'lov usullari: Click, Payme, naqd pul, USDT',
        { parse_mode: 'Markdown' }
    );
});

bot.action('faq_warranty', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
        '🛡 *Kafolat bormi?*\n\n' +
        '*Ha, albatta!* Biz 30 kun kafolat beramiz.\n\n' +
        '✅ 30 kun ichida barcha xatolarni *bepul tuzatamiz*\n' +
        '✅ Texnik yordam ko\'rsatamiz\n' +
        '✅ Kichik o\'zgarishlarni amalga oshiramiz\n\n' +
        'Sizning mamnunligingiz biz uchun muhim! 🤝',
        { parse_mode: 'Markdown' }
    );
});

// ============================================
// /admin KOMANDASI — ADMIN PANEL
// ============================================

bot.command('admin', async (ctx) => {
    // Faqat admin uchun ruxsat
    if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) {
        await ctx.reply('⛔ Bu komanda faqat admin uchun!');
        return;
    }

    const data = loadData();
    const totalUsers = data.users.length;
    const totalOrders = data.orders.length;

    // Oxirgi 5 ta buyurtma
    const recentOrders = data.orders.slice(-5).reverse();
    let recentOrdersText = '';

    if (recentOrders.length > 0) {
        recentOrdersText = '\n\n📋 *Oxirgi buyurtmalar:*\n';
        recentOrders.forEach((order, i) => {
            recentOrdersText +=
                `\n${i + 1}. 👤 ${order.name}\n` +
                `   📱 ${order.phone}\n` +
                `   🛠 ${order.service}\n` +
                `   🕐 ${order.createdAt}\n`;
        });
    } else {
        recentOrdersText = '\n\n📋 Hali buyurtmalar yo\'q.';
    }

    await ctx.reply(
        '📊 *ADMIN PANEL*\n\n' +
        `👥 Jami foydalanuvchilar: *${totalUsers}*\n` +
        `📦 Jami buyurtmalar: *${totalOrders}*\n` +
        recentOrdersText,
        { parse_mode: 'Markdown' }
    );
});

// ============================================
// NOMA'LUM XABARLARNI QAYTA ISHLASH
// ============================================

bot.on('text', async (ctx) => {
    // Agar foydalanuvchi scene ichida bo'lsa, bu handler ishlamaydi
    // Aks holda, asosiy menyuni ko'rsatish
    await ctx.reply(
        '🤔 Tushunmadim. Iltimos, menyudagi tugmalardan birini tanlang:',
    );
    await showMainMenu(ctx);
});

// ============================================
// BOTNI ISHGA TUSHIRISH
// ============================================

bot
    .launch()
    .then(() => {
        // Telegram uchun Main Menu comandalari tugmachasini yaratish
        bot.telegram.setMyCommands([
            { command: 'start', description: 'Botni qayta ishga tushirish' },
            { command: 'admin', description: 'Admin panel va Statistika' }
        ]);

        console.log('✅ Bot muvaffaqiyatli ishga tushdi!');
        console.log(`🤖 Bot nomi: Sotuv Manager Bot`);
        console.log(`👤 Admin Chat ID: ${ADMIN_CHAT_ID}`);
    })
    .catch((err) => {
        console.error('❌ Botni ishga tushirishda xato:', err.message);
        process.exit(1);
    });

// Graceful shutdown — Ctrl+C bosganda botni to'xtatish
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
