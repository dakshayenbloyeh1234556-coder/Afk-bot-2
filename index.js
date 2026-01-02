const mineflayer = require('mineflayer');
const express = require('express');
const {
  pathfinder,
  Movements,
  goals: { GoalBlock }
} = require('mineflayer-pathfinder');

const config = require('./settings.json');

/* =====================
   KEEP ALIVE SERVER (Replit-friendly)
===================== */
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('AFK Bot running');
});

app.listen(PORT, () => {
  console.log(`[KEEP_ALIVE] Server is running on port ${PORT}`);
});

/* =====================
   CREATE BOT
===================== */
function createBot() {
  const bot = mineflayer.createBot({
    username: config['bot-account'].username,
    password: config['bot-account'].password,
    auth: config['bot-account'].type,
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version
  });

  bot.loadPlugin(pathfinder);

  /* =====================
     AUTO AUTH
  ===================== */
  function autoAuth() {
    const pw = config.utils['auto-auth'].password;
    bot.chat(`/register ${pw} ${pw}`);
    setTimeout(() => bot.chat(`/login ${pw}`), 2000);
  }

  bot.once('spawn', () => {
    console.log('[BOT] Spawned');

    const mcData = require('minecraft-data')(bot.version);
    const movements = new Movements(bot, mcData);
    bot.pathfinder.setMovements(movements);

    if (config.utils['auto-auth'].enabled) {
      setTimeout(autoAuth, 1500);
    }

    /* =====================
       CHAT MESSAGES
    ===================== */
    if (config.utils['chat-messages'].enabled) {
      const msgs = config.utils['chat-messages'].messages;
      let i = 0;
      setInterval(() => {
        bot.chat(msgs[i]);
        i = (i + 1) % msgs.length;
      }, config.utils['chat-messages']['repeat-delay'] * 1000);
    }

    /* =====================
       SNEAK + JUMP ANTI AFK
    ===================== */
    if (config.utils['anti-afk'].enabled) {
      bot.setControlState('jump', true);
      bot.setControlState('sneak', true);
    }

    /* =====================
       NORMAL RANDOM WALK
    ===================== */
    function randomWalk() {
      const pos = bot.entity.position;
      const x = pos.x + Math.floor(Math.random() * 6 - 3);
      const z = pos.z + Math.floor(Math.random() * 6 - 3);
      bot.pathfinder.setGoal(new GoalBlock(x, pos.y, z));
    }

    bot.on('goal_reached', () => {
      setTimeout(randomWalk, 2000);
    });

    randomWalk();

    /* =====================
       BREAK & PLACE BLOCK
    ===================== */
    async function breakAndPlace() {
      const block = bot.blockAt(bot.entity.position.offset(0, -1, 1));
      if (!block || block.name === 'air') return;
      if (!bot.canDigBlock(block)) return;

      try {
        await bot.dig(block);

        const item = bot.inventory.items().find(i => i.name === block.name);
        if (!item) return;

        await bot.equip(item, 'hand');
        const refBlock = bot.blockAt(bot.entity.position.offset(0, -1, 0));
        await bot.placeBlock(refBlock, { x: 0, y: 1, z: 0 });

      } catch (err) {
        console.log('[WARN] Break/place failed:', err.message);
      }
    }

    setInterval(breakAndPlace, 10000);
  });

  /* =====================
     AUTO RECONNECT
  ===================== */
  if (config.utils['auto-reconnect']) {
    bot.on('end', () => {
      console.log('[BOT] Reconnecting...');
      setTimeout(createBot, config.utils['auto-reconnect-delay']);
    });
  }

  bot.on('kicked', r => console.log('[BOT] Kicked:', r));
  bot.on('error', e => console.log('[ERROR]', e.message));
}

createBot();