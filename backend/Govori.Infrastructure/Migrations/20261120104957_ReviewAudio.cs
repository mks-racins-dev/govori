using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Govori.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ReviewAudio : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ReviewAudioKey",
                table: "Attempts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReviewText",
                table: "Attempts",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReviewAudioKey",
                table: "Attempts");

            migrationBuilder.DropColumn(
                name: "ReviewText",
                table: "Attempts");
        }
    }
}
