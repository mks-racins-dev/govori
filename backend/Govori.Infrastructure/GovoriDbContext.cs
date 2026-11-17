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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>().HasIndex(u => u.AppleSub).IsUnique();
        modelBuilder.Entity<Category>().HasIndex(c => c.Name).IsUnique();
        modelBuilder.Entity<Topic>().HasIndex(t => new { t.CategoryId, t.Text }).IsUnique();
        modelBuilder.Entity<Evaluation>().HasKey(e => e.AttemptId);
        modelBuilder.Entity<Evaluation>().Property(e => e.Json).HasColumnType("jsonb");
        modelBuilder.Entity<Attempt>().HasOne(a => a.Evaluation).WithOne().HasForeignKey<Evaluation>(e => e.AttemptId);
        modelBuilder.Entity<Attempt>().HasIndex(a => new { a.UserId, a.CreatedAt });
        modelBuilder.Entity<UiText>().HasKey(t => new { t.Locale, t.Key });
        modelBuilder.Entity<AppSetting>().HasKey(s => s.Key);
    }
}
