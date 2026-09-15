using Microsoft.Data.Sqlite;

namespace VaayuMonitor.Agent;

public record QueuedEvent(
    long Id,
    DateTimeOffset CapturedAt,
    string ProcessName,
    string WindowTitle,
    ActivityChannel Channel,
    string? DetectedIdentity,
    bool IsMismatch,
    EventConfidence Confidence,
    bool IsForeground);

public record QueuedWindowActivity(
    long Id,
    DateTimeOffset CapturedAt,
    string ProcessName,
    string WindowTitle,
    bool IsForeground);

/// <summary>
/// SQLite-backed offline queue at %ProgramData%\VaayuGuard\queue.db. Events
/// are written here first so nothing is lost if the PC is offline for days;
/// a separate sync step marks rows synced only once the backend accepts
/// them.
/// </summary>
public class LocalQueue
{
    private readonly string _connectionString;

    public LocalQueue(AgentOptions options)
    {
        var dbPath = Path.Combine(options.ResolveDataDirectory(), "queue.db");
        _connectionString = $"Data Source={dbPath}";
        Initialize();
    }

    private void Initialize()
    {
        using var conn = Open();
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = """
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    captured_at TEXT NOT NULL,
                    process_name TEXT NOT NULL,
                    window_title TEXT NOT NULL,
                    channel TEXT NOT NULL,
                    detected_identity TEXT,
                    is_mismatch INTEGER NOT NULL,
                    confidence TEXT NOT NULL,
                    is_foreground INTEGER NOT NULL DEFAULT 0,
                    synced INTEGER NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_events_unsynced ON events (synced);

                CREATE TABLE IF NOT EXISTS window_activity (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    captured_at TEXT NOT NULL,
                    process_name TEXT NOT NULL,
                    window_title TEXT NOT NULL,
                    is_foreground INTEGER NOT NULL DEFAULT 0,
                    synced INTEGER NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_window_activity_unsynced ON window_activity (synced);
                """;
            cmd.ExecuteNonQuery();
        }

        // A queue.db from before is_foreground existed won't have the
        // column — CREATE TABLE IF NOT EXISTS leaves it untouched, so add
        // it explicitly for machines that already ran an older build.
        bool hasColumn;
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = "SELECT COUNT(*) FROM pragma_table_info('events') WHERE name = 'is_foreground';";
            hasColumn = Convert.ToInt64(cmd.ExecuteScalar()) > 0;
        }
        if (!hasColumn)
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "ALTER TABLE events ADD COLUMN is_foreground INTEGER NOT NULL DEFAULT 0;";
            cmd.ExecuteNonQuery();
        }
    }

    private SqliteConnection Open()
    {
        var conn = new SqliteConnection(_connectionString);
        conn.Open();
        return conn;
    }

    public void Enqueue(ExtractedEvent evt)
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO events (captured_at, process_name, window_title, channel, detected_identity, is_mismatch, confidence, is_foreground)
            VALUES ($capturedAt, $processName, $windowTitle, $channel, $detectedIdentity, $isMismatch, $confidence, $isForeground);
            """;
        cmd.Parameters.AddWithValue("$capturedAt", DateTimeOffset.UtcNow.ToString("o"));
        cmd.Parameters.AddWithValue("$processName", evt.ProcessName);
        cmd.Parameters.AddWithValue("$windowTitle", evt.WindowTitle);
        cmd.Parameters.AddWithValue("$channel", evt.Channel == ActivityChannel.Email ? "email" : "whatsapp");
        cmd.Parameters.AddWithValue("$detectedIdentity", (object?)evt.DetectedIdentity ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$isMismatch", evt.IsMismatch ? 1 : 0);
        cmd.Parameters.AddWithValue("$confidence", evt.Confidence == EventConfidence.High ? "high" : "low");
        cmd.Parameters.AddWithValue("$isForeground", evt.IsForeground ? 1 : 0);
        cmd.ExecuteNonQuery();
    }

    public List<QueuedEvent> GetUnsyncedBatch(int limit)
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT id, captured_at, process_name, window_title, channel, detected_identity, is_mismatch, confidence, is_foreground
            FROM events WHERE synced = 0 ORDER BY id ASC LIMIT $limit;
            """;
        cmd.Parameters.AddWithValue("$limit", limit);

        var result = new List<QueuedEvent>();
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            result.Add(new QueuedEvent(
                reader.GetInt64(0),
                DateTimeOffset.Parse(reader.GetString(1)),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetString(4) == "email" ? ActivityChannel.Email : ActivityChannel.WhatsApp,
                reader.IsDBNull(5) ? null : reader.GetString(5),
                reader.GetInt32(6) == 1,
                reader.GetString(7) == "high" ? EventConfidence.High : EventConfidence.Low,
                reader.GetInt32(8) == 1));
        }
        return result;
    }

    public void MarkSynced(IEnumerable<long> ids)
    {
        var idList = ids.ToList();
        if (idList.Count == 0) return;

        using var conn = Open();
        using var tx = conn.BeginTransaction();
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = "UPDATE events SET synced = 1 WHERE id = $id;";
        var param = cmd.CreateParameter();
        param.ParameterName = "$id";
        cmd.Parameters.Add(param);
        foreach (var id in idList)
        {
            param.Value = id;
            cmd.ExecuteNonQuery();
        }
        tx.Commit();
    }

    /// <summary>Housekeeping: drop already-synced rows older than the retention window.</summary>
    public void PruneSynced(TimeSpan olderThan)
    {
        using var conn = Open();
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = "DELETE FROM events WHERE synced = 1 AND captured_at < $cutoff;";
            cmd.Parameters.AddWithValue("$cutoff", (DateTimeOffset.UtcNow - olderThan).ToString("o"));
            cmd.ExecuteNonQuery();
        }
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = "DELETE FROM window_activity WHERE synced = 1 AND captured_at < $cutoff;";
            cmd.Parameters.AddWithValue("$cutoff", (DateTimeOffset.UtcNow - olderThan).ToString("o"));
            cmd.ExecuteNonQuery();
        }
    }

    public void EnqueueWindowActivity(ScannedWindow window)
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO window_activity (captured_at, process_name, window_title, is_foreground)
            VALUES ($capturedAt, $processName, $windowTitle, $isForeground);
            """;
        cmd.Parameters.AddWithValue("$capturedAt", DateTimeOffset.UtcNow.ToString("o"));
        cmd.Parameters.AddWithValue("$processName", window.ProcessName);
        cmd.Parameters.AddWithValue("$windowTitle", window.WindowTitle);
        cmd.Parameters.AddWithValue("$isForeground", window.IsForeground ? 1 : 0);
        cmd.ExecuteNonQuery();
    }

    public List<QueuedWindowActivity> GetUnsyncedWindowActivityBatch(int limit)
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT id, captured_at, process_name, window_title, is_foreground
            FROM window_activity WHERE synced = 0 ORDER BY id ASC LIMIT $limit;
            """;
        cmd.Parameters.AddWithValue("$limit", limit);

        var result = new List<QueuedWindowActivity>();
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            result.Add(new QueuedWindowActivity(
                reader.GetInt64(0),
                DateTimeOffset.Parse(reader.GetString(1)),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetInt32(4) == 1));
        }
        return result;
    }

    public void MarkWindowActivitySynced(IEnumerable<long> ids)
    {
        var idList = ids.ToList();
        if (idList.Count == 0) return;

        using var conn = Open();
        using var tx = conn.BeginTransaction();
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = "UPDATE window_activity SET synced = 1 WHERE id = $id;";
        var param = cmd.CreateParameter();
        param.ParameterName = "$id";
        cmd.Parameters.Add(param);
        foreach (var id in idList)
        {
            param.Value = id;
            cmd.ExecuteNonQuery();
        }
        tx.Commit();
    }
}
