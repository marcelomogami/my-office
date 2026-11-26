import unittest
from office import layout, render, rest_layout
from session_panel import details, face_for


def session(name, skin, status='working', seat='G'):
    return {'name': name, 'skin': skin, 'status': status, 'seat': seat}


class OfficeTest(unittest.TestCase):
    def test_fixed_places_preempt_borrowed_and_keep_other_places(self):
        others = [session('a', 's0'), session('b', 's1'), session('c', 's2'), session('d', 's3'), session('e', 's4')]
        first = layout(others)
        self.assertEqual(first['e'], 4)
        second = layout(others + [session('~detran', 's7')], first)
        self.assertEqual(second['~detran'], 4)
        self.assertEqual([second[n] for n in 'abcd'], [0, 1, 2, 3])
        self.assertEqual(second['e'], 5)

    def test_away_and_home_office_are_not_drawn(self):
        items = [session('a', 's0', 'away'), session('b', 's1', seat=None)]
        self.assertEqual(layout(items), {})
        image = render(items, {})
        self.assertEqual(image.size, (1514, 148))
        self.assertEqual(image.getpixel((960, 0))[3], 0)
        self.assertEqual(image.getpixel((0, 4))[3], 255)

    def test_rest_seats_remain_stable_and_are_released(self):
        class LastChoice:
            @staticmethod
            def choice(options): return options[-1]
        resting = [session('a', 's0', 'idle'), session('b', 's1', 'idle')]
        seats = layout(resting)
        positions = rest_layout(resting, seats, rng=LastChoice())
        self.assertEqual(positions, {'a': 5, 'b': 4})
        self.assertEqual(rest_layout(list(reversed(resting)), seats, positions), positions)
        active = [session('a', 's0'), resting[1]]
        self.assertEqual(rest_layout(active, seats, positions), {'b': 4})

    def test_panel_shows_timer_and_preserves_home_office_done(self):
        s = session('a', 's0', 'idle')
        s['since'] = 1000
        self.assertEqual(details(s, True, 121000), ('a', 'idle', '02m'))
        self.assertEqual(details(s, False, 121000), ('a (home office)', 'done', ''))
        self.assertEqual(details(s, True, 7501000)[2], '2h05m')

    def test_home_office_face_is_stable(self):
        s = session('projeto', None, seat=None)
        self.assertEqual(face_for(s), face_for(s))
        self.assertEqual(face_for(session('chat-ferramentas', None, seat=None)), 's0')

    def test_working_and_resting_draw_different_scenes(self):
        working = [session('a','s0')]
        resting = [session('a','s0','idle')]
        self.assertNotEqual(render(working, layout(working)).tobytes(), render(resting, layout(resting)).tobytes())


if __name__ == '__main__': unittest.main()
