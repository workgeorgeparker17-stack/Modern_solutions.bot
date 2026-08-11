# 🤖 Sotuv Manager Bot

Telegram orqali sotuv va buyurtmalarni boshqarish boti.

## 📋 Imkoniyatlar

- ✅ Xizmatlar ro'yxati va batafsil ma'lumotlar
- ✅ Narxlar va buyurtma berish
- ✅ Buyurtma qabul qilish (qadam-baqadam)
- ✅ Adminga avtomatik xabar yuborish
- ✅ FAQ (ko'p beriladigan savollar)
- ✅ Admin panel (/admin — statistika)

## 🚀 Ishga tushirish

### 1. Node.js o'rnatish

[Node.js](https://nodejs.org/) (v16+) o'rnatilgan bo'lishi kerak.

### 2. Loyihani yuklab olish

```bash
cd Sotuv_bot
```

### 3. Kutubxonalarni o'rnatish

```bash
npm install
```

### 4. `.env` faylni sozlash

`.env` faylni oching va quyidagi qiymatlarni kiriting:

```env
BOT_TOKEN=your_bot_token_here
ADMIN_CHAT_ID=your_admin_chat_id_here
```

**Bot token olish:**
1. Telegramda [@BotFather](https://t.me/BotFather) ga yozing
2. `/newbot` komandasi yuboring
3. Bot nomi va username kiriting
4. Token nusxalang va `.env` ga qo'ying

**Admin Chat ID olish:**
1. Telegramda [@userinfobot](https://t.me/userinfobot) ga yozing
2. `/start` yuboring
3. ID raqamini oling va `.env` ga qo'ying

### 5. Botni ishga tushirish

```bash
node bot.js
```

Muvaffaqiyatli ishga tushganda konsolda quyidagi xabar chiqadi:
```
✅ Bot muvaffaqiyatli ishga tushdi!
```

## 📁 Fayl tuzilishi

```
Sotuv_bot/
├── bot.js          # Asosiy bot kodi
├── data.json       # Foydalanuvchilar va buyurtmalar
├── .env            # Maxfiy sozlamalar (token, admin ID)
├── package.json    # Node.js loyiha fayli
└── README.md       # Hujjat (shu fayl)
```

## 🛠 Texnologiyalar

- **Node.js** — server
- **Telegraf** — Telegram Bot API kutubxonasi
- **dotenv** — muhit o'zgaruvchilari

## 📞 Bog'lanish

- Telegram: [@Jasur_Ulugbekovich17](https://t.me/Jasur_Ulugbekovich17)
- Telefon: +998880998803
