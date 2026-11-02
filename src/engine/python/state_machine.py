# Every legal state change, in one table.
# If a change is not listed here, the elevator cannot make it:
# the controller asks, the state machine decides.

TRANSITIONS = {
    "IDLE":         ["MOVING_UP", "MOVING_DOWN", "DOOR_OPENING", "EMERGENCY"],
    "MOVING_UP":    ["DOOR_OPENING", "IDLE", "EMERGENCY"],
    "MOVING_DOWN":  ["DOOR_OPENING", "IDLE", "EMERGENCY"],
    "DOOR_OPENING": ["DOOR_OPEN", "EMERGENCY"],
    "DOOR_OPEN":    ["DOOR_CLOSING", "EMERGENCY"],
    "DOOR_CLOSING": ["DOOR_OPENING", "IDLE", "MOVING_UP", "MOVING_DOWN", "EMERGENCY"],
    "EMERGENCY":    ["IDLE", "DOOR_OPENING", "MOVING_UP", "MOVING_DOWN"],
}


class ElevatorStateMachine:
    def __init__(self, trace, clock):
        self.trace = trace
        self.clock = clock
        self.state = "IDLE"
        self.entered_at = 0

    def can(self, next_state):
        return next_state in TRANSITIONS[self.state]

    def transition(self, next_state, reason):
        if next_state == self.state:
            return True

        # Not in the table? Refuse the change.
        if not self.can(next_state):
            self.trace.emit('sm.reject', event="ILLEGAL_TRANSITION_BLOCKED",
                            message=f"{self.state} -> {next_state} is not allowed")
            return False

        previous = self.state
        self.state = next_state
        self.entered_at = self.clock()
        self.trace.emit('sm.transition', event="STATE_TRANSITION",
                        message=f"{previous} -> {next_state}: {reason}")
        return True

    def reset(self):
        self.state = "IDLE"
        self.entered_at = self.clock()
