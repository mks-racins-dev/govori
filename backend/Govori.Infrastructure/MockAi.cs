using Govori.Core;

namespace Govori.Infrastructure;

/// <summary>Used when no OpenAI key is configured, so the app works end to end in development.</summary>
public class MockTranscriber : ITranscriber
{
    public Task<Transcription> TranscribeAsync(Stream audio, string fileName, CancellationToken ct) =>
        Task.FromResult(new Transcription("Ну, это тестовая расшифровка. Добавьте ключ OpenAI в настройки бэкенда, " +
                        "чтобы получать настоящий текст вашей речи. Вот, как бы, и всё.", 0.96, ["расшифровка"]));
}

/// <summary>Used when no Anthropic key is configured.</summary>
public class MockSpeechEvaluator : ISpeechEvaluator
{
    // No review text: the worker falls back to the template review.
    public Task<Evaluated> EvaluateAsync(EvaluationRequest request, CancellationToken ct)
    {
        var rubric = new Rubric(
            new Criterion(2, "Мысль сказана прямо: «это тестовая расшифровка».", ""),
            new Criterion(1, "Довод есть, примера нет.", "Добавьте свой случай: «вчера я…»."),
            new Criterion(0, "Речь обрывается: «вот, как бы, и всё».", "Закончите фразой, которая подводит итог."),
            new Criterion(2, "Всё по теме.", ""),
            Delivery.Score(request.Metrics));
        return Task.FromResult(new Evaluated(new EvaluationResult(
            rubric.Total, null,
            "Это демонстрационная оценка. Добавьте ключ Anthropic, чтобы получать настоящий разбор.",
            ["Главная мысль прозвучала в первой фразе."],
            ["Закончите выводом, а не «вот и всё»."],
            ["За время подготовки придумайте последнюю фразу."],
            rubric,
            new Skeleton("это тестовая расшифровка", "добавьте ключ OpenAI", null, null)), Review: null));
    }
}
