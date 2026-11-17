"""Prevent accidental restoration of the removed desktop voice assistant."""
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]
class NoVoiceAssistant(unittest.TestCase):
    def test_no_voice_runtime_or_build_dependencies(self):
        forbidden = ('System.Speech', 'FoxOs.Assistant', 'AssistantHost', 'AssistantSpeech',
                     'AssistantMics', 'SttCatalog', 'ApplyPttHotkey', 'waveInOpen')
        for path in (ROOT / 'cmd').rglob('*'):
            if path.suffix not in ('.cs', '.ps1'): continue
            text = path.read_text(encoding='utf-8-sig')
            for token in forbidden:
                self.assertNotIn(token, text, str(path))
    def test_installer_and_voice_sources_removed(self):
        for name in ('foxstt.ps1', 'foxstt.bat', 'fox-stt.cs', 'fox-assistant.cs',
                     'fox-understand.cs', 'foxstyle/AssistantPage.cs',
                     'foxnodes/AssistantSpeech.cs', 'foxnodes/AssistantHost.cs'):
            self.assertFalse((ROOT / 'cmd' / name).exists(), name)
    def test_text_assistants_remain(self):
        for name in ('ask.ps1', 'friend.ps1'):
            self.assertTrue((ROOT / 'cmd' / name).exists(), name)
if __name__ == '__main__': unittest.main()
