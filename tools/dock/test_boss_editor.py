import io
import unittest
from unittest.mock import patch

import boss_editor


class BossEditorTests(unittest.TestCase):
    def test_selects_emote_and_sends_unicode_text(self):
        state = {'emote': 'heart', 'text': 'anterior', 'emotes': {'heart': 'iconHeart', 'coffee': 'iconCoffee'}}
        answers = iter(['2', 'Pausa para café'])
        with patch('boss_editor.request', side_effect=[state, {}]) as api:
            self.assertTrue(boss_editor.edit('http://localhost:1', lambda _: next(answers), io.StringIO()))
        api.assert_any_call('http://localhost:1', 'PUT', {'emote': 'coffee', 'text': 'Pausa para café'})

    def test_cancel_and_clear(self):
        state = {'emote': None, 'text': '', 'emotes': {'heart': 'iconHeart'}}
        with patch('boss_editor.request', return_value=state) as api:
            self.assertFalse(boss_editor.edit('http://localhost:1', lambda _: 'q', io.StringIO()))
            self.assertEqual(api.call_count, 1)
        with patch('boss_editor.request', side_effect=[state, {}]) as api:
            self.assertTrue(boss_editor.edit('http://localhost:1', lambda _: '0', io.StringIO()))
            api.assert_any_call('http://localhost:1', 'DELETE')

    def test_catalog_ignores_missing_sprites(self):
        _, names = boss_editor.emote_grid({'heart': 'iconHeart', 'broken': 'missing'}, 'heart', 3)
        self.assertEqual(names, ['heart'])


if __name__ == '__main__':
    unittest.main()
