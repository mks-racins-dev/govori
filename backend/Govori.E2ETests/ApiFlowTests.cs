using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Govori.E2ETests;

/// <summary>End-to-end scenarios the mobile app goes through, over real HTTP and a real database.</summary>
[Collection(ApiTestGroup.Name)]
public class ApiFlowTests(ApiFixture api)
{
    private static readonly byte[] FakeAudio = Enumerable.Range(0, 4096).Select(i => (byte)i).ToArray();

    [Fact]
    public async Task Health_is_public()
    {
        var res = await api.Anonymous().GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Theory]
    [InlineData("/topics/random")]
    [InlineData("/attempts")]
    [InlineData("/me")]
    [InlineData("/categories")]
    public async Task Protected_endpoints_require_sign_in(string url)
    {
        var res = await api.Anonymous().GetAsync(url);
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Ui_texts_include_the_progress_chart_strings()
    {
        var body = await api.Anonymous().GetFromJsonAsync<JsonElement>("/content/texts?locale=ru");
        var texts = body.GetProperty("texts");
        Assert.Equal("Ваш прогресс", texts.GetProperty("history.progress").GetString());
        Assert.Contains("{n}", texts.GetProperty("history.perWeeks").GetString());
    }

    [Fact]
    public async Task Full_flow_topic_record_evaluate_review_delete()
    {
        var http = await api.SignIn();

        // Today screen: categories and a random topic.
        var categories = await http.GetFromJsonAsync<JsonElement>("/categories");
        Assert.True(categories.GetArrayLength() > 0, "categories are seeded");
        var topic = await http.GetFromJsonAsync<JsonElement>("/topics/random");
        var topicId = topic.GetProperty("id").GetInt32();
        Assert.False(string.IsNullOrWhiteSpace(topic.GetProperty("text").GetString()));

        // Another topic, excluding the current one.
        var other = await http.GetFromJsonAsync<JsonElement>($"/topics/random?exclude={topicId}");
        Assert.NotEqual(topicId, other.GetProperty("id").GetInt32());

        // Record and upload.
        var id = await Upload(http, topicId, 60);

        // Worker transcribes and evaluates in the background; the app polls.
        var detail = await WaitForStatus(http, id, "Done");
        Assert.Equal(8, detail.GetProperty("evaluation").GetProperty("score").GetInt32());
        Assert.Equal(FakeTranscriber.DefaultText, detail.GetProperty("transcript").GetString());
        var metrics = detail.GetProperty("metrics");
        Assert.Equal(60, metrics.GetProperty("durationSec").GetInt32());
        var fillers = metrics.GetProperty("fillerWords");
        Assert.Equal(2, fillers.GetProperty("ну").GetInt32());
        Assert.Equal(1, fillers.GetProperty("как бы").GetInt32());
        Assert.Equal(1, fillers.GetProperty("типа").GetInt32());
        Assert.True(metrics.GetProperty("wordsPerMinute").GetInt32() > 0);

        // History list shows the score.
        var list = await http.GetFromJsonAsync<JsonElement>("/attempts");
        var item = Assert.Single(list.EnumerateArray());
        Assert.Equal(8, item.GetProperty("score").GetInt32());
        Assert.Equal("Done", item.GetProperty("status").GetString());

        // Profile stats.
        var me = await http.GetFromJsonAsync<JsonElement>("/me");
        Assert.Equal(1, me.GetProperty("attempts").GetInt32());
        Assert.Equal(8, me.GetProperty("averageScore").GetDouble());
        Assert.Equal(1, me.GetProperty("streakDays").GetInt32());

        // Playback returns the uploaded bytes.
        var audio = await http.GetByteArrayAsync($"/attempts/{id}/audio");
        Assert.Equal(FakeAudio, audio);

        // Delete.
        Assert.Equal(HttpStatusCode.NoContent, (await http.DeleteAsync($"/attempts/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await http.GetAsync($"/attempts/{id}")).StatusCode);
        Assert.Empty((await http.GetFromJsonAsync<JsonElement>("/attempts")).EnumerateArray());
    }

    [Fact]
    public async Task History_returns_scores_newest_first_for_the_progress_chart()
    {
        var http = await api.SignIn();
        var topicId = await TopicId(http);
        try
        {
            foreach (var score in new[] { 5, 6, 7, 9 })
            {
                api.Evaluator.Score = score;
                await WaitForStatus(http, await Upload(http, topicId, 55), "Done");
            }
        }
        finally { api.Evaluator.Score = 8; }

        var scores = (await http.GetFromJsonAsync<JsonElement>("/attempts")).EnumerateArray()
            .Select(a => a.GetProperty("score").GetInt32()).ToArray();
        Assert.Equal([9, 7, 6, 5], scores);

        var me = await http.GetFromJsonAsync<JsonElement>("/me");
        Assert.Equal(6.8, me.GetProperty("averageScore").GetDouble());
    }

    [Fact]
    public async Task Failed_evaluation_can_be_retried()
    {
        var http = await api.SignIn();
        api.Evaluator.FailNext(1);
        var id = await Upload(http, await TopicId(http), 60);

        var failed = await WaitForStatus(http, id, "Failed");
        Assert.False(string.IsNullOrWhiteSpace(failed.GetProperty("failureReason").GetString()));
        Assert.Equal(HttpStatusCode.NoContent, (await http.PostAsync($"/attempts/{id}/retry", null)).StatusCode);

        var done = await WaitForStatus(http, id, "Done");
        Assert.Equal(8, done.GetProperty("evaluation").GetProperty("score").GetInt32());
        // Retrying an attempt that already succeeded is rejected.
        Assert.Equal(HttpStatusCode.Conflict, (await http.PostAsync($"/attempts/{id}/retry", null)).StatusCode);
    }

    [Fact]
    public async Task Silence_is_reported_without_calling_the_ai()
    {
        var http = await api.SignIn();
        api.Transcriber.Next = "";
        try
        {
            var detail = await WaitForStatus(http, await Upload(http, await TopicId(http), 30), "Failed");
            Assert.Contains("речь", detail.GetProperty("failureReason").GetString());
            Assert.Equal(JsonValueKind.Null, detail.GetProperty("evaluation").ValueKind); // the AI was not asked
        }
        finally { api.Transcriber.Next = null; }
    }

    [Fact]
    public async Task Users_cannot_see_each_others_recordings()
    {
        var alice = await api.SignIn();
        var bob = await api.SignIn();
        var id = await Upload(alice, await TopicId(alice), 40);

        Assert.Equal(HttpStatusCode.NotFound, (await bob.GetAsync($"/attempts/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.GetAsync($"/attempts/{id}/audio")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.DeleteAsync($"/attempts/{id}")).StatusCode);
        Assert.Empty((await bob.GetFromJsonAsync<JsonElement>("/attempts")).EnumerateArray());
        Assert.Equal(HttpStatusCode.OK, (await alice.GetAsync($"/attempts/{id}")).StatusCode);
    }

    [Fact]
    public async Task Invalid_uploads_are_rejected()
    {
        var http = await api.SignIn();
        var topicId = await TopicId(http);

        var noAudio = new MultipartFormDataContent { { new StringContent(topicId.ToString(CultureInfo.InvariantCulture)), "topicId" }, { new StringContent("60"), "durationSec" } };
        Assert.Equal(HttpStatusCode.BadRequest, (await http.PostAsync("/attempts", noAudio)).StatusCode);

        Assert.Equal(HttpStatusCode.BadRequest, (await http.PostAsync("/attempts", Form(999_999, 60))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await http.PostAsJsonAsync("/attempts", new { topicId })).StatusCode);
    }

    [Fact]
    public async Task Daily_limit_is_enforced()
    {
        var http = await api.SignIn();
        var topicId = await TopicId(http);
        for (var i = 0; i < 20; i++)
            Assert.Equal(HttpStatusCode.OK, (await http.PostAsync("/attempts", Form(topicId, 10))).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await http.PostAsync("/attempts", Form(topicId, 10))).StatusCode);
    }

    [Fact]
    public async Task Deleting_the_account_removes_all_recordings()
    {
        var device = Guid.NewGuid().ToString();
        var http = await api.SignIn(device);
        var id = await Upload(http, await TopicId(http), 60);
        await WaitForStatus(http, id, "Done");

        Assert.Equal(HttpStatusCode.NoContent, (await http.DeleteAsync("/me")).StatusCode);

        // Signing in again on the same device starts from scratch.
        var again = await api.SignIn(device);
        Assert.Empty((await again.GetFromJsonAsync<JsonElement>("/attempts")).EnumerateArray());
        Assert.Equal(HttpStatusCode.NotFound, (await again.GetAsync($"/attempts/{id}")).StatusCode);
    }

    private static MultipartFormDataContent Form(int topicId, int durationSec)
    {
        var file = new ByteArrayContent(FakeAudio);
        file.Headers.ContentType = new("audio/mp4");
        return new MultipartFormDataContent
        {
            { file, "audio", "recording.m4a" },
            { new StringContent(topicId.ToString(CultureInfo.InvariantCulture)), "topicId" },
            { new StringContent(durationSec.ToString(CultureInfo.InvariantCulture)), "durationSec" },
        };
    }

    private static async Task<int> TopicId(HttpClient http) =>
        (await http.GetFromJsonAsync<JsonElement>("/topics/random")).GetProperty("id").GetInt32();

    private static async Task<Guid> Upload(HttpClient http, int topicId, int durationSec)
    {
        var res = await http.PostAsync("/attempts", Form(topicId, durationSec));
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        return (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
    }

    private static async Task<JsonElement> WaitForStatus(HttpClient http, Guid id, string status)
    {
        JsonElement detail = default;
        for (var i = 0; i < 100; i++)
        {
            detail = await http.GetFromJsonAsync<JsonElement>($"/attempts/{id}");
            if (detail.GetProperty("status").GetString() == status) return detail;
            await Task.Delay(200);
        }
        throw new TimeoutException($"Attempt {id} stayed '{detail.GetProperty("status").GetString()}', expected '{status}'");
    }
}
