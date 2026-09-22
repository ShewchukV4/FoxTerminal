using System.Windows.Forms;
using FoxOs.Sdk;

namespace FoxOs.Life {

    public interface ILifeHost {
        FoxTheme Theme { get; }
        LifeStore Store { get; }
        AiEngine Ai { get; }
        void ReloadUi();
        void DataChanged(string module);
        void Toast(string text);
        void ShowPage(string id);
        void SaveAll();
    }

    public abstract class LifeView : Panel {
        protected ILifeHost Host;
        protected FoxTheme T { get { return Host.Theme; } }

        protected LifeView(ILifeHost host) {
            Host = host;
            Dock = DockStyle.Fill;
            BackColor = host.Theme.Paper;
            FoxUi.Buffer(this);
        }

        public abstract void Bind();
    }
}
