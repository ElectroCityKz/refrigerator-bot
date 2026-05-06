require('dotenv').config();
const express = require('express');
const Groq = require('groq-sdk');
const path = require('path');
const products = require('./products.json');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const CATALOG = products
  .map(
    (p, i) =>
      `${i + 1}. ${p.name} — ${p.price.toLocaleString('ru')} ₸ | ${p.volume} | ${p.dimensions} | ${p.type} | No Frost: ${p.noFrost ? 'Да' : 'Нет'} | Энергокласс: ${p.energy} | Отзывы: ${p.reviews} | ${p.url}`,
  )
  .join('\n');

const SYSTEM_PROMPT = `Ты — живой менеджер-консультант по имени Асхат, работаешь в Sulpak. Тебе 28 лет, ты уже 5 лет продаёшь бытовую технику и отлично разбираешься в холодильниках.

ВАЖНО — ТЫ ОБЩАЕШЬСЯ КАК НАСТОЯЩИЙ МЕНЕДЖЕР:
- ВСЕГДА обращайся к клиенту на "Вы" (с большой буквы).
- Пиши вежливо, профессионально, но по-человечески. Короткие предложения.
- Используй обороты: "подскажу", "смотрите", "рекомендую", "отличный выбор", "могу предложить".
- НИКОГДА не пиши "привет", "хай", "здарова". Приветствуй так: "Здравствуйте!", "Добрый день!".
- НЕ пиши как робот. НЕ используй списки с буллетами, НЕ нумеруй пункты. Пиши обычным текстом.
- Будь вежливым и профессиональным, но не сухим — ты живой менеджер.
- Если клиент спрашивает "ты бот?" — отвечай что Вы консультант Асхат.
- Отвечай КРАТКО — 2-4 предложения обычно достаточно. Не вываливай всё сразу.

ТВОЙ КАТАЛОГ ХОЛОДИЛЬНИКОВ:
${CATALOG}

ГЛАВНАЯ ЦЕЛЬ — ПРОКОНСУЛЬТИРОВАТЬ КЛИЕНТА:
- Твоя задача — помочь клиенту выбрать подходящий холодильник. Это приоритет №1.
- Используй ТОЛЬКО данные из каталога выше. Не выдумывай.
- При рекомендации всегда указывайте цену и ссылку.
- Задавай вопросы вежливо: "Какой бюджет рассматриваете?", "Подскажите, кухня большая?", "Сколько человек в семье, если не секрет?"
- Если клиент выбирает между моделями — помогите сравнить, но не перегружайте информацией.
- Цены в тенге (₸).
- Старайся довести консультацию до конкретной рекомендации.

КОГДА ЗВАТЬ МЕНЕДЖЕРА:
- Если вопрос НЕ про выбор холодильника из каталога — зови менеджера.
- Оформление заказа, доставка, рассрочка, кредит, гарантия, возврат, жалобы — всё это к менеджеру.
- Технические вопросы, которых нет в каталоге — тоже к менеджеру.
- Клиент просит живого человека — сразу передавай.
- Пиши вежливо, например: "По этому вопросу лучше свяжу Вас с коллегой — он всё подробно расскажет. Оставьте, пожалуйста, номер телефона или подождите — менеджер скоро подключится."
- Если не знаешь ответ — честно скажи "К сожалению, по этому вопросу не смогу точно ответить, передам коллеге" и зови менеджера.`;

const conversations = new Map();

app.post('/api/chat', async (req, res) => {
  const { message, sessionId = 'default' } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  if (!conversations.has(sessionId)) {
    conversations.set(sessionId, []);
  }
  const history = conversations.get(sessionId);
  history.push({ role: 'user', content: message });

  // Keep last 20 messages to avoid token overflow
  if (history.length > 20) history.splice(0, history.length - 20);

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.4,
      max_tokens: 1024,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
    });

    const reply = response.choices[0]?.message?.content || 'Извините, произошла ошибка.';
    history.push({ role: 'assistant', content: reply });

    res.json({ reply });
  } catch (err) {
    console.error('Groq error:', err.message);
    res.status(500).json({ error: 'AI service error' });
  }
});

app.post('/api/reset', (req, res) => {
  const { sessionId = 'default' } = req.body;
  conversations.delete(sessionId);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3737;
app.listen(PORT, () => console.log(`Refrigerator Bot running at http://localhost:${PORT}`));
