using VaayuMonitor.Agent;

var builder = Host.CreateApplicationBuilder(args);

var agentOptions = new AgentOptions();
builder.Configuration.GetSection(AgentOptions.SectionName).Bind(agentOptions);
builder.Services.AddSingleton(agentOptions);

builder.Services.AddSingleton<WindowScanner>();
builder.Services.AddSingleton<LocalQueue>();
builder.Services.AddHttpClient<BackendClient>(client =>
{
    client.BaseAddress = new Uri(agentOptions.BackendBaseUrl);
    client.Timeout = TimeSpan.FromSeconds(20);
});
builder.Services.AddHttpClient<SelfUpdater>(client =>
{
    client.BaseAddress = new Uri(agentOptions.BackendBaseUrl);
    client.Timeout = TimeSpan.FromMinutes(2); // downloading the exe can take a while
});

builder.Services.AddHostedService<Worker>();

var host = builder.Build();

// Double-clicked from Downloads/Desktop/wherever instead of running from
// the installed location — act as our own installer instead of starting
// the background worker in place.
if (!Installer.IsRunningInstalled(agentOptions))
{
    var installLogger = host.Services.GetRequiredService<ILogger<Program>>();
    Installer.Run(agentOptions, installLogger);
    return;
}

host.Run();
