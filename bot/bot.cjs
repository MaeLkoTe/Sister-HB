// Node.js 22+, без npm-зависимостей. Токен не передаётся на сайт.
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: sleep } = require('node:timers/promises');

class TelegramError extends Error {
  constructor(code, retryAfter = 5) {
    super(`Telegram API: ${code}`);
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

function loadConfig() {
  const localPath = path.join(__dirname, 'config.local.json');
  const defaults = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.example.json'), 'utf8'));
  const local = fs.existsSync(localPath) ? JSON.parse(fs.readFileSync(localPath, 'utf8')) : {};
  const config = { ...defaults, ...local };
  config.token = process.env.TELEGRAM_BOT_TOKEN || config.token;
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(config.token || '')) {
    throw new Error('Укажите токен BotFather в bot/config.local.json или TELEGRAM_BOT_TOKEN.');
  }
  const url = new URL(config.siteUrl);
  if (url.protocol !== 'https:') throw new Error('siteUrl должен начинаться с https://.');
  if (typeof config.message !== 'string' || !config.message.trim() || config.message.length > 4096) {
    throw new Error('message должен содержать от 1 до 4096 символов.');
  }
  if (typeof config.buttonText !== 'string' || !config.buttonText.trim()) {
    throw new Error('Заполните buttonText.');
  }
  config.recipientChatId = String(config.recipientChatId ?? '').trim();
  if (config.recipientChatId && (!/^[1-9]\d*$/.test(config.recipientChatId) || !Number.isSafeInteger(Number(config.recipientChatId)))) {
    throw new Error('recipientChatId должен содержать числовой Telegram ID пользователя.');
  }
  return config;
}

function createApi(token, signal) {
  return async (method, params = {}) => {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.any([signal, AbortSignal.timeout(45000)])
    });
    const body = await response.json();
    if (!body.ok) throw new TelegramError(body.error_code || response.status, body.parameters?.retry_after);
    return body.result;
  };
}

async function sendInvitation(chatId, api, config) {
  return api('sendMessage', {
    chat_id: chatId,
    text: config.message,
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: [[{ text: config.buttonText, url: config.siteUrl }]] }
  });
}

async function handleUpdate(update, api, config) {
  const message = update.message;
  if (message?.chat?.type !== 'private' || typeof message.text !== 'string') return;
  // Принимаем /start, /start с параметром и команды с @именем_бота.
  const command = message.text.trim().split(/\s/)[0].split('@')[0];
  if (command !== '/start' && command !== '/help') return;
  await sendInvitation(message.chat.id, api, config);
}

async function main() {
  const config = loadConfig();
  const shutdown = new AbortController();
  process.once('SIGINT', () => shutdown.abort());
  process.once('SIGTERM', () => shutdown.abort());
  const api = createApi(config.token, shutdown.signal);
  if (config.recipientChatId) {
    await sendInvitation(config.recipientChatId, api, config);
    console.log('Приглашение отправлено. Бот завершил работу. Повторный запуск отправит его ещё раз.');
    return;
  }
  const me = await api('getMe');
  const webhook = await api('getWebhookInfo');
  if (webhook.url) throw new Error('У бота настроен webhook. Используйте нового бота или отключите прежнюю интеграцию.');
  const statePath = path.join(__dirname, `.state-${me.id}.json`);
  let offset = 0;
  if (fs.existsSync(statePath)) {
    offset = JSON.parse(fs.readFileSync(statePath, 'utf8')).offset;
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Некорректный файл состояния бота.');
  }
  console.log(`Бот работает: https://t.me/${me.username}. Остановка: Ctrl+C.`);
  while (!shutdown.signal.aborted) {
    try {
      const updates = await api('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
      for (const update of updates) {
        if (shutdown.signal.aborted) break;
        try {
          await handleUpdate(update, api, config);
        } catch (error) {
          // Заблокировавший бота получатель не задерживает остальные сообщения.
          if (!(error instanceof TelegramError && error.code === 403)) throw error;
        }
        offset = update.update_id + 1;
        fs.writeFileSync(statePath, JSON.stringify({ offset }), { mode: 0o600 });
      }
    } catch (error) {
      if (shutdown.signal.aborted) break;
      if (error instanceof TelegramError && [400, 401, 404, 409].includes(error.code)) throw error;
      if (error.code && !(error instanceof TelegramError)) throw error;
      // Не печатаем исходные сетевые ошибки: они могут содержать URL с токеном.
      console.error('Временная ошибка связи или лимит Telegram. Повторяем запрос.');
      await sleep((error.retryAfter || 5) * 1000, undefined, { signal: shutdown.signal }).catch(() => {});
    }
  }
  console.log('Бот остановлен.');
}

if (require.main === module) {
  main().catch(error => {
    if (error instanceof TelegramError) {
      if (error.code === 403) {
        console.error('Telegram запретил отправку. Сестра должна заранее нажать «Старт» у этого бота и не блокировать его.');
      } else if (error.code === 400) {
        console.error('Telegram отклонил запрос. Проверьте числовой recipientChatId и текст; получатель должен заранее открыть бота и нажать «Старт».');
      } else {
        console.error(`Ошибка Telegram ${error.code}. Проверьте токен и убедитесь, что запущена только одна копия бота. При лимите отправки повторите запуск позже.`);
      }
    } else {
      console.error('Не удалось запустить бота. Проверьте конфиг, интернет и отсутствие webhook.');
    }
    process.exitCode = 1;
  });
}

module.exports = { loadConfig, createApi, handleUpdate, sendInvitation };
