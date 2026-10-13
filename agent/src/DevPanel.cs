using System.Windows.Forms;

namespace VaayuMonitor.Agent;

/// <summary>
/// Local developer panel, opened on the PC with
///   VaayuGuardAgent.exe --dev &lt;developer-code&gt;
/// Only the correct (dashboard-managed) developer code opens it. From here a
/// developer physically at the machine can, for THIS PC:
///   • edit the local send hide-list (tab / email / WhatsApp) — applied on top
///     of the dashboard's per-device filters, dropping data before it is sent;
///   • pause/resume all reporting;
///   • see what the agent is capturing right now, to decide what to filter.
/// Settings are saved to local_dev.json; the running agent picks them up on
/// its next tick without a restart.
/// </summary>
public static class DevPanel
{
    public const string Flag = "--dev";

    public static bool IsDevInvocation(string[] args) =>
        args.Any(a =>
            string.Equals(a, Flag, StringComparison.OrdinalIgnoreCase) ||
            a.StartsWith(Flag + "=", StringComparison.OrdinalIgnoreCase));

    public static void Run(AgentOptions options, string[] args, ILogger logger)
    {
        var code = ExtractCodeArg(args) ?? PromptForCode();
        if (string.IsNullOrWhiteSpace(code))
        {
            logger.LogInformation("Developer panel cancelled — no code entered.");
            return;
        }

        var expected = SecretCodes.Resolve(options, SecretCodes.DeveloperHashFile, options.DeveloperCodeSha256);
        if (!SecretCodes.Matches(code, expected))
        {
            logger.LogWarning("Developer panel refused — incorrect code.");
            ShowMessage("Incorrect developer code.", MessageBoxIcon.Error);
            return;
        }

        RunOnStaThread<object?>(() => { ShowPanel(options); return null; });
    }

    private static string? ExtractCodeArg(string[] args)
    {
        for (var i = 0; i < args.Length; i++)
        {
            var a = args[i];
            if (a.StartsWith(Flag + "=", StringComparison.OrdinalIgnoreCase))
                return a[(Flag.Length + 1)..];
            if (string.Equals(a, Flag, StringComparison.OrdinalIgnoreCase))
                return (i + 1 < args.Length && !args[i + 1].StartsWith('-')) ? args[i + 1] : null;
        }
        return null;
    }

    private static void ShowPanel(AgentOptions options)
    {
        var config = LocalDevConfig.Load(options);

        using var form = new Form
        {
            Text = "VaayuGuard — Developer panel",
            Width = 560,
            Height = 560,
            FormBorderStyle = FormBorderStyle.FixedDialog,
            StartPosition = FormStartPosition.CenterScreen,
            MaximizeBox = false,
            MinimizeBox = false,
        };

        var pause = new CheckBox
        {
            Text = "Pause ALL reporting from this PC (capture and send nothing until resumed)",
            Left = 16,
            Top = 14,
            Width = 510,
            Checked = config.Paused,
        };

        var filtersLabel = new Label { Text = "Hide-list — matching items are never sent from this PC:", Left = 16, Top = 48, Width = 510 };
        var filters = new ListBox { Left = 16, Top = 70, Width = 510, Height = 150 };
        void RefreshFilters()
        {
            filters.Items.Clear();
            foreach (var r in config.Filters) filters.Items.Add($"{r.Target,-9}  {r.Pattern}");
        }
        RefreshFilters();

        var target = new ComboBox
        {
            Left = 16,
            Top = 230,
            Width = 120,
            DropDownStyle = ComboBoxStyle.DropDownList,
        };
        target.Items.AddRange(["tab", "email", "whatsapp"]);
        target.SelectedIndex = 0;

        var pattern = new TextBox { Left = 144, Top = 230, Width = 270 };
        pattern.PlaceholderText = "keyword / email / number to hide";
        var add = new Button { Text = "Add", Left = 420, Top = 229, Width = 50 };
        var remove = new Button { Text = "Remove", Left = 472, Top = 229, Width = 54 };

        add.Click += (_, _) =>
        {
            var p = pattern.Text.Trim();
            if (p.Length == 0) return;
            config.Filters.Add(new LocalFilterRule { Target = (string)target.SelectedItem!, Pattern = p });
            pattern.Clear();
            RefreshFilters();
        };
        remove.Click += (_, _) =>
        {
            if (filters.SelectedIndex >= 0 && filters.SelectedIndex < config.Filters.Count)
            {
                config.Filters.RemoveAt(filters.SelectedIndex);
                RefreshFilters();
            }
        };

        var capturedLabel = new Label { Text = "What this PC is capturing right now (double-click to hide it):", Left = 16, Top = 268, Width = 510 };
        var captured = new ListBox { Left = 16, Top = 290, Width = 510, Height = 140 };
        var refresh = new Button { Text = "Refresh", Left = 16, Top = 436, Width = 90 };

        var currentIdentities = new List<string?>();
        void RefreshCaptured()
        {
            captured.Items.Clear();
            currentIdentities.Clear();
            var device = DeviceState.Load(options);
            var assignedEmail = device?.AssignedEmail ?? "";
            var assignedPhone = device?.AssignedPhone;
            var wa = WhatsAppIdentityStore.TryGetCurrentNumber(options);
            foreach (var w in new WindowScanner().Scan())
            {
                var evt = IdentityExtractor.Classify(w, assignedEmail, assignedPhone, wa);
                var id = evt?.DetectedIdentity;
                currentIdentities.Add(id);
                captured.Items.Add(id is null ? w.WindowTitle : $"[{id}]  {w.WindowTitle}");
            }
        }
        refresh.Click += (_, _) => RefreshCaptured();
        captured.DoubleClick += (_, _) =>
        {
            var i = captured.SelectedIndex;
            if (i < 0) return;
            // Prefill a rule from the selection: if it had a detected identity,
            // hide that identity; otherwise hide by its window title text.
            var id = currentIdentities[i];
            if (!string.IsNullOrEmpty(id))
            {
                target.SelectedItem = id.StartsWith('+') || id.All(char.IsDigit) ? "whatsapp" : "email";
                pattern.Text = id;
            }
            else
            {
                target.SelectedItem = "tab";
                pattern.Text = (string)captured.Items[i]!;
            }
        };
        RefreshCaptured();

        var save = new Button { Text = "Save", Left = 352, Top = 480, Width = 80, DialogResult = DialogResult.OK };
        var cancel = new Button { Text = "Cancel", Left = 440, Top = 480, Width = 80, DialogResult = DialogResult.Cancel };

        form.Controls.AddRange([
            pause, filtersLabel, filters, target, pattern, add, remove,
            capturedLabel, captured, refresh, save, cancel,
        ]);
        form.AcceptButton = save;
        form.CancelButton = cancel;

        if (form.ShowDialog() == DialogResult.OK)
        {
            config.Paused = pause.Checked;
            try
            {
                config.Save(options);
                ShowMessage("Saved. The agent will apply these on its next tick.", MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                ShowMessage($"Could not save: {ex.Message}", MessageBoxIcon.Error);
            }
        }
    }

    private static string? PromptForCode() => RunOnStaThread<string?>(() =>
    {
        using var form = new Form
        {
            Text = "VaayuGuard — Developer panel",
            Width = 380,
            Height = 175,
            FormBorderStyle = FormBorderStyle.FixedDialog,
            StartPosition = FormStartPosition.CenterScreen,
            MaximizeBox = false,
            MinimizeBox = false,
            TopMost = true,
        };
        var label = new Label { Text = "Enter the developer-access code:", Left = 14, Top = 15, Width = 345 };
        var box = new TextBox { Left = 14, Top = 42, Width = 345, UseSystemPasswordChar = true };
        var ok = new Button { Text = "Open", Left = 197, Top = 85, Width = 75, DialogResult = DialogResult.OK };
        var cancel = new Button { Text = "Cancel", Left = 278, Top = 85, Width = 75, DialogResult = DialogResult.Cancel };
        form.Controls.AddRange([label, box, ok, cancel]);
        form.AcceptButton = ok;
        form.CancelButton = cancel;
        return form.ShowDialog() == DialogResult.OK ? box.Text : null;
    });

    private static void ShowMessage(string text, MessageBoxIcon icon) => RunOnStaThread<object?>(() =>
    {
        MessageBox.Show(text, "VaayuGuard Developer", MessageBoxButtons.OK, icon);
        return null;
    });

    private static T RunOnStaThread<T>(Func<T> func)
    {
        T result = default!;
        var thread = new Thread(() => result = func());
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();
        return result;
    }
}
