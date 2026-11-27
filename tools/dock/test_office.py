import unittest
from office import layout, render, rest_layout
from session_panel import details, face_for, panel_entries


def session(name, skin, status='working', seat='6', face=None):
    return {'name': name, 'skin': skin, 'status': status, 'seat': seat, 'face': face}


class OfficeTest(unittest.TestCase):
    def test_desks_follow_the_backend_numbering(self):
        items = [session(str(n), 'char1', seat=str(n)) for n in range(1, 7)]
        self.assertEqual(layout(items), {'1': 5, '2': 4, '3': 3, '4': 2, '5': 1, '6': 0})
        self.assertEqual(layout([session('a', 'char1', seat='A')]), {})

    def test_away_and_home_office_are_not_drawn(self):
        items = [session('a', 'char1', 'away'), session('b', 'char2', seat=None)]
        self.assertEqual(layout(items), {})
        image = render(items, {})
        self.assertEqual(image.size, (1514, 148))
        self.assertEqual(image.getpixel((960, 0))[3], 0)
        self.assertEqual(image.getpixel((0, 4))[3], 255)

    def test_rest_seats_remain_stable_and_are_released(self):
        class LastChoice:
            @staticmethod
            def choice(options): return options[-1]
        resting = [session('a', 'char1', 'idle', '6'), session('b', 'char2', 'idle', '5')]
        seats = layout(resting)
        positions = rest_layout(resting, seats, rng=LastChoice())
        self.assertEqual(positions, {'a': 7, 'b': 6})
        self.assertEqual(rest_layout(list(reversed(resting)), seats, positions), positions)
        active = [session('a', 'char1'), resting[1]]
        self.assertEqual(rest_layout(active, seats, positions), {'b': 6})

    def test_eight_rest_spots_all_drawn(self):
        from office import REST
        self.assertEqual(len(REST), 8)
        resting = [session(str(i), 'char1', 'idle', str(i % 6 + 1)) for i in range(8)]
        everyone = render(resting, {}, rest_seats={str(i): i for i in range(8)})
        nobody = render(resting, {}, rest_seats={})
        self.assertNotEqual(everyone.tobytes(), nobody.tobytes())

    def test_panel_shows_timer_and_preserves_home_office_done(self):
        s = session('a', 'char1', 'idle')
        s['since'] = 1000
        self.assertEqual(details(s, True, 121000), ('a', 'idle', '02m'))
        self.assertEqual(details(s, False, 121000), ('a (home office)', 'done', ''))
        self.assertEqual(details(s, True, 7501000)[2], '2h05m')

    def test_boss_first_and_eight_session_slots(self):
        sessions = [session(str(i), 'char1') for i in range(9)]
        entries = panel_entries(sessions)
        self.assertEqual([s['name'] for s in entries], ['Boss'] + [str(i) for i in range(8)])
        self.assertEqual(face_for(entries[0]), 'boss')
        self.assertEqual(details(entries[0], False, 0), ('Boss', None, ''))
        self.assertEqual(panel_entries([])[0]['name'], 'Boss')

    def test_home_office_face_is_stable(self):
        s = session('projeto', None, seat=None)
        self.assertEqual(face_for(s), face_for(s))
        self.assertEqual(face_for(session('projeto', None, seat=None, face='char3')), 'char3')

    def test_working_and_resting_draw_different_scenes(self):
        working = [session('a','char1')]
        resting = [session('a','char1','idle')]
        self.assertNotEqual(render(working, layout(working)).tobytes(), render(resting, layout(resting)).tobytes())


class RestDemoTest(unittest.TestCase):
    def test_desk_demo_fills_every_desk(self):
        from office import desk_demo
        sessions, seats, rest = desk_demo(['char2'])
        self.assertEqual(sorted(seats.values()), [0, 1, 2, 3, 4, 5])
        self.assertEqual(sessions[0]['skin'], 'char2')
        self.assertEqual(rest, {})

    def test_rest_demo_fills_every_spot_in_order(self):
        from office import CAST, REST, rest_demo
        sessions, seats, positions = rest_demo(['char3', 'desconhecido', 'char3'])
        self.assertEqual(seats, {})
        self.assertEqual(len(sessions), len(REST))
        self.assertEqual(sessions[0]['skin'], 'char3')
        self.assertEqual(len({s['skin'] for s in sessions}), min(len(REST), len(CAST)))
        self.assertEqual(positions, {s['name']: i for i, s in enumerate(sessions)})


if __name__ == '__main__': unittest.main()
