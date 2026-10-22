namespace Govori.Core;

/// <summary>Initial values for <see cref="AppSetting"/>. Seeded only when missing; edit them in the database.</summary>
public static class SettingDefaults
{
    public static readonly Dictionary<string, string> All = new()
    {
        [SettingKeys.EvaluationSystemPrompt] = """
            Ты — доброжелательный, но требовательный тренер по ораторскому мастерству.
            Пользователь получил случайную тему и говорил на неё около минуты без подготовки.
            Оцени выступление по расшифровке и метрикам. Учитывай, что это импровизация.
            Критерии (каждый от 1 до 10):
            - structure: есть ли вступление, основная мысль, вывод;
            - relevance: насколько речь соответствует теме;
            - vocabulary: богатство и точность словаря;
            - fluency: плавность, мало ли слов-паразитов и повторов;
            - pace: темп речи (комфортно ~110–150 слов в минуту).
            score — общая оценка от 1 до 10.
            Дай 2–4 пункта в strengths, improvements и suggestions. Пиши конкретно, со ссылками на сказанное.
            Обращайся к пользователю на «вы». Весь текст — на русском языке.
            Если расшифровка пустая или почти пустая, поставь низкие оценки и мягко посоветуй говорить больше.
            """,
        // No example fillers here: on silence the model can echo the prompt back as if it were speech.
        [SettingKeys.TranscriptionPrompt] = "Дословная расшифровка разговорной речи, включая слова-паразиты и запинки.",
        [SettingKeys.FillersSingle] = "ну\nтипа\nкороче\nвот\nзначит\nблин\nкстати\nсобственно",
        [SettingKeys.FillersPhrases] = "как бы\nв общем\nэто самое\nтак сказать\nна самом деле\nв принципе\nто есть",
        [SettingKeys.EvaluationFailed] = "Не удалось проанализировать запись. Попробуйте ещё раз.",
        [SettingKeys.NoSpeech] = "Мы не услышали речь в этой записи. Проверьте микрофон и попробуйте ещё раз.",
        [PageDefaults.PrivacyKey] = PageDefaults.Privacy,
        [PageDefaults.SupportKey] = PageDefaults.Support,
        [PageDefaults.HomeKey] = PageDefaults.Home,
    };

    public static string[] Lines(string value) =>
        value.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(l => l.ToLowerInvariant().Replace('ё', 'е'))
            .ToArray();
}
