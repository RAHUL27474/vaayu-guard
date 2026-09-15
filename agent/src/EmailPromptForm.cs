using System.Windows.Forms;

namespace VaayuMonitor.Agent;

/// <summary>Minimal "enter your assigned email" dialog shown during install.</summary>
public class EmailPromptForm : Form
{
    private readonly TextBox _textBox;

    public string EnteredEmail => _textBox.Text.Trim();

    public EmailPromptForm()
    {
        Text = "VaayuGuard Setup";
        FormBorderStyle = FormBorderStyle.FixedDialog;
        StartPosition = FormStartPosition.CenterScreen;
        MinimizeBox = false;
        MaximizeBox = false;
        ClientSize = new System.Drawing.Size(360, 140);
        TopMost = true;

        var label = new Label
        {
            Text = "Enter the company email address assigned to this PC:",
            Left = 16,
            Top = 16,
            Width = 328,
            Height = 40,
        };

        _textBox = new TextBox { Left = 16, Top = 60, Width = 328 };

        var okButton = new Button { Text = "Install", Left = 184, Top = 96, Width = 80, DialogResult = DialogResult.OK };
        var cancelButton = new Button { Text = "Cancel", Left = 264, Top = 96, Width = 80, DialogResult = DialogResult.Cancel };

        Controls.Add(label);
        Controls.Add(_textBox);
        Controls.Add(okButton);
        Controls.Add(cancelButton);

        AcceptButton = okButton;
        CancelButton = cancelButton;
    }

    /// <summary>Runs the dialog on a dedicated STA thread and returns the entered email, or null if cancelled.</summary>
    public static string? Prompt()
    {
        string? result = null;
        var thread = new Thread(() =>
        {
            using var form = new EmailPromptForm();
            if (form.ShowDialog() == DialogResult.OK && !string.IsNullOrWhiteSpace(form.EnteredEmail))
            {
                result = form.EnteredEmail;
            }
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();
        return result;
    }
}
