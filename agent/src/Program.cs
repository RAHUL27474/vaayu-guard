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

builder.Services.AddHostedService<Worker>();

var host = builder.Build();
host.Run();
