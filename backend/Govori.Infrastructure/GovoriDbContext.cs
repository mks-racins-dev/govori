using Govori.Core;
using Microsoft.EntityFrameworkCore;

namespace Govori.Infrastructure;

public class GovoriDbContext(DbContextOptions<GovoriDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Topic> Topics => Set<Topic>();
    public DbSet<Attempt> Attempts => Set<Attempt>();
    public DbSet<Evaluation> Evaluations => Set<Evaluation>();
    public DbSet<UiText> UiTexts => Set<UiText>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>().HasIndex(u => u.AppleSub).IsUnique();
        b.Entity<Category>().HasIndex(c => c.Name).IsUnique();
        b.Entity<Topic>().HasIndex(t => new { t.CategoryId, t.Text }).IsUnique();
        b.Entity<Evaluation>().HasKey(e => e.AttemptId);
        b.Entity<Evaluation>().Property(e => e.Json).HasColumnType("jsonb");
        b.Entity<Attempt>().HasOne(a => a.Evaluation).WithOne().HasForeignKey<Evaluation>(e => e.AttemptId);
        b.Entity<Attempt>().HasIndex(a => new { a.UserId, a.CreatedAt });
        b.Entity<UiText>().HasKey(t => new { t.Locale, t.Key });
        b.Entity<AppSetting>().HasKey(s => s.Key);
    }
}
