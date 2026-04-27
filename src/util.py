from datetime import datetime


def get_current_time_string():
    now = datetime.now()
    return now.strftime("%Y-%m-%d_%H-%M-%S")
