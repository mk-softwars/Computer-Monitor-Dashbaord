using System.Net.WebSockets;
using System.Text.Json;
using System.Text.Json.Serialization;
using ComputerMonitor.Contracts;
using ComputerMonitor.Monitoring;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://127.0.0.1:0");
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddSingleton<HardwareMonitor>();
builder.Services.AddSingleton<SettingsStore>();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
});

var app = builder.Build();
app.UseCors();
app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(15) });

var token = Environment.GetEnvironmentVariable("COMPUTER_MONITOR_TOKEN");
if (string.IsNullOrWhiteSpace(token))
{
    token = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
    Console.Error.WriteLine("COMPUTER_MONITOR_TOKEN was not provided; generated a temporary token.");
}

app.Use(async (context, next) =>
{
    var supplied = context.Request.Headers["X-Monitor-Token"].FirstOrDefault()
                   ?? context.Request.Query["token"].FirstOrDefault();
    if (!System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
            System.Text.Encoding.UTF8.GetBytes(supplied ?? ""),
            System.Text.Encoding.UTF8.GetBytes(token)))
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return;
    }
    await next();
});

app.MapGet("/api/status", () => Results.Ok(new { status = "online", service = "ComputerMonitor" }));
app.MapGet("/api/settings", (SettingsStore settings) => settings.Get());
app.MapPost("/api/settings", (MonitorSettings value, SettingsStore settings) => Results.Ok(settings.Update(value)));

app.MapGet("/ws", async (HttpContext context, HardwareMonitor monitor, SettingsStore settings) =>
{
    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        return;
    }

    using var socket = await context.WebSockets.AcceptWebSocketAsync();
    while (socket.State == WebSocketState.Open && !context.RequestAborted.IsCancellationRequested)
    {
        try
        {
            var current = settings.Get();
            var snapshot = monitor.Capture(current);
            await socket.SendAsJsonAsync(snapshot, app.Services.GetRequiredService<
                Microsoft.Extensions.Options.IOptions<Microsoft.AspNetCore.Http.Json.JsonOptions>>().Value.SerializerOptions,
                context.RequestAborted);
            await Task.Delay(current.RefreshIntervalMs, context.RequestAborted);
        }
        catch (OperationCanceledException)
        {
            break;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Sensor sample failed: {ex.Message}");
            await Task.Delay(1500, context.RequestAborted);
        }
    }
});

await app.StartAsync();
var address = app.Services.GetRequiredService<IServer>()
    .Features.Get<IServerAddressesFeature>()?.Addresses.FirstOrDefault();
if (address is null) throw new InvalidOperationException("The monitor service failed to bind to loopback.");
Console.WriteLine($"MONITOR_READY {address}");
await app.WaitForShutdownAsync();

static class WebSocketJsonExtensions
{
    public static Task SendAsJsonAsync<T>(this WebSocket socket, T value, JsonSerializerOptions options,
        CancellationToken cancellationToken)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(value, options);
        return socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, cancellationToken);
    }
}
