using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Govori.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class TopicBankAndClarity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Genre",
                table: "Topics",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Hint",
                table: "Topics",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Technique",
                table: "Topics",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<double>(
                name: "Clarity",
                table: "Attempts",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UnclearWords",
                table: "Attempts",
                type: "text",
                nullable: true);

            // The new topic bank replaces the old one. Old topics are switched off, not deleted, so past attempts
            // keep their topic; the seeder switches back on the ones that are also in the new bank.
            migrationBuilder.Sql("""UPDATE "Topics" SET "IsActive" = false WHERE "Genre" = '';""");
            // The "new" badge moves to the categories added with the bank.
            migrationBuilder.Sql("""UPDATE "Categories" SET "Badge" = NULL WHERE "Name" = 'Жизнь' AND "Badge" = 'НОВОЕ';""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Genre",
                table: "Topics");

            migrationBuilder.DropColumn(
                name: "Hint",
                table: "Topics");

            migrationBuilder.DropColumn(
                name: "Technique",
                table: "Topics");

            migrationBuilder.DropColumn(
                name: "Clarity",
                table: "Attempts");

            migrationBuilder.DropColumn(
                name: "UnclearWords",
                table: "Attempts");
        }
    }
}
