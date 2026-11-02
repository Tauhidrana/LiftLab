# The safety chain: a row of switches that must ALL be closed for the
# motor to run. In a real elevator they are wired one after another,
# so any single open switch cuts the motor power and drops the brake,
# even if the software goes wrong.

FAULT_LABELS = {
    "doorObstruction":     "Door obstruction",
    "doorSensorFailure":   "Door sensor (light curtain) failure",
    "motorUnavailable":    "Traction motor / drive unavailable",
    "positionSensorFault": "Position sensor malfunction",
    "emergencyStop":       "Emergency stop pressed",
    "powerLoss":           "Mains power loss",
}


class SafetySystem:
    def __init__(self):
        self.faults = set()
        self.governor_tripped = False

    def has(self, fault):
        return fault in self.faults

    def chain(self, doors_locked):
        # Each link: (name, is it OK?)
        return [
            ("Door locks closed",           doors_locked),
            ("Emergency stop circuit",      not self.has("emergencyStop")),
            ("Mains supply",                not self.has("powerLoss")),
            ("Drive / motor ready",         not self.has("motorUnavailable")),
            ("Position feedback plausible", not self.has("positionSensorFault")),
            ("Overspeed governor",          not self.governor_tripped),
        ]

    def can_move(self, doors_locked):
        # May the car move? Every link must be closed.
        open_links = [name for name, ok in self.chain(doors_locked) if not ok]
        return len(open_links) == 0, open_links

    def can_close_doors(self, light_curtain):
        # May the doors close? The doorway must be proven clear.
        if not light_curtain["healthy"]:
            return False, "Light curtain failed self-test"
        if light_curtain["blocked"]:
            return False, "Light curtain beam interrupted"
        return True, None

    def check_overspeed(self, speed, rated_speed):
        # The governor trips if the car goes faster than 115% of rated speed.
        if abs(speed) > rated_speed * 1.15:
            self.governor_tripped = True
        return self.governor_tripped
