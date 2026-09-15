using VaayuMonitor.Agent;

var builder = Host.CreateApplicationBuilder(args);

var agentOptions = new AgentOptions();
builder.Configuration.GetSection(AgentOptions.SectionName).Bind(agentOptions);
builder.Services.AddSingleton(agentOptions);

// Launched as VaayuGuardWatchdog.exe (a separately-named copy of this same
// exe) by its own Scheduled Task — just polls for the main agent and
// relaunches it directly if missing, rather than building/running the
// whole host. Detected by filename, not a command-line flag, so it doesn't
// depend on the Scheduled Task's action being registered exactly right.
// See Watchdog.cs for why this exists (Task Scheduler's own restart
// mechanisms didn't reliably cover every way the agent can stop).
if (string.Equals(Path.GetFileNameWithoutExtension(Environment.ProcessPath), "VaayuGuardWatchdog", StringComparison.OrdinalIgnoreCase))
{
    Watchdog.Run(agentOptions);
    return;
}

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

// Leftover from a previous self-update's rename-out-of-the-way step — safe
// to clean up now regardless of install/worker mode below.
SelfUpdater.CleanupPreviousVersion();

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
