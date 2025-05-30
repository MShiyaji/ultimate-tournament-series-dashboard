"""Script to generate UltRank tiers.

Requirements:
 geopy installed: pip install geopy
 start.gg API key stored in a file 'smashgg.key'
 From the UltRank TTS Scraping Sheet:
  ultrank_players.csv
  ultrank_regions.csv
  ultrank_invitational.csv
"""

from startgg_toolkit import send_request, isolate_slug
from geopy.geocoders import Nominatim
import csv
import re
import sys
import json
import datetime

NUM_PLAYERS_FLOOR = 2

SCORE_FLOOR = {
    1: 250,
    2: 200,
    3: 200
}

ENTRANT_FLOOR = {
    1: 64,
    2: 48,
    3: 32
}

NEW_MULT_SYSTEM_DATE = datetime.date.fromisoformat('2024-12-16')


class PotentialMatchWithDqs:
    def __init__(self, tag, id_, points, note, actual_tag='', dqs=0):
        self.tag = tag.strip()
        self.id_ = id_
        self.points = points
        self.note = note
        self.actual_tag = actual_tag if actual_tag != '' else self.tag
        self.dqs = dqs

    def __str__(self):
        actual_tag_portion = '' if self.actual_tag == self.tag else self.actual_tag + ': '
        dq_portion = '' if self.dqs == 0 else ' - {} DQ{}'.format(
            self.dqs, 's' if self.dqs == 1 else '')
        return '{} (id {}) - {}{} points [{}]{}'.format(self.tag, self.id_, actual_tag_portion, self.points, self.note, dq_portion)


class DisqualificationValue:
    """Stores a player value with DQ count."""

    def __init__(self, value, dqs):
        self.value = value
        self.dqs = dqs

    def __str__(self):
        return '{} - {} DQ{}'.format(str(self.value), str(self.dqs), '' if self.dqs == 1 else 's')


class CountedValue:
    """Stores a counted player value with additional data."""

    def __init__(self, player_value, total_points, alt_tag):
        self.player_value = player_value
        self.points = total_points
        self.alt_tag = alt_tag.strip()
        self.tag = player_value.tag
        self.id_ = player_value.id_

    def __str__(self):
        if self.tag == self.player_value.hex_:
            full_tag = self.tag
        elif self.alt_tag.lower() == self.player_value.tag.lower():
            full_tag = self.alt_tag
        else:
            full_tag = f'{self.alt_tag} (aka {self.player_value.tag})'

        return '{} - {} points [{}]'.format(full_tag, self.points, self.player_value.note)


class PlayerValue:
    """Stores scores for players."""

    def __init__(self, id_, hex_, tag, points=0, category='', note='', start_time=None, end_time=None):
        self.id_ = id_
        self.hex_ = hex_
        self.tag = tag
        self.points = points
        self.category = category
        self.note = note
        self.start_time = start_time
        self.end_time = end_time

    def __str__(self):
        return '{} (id {}) - {} points [{}]'.format(self.tag, self.id_, self.points,  self.note)

    def is_within_timeframe(self, time):
        if self.start_time != None and time < self.start_time:
            return False
        if self.end_time != None and time >= self.end_time:
            return False

        return True


class PlayerValueGroup:
    """Stores multiple scores for players."""

    def __init__(self, id_, hex_, tag, other_tags=[]):
        self.tag = tag
        self.id_ = id_
        self.hex_ = hex_
        self.values = []
        self.invitational_values = []
        self.other_tags = [tag_.lower() for tag_ in other_tags]

    def add_value(self, points, category='', note='', start_time=None, end_time=None):
        self.values.append(PlayerValue(
            self.id_, self.hex_, self.tag, points, category, note, start_time, end_time))

        self.values.sort(reverse=True, key=lambda val: val.points)

    def add_invitational_value(self, points, note='', start_time=None, end_time=None):
        self.invitational_values.append(PlayerValue(
            self.id_, self.hex_, self.tag, points, 'Invitational Value', note, start_time, end_time))

        self.invitational_values.sort(reverse=True, key=lambda val: val.points)

    def retrieve_value(self, tournament, invitational=False):
        value_to_return = None

        for value in self.values:
            if value.is_within_timeframe(tournament.start_time):
                value_to_return = value
                break 

        if invitational:
            for value in self.invitational_values:
                if value.is_within_timeframe(tournament.start_time):
                    if value_to_return is None:
                        value_to_return = PlayerValue('', '', '', 0)
                    return PlayerValue(value.id_, value.hex_, value.tag, category=value_to_return.category, note='{} + Invit. Val. (Rank {})'.format(value_to_return.note, value.note), points=value.points + value_to_return.points)

        return value_to_return

    def match_tag(self, tag):
        return tag.lower() == self.tag.lower() or tag.lower() in self.other_tags


class TournamentTieringResult:
    def __init__(self, slug, score, entrants, region, values, dqs, potential, date, is_invitational=False, phases=[], dq_count=-1):
        self.slug = slug
        self.score = score
        self.values = values
        self.dqs = dqs
        self.potential = potential
        self.date = date
        self.entrants = entrants
        self.region = region
        self.is_invitational = is_invitational
        self.dq_count = dq_count
        self.phases = phases
        self.max_score = None

        name = get_name(slug)
        self.tournament = name['tournament']
        self.event = name['event']

    def using_new_tiering_system(self):
        return self.date > NEW_MULT_SYSTEM_DATE

    def write_result(self, filelike=None):
        original_stdout = sys.stdout

        if filelike != None:
            sys.stdout = filelike

        print('{} - {} ({}){}'.format(self.tournament, self.event,
                                      self.slug, ' (invitational)' if self.is_invitational else ''))
        print('Phases used: {}'.format(str(self.phases)))
        print()

        if not self.should_count():
            print('WARNING: This tournament does not meet the criteria of at least {} entrants or a score of at least {} with {} qualified players'.format(
                self.region.entrant_floor, self.region.score_floor, NUM_PLAYERS_FLOOR))
            print()
        elif not self.should_count_strict():
            print('WARNING: This tournament may not meet the criteria of at least {} entrants or a score of at least {} with {} qualified players'.format(
                self.region.entrant_floor, self.region.score_floor, NUM_PLAYERS_FLOOR))
            print()

        participants_string = '{} - {} DQs = {}'.format(
            self.entrants + self.dq_count, self.dq_count, self.entrants) if self.dq_count != -1 else str(self.entrants)

        if self.date > NEW_MULT_SYSTEM_DATE:
            print_str = 'Entrants: '
            print_str += participants_string
            entrants_score = self.entrants
            if self.region.multiplier >= 2:
                print_str += ' + {} (x2)'.format(str(min(256, self.entrants)))
                entrants_score += min(256, self.entrants)
            if self.region.multiplier >= 3:
                print_str += ' + {} (x3)'.format(str(min(128, self.entrants)))
                entrants_score += min(128, self.entrants)
            if self.region.multiplier == 1:
                print_str += ' (x1)'
            print_str += f' = {entrants_score} [x{self.region.multiplier}, {self.region.note}]'
            print(print_str)

        else:
            print('Entrants: {} x {} [{}] = {}'.format(
                participants_string, self.region.multiplier, self.region.note, self.entrants * self.region.multiplier))

        print()
        print('Top Player Points: ')

        for participant in self.values:
            print('  {}'.format(str(participant)))

        print()
        print('Total Score: {}'.format(self.score))

        if len(self.dqs) > 0:
            print()
            print('-----')
            print('DQs')
            for dq in self.dqs:
                print('  {}'.format(str(dq)))

        if len(self.potential) > 0:
            print()
            print('-----')
            print('Potentially Mismatched Players')
            for match in self.potential:
                print('  {}'.format(str(match)))

        sys.stdout = original_stdout

    def max_potential_score(self):
        if self.max_score != None:
            return self.max_score

        potential_score = self.score

        potential_player_scores = {}

        for pot in self.potential:
            if isinstance(pot, DisqualificationValue):
                potential_player_scores[pot.value.id_] = max(
                    pot.value.points, potential_player_scores.get(pot.value.id_, 0))
            else:
                potential_player_scores[pot.id_] = max(
                    pot.points, potential_player_scores.get(pot.id_, 0))

        dq_scores = {}

        for dq in self.dqs:
            if isinstance(dq.value, CountedValue):
                dq_scores[dq.value.player_value.id_] = dq.value.points
            else:
                dq_scores[dq.value.id_] = max(
                    dq.value.points, dq_scores.get(dq.value.id_, 0))

        for value in potential_player_scores.values():
            potential_score += value

        for value in dq_scores.values():
            potential_score += value

        self.max_score = potential_score

        return potential_score

    def should_count_strict(self):
        return self.entrants >= self.region.entrant_floor or (self.score >= self.region.score_floor and len(self.values) >= NUM_PLAYERS_FLOOR)

    def should_count(self):
        return self.entrants >= self.region.entrant_floor or (self.max_potential_score() >= self.region.score_floor and len(self.values) + len(self.potential) + len(self.dqs) >= NUM_PLAYERS_FLOOR)


class RegionValue:
    """Stores region multipliers."""

    def __init__(self, country_code='', iso2='', county='', city='', state_district='', jp_postal='', multiplier=1, note='', start_time=None, end_time=None):
        self.country_code = country_code
        self.iso2 = iso2
        self.county = county
        self.city = city
        self.state_district = state_district
        self.jp_postal = jp_postal
        self.multiplier = multiplier
        self.entrant_floor = ENTRANT_FLOOR[multiplier]
        self.score_floor = SCORE_FLOOR[multiplier]
        self.note = note
        self.start_time = start_time
        self.end_time = end_time

    def match(self, address, time=None):
        """Compares an address derived from Nominatim module to the stored 
        region.
        Higher number = larger match.
        """
        if time != None:
            if self.start_time != None and time < self.start_time:
                return 0
            if self.end_time != None and time >= self.end_time:
                return 0

        if self.country_code == '':
            return 1

        match = 0

        if address.get('country_code', '') == self.country_code:
            match += 2

            if self.iso2 == '':
                match += 1
            elif address.get('ISO3166-2-lvl4', '') == self.iso2 or address.get('ISO3166-2-lvl3', '') == self.iso2:
                match += 2

                if self.county == '' and self.city == '' and self.state_district == '':
                    match += 1
                elif self.county != '' and address.get('county', '') == self.county:
                    match += 2
                elif self.city != '' and address.get('city', '') == self.city:
                    match += 2
                elif self.state_district != '' and address.get('state_district', '') == self.state_district:
                    match += 2

            if self.country_code == 'jp':
                jp_postal = address.get('postcode', 'XX')[0:2]

                if self.jp_postal == '':
                    match += 1
                elif jp_postal == self.jp_postal:
                    match += 2

        return match

    def __eq__(self, other):
        if not isinstance(other, RegionValue):
            return False

        return self.get_equality_measures == other.get_equality_measures()

    def get_equality_measures(self):
        return (self.country_code,
                self.iso2,
                self.county,
                self.city,
                self.state_district,
                self.jp_postal,
                self.multiplier,
                self.entrant_floor,
                self.score_floor)

    def __hash__(self):
        return hash(self.get_equality_measures())

    def __str__(self):
        ret = ''
        if self.country_code != '':
            ret += '{}'.format(self.country_code)

            if self.iso2 != '':
                ret += '/{}'.format(self.iso2)

                if self.county != '':
                    ret += '/{}'.format(self.county)
                elif self.city != '':
                    ret += '/{}'.format(self.city)
                elif self.state_district != '':
                    ret += '/{}'.format(self.state_district)

            if self.jp_postal != '':
                ret += '/JP Postal {}'.format(self.jp_postal)

        else:
            ret = 'All Other Regions'
        ret += ' [{}] - x{}'.format(self.note, self.multiplier)

        return ret


class Entrant:
    """Wrapper class to store player ids and tags."""

    def __init__(self, id_num, tag):
        self.id_ = id_num
        self.tag = tag

    def __eq__(self, other):
        if not isinstance(other, Entrant):
            return False
        return self.id_ == other.id_ and self.tag == other.tag

    def __str__(self):
        return f'{self.tag} [{self.id_}]'

    def __hash__(self):
        return hash((self.id_, self.tag))


class Tournament:
    """Stores tournament info/metadata."""

    def __init__(self, event_slug, is_invitational=False, location=True):
        """Populates tournament metadata with tournament slug/invitational status."""

        self.event_slug = isolate_slug(event_slug)
        self.is_invitational = is_invitational
        self.tier = None

        self.gather_entrant_counts()
        if location:
            self.gather_location_info()
        else:
            self.address = {'country_code': 'us'}
        self.retrieve_start_time()

    def gather_entrant_counts(self):
        # Check if the event has progressed enough to detect DQs.
        self.total_dqs = -1  # Placeholder value

        event_progressed = check_phase_completed(self.event_slug)

        if event_progressed:
            self.phases = collect_phases(self.event_slug)

            self.dq_list, self.participants = get_dqs(
                self.event_slug, phase_ids=[phase['id'] for phase in self.phases])

            self.total_dqs = 0

            participant_ids = [part.id_ for part in self.participants]

            for player_id, _ in self.dq_list.items():
                if player_id not in participant_ids:
                    self.total_dqs += 1

            self.total_entrants = len(self.participants) + self.total_dqs

        else:
            self.participants = get_entrants(self.event_slug)
            self.dq_list = {}
            self.total_dqs = -1
            self.total_entrants = len(self.participants)
            self.phases = []

        # Comment out if subtracting generic entrant dqs
        self.total_dqs = -1

    def gather_location_info(self):
        geo = Nominatim(user_agent='ultrank', timeout=10)

        query, variables = location_query(self.event_slug)
        resp = send_request(query, variables)

        try:
            self.lat = resp['data']['event']['tournament']['lat']
            self.lng = resp['data']['event']['tournament']['lng']
        except Exception as e:
            print(e)
            print(resp)
            raise e

        if self.lat < -80:
            self.address = {'country_code': 'aq'}
            return

        # Try 10 times
        for i in range(5):
            try:
                self.address = geo.reverse('{}, {}'.format(
                    self.lat, self.lng)).raw['address']
                break
            except Exception:
                print(f'Nominatim error {i}')
                pass

        # print(self.address)

    def retrieve_start_time(self):
        query, variables = time_query(self.event_slug)
        resp = send_request(query, variables)

        try:
            self.start_time = datetime.date.fromtimestamp(
                resp['data']['event']['startAt'])
        except Exception as e:
            print(e)
            print(resp)
            raise e

    def calculate_tier(self):
        """Calculates point value of event."""

        if self.tier != None:
            return self.tier

        # add things up
        total_score = 0

        # Entrant score
        best_match = 0
        best_region = None

        for region in region_mults:
            match = region.match(self.address, time=self.start_time)
            # if match != 0:
            #     print('{} {}'.format(match, str(region)))
            if match > best_match:
                best_region = region
                best_match = match

        if self.start_time > NEW_MULT_SYSTEM_DATE:
            total_score += self.total_entrants

            if best_region.multiplier >= 2:
                total_score += min(256, self.total_entrants)
            if best_region.multiplier >= 3:
                total_score += min(128, self.total_entrants)
        else:
            total_score += self.total_entrants * best_region.multiplier

        # Player values
        valued_participants = []
        potential_matches = []

        for participant in self.participants:
            if participant.id_ in self.dq_list:
                # Only count fully participating players towards points

                continue
            if participant.id_ in scored_players:
                player_value = scored_players[participant.id_].retrieve_value(
                    self, invitational=self.is_invitational)

                if player_value != None:
                    score = player_value.points

                    total_score += score

                    valued_participants.append(CountedValue(
                        player_value, score, participant.tag))
            elif participant.tag.lower() in scored_tags:
                for player_value_group in scored_players.values():
                    if player_value_group.match_tag(participant.tag):
                        player_value = player_value_group.retrieve_value(self, invitational=self.is_invitational)

                        if player_value != None:
                            score = player_value.points
                            potential_matches.append(PotentialMatchWithDqs(
                                participant.tag, participant.id_, score, player_value.note, player_value.tag))

        # Loop through players with DQs
        participants_with_dqs = []

        for participant, num_dqs in self.dq_list.values():
            if participant.id_ in scored_players:
                player_value = scored_players[participant.id_].retrieve_value(
                    self, invitational=self.is_invitational)

                if player_value != None:
                    score = player_value.points

                    participants_with_dqs.append(DisqualificationValue(
                        CountedValue(player_value, score, participant.tag), num_dqs))
            elif participant.tag.lower() in scored_tags:
                for player_value_group in scored_players.values():
                    if player_value_group.match_tag(participant.tag):
                        player_value = player_value_group.retrieve_value(self, invitational=self.is_invitational)

                        if player_value != None:
                            score = player_value.points
                            potential_matches.append(PotentialMatchWithDqs(
                                participant.tag, participant.id_, score, player_value.note, player_value.tag, num_dqs))

        # Sort for readability
        valued_participants.sort(key=lambda p: (-1 * p.points, p.player_value.category, p.player_value.note))
        participants_with_dqs.sort(
            reverse=True, key=lambda p: (p.dqs, p.value.points))
        potential_matches.sort(key=lambda m: (m.dqs, m.tag))

        self.tier = TournamentTieringResult(self.event_slug, total_score, self.total_entrants, best_region, valued_participants,
                                            participants_with_dqs, potential_matches, self.start_time, is_invitational=self.is_invitational,
                                            phases=[phase['name'] for phase in self.phases], dq_count=self.total_dqs)

        return self.tier


def entrants_query(event_slug, page_num=1, per_page=200):
    query = '''query getEntrants($eventSlug: String!, $pageNum: Int!, $perPage: Int!) {
        event(slug: $eventSlug) {
            entrants(
                query: {
                    page: $pageNum,
                    perPage: $perPage
                }
            ){
                pageInfo {
                    totalPages
                }
                nodes {
                    participants {
                        player {
                            gamerTag
                            id
                        }
                    }
                }
            }
        }
    }'''
    variables = '''{{
        "eventSlug": "{}",
        "pageNum": {},
        "perPage": {}
    }}'''.format(event_slug, page_num, per_page)
    return query, variables


def sets_query(event_slug, page_num=1, per_page=50, phases=None):
    """Generates a query to retrieve sets from an event."""

    query = '''query getSets($eventSlug: String!, $pageNum: Int!, $perPage: Int!, $phases: [ID]!) {
  event(slug: $eventSlug) {
    sets(page: $pageNum, perPage: $perPage, filters:{ state: [3], phaseIds: $phases}) {
      pageInfo {
        page
        totalPages
      }
      nodes {
        wPlacement
        winnerId
        slots {
          entrant {
            id
            participants {
              player {
                gamerTag
                id
              }
            }
          }
          standing {
            stats {
              score {
                value
              }
            }
          }
        }
      }
    }
  }
}'''
    variables = '''{{
        "eventSlug": "{}",
        "pageNum": {},
        "perPage": {},
        "phases": {}
    }}'''.format(event_slug, page_num, per_page, f'{phases if phases is not None else "[]"}')
    return query, variables


def phase_list_query(event_slug):
    """Generates a query to retrieve a list of phases from an event."""

    query = '''query getPhases($eventSlug: String!) {
  event(slug: $eventSlug) {
    phases {
      id
      name
      state
      isExhibition
    }
  }
}'''
    variables = '''{{
        "eventSlug": "{}"
    }}'''.format(event_slug)

    return query, variables


def location_query(event_slug):
    """Generates a query to retrieve the location (latitude/longitude)
    of an event.
    """

    query = '''query getLoc($eventSlug: String!) {
  event(slug: $eventSlug) {
    tournament {
      lat
      lng
    }
  }
}'''
    variables = '''{{
        "eventSlug": "{}"
    }}'''.format(event_slug)

    return query, variables


def time_query(event_slug):
    """Generates a query to retrieve the start time of an event.
    """

    query = '''query getLoc($eventSlug: String!) {
  event(slug: $eventSlug) {
    startAt
  }
}'''
    variables = '''{{
        "eventSlug": "{}"
    }}'''.format(event_slug)

    return query, variables


def name_query(event_slug):
    """Generates a query to retrieve tournament and event name given a slug."""

    query = '''query nameQuery($eventSlug: String!) {
  event(slug: $eventSlug) {
    name
    tournament {
      name
    }
  }
}'''
    variables = '''{{
        "eventSlug": "{}"
    }}'''.format(event_slug)

    return query, variables


def get_sets_in_phases(event_slug, phase_ids):
    """Collects all the sets in a group of phases."""

    page = 1

    sets = []

    while True:
        query, variables = sets_query(
            event_slug, page_num=page, phases=phase_ids)
        resp = send_request(query, variables)

        try:
            sets.extend(resp['data']['event']['sets']['nodes'])
        except Exception as e:
            print(e)
            print(resp)
            raise e

        if page >= resp['data']['event']['sets']['pageInfo']['totalPages']:
            break
        page += 1

    return sets


def check_phase_completed(event_slug):
    """Checks to see if any phases are completed."""

    # Get ordered list of phases
    query, variables = phase_list_query(event_slug)
    resp = send_request(query, variables)

    try:
        for phase in resp['data']['event']['phases']:
            if phase.get('state', '') == 'COMPLETED' and not phase.get('isExhibition', True):
                return True
    except Exception as e:
        print(e)
        print(resp)
        raise e

    return False


def collect_phases(event_slug):
    """Collects phases that are part of the main tournament.
    (Hopefully) excludes amateur brackets.
    """

    # Get ordered list of phases
    query, variables = phase_list_query(event_slug)
    resp = send_request(query, variables)

    return [phase for phase in resp['data']['event']['phases'] if not phase['isExhibition']]


def get_entrants(event_slug):
    page = 1
    participants = set()

    while True:
        query, variables = entrants_query(event_slug, page_num=page)
        resp = send_request(query, variables)

        for entrant in resp['data']['event']['entrants']['nodes']:
            try:
                player_data = Entrant(
                    entrant['participants'][0]['player']['id'], entrant['participants'][0]['player']['gamerTag'])

                participants.add(player_data)
            except Exception as e:
                print(e)
                print(resp)
                print(entrant)
                # raise e

        if page >= resp['data']['event']['entrants']['pageInfo']['totalPages']:
            break
        page += 1

    return participants


def get_dqs(event_slug, phase_ids=None):
    """Retrieves DQs of an event."""

    dq_list = {}
    participants = set()

    for set_data in get_sets_in_phases(event_slug, phase_ids):
        if set_data['winnerId'] == None:
            continue

        if len(set_data['slots']) < 2:
            continue
        if set_data['slots'][0]['entrant'] is None or set_data['slots'][1]['entrant'] is None:
            continue

        try:
            loser = 1 if set_data['winnerId'] == set_data['slots'][0]['entrant']['id'] else 0

            player_data_0 = Entrant(set_data['slots'][0]['entrant']['participants'][0]['player']
                                    ['id'], set_data['slots'][0]['entrant']['participants'][0]['player']['gamerTag'])
            player_data_1 = Entrant(set_data['slots'][1]['entrant']['participants'][0]['player']
                                    ['id'], set_data['slots'][1]['entrant']['participants'][0]['player']['gamerTag'])
            player_data_loser = player_data_0 if loser == 0 else player_data_1

            if set_data['slots'][0]['standing'] == None and set_data['slots'][1]['standing'] == None:
                player_id = set_data['slots'][loser]['entrant']['participants'][0]['player']['id']

                if player_id in dq_list.keys():
                    dq_list[player_id][1] += 1
                else:
                    dq_list[player_id] = [player_data_loser, 1]
                continue

            game_count = set_data['slots'][loser]['standing']['stats']['score']['value']

            if game_count == -1:
                player_id = set_data['slots'][loser]['entrant']['participants'][0]['player']['id']

                if player_id in dq_list.keys():
                    dq_list[player_id][1] += 1
                else:
                    dq_list[player_id] = [player_data_loser, 1]
            else:
                # not a dq, record both players as participants
                participants.add(player_data_0)
                participants.add(player_data_1)
        except Exception as e:
            print(set_data)
            print(e)

    return dq_list, participants


def get_name(event_slug):
    query, variables = name_query(event_slug)
    resp = send_request(query, variables)

    return {'event': resp['data']['event']['name'], 'tournament': resp['data']['event']['tournament']['name']}


def read_players():
    players = {}
    tags = set()
    alt_tags = {}

    try:
        with open('ultrank_tags.csv', newline='', encoding='utf-8') as tags_file:
            reader = csv.reader(tags_file)

            for row in reader:
                alt_tag_list = []
                for tag in row[1:]:
                    if tag != '':
                        alt_tag_list.append(tag)

                if len(alt_tag_list) != 0:
                    alt_tags[row[0]] = alt_tag_list

                    for tag in alt_tag_list:
                        tags.add(tag.lower())

    except FileNotFoundError:
        pass

    with open('ultrank_players.csv', newline='', encoding='utf-8') as players_file:
        reader = csv.DictReader(players_file)

        for row in reader:
            id_ = row['Start.gg Num ID']
            if id_ == '':
                id_ = row['Player']
            else:
                id_ = int(id_)

            slug = row['Start.gg Hex ID']

            tag = row['Player'].strip()
            if tag == '':
                continue

            points = int(row['Points'])

            start_date = datetime.date.fromisoformat(
                row['Start Date']) if row['Start Date'] != '' else None
            end_date = datetime.date.fromisoformat(
                row['End Date']) if row['End Date'] != '' else None

            if id_ not in players:
                player_value_group = PlayerValueGroup(
                    id_, slug, tag, other_tags=alt_tags.get(row['Player'], []))
                players[id_] = player_value_group

            players[id_].add_value(points, row['Category'], row['Note'], start_date, end_date)

            tags.add(tag.lower())

    with open('ultrank_invitational.csv', newline='', encoding='utf-8') as invit_file:
        reader = csv.DictReader(invit_file)

        for row in reader:
            id_ = row['Num']
            if id_ == '':
                id_ = row['Name']
            else:
                id_ = int(id_)

            slug = row['Hex']

            start_date = datetime.date.fromisoformat(
                row['Start Date']) if row['Start Date'] != '' else None
            end_date = datetime.date.fromisoformat(
                row['End Date']) if row['End Date'] != '' else None

            if id_ not in players:
                player_value_group = PlayerValueGroup(
                    id_, slug, tag, other_tags=alt_tags.get(row['Name'], []))
                players[id_] = player_value_group

            players[id_].add_invitational_value(
                    int(row['Additional Points']), note=row['Rank'], start_time=start_date, end_time=end_date)

    return players, tags


def read_regions():
    regions = set()

    with open('ultrank_regions.csv', newline='') as regions_file:
        reader = csv.DictReader(regions_file)

        for row in reader:
            start_date = datetime.date.fromisoformat(row['Start Date']) if row['Start Date'] != '' else None
            end_date = datetime.date.fromisoformat(row['End Date']) if row['End Date'] != '' else None

            region_value = RegionValue(country_code=row['country_code'], iso2=row['ISO3166-2'], county=row['county'],
                                       city=row['city'], state_district=row['state_district'], jp_postal=row['jp-postal-code'],
                                       multiplier=int(row['Multiplier']), note=row['Note'], start_time=start_date, end_time=end_date)
            regions.add(region_value)

    return regions


scored_players, scored_tags = read_players()
region_mults = read_regions()

if __name__ == '__main__':
    event_slug = input('input event url: ')

    is_invitational = input('is this an invitational? (y/n) ')
    is_invitational = is_invitational.lower() == 'y' or is_invitational.lower() == 'yes'

    tournament = Tournament(event_slug, is_invitational)

    result = tournament.calculate_tier()
    result.write_result()

    print()
    print('Maximum potential total: {}'.format(
        int(result.max_potential_score())))
