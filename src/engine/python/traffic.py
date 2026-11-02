# Passenger traffic for Automatic mode.
# People appear on random floors, press the hall button,
# get in when the car comes their way, and press their destination.

import math
import random

CAR_CAPACITY = 8


class TrafficSimulator:
    def __init__(self, config):
        self.config = config
        self.enabled = False
        self.passengers = []
        self.rng = random.Random(config.seed)   # same seed -> same traffic
        self.next_spawn = 0.0

    def riders(self):
        return [p for p in self.passengers if p.state == "RIDING"]

    def waiting(self):
        return [p for p in self.passengers if p.state == "WAITING"]

    def update(self, time, hooks):
        if not self.enabled:
            return
        if time >= self.next_spawn:
            self.spawn(time, hooks)
            mean_gap = 60 / max(0.1, self.config.traffic_rate)
            self.next_spawn = time - math.log(1 - self.rng.random()) * mean_gap

    def spawn(self, time, hooks):
        n = self.config.floors
        origin = self.rng.randint(1, n)
        destination = self.rng.randint(1, n)
        if origin == destination:
            destination = 1 if origin == n else origin + 1
        person = Passenger(origin, destination, time)
        self.passengers.append(person)
        direction = "UP" if destination > origin else "DOWN"
        hooks.call_elevator(origin, direction)

    def exchange(self, time, floor, direction, hooks):
        # Doors are open: riders get out first, then waiting people get in.
        out = 0
        inn = 0
        for p in self.riders():
            if p.destination == floor:
                p.state = "DONE"
                out += 1
        for p in self.waiting():
            if p.origin != floor or len(self.riders()) >= CAR_CAPACITY:
                continue
            p.state = "RIDING"
            p.board_time = time
            inn += 1
            hooks.request_floor(p.destination)
        return out, inn


class Passenger:
    def __init__(self, origin, destination, spawn_time):
        self.origin = origin
        self.destination = destination
        self.spawn_time = spawn_time
        self.state = "WAITING"
