FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY EduMonitor.Core/EduMonitor.Core.csproj EduMonitor.Core/
COPY EduMonitor.Infrastructure/EduMonitor.Infrastructure.csproj EduMonitor.Infrastructure/
COPY EduMonitor.Api/EduMonitor.Api.csproj EduMonitor.Api/
RUN dotnet restore EduMonitor.Api/EduMonitor.Api.csproj
COPY EduMonitor.Core/ EduMonitor.Core/
COPY EduMonitor.Infrastructure/ EduMonitor.Infrastructure/
COPY EduMonitor.Api/ EduMonitor.Api/
RUN dotnet publish EduMonitor.Api/EduMonitor.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_URLS=http://+:5102
EXPOSE 5102
ENTRYPOINT ["dotnet", "EduMonitor.Api.dll"]