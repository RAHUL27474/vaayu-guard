using System.Text.Json;

namespace VaayuMonitor.Agent;

public class DeviceState
{
    public string DeviceId { get; set; } = "";
    public string DeviceToken { get; set; } = "";
    public string AssignedEmail { get; set; } = "";
    public bool ConsentReported { get; set; }

    private static string StatePath(AgentOptions options) =>
        Path.Combine(options.ResolveDataDirectory(), "device.json");

    public static DeviceState? Load(AgentOptions options)
    {
        var path = StatePath(options);
        if (!File.Exists(path)) return null;
        try
        {
            return JsonSerializer.Deserialize<DeviceState>(File.ReadAllText(path));
        }
        catch
        {
            return null; // corrupt file — re-enroll rather than crash
        }
    }

    public void Save(AgentOptions options)
    {
        File.WriteAllText(StatePath(options), JsonSerializer.Serialize(this));
    }
}
