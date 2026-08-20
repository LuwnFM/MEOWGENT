import json
import platform
import sys


def main() -> None:
    json.dump(
        {
            "platform": platform.platform(),
            "python": sys.version.split()[0],
        },
        sys.stdout,
    )


if __name__ == "__main__":
    main()