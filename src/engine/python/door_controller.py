# The car door operator: a small motor that slides the car doors.
# The landing (floor) doors are hooked to the car doors by a metal vane,
# so they only open when the car is level with that floor.


class DoorController:
    def __init__(self, config):
        self.config = config
        self.position = 0.0        # 0 = closed, 1 = fully open
        self.status = "CLOSED"
        self.locked = True         # the door lock is part of the safety chain
        self.motor_active = False
        # Light curtain: invisible infrared beams across the doorway
        self.light_curtain = {"blocked": False, "healthy": True}

    def start_opening(self):
        self.locked = False
        self.status = "OPENING"
        self.motor_active = True

    def start_closing(self):
        self.status = "CLOSING"
        self.motor_active = True

    def update(self, dt):
        # Returns "OPENED" or "CLOSED" on the step the doors finish moving.
        rate = dt / self.config.door_travel_time

        if self.status == "OPENING":
            self.position = min(1.0, self.position + rate)
            if self.position >= 1:
                self.status = "OPEN"
                self.motor_active = False
                return "OPENED"

        elif self.status == "CLOSING":
            self.position = max(0.0, self.position - rate)
            if self.position <= 0:
                self.status = "CLOSED"
                self.motor_active = False
                self.locked = True
                return "CLOSED"

        return None
