FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY EduMonitor.Gateway/EduMonitor.Gateway.csproj EduMonitor.Gateway/
RUN dotnet restore EduMonitor.Gateway/EduMonitor.Gateway.csproj
COPY EduMonitor.Gateway/ EduMonitor.Gateway/
RUN dotnet publish EduMonitor.Gateway/EduMonitor.Gateway.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_URLS=http://+:5000
EXPOSE 5000
ENTRYPOINT ["dotnet", "EduMonitor.Gateway.dll"]