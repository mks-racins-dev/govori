using Govori.Core;

namespace Govori.Infrastructure;

/// <summary>Used when no OpenAI key is configured, so the app works end to end in development.</summary>
public class MockTranscriber : ITranscriber
{
    public Task<string> TranscribeAsync(Stream audio, string fileName, CancellationToken ct) =>
        Task.FromResult("Ну, это тестовая расшифровка. Добавьте ключ OpenAI в настройки бэкенда, " +
                        "чтобы получать настоящий текст вашей речи. Вот, как бы, и всё.");
}

/// <summary>Used when no Anthropic key is configured.</summary>
public class MockSpeechEvaluator : ISpeechEvaluator
{
    public Task<EvaluationResult> EvaluateAsync(string topic, string transcript, SpeechMetrics metrics, CancellationToken ct) =>
        Task.FromResult(new EvaluationResult(
            Score: 7,
            SubScores: new SubScores(7, 8, 6, 6, 7),
            Summary: "Это демонстрационная оценка. Добавьте ключ Anthropic, чтобы получать настоящий разбор.",
            Strengths: ["Вы уверенно начали выступление", "Мысль соответствовала теме"],
            Improvements: ["Меньше слов-паразитов", "Добавьте чёткий вывод в конце"],
            Suggestions: ["Используйте структуру «тезис — пример — вывод»", "Делайте паузу вместо «э-э»"]));
}
