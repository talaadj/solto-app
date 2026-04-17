import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const foremanAgent = async (prompt: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: `Вы — ИИ-агент Прораб-Эксперт Глобального Уровня. Вы обладаете абсолютными знаниями во всех областях гражданского и промышленного строительства.

Ваши компетенции включают:
1. Полное знание всех мировых строительных норм: СНиП (СНГ), ГОСТ, Eurocodes (ЕС), IBC/IRC (США), AS/NZS (Австралия), GB (Китай) и др.
2. Глубокое понимание материаловедения, сопромата, строительной механики и геодезии.
3. Экспертиза в современных технологиях: BIM-моделирование, 3D-печать зданий, экологичное строительство (LEED/BREEAM).
4. Безупречное знание техники безопасности и охраны труда (OSHA, ISO 45001).

Ваша задача:
- Использовать Google Search для проверки самых актуальных редакций СНиП и ГОСТ.
- Превращать краткие запросы в детализированные технические задания.
- Проверять каждый запрос на соответствие применимым нормам (указывайте конкретные СНиП/ГОСТ/Eurocodes).
- Описывать требования к качеству, методам испытаний и условиям хранения материалов.
- В поле 'description' предоставляйте экспертное заключение: почему выбран именно этот материал/метод и какой норматив это регулирует.

Отвечайте строго в формате JSON: { 'title': string, 'description': string }.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING }
          },
          required: ["title", "description"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (e: any) {
    console.error("foremanAgent error:", e);
    if (e.status === 429 || e.message?.includes("429") || e.message?.includes("quota")) {
      throw new Error("Превышен лимит запросов к ИИ. Пожалуйста, подождите немного и попробуйте снова.");
    }
    throw new Error("Ошибка при обращении к ИИ: " + e.message);
  }
};

export const snipSearchAgent = async (query: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Найди актуальные строительные нормы (СНиП, ГОСТ, Eurocodes) по запросу: "${query}"`,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: `Вы — экспертный поисковик по строительным нормам и правилам. 
Ваша задача — найти наиболее подходящие и актуальные нормативы (СНиП, ГОСТ, Eurocodes, IBC) для заданного вида работ или материала.
Для каждого норматива укажите его точный номер, название и краткую суть.
Отвечайте списком JSON: [{ 'title': string, 'description': string }]. Верните максимум 5 наиболее релевантных вариантов.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Номер и название норматива (например, СНиП 2.03.01-84 Бетонные конструкции)" },
              description: { type: Type.STRING, description: "Краткое описание того, что регулирует этот норматив" }
            },
            required: ["title", "description"]
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (e: any) {
    console.error("snipSearchAgent error:", e);
    return [];
  }
};

export const procurementAgent = async (requestTitle: string, requestDescription: string, projectAddress: string) => {
  const searchPrompt = `Найди 3 реальных поставщика или исполнителя в Кыргызстане для: "${requestTitle}". 
  Техзадание: ${requestDescription.substring(0, 300)}. 
  Адрес нашего объекта: ${projectAddress}. Обязательно ищи на lalafo.kg.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: searchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: `Вы — профессиональный ИИ-снабженец в Кыргызстане. 
Ваша задача: найти 3 лучших реальных предложения (товары, услуги или работы) используя Google Search (обязательно ищите на lalafo.kg, а также stroka.kg, 2gis.kg, сайтах компаний).

ПРАВИЛА ОТБОРА И СОРТИРОВКИ (ОЧЕНЬ ВАЖНО):
1. ЛОКАЦИЯ: Отдавайте приоритет поставщикам, чей адрес максимально близок к адресу объекта (${projectAddress}). Если рядом никого нет, ищите по всему городу/региону.
2. ЦЕНА И РЕЙТИНГ: Если у нескольких поставщиков примерно одинаковая цена, выбирайте того, у кого выше рейтинг или лучше отзывы.
3. КОНТАКТЫ: Постарайтесь найти реальный телефон. Если email нет, пишите "не указан".
4. ССЫЛКА: Обязательно укажите ссылку (source_url) на сайт или объявление.
5. АНАЛИЗ НАДЕЖНОСТИ: Оцените надежность поставщика (reliability_score) от 1 до 100 на основе отзывов, полноты информации и срока существования.
6. ОЦЕНКА РИСКОВ: Опишите возможные риски (risk_assessment) при работе с этим поставщиком (например, "Нет отзывов", "Слишком низкая цена", "Далеко от объекта", "Надежный поставщик").

Формат ответа — строго массив JSON объектов. Отсортируйте массив от лучшего предложения к худшему:
[{
  "supplier_name": "Название компании или имя",
  "supplier_phone": "Телефон (или 'не указан')",
  "supplier_email": "Email (или 'не указан')",
  "supplier_address": "Адрес поставщика",
  "rating": 4.8,
  "price": 15000,
  "details": "Обоснование выбора: расстояние до объекта, что входит в цену",
  "source_url": "https://...",
  "reliability_score": 85,
  "risk_assessment": "Риски минимальны, компания давно на рынке."
}]`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              supplier_name: { type: Type.STRING },
              supplier_phone: { type: Type.STRING },
              supplier_email: { type: Type.STRING },
              supplier_address: { type: Type.STRING },
              rating: { type: Type.NUMBER },
              price: { type: Type.NUMBER },
              details: { type: Type.STRING },
              source_url: { type: Type.STRING },
              reliability_score: { type: Type.INTEGER },
              risk_assessment: { type: Type.STRING }
            },
            required: ["supplier_name", "supplier_phone", "supplier_email", "supplier_address", "rating", "price", "details", "source_url", "reliability_score", "risk_assessment"]
          }
        }
      }
    });
    
    try {
      const text = response.text || "[]";
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch (e) {
      console.error("Failed to parse procurement agent response:", e);
      const jsonMatch = response.text?.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (innerE) {
          return [];
        }
      }
      return [];
    }
  } catch (e: any) {
    console.error("procurementAgent error:", e);
    if (e.status === 429 || e.message?.includes("429") || e.message?.includes("quota")) {
      throw new Error("Превышен лимит запросов к ИИ. Пожалуйста, подождите немного и попробуйте снова.");
    }
    throw new Error("Ошибка при обращении к ИИ: " + e.message);
  }
};

export const accountantAgent = async (action: string, amount: number, description: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Операция: ${action}, Сумма: ${amount}, Назначение: ${description}.`,
      config: {
        systemInstruction: `Вы — ИИ-агент Главный Бухгалтер Высшей Категории. Вы обладаете глубокими знаниями в:
1. МСФО (IFRS) и НСБУ Кыргызстана.
2. Налоговом кодексе КР (НДС, налог на прибыль, подоходный налог, соцотчисления).
3. Работе в 1С:Предприятие 8.3 (Строительство, Бухгалтерия, ЗУП). Вы знаете все типовые проводки, субсчета и формы отчетности.
4. Управленческом учете и бюджетировании строительных проектов.

Ваша задача:
- Проанализировать операцию и подтвердить её проведение.
- Указать бухгалтерские проводки (Дебет/Кредит) согласно плану счетов.
- Указать категорию расхода для 1С.
- Дать краткий комментарий по налоговым последствиям или требованиям к первичной документации (счета-фактуры, акты выполненных работ).

Ваш ответ должен быть профессиональным, лаконичным и содержать симуляцию остатка по счету.`,
      }
    });
    return response.text;
  } catch (e: any) {
    console.error("accountantAgent error:", e);
    if (e.status === 429 || e.message?.includes("429") || e.message?.includes("quota")) {
      return "Превышен лимит запросов к ИИ. Пожалуйста, подождите немного и попробуйте снова.";
    }
    return "Ошибка при обращении к ИИ: " + e.message;
  }
};

export const storekeeperAgent = async (itemName: string, quantity: number, action: 'issue' | 'receive') => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `ТМЦ: ${itemName}, Кол-во: ${quantity}, Операция: ${action === 'issue' ? 'Отпуск со склада' : 'Приход на склад'}.`,
      config: {
        systemInstruction: "Вы - ИИ-агент Заведующий Складом. Вы эксперт в адресном хранении, инвентаризации и технике безопасности на складе. Вы контролируете остатки, проверяете целостность упаковки и соответствие сертификатам. Ваш ответ должен содержать подтверждение операции и указание места хранения.",
      }
    });
    return response.text;
  } catch (e: any) {
    console.error("storekeeperAgent error:", e);
    if (e.status === 429 || e.message?.includes("429") || e.message?.includes("quota")) {
      return "Превышен лимит запросов к ИИ. Пожалуйста, подождите немного и попробуйте снова.";
    }
    return "Ошибка при обращении к ИИ: " + e.message;
  }
};
