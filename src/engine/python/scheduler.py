# Decides where the car should go next.
# Same requests + same position always give the same answer.

EPS = 0.01


def collect_stops(ctx):
    stops = []
    for call in ctx.car_calls:
        stops.append({"floor": call.floor, "kind": "car", "time": call.time})
    for call in ctx.hall_calls:
        kind = "hall-up" if call.direction == "UP" else "hall-down"
        stops.append({"floor": call.floor, "kind": kind, "time": call.time})
    return stops


def is_ahead(floor, position, direction):
    if direction == "UP":
        return floor > position + EPS
    return floor < position - EPS


def opposite(direction):
    return "DOWN" if direction == "UP" else "UP"


class RequestScheduler:
    def select_next(self, ctx):
        stops = collect_stops(ctx)
        if not stops:
            return None

        if ctx.algorithm == "CUSTOM":
            return self.run_custom(ctx)

        if ctx.algorithm == "FCFS":
            # First-Come-First-Served: the oldest request wins.
            oldest = min(stops, key=lambda s: s["time"])
            return oldest["floor"]

        if ctx.algorithm == "SSTF":
            # Shortest-Seek-Time-First: always go to the closest request.
            nearest = min(stops, key=lambda s: (abs(s["floor"] - ctx.position), s["time"]))
            return nearest["floor"]

        # SCAN and LOOK: keep going one way, serve everything on the way.
        direction = ctx.direction
        if direction == "NONE":
            nearest = min(stops, key=lambda s: abs(s["floor"] - ctx.position))
            direction = "UP" if nearest["floor"] >= ctx.position else "DOWN"

        for d in (direction, opposite(direction)):
            ahead = [s for s in stops if is_ahead(s["floor"], ctx.position, d)]
            if not ahead:
                continue
            floors = [s["floor"] for s in ahead]
            # Stop at the nearest one in our direction...
            return min(floors) if d == "UP" else max(floors)

        if ctx.algorithm == "SCAN":
            # SCAN always sweeps to the end of the shaft before turning back.
            return ctx.floors if direction == "UP" else 1
        return None

    def run_custom(self, ctx):
        # Challenge mode: call YOUR select_next() and check the answer.
        try:
            floor = self.custom(ctx)
        except Exception as error:
            self.custom_error = f"select_next() crashed: {error}"
            return None
        if floor is None:
            return None
        if not (1 <= floor <= ctx.floors):
            self.custom_error = f"select_next() returned {floor}, expected 1..{ctx.floors}"
            return None
        return floor

    def direction_after_stop(self, ctx):
        # After stopping at a floor, which way does the car continue?
        if ctx.algorithm in ("FCFS", "SSTF", "CUSTOM"):
            return "NONE"
        others = [s for s in collect_stops(ctx) if abs(s["floor"] - ctx.position) > EPS]
        if ctx.direction != "NONE":
            if any(is_ahead(s["floor"], ctx.position, ctx.direction) for s in others):
                return ctx.direction
            back = opposite(ctx.direction)
            if any(is_ahead(s["floor"], ctx.position, back) for s in others):
                return back
        return "NONE"
