# Owns the one running ElevatorController and moves time forward
# in fixed steps of 1/60 s (same inputs -> same behaviour every time).

FIXED_DT = 1 / 60


class SimRuntime:
    def __init__(self, config):
        self.config = config
        self.events = []
        self.build()

    def build(self):
        self.controller = ElevatorController(self.config)
        self.events = []
        self.controller.trace.subscribe(self.events.append)
        self.controller.trace.begin_chain("Boot")
        self.controller.trace.emit('boot', event="SYSTEM_BOOT",
                                   message=f"Controller online: {self.config.floors} floors")

    def run(self, seconds):
        # The main loop: tick the controller again and again.
        steps = int(seconds / FIXED_DT)
        for _ in range(steps):
            self.controller.tick(FIXED_DT)
