namespace Govori.Core;

public enum AttemptStatus { Recording, Processing, Done, Failed }

public class User
{
    public Guid Id { get; set; }
    public string AppleSub { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string? Badge { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public class Topic
{
    public int Id { get; set; }
    public string Text { get; set; } = "";
    public int CategoryId { get; set; }
    public Category? Category { get; set; }
    /// <summary>1 easy, 2 medium, 3 hard. Also sets the prep time.</summary>
    public int Difficulty { get; set; }

    /// <summary>Format of the task, e.g. "Если бы…" or "Продайте предмет". Empty for legacy topics.</summary>
    public string Genre { get; set; } = "";

    /// <summary>A speaking technique suggested for this topic, e.g. "Правило трёх". Not scored.</summary>
    public string Technique { get; set; } = "";

    /// <summary>A one-line hint shown during preparation.</summary>
    public string Hint { get; set; } = "";
    public bool IsActive { get; set; } = true;
}

/// <summary>A UI string shown in the app, editable without an app release.</summary>
public class UiText
{
    public string Locale { get; set; } = "ru";
    public string Key { get; set; } = "";
    public string Value { get; set; } = "";
    public DateTime UpdatedAt { get; set; }
}

/// <summary>Server-side text such as AI prompts and filler-word lists.</summary>
public class AppSetting
{
    public string Key { get; set; } = "";
    public string Value { get; set; } = "";
}

public class Attempt
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public int TopicId { get; set; }
    public Topic? Topic { get; set; }
    public string AudioKey { get; set; } = "";
    public int DurationSec { get; set; }
    public AttemptStatus Status { get; set; }
    public string? Transcript { get; set; }
    public string? FailureReason { get; set; }

    /// <summary>Share of words the transcriber heard confidently (0–1); null when it gave no confidence data.</summary>
    public double? Clarity { get; set; }

    /// <summary>Words heard least confidently, newline-separated.</summary>
    public string? UnclearWords { get; set; }

    /// <summary>Storage key of the spoken AI review; null when it was not generated.</summary>
    public string? ReviewAudioKey { get; set; }

    /// <summary>The text of the spoken review, kept so later reviews can avoid repeating its phrasing.</summary>
    public string? ReviewText { get; set; }
    public DateTime CreatedAt { get; set; }
    public Evaluation? Evaluation { get; set; }
}

public class Evaluation
{
    public Guid AttemptId { get; set; }
    public int Score { get; set; }
    public string Json { get; set; } = "";
}
