using Microsoft.Extensions.Logging;

namespace VaayuMonitor.Agent;

/// <summary>
/// Appends log lines to a plain text file under the data directory. Needed
/// because switching the exe to WinExe (no console window — see the csproj
/// comment on OutputType) means the default console logger's output goes
/// nowhere; without this there was no way to see what a running agent was
/// actually doing or failing on.
/// </summary>
public sealed class FileLoggerProvider(string logPath) : ILoggerProvider
{
    private readonly object _lock = new();

    public ILogger CreateLogger(string categoryName) => new FileLogger(categoryName, logPath, _lock);

    public void Dispose() { }

    private sealed class FileLogger(string categoryName, string logPath, object writeLock) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Information;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel)) return;

            var line = $"{DateTimeOffset.Now:yyyy-MM-dd HH:mm:ss} [{logLevel}] {categoryName}: {formatter(state, exception)}";
            if (exception is not null) line += Environment.NewLine + exception;

            try
            {
                lock (writeLock)
                {
                    File.AppendAllText(logPath, line + Environment.NewLine);
                }
            }
            catch
            {
                // Best-effort — logging must never be why the agent crashes.
            }
        }
    }
}
