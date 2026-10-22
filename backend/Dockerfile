# Build and run the Govori API. Railway builds this file from the backend/ directory.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Govori.Core/Govori.Core.csproj Govori.Core/
COPY Govori.Infrastructure/Govori.Infrastructure.csproj Govori.Infrastructure/
COPY Govori.Api/Govori.Api.csproj Govori.Api/
RUN dotnet restore Govori.Api/Govori.Api.csproj
COPY . .
RUN dotnet publish Govori.Api/Govori.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
# Npgsql probes for GSSAPI on connect; without the library it logs an error on every connection.
RUN apt-get update && apt-get install -y --no-install-recommends libgssapi-krb5-2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_ENVIRONMENT=Production
USER app
ENTRYPOINT ["dotnet", "Govori.Api.dll"]
