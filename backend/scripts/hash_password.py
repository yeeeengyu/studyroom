import getpass
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.security import hash_password


if __name__ == "__main__":
    print(hash_password(getpass.getpass("Password: ")))
